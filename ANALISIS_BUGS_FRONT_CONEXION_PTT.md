# Análisis — Bugs front: Conectar / Desconectar y Push-to-Talk

**Fecha:** 2026-08-03  
**Estado:** fixes B1/B2/B3(mínimo) + labels **implementados** en código  
**Alcance:** frontend (`src/app/App.tsx`, `BottomToolbar.tsx`, `useRealtimeSession.ts`, `postComparacionContinuar.ts`)  
**Relacionado:** `PLAN_MIGRACION_REALTIME_BETA_GA.md` (§9: `session.type` obligatorio en GA)

---

## Resumen

| # | Síntoma | Estado | Causa raíz |
|---|---------|--------|------------|
| **B1** | Auto-connect OK; botón rojo **no desconecta** — sesión sigue abierta | **Cerrada** | Cleanup usa `removeListener`; SDK solo tiene `off` → `TypeError` aborta `disconnect` antes de `close()` |
| **B2** | Checkbox PTT → error `Missing required parameter: 'session.type'` | **Cerrada** | `session.update` en `updateSession` sin `session.type: "realtime"` |
| **B3** | Con checkbox tildado, audio dispara respuesta sin pulsar **Hablar** | **Cerrada** (cascada) | B2 impide aplicar `turn_detection: null` → VAD sigue activo |

**Veredicto:**
1. **B1:** click en “Desconectado” → `TypeError: removeListener is not a function` → no hay `close()` ni `DISCONNECTED`.
2. **B2/B3:** falta `type: "realtime"` en cada `session.update` del cliente.

---

## Contexto histórico

El front nace del **demo Realtime Agents de OpenAI**:

1. Al cargar, con agente seleccionado → **auto-connect** (esperado; no es bug).
2. Botón inferior = toggle Connect / Disconnect.
3. Checkbox = modo PTT; **Hablar** = hold-to-talk.

Migración beta → GA (`a82749f`): token `client_secrets`, forma de `session.update`, eventos transcript, SDK `@openai/agents` 0.11.x. Eso restauró **conectar y hablar**.

**No se tocó ni se probó:**
- Labels / wiring del botón en `BottomToolbar.tsx`
- Camino **disconnect** end-to-end
- PTT en vivo (`session.type` en updates)

Traducción del demo: `"Disconnect"` → **`"Desconectado"`** (estado) en vez de **`"Desconectar"`** (acción). Copy secundario; el fallo funcional es el `TypeError` del cleanup.

---

## Contexto UI

`src/app/components/BottomToolbar.tsx`

| Control | Rol real | Captura reportada |
|---------|----------|-------------------|
| Botón rojo **"Desconectado"** | Debería desconectar | `CONNECTED` (sesión activa) |
| Checkbox (label oculto) | Activa PTT (`isPTTActive`) | Desmarcado |
| Botón **"Hablar"** | Hold-to-talk | Disabled si `!isPTTActive` |

---

## B1 — Desconectar no corta la sesión (**causa raíz confirmada**)

### Síntoma

1. Abrir front → sesión inicia sola (auto-connect). OK.
2. Botón rojo **"Desconectado"** (= UI en `CONNECTED`).
3. Click para cortar → **no desconecta**; mic / agente / WebRTC siguen.
4. Consola muestra `TypeError` (ver abajo).

### Evidencia de consola (2026-08-03)

```text
TypeError: e.removeListener is not a function.
(In 'e.removeListener("agent_tool_end", i)', 'e.removeListener' is undefined)
```

### Cadena causal (confirmada)

```
click "Desconectado"
  → onToggleConnection()
  → disconnectFromRealtime()
  → disconnect()                          // useRealtimeSession.ts
      → postComparacionCleanupRef.current?.()   // 1ª línea — EXPLOTA
      → sessionRef.close()                      // nunca llega
      → sessionRef = null                       // nunca llega
      → updateStatus('DISCONNECTED')            // nunca llega
```

Cleanup que falla (`chatSupervisor` adjunta handlers post-comparación):

```88:93:src/app/lib/postComparacionContinuar.ts
  return () => {
    clearNudgeTimeout();
    session.removeListener('agent_tool_end', onToolEnd);
    session.removeListener('agent_tool_start', onToolStart);
    session.removeListener('audio_stopped', onAudioStopped);
  };
```

API real del SDK en browser (`BrowserEventEmitter` / `RuntimeEventEmitter`):

| Método | ¿Existe? |
|--------|----------|
| `on` | sí |
| `off` | sí |
| `emit` | sí |
| `once` | sí |
| `removeListener` | **no** (eso es Node `EventEmitter`) |

Sin `close()` ni cambio de status → sesión WebRTC viva y botón sigue rojo.

### Auto-connect (diseño, no bug)

```153:157:src/app/App.tsx
  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);
```

Deps solo `[selectedAgentName]` → un disconnect manual exitoso **no** debería re-conectar solo.

### Hardening posterior (no necesario para el síntoma actual)

| ID | Tema | Prioridad tras fix B1.1 |
|----|------|-------------------------|
| B1.2 | `connect()` async sin generation id / sesiones huérfanas / sin cleanup on unmount | Media — prevenir regresiones |
| B1.3 | Doble status (hook + `sessionStatus` en App) | Baja |
| B1.4 | Label `"Desconectado"` → `"Desconectar"` / `"Conectar"` | Baja (UX) |

