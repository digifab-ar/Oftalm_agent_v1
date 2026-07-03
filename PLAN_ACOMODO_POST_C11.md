# Plan de implementación — Acomodo post-C11 (Opción B)

**Versión:** 1.0  
**Fecha:** 2026-07-03  
**Estado:** Implementado (pendiente deploy + QA)  
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
| **C1** | `POST_COMPARACION_CLIENT_PAUSE_MS = 6000` |
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

| Métrica | Objetivo |
|---------|----------|
| Δ(paciente → C11 en transcript) | **< 5 s** (HTTP 1 sin espera 6 s) |
| Δ(fin TTS C11 → `auto_chain`) | **≈ 6 s** (±0,5 s) |
| Δ(`auto_chain` → cambio foróptero en CSV) | **< 1 s** inicio HTTP 2 |
| `obtenerEtapa` entre C11 y C12 | **exactamente 1** |

### 8.2 Regresión obligatoria

- [ ] `"con este lente"` / `preferencia: actual` → sin C11, cambio directo
- [ ] `noOpSiguiente` → sin ritual
- [ ] Ritual inter-test (grueso→fino) → C11 + 6 s + siguiente test
- [ ] ETAPA_6 binocular con reanclaje → mismo patrón
- [ ] Sin preguntas comparativas duplicadas (anti `examen-registro-8`)
- [ ] Paciente dice "listo" en silencio post-C11 → ignorado, flujo continúa

### 8.3 Evidencia

Archivar CSV + captura logs UI como `examen-registro-NN.csv` con nota en este plan.

---

## 9. Decisiones

| ID | Decisión | Estado |
|----|----------|--------|
| **D01** | Opción B: espera clínica **post-C11** en cliente, no pre-C11 en servidor | ✅ Cerrada |
| **D02** | Duración inicial: **6 s** (`POST_COMPARACION_CLIENT_PAUSE_MS`) | ✅ Cerrada |
| **D03** | C11 v2 con copy prospectivo (*"quedate con este lente"*) | ✅ Cerrada |
| **D04** | Hardening `nudgeScheduled` obligatorio (anti doble `obtenerEtapa`) | ✅ Cerrada |
| **D05** | No gatear VAD durante pausa (igual que Fase 1b) | ✅ Cerrada |
| **D06** | Espera en deferred servidor como fallback — solo si QA muestra llamadas tempranas del modelo | Abierta |
| **D07** | Validación tono C11 v2 con operador clínico | Pendiente |

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
| `registros-examen/examen-registro-17.csv` | Timing pre/post C11 |
| Sesión UI 2026-07-03 ~16:23 | Evidencia problema (captura operador) |

---

## Historial

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-07-03 | Plan inicial Opción B + análisis fricción `obtenerEtapa` anticipado |
| 1.1 | 2026-07-03 | Implementado: motor M1–M5, cliente C1–C3, prompt A1–A2 |
