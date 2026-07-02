# Plan de implementación — Resiliencia ante `rate_limit_exceeded` (examen visual)

**Versión:** 0.3  
**Fecha:** 2026-07-01  
**Estado:** **Fase 1 definida** (truncation Variante A) — implementación pendiente  
**Proyecto:** `openai-realtime-agents-main-2`  
**Relacionado con:** `PLAN_FEEDBACK_CLIENTE_EXAMEN.md` (fluidez post-Sigamos), agente `chatSupervisor`  
**Modelo:** `gpt-realtime-mini-2025-12-15` (límite compartido TPM con `gpt-4o-mini-realtime`: 40.000)

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Workflow: paciente ↔ agente ↔ servidor](#2-workflow-paciente--agente--servidor)
3. [Problema y síntoma](#3-problema-y-síntoma)
4. [Causa raíz](#4-causa-raíz)
5. [Discovery — qué expone la API sobre tokens](#5-discovery--qué-expone-la-api-sobre-tokens)
6. [Discovery — `reset_seconds` vs tiempo real de reintento](#6-discovery--reset_seconds-vs-tiempo-real-de-reintento)
7. [Discovery — prompt caching, truncation y costo](#7-discovery--prompt-caching-truncation-y-costo)
8. [Enfoque recomendado](#8-enfoque-recomendado)
9. [Arquitectura objetivo](#9-arquitectura-objetivo)
10. [Fases de implementación](#10-fases-de-implementación)
11. [Decisiones](#11-decisiones)
12. [Riesgos y mitigaciones](#12-riesgos-y-mitigaciones)
13. [Referencias](#13-referencias)

---

## 1. Resumen ejecutivo

Durante el examen visual, de forma **esporádica**, el agente Realtime queda en **silencio**: el servidor rechaza una respuesta por agotar el límite **TPM** (tokens por minuto) y el cliente **no recupera** el flujo.

| Hallazgo | Implicación |
|----------|-------------|
| No existe preflight de costo por mensaje | No se puede preguntar “¿cuántos tokens cuesta este turno?” antes de enviarlo |
| Sí existe presupuesto en sesión vía `rate_limits.updated` | El cliente puede saber `remaining` y decidir si enviar o esperar |
| `reset_seconds` ≠ tiempo mínimo para reintentar | Esperar 60 s cuando a los 10 s ya funciona **infla latencia** sin necesidad |
| El error incluye `Please try again in Xs` | Es la señal **más precisa** para el primer reintento |
| El backend clínico ya es stateful | Podar historial Realtime es viable sin perder estado del examen |
| El fallo puede ser **solo TTS** tras tool exitosa | El servidor ya respondió pero el paciente no escuchó nada |
| Workaround manual `{}` ya validado en campo | Automatizable como `obtenerEtapa({})` tras backoff, sin input del paciente |
| **Sin `truncation` en sesión hoy** | Historial crece hasta ~8.600 `input_tokens`/turno; default servidor ~28k |
| **`cached_tokens` alto (~99%)** | Ahorra $ pero **no reduce TPM** — el límite cuenta `input_tokens` enteros |

**Estrategia acordada:** abordar TPM en dos frentes:

1. **Fase 1 (preventivo):** truncation **Variante A** — `post_instructions: 6000`, `retention_ratio: 0.8`.
2. **Fases 2–3 (reactivo + pacing):** reintento automático + throttling con `remaining`.

**Esfuerzo orientativo:** Fase 1 (~0,5 día implementación + 1 examen QA A/B); Fases 2–3 (~1,5 días) si Fase 1 no basta.

---

## 2. Workflow: paciente ↔ agente ↔ servidor

### 2.1 Tres actores y responsabilidades

```
┌──────────┐     voz / VAD      ┌─────────────────────┐    POST /api/examen/instrucciones    ┌──────────────────┐
│ Paciente │ ◄────────────────► │ Agente Realtime     │ ◄──────────────────────────────────► │ Servidor clínico │
│          │     audio TTS      │ (gpt-realtime-mini) │         tool obtenerEtapa            │ (motorExamen.js) │
└──────────┘                    └─────────────────────┘                                      └──────────────────┘
                                         ▲
                                         │ señales cliente (auto_chain, PTT, texto `{}`)
                                         │
                                ┌────────┴────────┐
                                │ Cliente Next.js │
                                │ (WebRTC + SDK)  │
                                └─────────────────┘
```

| Actor | Rol | Stateful |
|-------|-----|----------|
| **Paciente** | Habla (VAD) o escucha (TTS) | No |
| **Agente Realtime** | Interpreta voz, llama `obtenerEtapa`, lee `pasos[].mensaje` al paciente | Solo historial de conversación (crece) |
| **Servidor clínico** | Estado del examen, foróptero, TV, guion (`pasos`, `contexto`) | **Sí** — fuente de verdad |
| **Cliente Next.js** | WebRTC, `auto_chain` post-Sigamos, logs, input manual de operador | Mínimo (`pending` en postComparacion) |

El prompt del agente refuerza: *"No guardés estado. El backend lo maneja todo."* — esto hace viable recuperar llamando otra vez a `obtenerEtapa({})` sin repetir input del paciente.

### 2.2 Ciclo normal de un turno

```
1. Paciente habla (o auto_chain / inicio)
      ↓
2. Agente Realtime → response.create (consume TPM: contexto + audio in)
      ↓
3. Agente llama obtenerEtapa({ respuestaPaciente?, interpretaciones? })
      ↓
4. Servidor clínico procesa, avanza estado, devuelve { pasos, contexto }
      ↓
5. Agente pronuncia pasos[].mensaje (consume TPM: audio out)
      ↓
6. Paciente escucha y responde → volver a 1
```

**Punto crítico:** los pasos 3–5 ocurren dentro de **una o más** `response` de Realtime. El límite TPM aplica al **conjunto** (contexto + tool + TTS). El servidor clínico (paso 4) **no** consume TPM de OpenAI.

### 2.3 Dos modos de fallo por rate limit

| Modo | Qué pasó | Servidor clínico | Paciente escuchó | Estado en logs |
|------|----------|------------------|------------------|----------------|
| **A — Respuesta muerta** | `response.done` failed, `output: []`, `usage: 0` | **No** llegó la tool, o no completó el ciclo | Nada | Sin `function call result: obtenerEtapa` tras el fallo |
| **B — Tool OK, TTS muerto** | `obtenerEtapa` ejecutó y devolvió JSON; falló la generación de audio posterior | **Sí** respondió (estado puede haber avanzado) | Nada | Hay `function call result: obtenerEtapa` pero sin TTS / `response.done` failed después |

En la práctica el operador percibe lo mismo: **silencio**. Pero la recuperación automática debe distinguir A vs B (ver §2.5).

### 2.4 Evidencia de campo — caso post-Sigamos (modo A)

Sesión con fallo tras `auto_chain` (logs UI, 2026-07-01 ~17:37):

| Hora | Evento |
|------|--------|
| 17:37:03 | `function call: obtenerEtapa` |
| 17:37:12 | `function call result: obtenerEtapa` |
| 17:37:13 | Agente: *"Sigamos con este."* |
| 17:37:13 | `post_comparacion_continuar_nudge auto_chain` |
| 17:37:13 | `rate_limits.updated` → `response.created` |
| 17:37:13 | **`response.done` FAILED** — `Used 36641`, `Requested 7707`, `Please try again in 6.522s` |
| 17:37:13 | `rate_limits.updated` → `remaining: 3157`, `reset_seconds: 55.263` |
| 17:37:14 | `output_audio_buffer.stopped` |
| *~36 s silencio* | |
| 17:37:49 | Operador envía **`{}`** (texto manual) |
| 17:37:50 | `function call: obtenerEtapa` |
| 17:37:56 | `function call result: obtenerEtapa` |
| 17:37:56 | Agente: *"¿Ves mejor con este o con el anterior?"* |
| 17:38:10 | Paciente: *"con el anterior."* |

**Lectura:** el nudge post-Sigamos disparó una `response` que **falló antes de completar** `obtenerEtapa` + TTS (modo A). El servidor **no** había entregado la siguiente pregunta al agente en ese ciclo fallido. El `{}` manual ~36 s después actuó como **destrabe**: el agente llamó `obtenerEtapa({})`, el servidor respondió, y **esta vez** hubo tokens para TTS.

**Nota:** el delay de 36 s es mucho mayor que los 6,5 s sugeridos por el error — el operador esperó más de lo necesario (coherente con §6: no usar `reset_seconds` como guía).

### 2.5 Workaround manual `{}` — por qué funciona y límites

**Qué hace el operador:** escribe `{}` en el input de texto del cliente → `sendUserText("{}")` → el modelo lo interpreta como “no sé qué hacer / body vacío” → llama `obtenerEtapa({})` según el prompt.

**Por qué salva el examen:**

1. **El servidor tiene el estado** — no depende de que el agente “recuerde” el último `pasos`.
2. **`obtenerEtapa({})` es idempotente en muchos checkpoints** — devuelve qué decir *ahora* según la etapa actual.
3. **Segundo intento con TPM recuperado** — tras unos segundos la ventana deslizante libera tokens; la misma operación que falló ahora entra.

**Riesgos del `{}` manual (motivo para automatizar):**

| Riesgo | Cuándo |
|--------|--------|
| Latencia clínica (~30 s de silencio) | Operador no reacciona al instante |
| Doble avance en servidor (modo B) | Si `obtenerEtapa` ya corrió y avanzó estado, un segundo `{}` podría re-ejecutar lógica deferred — en campo **no se observó** en este caso, pero hay que validar por etapa |
| Confusión con respuesta del paciente | `{}` no debe mezclarse con turnos reales del paciente |
| No escala | Requiere operador atento durante todo el examen |

### 2.6 Recuperación automática equivalente al `{}`

El cliente **no necesita** que el operador escriba `{}`. Equivalentes programáticos:

| Situación detectada | Acción automática (tras backoff §6) |
|--------------------|-------------------------------------|
| Modo A: fallo tras `auto_chain`, sin `obtenerEtapa` posterior | Reenviar `__POST_COMPARACION_CONTINUAR__` **o** `sendMessage` que dispare `obtenerEtapa({})` |
| Modo A: fallo tras respuesta del paciente, sin tool | `response.create` (el contexto aún tiene la última respuesta del paciente) |
| Modo B: `obtenerEtapa` OK en historial, TTS falló | **`response.create` solo** (re-leer `pasos` del último tool result en contexto) — **sin** segunda llamada al servidor si el JSON ya está en historial |
| Modo B dudoso / sin tool result visible | Fallback seguro: `obtenerEtapa({})` (equivalente a `{}`) — el servidor es stateful |

**Decisión de diseño (D8):** priorizar `response.create` en modo B para no golpear el servidor de nuevo; usar `obtenerEtapa({})` como fallback (equivalente al `{}` manual).

### 2.7 Diagrama del fallo observado

```
Sigamos TTS OK
  → audio_stopped
    → auto_chain: __POST_COMPARACION_CONTINUAR__
      → response.create  [TPM: Used 36641 + Requested 7707 > 40000]
        → response.done FAILED (output: [])
          → servidor NO consultado en este ciclo
            → silencio ~36s
              → operador: "{}"
                → obtenerEtapa({}) → servidor OK → TTS OK
                  → "¿Ves mejor con este o con el anterior?"
```

---

## 3. Problema y síntoma

### 3.1 Evento observado

```json
{
  "type": "response.done",
  "response": {
    "status": "failed",
    "output": [],
    "status_details": {
      "type": "failed",
      "error": {
        "type": "tokens",
        "code": "rate_limit_exceeded",
        "message": "Rate limit reached for gpt-realtime-mini-2025-12-15 (for limit gpt-4o-mini-realtime) in organization org-… on tokens per min (TPM): Limit 40000, Used 34514, Requested 6665. Please try again in 1.768s."
      }
    },
    "usage": {
      "input_tokens": 0,
      "output_tokens": 0
    }
  }
}
```

### 3.2 Impacto en el examen

- `output: []` → **sin audio**, sin tool call visible para el paciente.
- El flujo clínico se **corta** hasta intervención manual o hasta que el paciente hable y el VAD dispare otra respuesta (no garantizado).
- El panel **Logs** marca el evento en rojo (`Events.tsx`) pero **no hay recuperación automática**.

### 3.3 Estado actual del código

En `useRealtimeSession.ts`, `response.done` fallido cae en el `default` de `handleTransportEvent` y solo se loguea:

```
transport_event → logServerEvent(event)   // sin acción
```

No se consume `rate_limits.updated`. Los triggers explícitos (`response.create` en PTT, `auto_chain` post-Sigamos) no pasan por ningún scheduler.

---

## 4. Causa raíz

### 4.1 No es un bug clínico

El backend del foróptero (`motorExamen.js`, Railway) y la tool `obtenerEtapa` no son la causa. Es **agotamiento del bucket TPM** de la cuenta/org en la ventana móvil de 60 segundos.

En el caso documentado: `34.514 + 6.665 > 40.000` → faltaban ~1.179 tokens.

### 4.2 Por qué ocurre a mitad de examen

El consumo crece con la duración de la sesión:

| Factor | Efecto |
|--------|--------|
| System prompt largo (`chatSupervisor/index.ts`) | Base fija en cada turno |
| Historial acumulado (transcripciones, tool calls, JSON de `obtenerEtapa`) | Crece linealmente |
| Tokens de audio (input + output) | Más costosos que texto |
| Cadena rápida tool → TTS → `auto_chain` → tool | Ráfagas en pocos segundos |
| `server_vad` + `create_response: true` (`session/route.ts`) | Respuestas automáticas sin control de pacing |
| Guardrails (`/api/responses`, gpt-4o-mini) | Carga paralela (no cuenta en TPM Realtime, pero suma presión operativa) |

### 4.3 Cadena causal (genérica)

```
Examen avanzado (contexto grande)
  → VAD / auto_chain / PTT disparan response.create
    → Servidor estima input + reserva output
      → TPM insuficiente
        → response.done status=failed, output=[]
          → Cliente solo loguea → silencio en examen
```

### 4.4 Cadena causal (caso post-Sigamos — evidencia §2.4)

Ver diagrama §2.7. El fallo ocurre en la **response del auto_chain**, no en la comunicación con Railway.

---

## 5. Discovery — qué expone la API sobre tokens

### 5.1 Lo que **no** existe

| Pregunta | Respuesta |
|----------|-----------|
| ¿Endpoint GET para consultar TPM antes de enviar? | **No** |
| ¿Preflight “esta request costará X tokens”? | **No** |
| ¿Certeza de que alcanza para el último mensaje no enviado? | **No** — solo aproximación |

### 5.2 Lo que **sí** existe (push en sesión)

#### `rate_limits.updated`

Emitido al **inicio** y al **fin** de cada respuesta (junto con `response.done`). No requiere polling HTTP.

```json
{
  "type": "rate_limits.updated",
  "rate_limits": [
    {
      "name": "tokens",
      "limit": 40000,
      "remaining": 5486,
      "reset_seconds": 13.5
    },
    {
      "name": "requests",
      "limit": 100,
      "remaining": 38,
      "reset_seconds": 52747
    }
  ]
}
```

| Campo | Uso |
|-------|-----|
| `name: "tokens"` | **Este** es el límite relevante para TPM del examen |
| `remaining` | Tokens que aún podés consumir en la ventana actual (ya incluye reservas de respuestas en curso) |
| `limit` | Techo de la ventana (ej. 40.000) |
| `reset_seconds` | Ver §6 — **no** usar como única guía de reintento |

**Nota:** al crear una respuesta, el servidor **reserva** tokens de output (típicamente hasta el máximo configurado). `remaining` refleja esa reserva y se ajusta al completar `response.done`.

#### `response.done.usage`

Costo **real** del turno (cuando la respuesta termina, exitosa o no):

```json
"usage": {
  "input_tokens": 6200,
  "output_tokens": 450,
  "input_token_details": {
    "text_tokens": 4100,
    "audio_tokens": 2100,
    "cached_tokens": 800
  }
}
```

Sirve para **calibrar** estimaciones (promedio móvil por etapa del examen), no para predecir el próximo turno con exactitud.

#### Mensaje de error en `status_details`

Cuando falla, el servidor indica:

- `Limit`, `Used`, `Requested` — diagnóstico del rebalse
- `Please try again in Xs` — **mejor estimación** para el primer reintento de *esta* request

### 5.3 Heurística práctica para decidir si enviar

```
¿remaining >= HEADROOM?
  → sí: encolar o enviar response.create
  → no: esperar (backoff corto) y reevaluar con próximo rate_limits.updated
```

**HEADROOM recomendado (discovery):** 7.000–8.000 tokens, basado en error real con `Requested: 6665`.

**Estimación opcional más fina:**

```
costo_estimado ≈ promedio_móvil(
  usage.input_tokens + usage.output_tokens,
  últimas N respuestas del examen
)
enviar si remaining >= costo_estimado + margen (ej. 1500)
```

### 5.4 Implicación para mensaje no enviado

Si `response.done` falló con `output: []`, el paciente **no escuchó** el mensaje. Recuperación según modo (§2.3):

| Modo | Contexto | Acción de recuperación |
|------|----------|------------------------|
| **A** | Fallo tras `auto_chain`, sin `obtenerEtapa` posterior | Reenviar nudge o `obtenerEtapa({})` tras backoff |
| **A** | Fallo tras respuesta del paciente, sin tool en historial | `response.create` tras backoff |
| **B** | `obtenerEtapa` OK en historial, TTS falló | `response.create` solo (re-leer último tool result) |
| **B** (dudoso) | No hay tool result visible | Fallback `obtenerEtapa({})` — equivalente a `{}` manual (§2.6) |

---

## 6. Discovery — `reset_seconds` vs tiempo real de reintento

### 6.1 Observación de campo

A veces `reset_seconds` indica **~60 s**, pero tras esperar **~10 s** el reintento ya funciona.

### 6.2 Explicación — dos métricas distintas

| Métrica | Significado |
|---------|-------------|
| **`reset_seconds`** | Tiempo hasta que el límite vuelva a su **estado inicial completo** (bucket TPM al 100 %) |
| **`Please try again in Xs`** (error) | Tiempo hasta tener tokens **suficientes para esta request concreta** |

Documentación OpenAI (HTTP, análogo conceptual):

> `x-ratelimit-reset-tokens`: *The time until the rate limit resets to its **initial state**.*

No significa “esperá exactamente esto antes de cualquier reintento”.

### 6.3 Por qué a los 10 s ya alcanza

**1. Ventana deslizante (sliding window), no reloj fijo**

TPM usa una ventana móvil de 60 s. Los tokens consumidos hace 50–55 s **salen** de la ventana de forma continua; no hace falta esperar el minuto entero para recuperar margen parcial.

```
t=0s   ████████████  (pico de uso)
t=30s  ████████████  (todo aún en ventana)
t=50s  ██████░░░░░░  (uso antiguo salió → remaining sube)
t=60s  ░░░░░░░░░░░░  (ventana “limpia” → reset_seconds ≈ 0)
```

**2. No se necesita el bucket lleno**

Para reintentar un mensaje de ~6.665 tokens, basta liberar **~1.200–7.000** tokens según el caso — no recuperar los 40.000 completos.

**3. Liberación de reservas**

Si la respuesta falló con `output: []`, la reserva de output que el servidor hizo al crear la response se libera al completar `response.done`, lo que puede subir `remaining` antes de que expire la ventana.

**4. Dos límites en el mismo evento**

Siempre filtrar por `name: "tokens"`. El `reset_seconds` de `requests` puede ser órdenes de magnitud mayor y no aplica al problema TPM del examen.

### 6.4 Regla operativa (discovery)

| Fuente | Rol en reintento |
|--------|------------------|
| `Please try again in Xs` del error | **Prioridad 1** — delay inicial |
| Backoff corto (2 s → 5 s → 10 s) + jitter | **Prioridad 2** — reintentos siguientes |
| `remaining` en `rate_limits.updated` | **Prioridad 3** — enviar cuando `remaining >= HEADROOM` |
| `reset_seconds` | **Solo techo máximo** de espera o referencia de recuperación total — **no** como mínimo obligatorio |

**Anti-patrón:** `await sleep(reset_seconds)` cuando `reset_seconds === 60` → añade ~50 s de latencia innecesaria al examen.

**Pseudológica acordada:**

```typescript
const delay = Math.min(
  parseRetryAfterFromError(error.message),  // ej. 1.8s
  backoffWithJitter(attempt),               // ej. 2s, 5s, 10s
  MAX_RETRY_WAIT                            // ej. 15s — no 60s
);

// Antes de reintentar, si llegó rate_limits.updated:
if (tokensRemaining >= HEADROOM) retryNow();
```

---

## 7. Discovery — prompt caching, truncation y costo

### 7.1 Estado actual: sin truncation

Hoy **no** hay `truncation` en `src/app/api/session/route.ts` ni en `session.update` de `App.tsx`. El servidor usa el default:

| Default | Comportamiento |
|---------|----------------|
| Tope implícito | ~28.224 tokens post-instructions (modelo 32k − 4.096 output) |
| `retention_ratio` | `1.0` — trunca solo lo mínimo necesario |
| Efecto en examen largo | Historial crece sin podar hasta ~8.600+ `input_tokens`/turno |

### 7.2 Prompt caching (`cached_tokens`)

El cache es **automático**. No existe `max_cached_tokens`.

| Campo (ej. turno ETAPA_4) | Valor observado |
|---------------------------|-----------------|
| `input_tokens` | 8.631 |
| `cached_tokens` | 8.576 (~99,4 %) |
| Tokens nuevos | 55 (audio "K" del paciente) |

**Implicaciones:**

| Aspecto | Efecto |
|---------|--------|
| **Costo $** | Positivo — cached se factura mucho más barato |
| **TPM (40k)** | **No ayuda** — `input_tokens` enteros cuentan hacia el rate limit |
| **Latencia** | Positivo — no reprocesa todo el prefijo |

No se puede “limitar el cache” directamente; solo **reducir el historial** (truncation o `conversation.item.delete`).

### 7.3 Truncation — opciones evaluadas

| Variante | Config | TPM esperado | Riesgo clínico | Uso |
|----------|--------|--------------|----------------|-----|
| **Baseline** (hoy) | Sin config | ~8.600 input/turno | Ninguno | Referencia A/B |
| **A — conservadora** ✅ | `post_instructions: 6000`, `retention_ratio: 0.8` | ~5.000–6.000 input/turno (−30–40 %) | Bajo | **Fase 1** |
| **B — agresiva** | `post_instructions: 4500`, `retention_ratio: 0.8` | ~4.000–5.000 input/turno | Medio | Solo si A no basta |
| **Disabled** | `"truncation": "disabled"` | Sin podar → error al llenar contexto | — | No recomendado |

**`post_instructions`:** máximo de tokens de conversación **después** de instructions + tool definitions. No incluye el system prompt ni el schema de `obtenerEtapa`.

**`retention_ratio: 0.8`:** al truncar, baja de golpe al 80 % del tope (menos truncaciones frecuentes, menos cache bust continuo). Recomendado por [OpenAI — Managing costs](https://developers.openai.com/api/docs/guides/realtime-costs).

### 7.4 Variante A — configuración acordada (Fase 1)

```json
{
  "type": "session.update",
  "session": {
    "truncation": {
      "type": "retention_ratio",
      "retention_ratio": 0.8,
      "token_limits": {
        "post_instructions": 6000
      }
    }
  }
}
```

**Ubicación de implementación:** `src/app/api/session/route.ts` dentro del objeto `session` del `client_secrets` (aplica desde el connect). Alternativa: primer `session.update` en `App.tsx` tras conectar — preferir `session/route.ts` para una sola fuente de verdad.

### 7.5 Trade-off TPM vs costo $

| Efecto de truncar | TPM | Costo $ |
|-------------------|-----|---------|
| Menos `input_tokens`/turno | **Baja** | Baja (menos tokens totales) |
| Truncación rompe cache (cache bust) | — | **Puede subir** en turnos post-truncación (más tokens a tarifa full) |
| `retention_ratio: 0.8` | — | Amortiza el cache bust |

**Hipótesis:** Variante A reduce `rate_limit_exceeded` esporádicos; el costo por examen puede quedar **similar o +10–25 %** por menor cache hit. El objetivo de Fase 1 es **fluidez (TPM)**, no minimizar $.

### 7.6 Fórmula de costo por `response.done` (gpt-realtime-mini)

Precios orientativos (verificar en [pricing](https://openai.com/api/pricing/)):

| Modalidad | Input | Cached input | Output |
|-----------|-------|--------------|--------|
| Texto | $0,60 / 1M | $0,06 / 1M | $2,40 / 1M |
| Audio | $10 / 1M | $0,30 / 1M | $20 / 1M |

```typescript
const d = usage.input_token_details;
const c = d.cached_tokens_details ?? {};

const textNew  = d.text_tokens  - (c.text_tokens  ?? 0);
const audioNew = d.audio_tokens - (c.audio_tokens ?? 0);
const textCached  = c.text_tokens  ?? 0;
const audioCached = c.audio_tokens ?? 0;

const costInput =
  textNew  * 0.60e-6 + audioNew  * 10e-6 +
  textCached * 0.06e-6 + audioCached * 0.30e-6;

const o = usage.output_token_details ?? {};
const costOutput =
  (o.text_tokens ?? 0) * 2.40e-6 +
  (o.audio_tokens ?? 0) * 20e-6;

const costUsd = costInput + costOutput;
```

**Ejemplo baseline** (8.631 input, 8.576 cached, 35 output texto): ≈ **$0,0011/turno**.

### 7.7 Protocolo A/B (Fase 1 QA)

Ejecutar **un examen completo** con baseline (sin truncation) y otro con Variante A. Registrar por cada `response.done`:

| Métrica | Cómo medir |
|---------|------------|
| `input_tokens` promedio / pico | `response.done.usage` |
| `% cache` | `cached_tokens / input_tokens` |
| TPM pico (ventana 60 s) | Suma `input + output` en la ventana más cargada |
| `rate_limit_exceeded` (count) | Logs rojos |
| Costo $ estimado | Fórmula §7.6 × N turnos |
| Regresión clínica | CSV + QA manual (mismas etapas, sin saltos) |

---

## 8. Enfoque recomendado

### 8.1 Capas (por prioridad de implementación)

| Capa | Nombre | Objetivo | Fase |
|------|--------|----------|------|
| **T** | Truncation Variante A | Reducir `input_tokens`/turno (−30–40 % TPM) | **1** ⭐ |
| **A** | Reintento reactivo | Recuperar silencios tras `rate_limit_exceeded` | 2 |
| **B** | Throttling proactivo | Prevenir fallos con `remaining` + cola | 3 |
| **C** | Podado manual historial | `conversation.item.delete` tool outputs viejos | 4 |
| **E** | Operacional | Subir tier TPM en cuenta OpenAI | Paralelo |

### 8.2 Caminos descartados o secundarios

| Camino | Motivo |
|--------|--------|
| Esperar siempre `reset_seconds` completo | Infla latencia; discovery §6 demuestra que es conservador en exceso |
| Predecir tokens exactos pre-request | La API no lo soporta |
| Depender del operador enviando `{}` | Funciona en campo (§2.5) pero no es productizable |
| Limitar `cached_tokens` directamente | No existe en la API |
| Reconectar sesión WebRTC ante rate limit | La conexión sigue usable; basta reintentar `response.create` |

### 8.3 Buenas prácticas aplicables

- **Exponential backoff con jitter** en reintentos (evitar thundering herd).
- **Máximo 3 reintentos** por fallo; luego log crítico + UX discreta (“Un momento…”).
- **Single-flight:** una respuesta activa; evitar solapar VAD explícito + `auto_chain` + PTT.
- **Idempotencia:** no duplicar audio ni reenviar nudge si `obtenerEtapa` ya corrió.
- **Detección modo A vs B:** inspeccionar historial SDK / breadcrumbs entre fallo y reintento (§2.3).
- **Observabilidad:** log estructurado de `usage`, `remaining`, intentos de retry (breadcrumb `rate_limit_retry`, no visible al paciente).

---

## 9. Arquitectura objetivo

### 9.1 Fase 1 — cambio en sesión (inmediato)

```diff
// src/app/api/session/route.ts
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
+   truncation: {
+     type: "retention_ratio",
+     retention_ratio: 0.8,
+     token_limits: { post_instructions: 6000 },
+   },
    audio: { ... },
  },
```

Opcional para A/B: query param `?truncation=baseline|6000` que omita o incluya el bloque (solo para QA, no producción).

### 9.2 Fases 2–3 — módulo `responseScheduler.ts`

Responsabilidades:

1. Estado: `tokensRemaining`, `tokensLimit`, `responseInFlight`, `pendingIntent`, `retryCount`.
2. `onRateLimitsUpdated(event)` — actualizar presupuesto (`name === "tokens"`).
3. `onResponseDone(event)` — completado → liberar cola; fallido + `rate_limit_exceeded` → programar reintento.
4. `enqueueResponse(intent)` — serializar triggers (`vad` | `auto_chain` | `ptt` | `retry`).
5. `parseRetryAfter(message)` — extraer segundos de `Please try again in Xs`.
6. `classifyFailureMode(history)` → `'A' | 'B'` para elegir reintento (§2.6).

### 9.3 Integración (Fases 2–3)

| Archivo | Cambio |
|---------|--------|
| `src/app/lib/responseScheduler.ts` | Nuevo |
| `src/app/hooks/useRealtimeSession.ts` | Handlers `response.done` + `rate_limits.updated` |
| `src/app/lib/postComparacionContinuar.ts` | Nudge vía scheduler; delay mínimo post-`audio_stopped` (~300 ms) |
| `src/app/App.tsx` | PTT / `response.create` vía scheduler |
| `src/app/hooks/useHandleSessionHistory.ts` | Breadcrumb `rate_limit_retry` |

### 9.4 Diagrama de flujo (Fases 2–3)

```
Triggers (VAD server, PTT, auto_chain, sendUserText)
        │
        ▼
  ResponseScheduler
    ├─ ¿responseInFlight? → cola
    ├─ ¿remaining >= HEADROOM? → response.create
    └─ si no → esperar backoff / rate_limits.updated

response.done (failed, rate_limit_exceeded)
        │
        ▼
  parseRetryAfter + backoff corto
        │
        ▼
  reintento (max 3):
    modo A → re-nudge o obtenerEtapa({})
    modo B → response.create (fallback: obtenerEtapa({}))
```

### 9.5 Limitación conocida: VAD server-side

Con `server_vad` + `create_response: true` en `session/route.ts`, el **servidor** crea respuestas sin pasar por el scheduler del cliente. Mitigación: Fase 1 (truncation) + Fase 3 (throttling). No se puede interceptar cada `response.create` interno del VAD.

---

## 10. Fases de implementación

### Fase 0 — Baseline de métricas (0,25 día, en paralelo con Fase 1)

| ID | Tarea |
|----|-------|
| 0.1 | Exportar logs de **un** examen sin truncation: `input_tokens`, `cached_tokens`, `rate_limit_exceeded` count |
| 0.2 | Calcular costo $ baseline con fórmula §7.6 |
| 0.3 | Anotar TPM pico (ventana 60 s más cargada) |

**Salida:** tabla comparativa para QA de Fase 1.

---

### Fase 1 — Truncation Variante A (0,5 día) ⭐ **PRÓXIMA**

**Objetivo:** reducir presión TPM podando historial server-side antes de llegar a ~8.600 tokens/turno.

| ID | Tarea | Archivo |
|----|-------|---------|
| 1.1 | Agregar `truncation` con `post_instructions: 6000`, `retention_ratio: 0.8` | `src/app/api/session/route.ts` |
| 1.2 | Verificar en logs que `session.created` / `session.updated` reflejan truncation | Panel Events |
| 1.3 | Ejecutar examen completo E2E con misma rutina clínica que baseline | Manual |
| 1.4 | Comparar métricas §7.7 (input/pico, % cache, TPM, rate limits, $) | Logs |
| 1.5 | QA clínico: sin saltos de etapa, Sigamos/auto_chain OK, interpretaciones correctas | CSV |

**Config a implementar:**

```json
"truncation": {
  "type": "retention_ratio",
  "retention_ratio": 0.8,
  "token_limits": {
    "post_instructions": 6000
  }
}
```

**Criterios de aceptación:**

- [ ] `input_tokens` promedio **< 6.500** en segunda mitad del examen (ETAPA_5/6).
- [ ] **Cero** `rate_limit_exceeded` en examen completo, o reducción ≥ 80 % vs baseline.
- [ ] Sin regresión clínica (mismo flujo que `examen-registro-9` / QA Punto 1).
- [ ] Costo $ del examen documentado; incremento ≤ 25 % vs baseline aceptable si TPM OK.
- [ ] Si no cumple: escalar a **Variante B** (`post_instructions: 4500`) o combinar con Fase 4 (podado manual).

**Si Fase 1 cumple:** Fases 2–3 pasan a “nice to have” (recuperación ante fallos residuales).

---

### Fase 2 — Reintento reactivo (1 día)

| ID | Tarea |
|----|-------|
| 1.1 | `responseScheduler.ts` con handler de `response.done` failed |
| 1.2 | Parser `Please try again in Xs` |
| 1.3 | Reintento automático (max 3, backoff + jitter, **sin** esperar `reset_seconds` completo) |
| 1.4 | Integrar en `handleTransportEvent` |
| 1.5 | Reintento de `auto_chain` nudge si aplica (modo A post-Sigamos) |
| 1.6 | Breadcrumb `rate_limit_retry` |
| 1.7 | Clasificador modo A/B; fallback `obtenerEtapa({})` equivalente a `{}` manual |

**Criterios de aceptación:**

- [ ] Ante `rate_limit_exceeded`, el examen continúa en **< 15 s** sin input del paciente.
- [ ] No hay audio duplicado en reintentos.
- [ ] Tras 3 fallos, log crítico (sin loop infinito).
- [ ] No se espera `reset_seconds` completo si el reintento temprano funciona.
- [ ] Recuperación automática **sin** `{}` manual del operador (equivalente funcional §2.6).

### Fase 3 — Throttling proactivo (1–1,5 días)

| ID | Tarea |
|----|-------|
| 2.1 | Consumir `rate_limits.updated` en scheduler |
| 2.2 | `HEADROOM` configurable (default 8.000) |
| 2.3 | Cola single-flight para triggers explícitos |
| 2.4 | Delay mínimo post-`audio_stopped` antes de `auto_chain` |

**Criterios de aceptación:**

- [ ] Reducción > 90 % de `rate_limit_exceeded` en examen completo E2E.
- [ ] Latencia añadida imperceptible cuando `remaining` es alto.

### Fase 4 — Podado manual de historial (opcional, 1 día)

| ID | Tarea |
|----|-------|
| 4.1 | Podar `function_call_output` antiguos (mantener último `obtenerEtapa`) |
| 4.2 | Evaluar desactivar guardrails en `chatSupervisor` |
| 4.3 | Acortar prompt / mover tablas de interpretación al backend |

**Cuándo:** si Fase 1 + Variante B aún no alcanzan para TPM.

### Fase 5 — UX y operaciones (0,5 día)

| ID | Tarea |
|----|-------|
| 4.1 | Indicador discreto “Un momento…” si delay > 3 s |
| 4.2 | Métrica `rate_limit_events / examen` en logs |
| 4.3 | Evaluar upgrade tier TPM con datos de Fase 0 |

---

## 11. Decisiones

| ID | Pregunta | Estado | Decisión |
|----|----------|--------|----------|
| **D1** | ¿Feedback al paciente durante espera? | Abierta | “Un momento…” si delay > 3 s (Fase 2) |
| **D2** | `HEADROOM` (tokens) | Abierta | **8k** (Fase 3) |
| **D3** | Max reintentos | Abierta | **3** (Fase 2) |
| **D4** | Max wait por intento | Abierta | **15s** — no usar `reset_seconds` como piso |
| **D5** | ¿Desactivar guardrails en examen? | Abierta | Evaluar en Fase 4 |
| **D6** | ¿Podar historial automáticamente? | Abierta | `conversation.item.delete` en Fase 4 |
| **D7** | ¿Upgrade TPM en paralelo? | Abierta | Sí si volumen crece |
| **D8** | Recuperación modo B | Cerrada | `response.create` primero; `obtenerEtapa({})` fallback (§2.6) |
| **D9** | Truncation para Fase 1 | **Cerrada** | **Variante A:** `post_instructions: 6000`, `retention_ratio: 0.8` |
| **D10** | Dónde configurar truncation | **Cerrada** | `src/app/api/session/route.ts` (objeto `session` en `client_secrets`) |

---

## 12. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Audio duplicado en reintento | Media | Single-flight; verificar `audio_stopped` / tool ya ejecutada |
| Loop de rate limit | Baja | Max 3 reintentos; pausa 60 s solo como último recurso |
| Latencia por throttling excesivo | Media | Solo esperar cuando `remaining < HEADROOM` |
| VAD server-side fuera del scheduler | Alta | Capa B + C; no interceptable desde cliente |
| Confundir `reset_seconds` de `requests` con `tokens` | Media | Filtrar siempre `name === "tokens"` |
| Doble avance servidor al reintentar `obtenerEtapa({})` en modo B | Baja–Media | Preferir `response.create` si tool result ya en historial (D8) |
| Operador depende de `{}` manual | Alta (hoy) | Fase 2 — automatizar equivalente |
| Truncation pierde contexto clínico en historial Realtime | Media | Backend stateful; validar QA Fase 1; subir a 6500 si hay regresión |
| Cache bust → costo $ sube | Media | Aceptable si elimina rate limits; medir en A/B §7.7 |
| `post_instructions: 6000` insuficiente | Media | Escalar a Variante B (4500) o Fase 4 |

---

## 13. Referencias

- [Managing costs — Realtime API](https://developers.openai.com/api/docs/guides/realtime-costs) — truncation, caching, `post_instructions`
- [Realtime conversations — OpenAI API](https://developers.openai.com/api/docs/guides/realtime-conversations) — ciclo `response.create` → `response.done` → `rate_limits.updated`
- [Rate limits — OpenAI API](https://developers.openai.com/api/docs/guides/rate-limits) — sliding window, `x-ratelimit-reset-tokens` = estado inicial completo
- [Error handling — Realtime](https://platform.openai.com/docs/guides/realtime-model-capabilities#error-handling) — la sesión sigue usable tras errores
- Código actual: `src/app/hooks/useRealtimeSession.ts`, `src/app/lib/postComparacionContinuar.ts`, `src/app/api/session/route.ts`
- Plan relacionado: `PLAN_FEEDBACK_CLIENTE_EXAMEN.md` (§2.3 — auto_chain post-Sigamos)

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 0.1 | 2026-07-01 | Documento inicial: síntoma, discovery API tokens, `reset_seconds` vs reintento real, arquitectura y fases |
| 0.2 | 2026-07-01 | §2 Workflow 3 actores; modos de fallo A/B; evidencia post-Sigamos; workaround `{}` |
| 0.3 | 2026-07-01 | §7 prompt caching + truncation; **Fase 1 = Variante A** (`post_instructions: 6000`, `retention_ratio: 0.8`); fases 2–5 reordenadas; D9–D10 cerradas |
