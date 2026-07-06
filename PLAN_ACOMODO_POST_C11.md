# Plan de implementación — Acomodo post-C11 (Opción B)

**Versión:** 1.3  
**Fecha:** 2026-07-03 (última actualización de estado: 2026-07-06)  
**Estado:** Opción B **implementada y desplegada** — QA parcial OK; **fix B revertido**; bloqueante abierto **P1-F6** (`audio_stopped` temprano)  
**HEAD `main`:** `eecb2b7`  
**Proyecto:** `openai-realtime-agents-main-2`  
**Relacionado con:** `PLAN_COPY_NATURAL_AGENTE.md` (C11), `PLAN_RATE_LIMIT_EXAMEN.md` (P2), `PLAN_FEEDBACK_CLIENTE_EXAMEN.md` (§2.3.8 auto_chain), `PLAN_REANCLAJE_POST_COMPARATIVA_LENTES.md` (§4.4)

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Problema observado](#2-problema-observado)
3. [Diseño objetivo — Opción B](#3-diseño-objetivo--opción-b)
4. [Consulta: fricción si el agente llama `obtenerEtapa` antes del delay](#4-consulta-fricción-si-el-agente-llama-obteniretapa-antes-del-delay)
5. [Cambios por archivo](#5-cambios-por-archivo)
6. [Copy C11 v2](#6-copy-c11-v2)
7. [Orden de deploy](#7-orden-de-deploy)
8. [Plan de QA](#8-plan-de-qa)
9. [Decisiones](#9-decisiones)
10. [Riesgos y mitigaciones](#10-riesgos-y-mitigaciones)
11. [Fuera de alcance](#11-fuera-de-alcance)
12. [Referencias](#12-referencias)
13. [Estado actual y QA](#13-estado-actual-y-qa)

---

## 1. Resumen ejecutivo

El ritual post-comparación (C11 + `postComparacionContinuar`) hoy coloca el **acomodo ocular antes** del mensaje verbal y deja un **descanso corto después** de C11. Eso invierte la experiencia clínica deseada.

**Opción B** reordena el flujo sin cambiar el contrato `postComparacionContinuar` + `auto_chain`:

```
Paciente elige → reanclar rápido → C11 inmediato → 6 s silencio (lente elegido) → cambiar lente → nueva pregunta
```

| Capa | Hoy | Opción B |
|------|-----|----------|
| Servidor pre-C11 (`POST_COMPARACION_ESPERA_SEG`) | 6 s dentro del HTTP 1 | **0 s** (eliminar) |
| Cliente post-C11 (`POST_COMPARACION_CLIENT_PAUSE_MS`) | 2 s | **6 s** |
| Copy C11 | Pasado (*"volvemos a tu selección"*) | Presente (*"quedate con este lente"*) |
| HTTP 1 tras elección | ~10–12 s bloqueante | ~2–4 s |

**Alcance:** 3 ramas del motor con ritual, `postComparacionContinuar.ts`, variantes C11, ajuste menor de prompt, hardening anti-doble-llamada.

---

## 2. Problema observado

### 2.1 Evidencia (sesión 2026-07-03 ~16:23)

| Evento | Timestamp | Δ |
|--------|-----------|---|
| Paciente: *"con el anterior"* | 16:23:23.413 | — |
| `obtenerEtapa` HTTP 1 (reanclaje + espera servidor) | 16:23:23.698 → 35.758 | **~12 s** |
| C11: *"Bueno, volvemos a tu selección."* | 16:23:36.053 | +0,3 s |
| `auto_chain: postComparacionContinuar` | 16:23:38.533 | **+2,5 s** tras C11 |
| `obtenerEtapa` HTTP 2 (cambia lente) | 16:23:38.701 | +0,2 s |
| Nueva comparación C12 | 16:23:42.264 | +3,6 s |

### 2.2 Desajuste clínico

1. **Acomodo real** ocurre en silencio **antes** de C11 (reanclaje + `POST_COMPARACION_ESPERA_SEG` dentro del HTTP 1).
2. C11 confirma algo que **ya pasó** (*"volvemos a tu selección"* con el lente ya en cara hace segundos).
3. **Tras C11**, solo **~2 s** (`POST_COMPARACION_CLIENT_PAUSE_MS`) antes del cambio al nuevo lente.
4. Subir `POST_COMPARACION_ESPERA_SEG` en servidor **empeora** la percepción: más silencio pre-verbal, mismo gap post-C11.

### 2.3 Flujo actual (invertido)

```
Paciente elige
    │
    ▼
┌─────────────────────────────────────┐
│ HTTP 1 (~12 s)                      │
│  • reanclar al lente elegido        │
│  • esperar 6 s  ← ACOMODO REAL      │  sin voz del agente
│  • devolver C11                     │
└─────────────────────────────────────┘
    │
    ▼
  C11 (TTS ~1 s)
    │
    ▼
  pausa 2 s (cliente)  ← ACOMODO PERCIBIDO (corto)
    │
    ▼
┌─────────────────────────────────────┐
│ HTTP 2 (deferred)                   │
│  • cambiar al nuevo lente           │
│  • nueva pregunta                   │
└─────────────────────────────────────┘
```

---

## 3. Diseño objetivo — Opción B

### 3.1 Flujo objetivo

```
Paciente elige
    │
    ▼
┌─────────────────────────────────────┐
│ HTTP 1 (~2–4 s)                     │
│  • reanclar al lente elegido        │
│  • esperar_foroptero (~1–2 s)       │
│  • devolver C11 (sin espera extra)  │
└─────────────────────────────────────┘
    │
    ▼
  C11 — inicio del descanso verbal
  "Quedate un momento con este lente..."
    │
    ▼
  pausa 6 s (cliente, post audio_stopped)
  foróptero SIN mover — deferred pendiente
    │
    ▼
  auto_chain → __POST_COMPARACION_CONTINUAR__
    │
    ▼
┌─────────────────────────────────────┐
│ HTTP 2 (deferred)                   │
│  • cambiar al nuevo lente           │
│  • nueva pregunta C12               │
└─────────────────────────────────────┘
```

### 3.2 Por qué la espera va en el cliente (post-C11)

| Criterio | Cliente post-C11 | Servidor en deferred |
|----------|------------------|----------------------|
| Lente elegido fijo durante pausa | ✅ deferred aún no ejecutado | ✅ pero HTTP 2 bloquea |
| Alineado con fin del TTS | ✅ `audio_stopped` | ❌ arranca al `auto_chain` |
| HTTP 1 rápido | ✅ | ✅ |
| Un solo knob clínico | `POST_COMPARACION_CLIENT_PAUSE_MS` | `POST_COMPARACION_ESPERA_SEG` en deferred |

**Decisión:** mover la espera clínica al **cliente** (`postComparacionContinuar.ts`). El servidor solo reancla y devuelve C11; el deferred se ejecuta cuando el cliente dispara `auto_chain` tras 6 s.

### 3.3 Contrato que NO cambia

- `postComparacionContinuar: true` + `requiereRespuestaPaciente: false` en motor.
- Señal `__POST_COMPARACION_CONTINUAR__` + breadcrumb `auto_chain: postComparacionContinuar`.
- Prompt: el agente **no** debe pedir confirmación tras C11; solo la señal interna encadena `obtenerEtapa({})`.
- Casos sin ritual (`preferencia: actual`, `noOpSiguiente`) — sin cambios (§4.4 `PLAN_REANCLAJE…`).

---

## 4. Consulta: fricción si el agente llama `obtenerEtapa` antes del delay

### 4.1 Respuesta corta

**Sí, hay fricción** — clínica y técnica. El agente **no debe** llamar `obtenerEtapa` antes de la señal interna. Si lo hace, se acorta o anula el acomodo y puede reaparecer la **regresión de doble llamada** (`examen-registro-8`).

### 4.2 Comportamiento del cliente hoy

```ts
// postComparacionContinuar.ts (simplificado)

onToolEnd   → postComparacionContinuar ? pending = true
onAudioStopped → pending = false; schedule nudge en POST_COMPARACION_CLIENT_PAUSE_MS
onToolStart → si obtenerEtapa && pending → clearNudgeTimeout()
```

**Problema:** `onAudioStopped` pone `pending = false` **antes** de programar el timeout. Durante los 6 s de espera, `pending` ya es `false`.

Si el modelo llama `obtenerEtapa({})` en ese intervalo:

| Efecto | Consecuencia |
|--------|--------------|
| **Clínico** | `ejecutarDeferredPostComparacionSiHay()` corre de inmediato → **cambia el lente antes de los 6 s** |
| **Técnico** | `onToolStart` **no** cancela el timeout (`pending === false`) → a los 6 s el `auto_chain` **igual dispara** |
| **Regresión** | Segundo `obtenerEtapa({})` con `deferredPostComparacion` ya consumido → puede **re-preguntar** en `faseComparacion === 'preguntando'` (mismo bug que `examen-registro-8`, commit `54c1ef0`) |

### 4.3 Escenarios

| Escenario | ¿Pasa hoy con 2 s? | ¿Empeora con 6 s? |
|-----------|-------------------|-------------------|
| Agente obedece prompt (solo nudge) | ✅ OK | ✅ OK |
| Agente llama `obtenerEtapa` **antes** de `audio_stopped` | Salta pausa; `onToolStart` cancela nudge si `pending` aún true | Igual |
| Agente llama `obtenerEtapa` **durante** la pausa post-`audio_stopped` | ⚠️ Doble llamada posible | ⚠️ **Ventana 3× más larga** |
| Paciente dice "listo"/"bien" en silencio | Prompt ignora; VAD podría disparar turno | Más exposición con 6 s |

### 4.4 Mitigación obligatoria (incluir en implementación)

**P0 — Hardening en `postComparacionContinuar.ts`:**

Introducir flag `nudgeScheduled` (o equivalente) independiente de `pending`:

```ts
let nudgeScheduled = false;

onAudioStopped → nudgeScheduled = true; schedule timeout
onToolStart (obtenerEtapa) → si nudgeScheduled: clearNudgeTimeout(); nudgeScheduled = false
timeout fires → nudgeScheduled = false; sendMessage(nudge)
```

Así **cualquier** `obtenerEtapa` durante la ventana de espera cancela el nudge pendiente → sin doble llamada.

**P1 — Prompt (ya existente, reforzar):**

- Tras C11: **prohibido** llamar `obtenerEtapa` hasta `__POST_COMPARACION_CONTINUAR__`.
- Cero texto al paciente en el turno de la señal.

**P2 — QA explícito:**

- Logs: exactamente **un** `obtenerEtapa` entre C11 y C12.
- Si hay dos: falla de regresión.

### 4.5 ¿Por qué no poner los 6 s solo en el servidor (deferred)?

Evita la carrera agente-vs-nudge en el cliente, pero el paciente queda en silencio **durante un HTTP largo** sin que el agente hable. La pausa post-TTS en cliente mantiene al paciente en el ritual verbal antes del silencio. Si en QA el modelo sigue llamando temprano, fallback: `esperar 6 s` al inicio de `ejecutarDeferredPostComparacionSiHay` **además** del cliente (defensa en profundidad).

---

## 5. Cambios por archivo

### 5.1 `reference/foroptero-server/motorExamen.js`

| ID | Cambio | Ubicación ~ |
|----|--------|-------------|
| **M1** | **Eliminar** bloque `esperar POST_COMPARACION_ESPERA_SEG` pre-return C11 en ETAPA_5 intra-test (`necesitaRitualPost`) | ~2164–2166 |
| **M2** | **Eliminar** mismo bloque en ritual inter-test (`ETAPA_5_RITUAL_INTER_TEST_COMPLETAR`) | ~2070–2072 |
| **M3** | **Eliminar** mismo bloque en ETAPA_6 binocular post-esfera con reanclaje | ~2267–2269 |
| **M4** | Actualizar variantes C11 (§6) en `MSG_POST_COMPARACION_LENTES_VARIANTES` | ~973–977 |
| **M5** | Comentario en `POST_COMPARACION_ESPERA_SEG`: reservado para documentación o uso futuro en deferred; **no** usar pre-C11 | ~1836 |

**Mantener sin cambios:**

- `pasosReanchor` + `esperar_foroptero`
- `deferredPostComparacion` + `postComparacionContinuar: true`
- `ejecutarDeferredPostComparacionSiHay()` — sin espera extra en v1

### 5.2 `src/app/lib/postComparacionContinuar.ts`

| ID | Cambio |
|----|--------|
| **C1** | `POST_COMPARACION_CLIENT_PAUSE_MS` — inicial 6000, ajustado a **4000** (`6c2a1ea`) |
| **C2** | Flag `nudgeScheduled` + cancelar timeout en **cualquier** `onToolStart` de `obtenerEtapa` mientras el nudge esté programado (§4.4) |
| **C3** | Actualizar comentario: pausa clínica post-C11, no solo TPM |

### 5.3 `src/app/agentConfigs/chatSupervisor/index.ts`

| ID | Cambio |
|----|--------|
| **A1** | En REGLA POST-COMPARACIÓN: tras C11 el paciente debe **mirar en silencio** con el lente elegido; no pedir confirmación |
| **A2** | Reforzar: **prohibido** `obtenerEtapa` entre C11 y la señal `__POST_COMPARACION_CONTINUAR__` |

### 5.4 Documentación

| Archivo | Actualización |
|---------|---------------|
| `DOCUMENTACION.md` | Ritual: reanclaje rápido → C11 → 6 s cliente → deferred |
| `PLAN_RATE_LIMIT_EXAMEN.md` | P2 pasa de 2 s TPM a 6 s acomodo; nota eliminación espera pre-C11 |
| `PLAN_COPY_NATURAL_AGENTE.md` | C11 v2 + decisión D11 |

---

## 6. Copy C11 v2

Reemplazar variantes orientadas al pasado por copy que marque el **inicio** del descanso:

| Var | Texto actual | Texto propuesto (Opción B) |
|-----|--------------|----------------------------|
| V1 | *Bueno, volvemos a tu selección.* | *Quedate un momento con este lente, mirá con calma.* |
| V2 | *Perfecto, seguimos con el lente que elegiste.* | *Conservá el lente que elegiste unos segundos, fijate bien.* |
| V3 | *Bien, me quedo con la opción elegida y continuamos.* | *Perfecto, mantené este lente un instante antes de seguir.* |

**Criterios:**

- Monólogo; **no** pregunta.
- Routing por `postComparacionContinuar`, no por texto.
- Verbatim en agente (D08).
- Validación tono con operador clínico antes de deploy (D10).

---

## 7. Orden de deploy

| Paso | Componente | Dónde | Notas |
|------|------------|-------|-------|
| 1 | M1–M5 + C11 v2 | Railway (motor) | HTTP 1 rápido |
| 2 | C1–C3 | Cliente Next.js | 6 s post-C11 + hardening |
| 3 | A1–A2 | Agente (prompt) | Mismo deploy que cliente |

**Importante:** si se deploya motor **sin** cliente, queda HTTP 1 rápido + solo 2 s post-C11 (peor que hoy en el tramo post-verbal). **Cliente debe ir con o inmediatamente después del motor.**

---

## 8. Plan de QA

### 8.1 Criterios de timing (logs UI)

Tras paciente elige `anterior` / `igual` con ritual:

| Métrica | Objetivo (diseño) | Resultado QA (registro-18/19) |
|---------|-------------------|-------------------------------|
| Δ(paciente → C11 en transcript) | **< 5 s** | ✅ Mayoría OK; ⚠️ HTTP 1 variable 2–10 s |
| Δ(**fin audible** C11 → `auto_chain`) | **≈ 4 s** (±0,5 s) — valor actual `POST_COMPARACION_CLIENT_PAUSE_MS` | ❌ **~1–2 s percibidos** (P1-F6: timer en `audio_stopped` temprano) |
| Δ(inicio C11 en transcript → `auto_chain`) | — (métrica engañosa) | ~4,7–7 s — incluye TTS; no usar como criterio clínico |
| Δ(`auto_chain` → cambio foróptero en CSV) | **< 1 s** inicio HTTP 2 | ✅ |
| `obtenerEtapa` entre C11 y C12 | **exactamente 1** | ✅ |

### 8.2 Regresión obligatoria

- [x] `"con este lente"` / `preferencia: actual` → sin C11, cambio directo — `examen-registro-18` ciclo 4, `examen-registro-19` no aplica en ventana exportada
- [ ] `noOpSiguiente` → sin ritual — no ejercitado en registros 18/19
- [ ] Ritual inter-test (grueso→fino) → C11 + pausa + siguiente test — no ejercitado en registros 18/19
- [ ] ETAPA_6 binocular con reanclaje → mismo patrón — no ejercitado en registros 18/19
- [x] Sin preguntas comparativas duplicadas (anti `examen-registro-8`) — OK en registros 18/19
- [x] Paciente no intercala turno entre C11 y C12 — OK en registros 18/19

### 8.3 Evidencia

| Archivo | Sesión | Notas |
|---------|--------|-------|
| `registros-examen/examen-registro-18.csv` | 2026-07-03 16:39–16:44 | QA Opción B post-deploy; 5 rituales C11 + 1 sin ritual |
| `registros-examen/examen-registro-19.csv` | 2026-07-03 16:55–16:57 | Pausa 4 s; síntoma P1-F6 (timer mid-TTS) |
| Capturas UI operador | 2026-07-03 ~16:23, 16:57 | Timestamps ms para correlación |

---

## 9. Decisiones

| ID | Decisión | Estado |
|----|----------|--------|
| **D01** | Opción B: espera clínica **post-C11** en cliente, no pre-C11 en servidor | ✅ Cerrada |
| **D02** | Duración pausa cliente: **6 s** inicial → ajustada a **4 s** tras QA (`6c2a1ea`) | ✅ Cerrada (valor actual: 4 s) |
| **D03** | C11 v2 con copy prospectivo (*"quedate con este lente"*) | ✅ Cerrada |
| **D04** | Hardening `nudgeScheduled` obligatorio (anti doble `obtenerEtapa`) | ✅ Cerrada |
| **D05** | No gatear VAD durante pausa (igual que Fase 1b) | ✅ Cerrada |
| **D08** | Fix B: timer en `response.output_audio_transcript.done` en lugar de `audio_stopped` | ❌ **Revertido** (`eecb2b7`) — empeoró comportamiento en campo |
| **D06** | Espera en deferred servidor como fallback — solo si QA muestra llamadas tempranas del modelo | Abierta |
| **D07** | Validación tono C11 v2 con operador clínico | Pendiente |
| **D09** | Próximo fix del trigger post-C11 (P1-F6) — pendiente definición de enfoque | **Abierta — bloqueante clínico** |

---

## 10. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Modelo llama `obtenerEtapa` antes del nudge | Media | C2 `nudgeScheduled`; prompt A2; QA §8.1 |
| Doble pregunta comparativa | Media si no C2 | Regresión `examen-registro-8`; un solo `obtenerEtapa` en logs |
| Silencio 6 s sin guía tras C11 | Baja | Copy C11 v2 instruye; monitorear feedback operador |
| VAD + "listo" del paciente | Media | Regla prompt existente; más ventana con 6 s |
| Deploy motor sin cliente | Alta si descoordinado | §7 orden estricto |
| Examen más largo | Baja | +4 s netos por ritual vs hoy (6 post − 2 post; 0 pre vs 6 pre) ≈ **mismo total**, mejor ubicado |

---

## 11. Fuera de alcance

- Cambiar firmware foróptero
- Gatear / silenciar VAD en pausas
- Ritual para `preferencia: actual` (P1 B §4.4)
- `tipoDialogo` / `copyVersion` en API
- Mover espera solo al servidor sin fase cliente (salvo fallback D06)

---

## 12. Referencias

| Recurso | Uso |
|---------|-----|
| `src/app/lib/postComparacionContinuar.ts` | Pausa post-C11 + auto_chain |
| `reference/foroptero-server/motorExamen.js` | Ritual, deferred, `POST_COMPARACION_ESPERA_SEG` |
| `src/app/agentConfigs/chatSupervisor/index.ts` | Regla post-comparación |
| `PLAN_FEEDBACK_CLIENTE_EXAMEN.md` §2.3.8, §4.0.1 | auto_chain; doble llamada |
| `PLAN_RATE_LIMIT_EXAMEN.md` §7.8, §10 Fase 1b | P2 histórico (2 s) |
| `registros-examen/examen-registro-8.csv` | Regresión doble `obtenerEtapa` |
| `registros-examen/examen-registro-17.csv` | Timing pre-Opción B |
| `registros-examen/examen-registro-18.csv` | QA Opción B |
| `registros-examen/examen-registro-19.csv` | QA 4 s + síntoma P1-F6 |
| Sesión UI 2026-07-03 ~16:23 | Evidencia problema pre-Opción B |
| Sesión UI 2026-07-03 ~16:57 | Evidencia P1-F6 (registro-19 ciclo 3) |

---

## 13. Estado actual y QA

**Última revisión:** 2026-07-06

### 13.1 Código en `main` (`eecb2b7`)

| Componente | Valor / comportamiento |
|------------|------------------------|
| **Motor** | Sin `POST_COMPARACION_ESPERA_SEG` pre-C11; reanclaje + C11 inmediato; copy C11 v2 |
| **Cliente** | `POST_COMPARACION_CLIENT_PAUSE_MS = **4000**` |
| **Trigger pausa** | `audio_stopped` (fix B **revertido**) |
| **Hardening** | `nudgeScheduled` activo |
| **Prompt** | Regla post-comparación A1–A2 |

### 13.2 Historial de commits (tema acomodo)

| Commit | Descripción | Estado |
|--------|-------------|--------|
| `c21a74e` | Experimento: 6 s pre-C11 en servidor | Superseded por Opción B |
| `94f43a2` | **Opción B** — acomodo post-C11 en cliente + C11 v2 | ✅ Vigente |
| `6c2a1ea` | Pausa cliente 6 s → **4 s** | ✅ Vigente |
| `521c69c` | Fix B: `output_audio_transcript.done` | ❌ Revertido |
| `eecb2b7` | Revert fix B | ✅ **HEAD** |

### 13.3 Resultados QA

#### `examen-registro-18` — Opción B globalmente OK

| Criterio | Resultado |
|----------|-----------|
| C11 rápido tras elección (HTTP 1) | ✅ Mayoría 2–6 s; ciclo 1 ~10 s (variable `esperar_foroptero`) |
| `auto_chain` post-C11 | ✅ ~6,6–7,2 s (con pausa 6 s del deploy de ese momento) |
| Un solo `obtenerEtapa` entre C11 y C12 | ✅ |
| Sin ritual con `preferencia: actual` | ✅ |
| Copy C11 v2 rotando | ✅ |
| Sin preguntas duplicadas | ✅ |

**Veredicto:** Opción B cumple contrato técnico (`postComparacionContinuar` + `auto_chain`).

#### `examen-registro-19` — Pausa 4 s; síntoma P1-F6

Ciclo analizado (captura ~16:57, CSV filas 32–38):

| Evento | UI | Análisis |
|--------|-----|----------|
| C11 *"Perfecto, mantené este lente..."* | 16:57:04.122 | Inicio TTS en transcript |
| `auto_chain` | 16:57:08.868 | Δ = **4,75 s** desde inicio C11 en UI |
| Cambio foróptero (CSV) | 16:57:09 | Coherente con `auto_chain` |

**Lectura:** los 4 s del timer **sí corren** en logs (4,75 s C11 UI → `auto_chain`), pero el timer arranca en un `audio_stopped` **temprano** (~0,75 s tras aparecer C11), no al **fin** del monólogo (~3–4 s de TTS). El paciente percibe solo **~1–2 s de silencio** después de que el agente termina de hablar.

### 13.4 Bloqueante abierto — P1-F6

| ID | Síntoma | Causa raíz | Intentos |
|----|---------|------------|----------|
| **P1-F6** | Pausa clínica post-C11 más corta que `POST_COMPARACION_CLIENT_PAUSE_MS` | `audio_stopped` del SDK dispara antes del fin del TTS de C11 (chunks / audio residual) | Fix B (`output_audio_transcript.done`) — **revertido** (`eecb2b7`) por empeorar comportamiento en campo |

**Estado P1-F6:** abierto; documentado también en `PLAN_COPY_NATURAL_AGENTE.md` Anexo E.

### 13.5 Fix B — revertido (lección)

| Aspecto | Detalle |
|---------|---------|
| **Commit** | `521c69c` → revert `eecb2b7` |
| **Motivo revert** | Empeoró experiencia en campo (operador) |
| **Estado en código** | Restaurado `audio_stopped` + `nudgeScheduled` |

No reintentar fix B sin rediseño; evaluar alternativas en §13.6.

### 13.6 Próximos caminos (sin implementar)

| Opción | Idea | Notas |
|--------|------|-------|
| **A** | P1-F6 clásico: armar timer solo tras `audio_started` del turno C11 + `audio_stopped` subsiguiente | Evita `audio_stopped` espurio pre-TTS |
| **B** | Reintentar señal de fin de TTS con validación (p. ej. `output_audio_transcript.done` + guard de `pending` + debounce) | Fix B falló; necesita diseño distinto |
| **C** | Subir `POST_COMPARACION_CLIENT_PAUSE_MS` a 6–7 s como compensación del trigger temprano | Parche; no corrige causa raíz |
| **D** | Espera en `ejecutarDeferredPostComparacionSiHay` (servidor) tras `auto_chain` | Desacopla de SDK; silencio sin voz del agente |
| **E** | Rollback completo a pre-Opción B (espera pre-C11 en servidor) | Revierte `94f43a2`; no pedido aún |

### 13.7 Resumen ejecutivo de estado

```
✅ Opción B desplegada (motor + cliente + prompt + C11 v2)
✅ auto_chain sin doble obtenerEtapa (nudgeScheduled)
✅ preferencia actual sin ritual
⚠️ Pausa percibida < 4 s (P1-F6 — audio_stopped temprano)
❌ Fix B revertido
⏳ QA formal del plan: parcial (ETAPA_6, inter-test, noOp sin cubrir)
⏳ Validación clínica copy C11 v2 (D07)
```

---

## Historial

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-07-03 | Plan inicial Opción B + análisis fricción `obtenerEtapa` anticipado |
| 1.1 | 2026-07-03 | Implementado: motor M1–M5, cliente C1–C3, prompt A1–A2 |
| 1.2 | 2026-07-03 | Fix B (P1-F6): timer post-C11 en `output_audio_transcript.done` — commit `521c69c` |
| 1.3 | 2026-07-06 | **Estado y QA:** registro-18/19; fix B revertido (`eecb2b7`); pausa 4 s; P1-F6 abierto; §13 |