---

## B2 — Checkbox tira `session.type` (**confirmado**)

### Evidencia (logs Events)

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "code": "missing_required_parameter",
    "message": "Missing required parameter: 'session.type'.",
    "param": "session.type"
  }
}
```

### Cadena

1. Tildar checkbox → `setIsPTTActive(true)`.
2. Effect `[isPTTActive]` → `updateSession()`.
3. Payload actual:

```288:297:src/app/App.tsx
    sendEvent({
      type: 'session.update',
      session: {
        audio: {
          input: {
            turn_detection: turnDetection,
          },
        },
      },
    });
```

4. Falta `session.type: "realtime"`. En GA es **obligatorio en cada** `session.update`.

| Campo | Actual | Esperado |
|-------|--------|----------|
| `session.type` | ausente → error | `"realtime"` |
| `session.audio.input.turn_detection` | `server_vad` \| `null` | OK (forma anidada) |

`/api/session` (client_secrets) **sí** manda `type` al crear el secret; el cliente no lo reenvía en updates en vivo.

Mismo `updateSession` corre al pasar a `CONNECTED` → si falla, PTT persistido en `localStorage` tampoco apaga el VAD al conectar.

---

## B3 — Audio sin pulsar Hablar (**cascada de B2**)

| Modo UI | `turn_detection` esperado | Hoy |
|---------|---------------------------|-----|
| Checkbox off | `server_vad` + `create_response: true` | OK (default sesión) |
| Checkbox on | `null` (solo Hablar hace commit + `response.create`) | **No aplica** — `session.update` rechazado (B2) |

Con PTT “activo” en UI, el servidor sigue con VAD → respuestas sin pulsar Hablar.

### Gap de producto (después de arreglar B2)

Aunque `turn_detection: null` se aplique, el mic WebRTC **sigue subiendo audio**; PTT solo evita auto-response. `mute()` hoy está ligado a reproducción (`isAudioPlaybackEnabled`), no a PTT.

Decisión pendiente: ¿B3 = “no respuesta automática” (mínimo) o “no stream de audio hasta Hablar” (estricto + mute input)?

---

## Mapa causa → síntoma

```
[Checkbox PTT]
  → updateSession() → session.update
       ├─ sin session.type ──► invalid_request_error          (B2)
       └─ update rechazado ──► VAD sigue ──► habla sin Hablar (B3)

[Botón Desconectar]   auto-connect al load = diseño OK
  → disconnect() → cleanup postComparacionContinuar
       → removeListener (no existe) ──► TypeError
       → close() / DISCONNECTED nunca corren ──► sesión vive   (B1)
```

---

## Archivos implicados

| Archivo | Rol |
|---------|-----|
| `src/app/lib/postComparacionContinuar.ts` | **B1:** cleanup `removeListener` → debe ser `off` |
| `src/app/hooks/useRealtimeSession.ts` | **B1:** `disconnect` sin `try/finally`; connect/mute |
| `src/app/App.tsx` | **B2/B3:** `updateSession`; toggle conexión; PTT |
| `src/app/components/BottomToolbar.tsx` | Labels / disabled |
| `src/app/api/session/route.ts` | Referencia correcta: ya incluye `session.type` |

---

## Fix propuesto (especificación; no implementado)

### B1 (bloqueante UX desconectar)

1. En `postComparacionContinuar.ts`: `session.off(...)` en los tres eventos.
2. En `disconnect`: `try/finally` → siempre `close()` + `sessionRef = null` + `DISCONNECTED`, aunque el cleanup falle.
3. (Opcional hardening) `connectGeneration`, cleanup on unmount, una sola fuente de status.
4. Labels: **"Desconectar"** / **"Conectar"**.

### B2 (bloqueante PTT)

```js
session: {
  type: "realtime",
  audio: {
    input: {
      turn_detection: turnDetection, // server_vad | null
    },
  },
}
```

Único call site crítico hoy: `updateSession` en `App.tsx`.

### B3

1. Depende de B2.
2. Mínimo: VAD off con PTT on.
3. Estricto (si se decide): `mute(true)` input mientras PTT y no se está hablando.

---

## Plan de verificación (post-fix)

| ID | Pasos | Esperado |
|----|-------|----------|
| T1 | Load app | Auto-connect; label **Desconectar** (tras fix copy) |
| T2 | Click Desconectar | **Sin** TypeError; botón **Conectar**; mic/agente muertos |
| T3 | Click Conectar | CONNECTED; sin error `session.type` |
| T4 | Tildar checkbox | Sin error en Events; Hablar habilitado |
| T5 | PTT on, hablar sin botón | **No** respuesta del agente |
| T6 | Mantener Hablar → soltar | Una respuesta; transcript |
| T7 | Destildar checkbox | VAD vuelve |

---

## Criterio de cierre

- [x] **B1 (código):** `off` + `try/finally` en disconnect; labels Desconectar/Conectar
- [x] **B2 (código):** `session.type: "realtime"` en `updateSession`
- [x] **B3 (código mínimo):** depende de B2 — VAD off cuando PTT on
- [ ] **Verificación manual T1–T7** (pendiente en runtime)
- [ ] B3 estricto (mute input) — no implementado; decisión de producto pendiente
- [ ] Hardening B1.2–B1.3 — no implementado
