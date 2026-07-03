# Plan de implementación — Copys naturales del agente Realtime

**Versión:** 1.0  
**Fecha:** 2026-07-03  
**Estado:** **Listo para implementación**  
**Proyecto:** `openai-realtime-agents-main-2`  
**Objetivo:** Copys más naturales en `motorExamen.js`, con routing del agente por **matching de contexto** (campos ya existentes). Sin campos nuevos en API ni CSV.

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura](#2-arquitectura)
3. [Dinámica del examen](#3-dinámica-del-examen)
4. [Inventario de copys (antes)](#4-inventario-de-copys-antes)
5. [Copys definitivos — 3 variantes](#5-copys-definitivos--3-variantes)
6. [Decisiones cerradas](#6-decisiones-cerradas)
7. [Estrategia agente: matching por contexto](#7-estrategia-agente-matching-por-contexto)
8. [Payloads: qué cambia](#8-payloads-qué-cambia)
9. [Plan de implementación](#9-plan-de-implementación)
10. [Archivos afectados](#10-archivos-afectados)
11. [Riesgos y mitigaciones](#11-riesgos-y-mitigaciones)
12. [QA y criterios de aceptación](#12-qa-y-criterios-de-aceptación)
13. [Checklist de seguimiento](#13-checklist-de-seguimiento)

---

## 1. Resumen ejecutivo

| Problema | Copy actual | Dirección |
|----------|-------------|-----------|
| Post-comparación | `Sigamos con este.` | C11 — 3 variantes afirmativas |
| Comparación ETAPA_5 | `Ves mejor con este o con el anterior?` | C12 — 3 variantes con «nuevo lente / anterior» |
| Binocular | «configuración anterior / actual» | C15+C16 — «lente anterior / nuevo» |
| Agudeza | `Mirá la pantalla. Decime qué letra ves.` | C10 — 3 variantes |

**Tres pilares de la implementación:**

1. **Backend** (`motorExamen.js`): arrays de 3 strings, rotación determinística (`contador % 3`), eliminar intro ex-C13.
2. **Agente** (`chatSupervisor/index.ts`): routing por **contexto existente** — no por frases literales del mensaje.
3. **Sin metadata extra:** no `copyVersion`, no `varianteIndice`, no `tipoDialogo` (ni en API ni en CSV).

El agente sigue pronunciando `pasos[].mensaje` **verbatim**. La naturalidad vive en el motor; el prompt solo define **qué payload mandar** según el `contexto` de la última tool response.

---

## 2. Arquitectura

```
Paciente (voz)
    ↓
Agente Realtime — lee contexto de obtenerEtapa → decide payload
    ↓
POST /api/examen/instrucciones
    ↓
motorExamen.js — elige variante de copy, ejecuta hardware, devuelve hablar + contexto
    ↓
Foróptero + TV
```

| Regla | Implicación |
|-------|-------------|
| Solo `pasos[].mensaje` al paciente | Copys en el motor |
| `postComparacionContinuar` dispara auto-avance | C11 puede cambiar de texto sin tocar cliente |
| Preferencias: anterior / actual / igual | Variantes C12/C15+C16 mantienen «anterior» y sinónimos de «actual» |

---

## 3. Dinámica del examen

| # | Momento | Backend espera al responder | Flag / campo clave en `contexto` |
|---|---------|----------------------------|-----------------------------------|
| A | Comparación ETAPA_5 (incl. 1ª gruesa) | `interpretacionComparacion` | `comparacionEstado.faseComparacion === "preguntando"` |
| B | Post-comparación (ritual) | **Nada** (nudge → `{}`) | `postComparacionContinuar: true` |
| C | Pre-grueso ETAPA_5 | `interpretacionAgudeza` | `ajusteLogmarPreGrueso: true` |
| D | Agudeza ETAPA_4 | `interpretacionAgudeza` | `etapa === "ETAPA_4"` |
| E | Binocular «listo» | solo `respuestaPaciente` | `faseBinocular === "binoc_transicion_esperando_listo"` |
| F | Binocular comparación | `interpretacionComparacion` | `faseBinocular` en `binoc_esfera_preguntando` \| `binoc_cil_preguntando` |
| G | Autorefractómetro | solo `respuestaPaciente` | `etapa === "ETAPA_1"` |

**Cambio UX en A:** se elimina el intro *«Ahora te voy a mostrar otro lente…»* (ex-C13). Tras hardware, un solo `hablar` (C12).

---

## 4. Inventario de copys (antes)

| ID | Constante / ubicación | Texto actual |
|----|----------------------|--------------|
| C10 | `MSG_AGUDEZA_LETRA_PANTALLA` | `Mirá la pantalla. Decime qué letra ves.` |
| C11 | `MSG_POST_COMPARACION_LENTES` | `Sigamos con este.` |
| C12 | local en `generarPasosEtapa5` | `Ves mejor con este o con el anterior?` |
| ~~C13~~ | inline `iniciando` + `esferico_grueso` | *eliminar* |
| C15+C16 | `MSG_BINOC_PREGUNTA_COMBINADA` | configuración anterior/actual + mejor o peor |

Copys fuera de alcance v1: C01–C09, C14, C17–C19 (§5.4).

---

## 5. Copys definitivos — 3 variantes

### 5.1 Rotación (solo interna al motor)

| Familia | Contador en `estadoExamen` | Cuándo incrementar |
|---------|---------------------------|-------------------|
| C10 | `contadoresCopy.agudezaPreguntas` | Cada `hablar` de agudeza |
| C11 | `contadoresCopy.postComparacion` | Cada ritual post-comparación |
| C12 | `contadoresCopy.comparacionLentes` | Cada pregunta comparativa ETAPA_5 |
| Binocular | `contadoresCopy.comparacionBinoc` | Cada `MSG_BINOC_PREGUNTA_COMBINADA` |

```javascript
function elegirVariante(variantes, indice) {
  const n = variantes.length;
  return variantes[((indice % n) + n) % n];
}
```

Reset de contadores en `inicializarExamen()`. **No** exponer índice ni versión fuera del motor.

---

### C10 — Agudeza

| Var | Texto |
|-----|-------|
| V1 | `Mirá la pantalla y decime qué letra ves.` |
| V2 | `Fijate la letra en la pantalla… decime cuál es.` |
| V3 | `Mirá con calma la pantalla y contame qué letra distinguís.` |

---

### C11 — Post-comparación

| Var | Texto |
|-----|-------|
| V1 | `Bueno, volvemos a tu selección.` |
| V2 | `Perfecto, seguimos con el lente que elegiste.` |
| V3 | `Bien, me quedo con la opción elegida y continuamos.` |

Monólogo; **no** es pregunta. Routing: `postComparacionContinuar` (no el texto).

---

### C12 — Comparación ETAPA_5 (incl. ex-C13)

| Var | Texto |
|-----|-------|
| V1 | `Y ahora, ¿ves mejor con el nuevo lente o con el anterior?` |
| V2 | `¿Con cuál ves más claro: con el lente nuevo o con el anterior?` |
| V3 | `Probemos así… ¿preferís el lente nuevo o el anterior?` |

**Motor:** quitar bloque `if (tipo === 'esferico_grueso')` intro en `generarPasosEtapa5` (~l. 3002–3008).

---

### C15 + C16 — Binocular (mensaje combinado)

| Var | Texto |
|-----|-------|
| V1 | `Ahora probamos otro par de lentes. ¿Ves mejor con el lente anterior o con el nuevo?` |
| V2 | `Voy a cambiarte los lentes… fijate bien. ¿Con cuál ves más cómodo: el anterior o el nuevo?` |
| V3 | `Pasamos a otro par de lentes. Decime… ¿preferís el lente anterior o el que tenés ahora?` |

Reemplaza `MSG_BINOC_PRE_CAMBIO` + `MSG_BINOC_PREGUNTA` + `MSG_BINOC_PREGUNTA_COMBINADA` por array `MSG_BINOC_PREGUNTA_COMBINADA_VARIANTES`.

---

### 5.4 Fuera de alcance v1

C01–C09, C14, C17–C19 — sin cambios en esta entrega.

---

## 6. Decisiones cerradas

| ID | Decisión |
|----|----------|
| D01 | **3 variantes** por familia C10, C11, C12, binocular |
| D02 | C11 V3: *«Bien, me quedo con la opción elegida y continuamos.»* |
| D03 | Binocular: solo **lentes**, sin «configuración» |
| D04 | C13 **unificado en C12** — sin intro esférico grueso |
| D05 | Agente: **matching por contexto** (no listas literales en prompt) |
| D06 | **No** `copyVersion`, **no** `varianteIndice` (API, contexto ni CSV) |
| D07 | **No** `tipoDialogo` ni otros campos nuevos en `contexto` |
| D08 | Agente **verbatim** — sin muletillas propias |
| D09 | `copysExamen.js` separado: **opcional**; v1 deja arrays en `motorExamen.js` |
| D10 | Validación tono con operador clínico: **pendiente** (no bloquea implementación) |

---

## 7. Estrategia agente: matching por contexto

### Estado actual (pre-implementación)

Híbrido **parcialmente** por contexto y **parcialmente** por frases literales:

| Mecanismo | ¿En uso hoy? |
|-----------|--------------|
| `etapa === ETAPA_4` | ✅ |
| `ajusteLogmarPreGrueso === true` | ✅ |
| `postComparacionContinuar === true` | ✅ |
| Frase literal comparación ETAPA_5 | ✅ (una sola frase — **se rompe** con variantes) |
| Frase literal comparación ETAPA_6 | ✅ (una sola frase — **se rompe** con variantes) |
| `comparacionEstado.faseComparacion` | ❌ backend lo envía; prompt **no** lo usa |
| `binocularEstado.faseBinocular` | ❌ backend lo envía; prompt **no** lo usa |

### Reglas objetivo (reemplazar frases literales en `index.ts`)

Usar el `contexto` de la **última** respuesta de `obtenerEtapa` **antes** de que el paciente hable:

| Prioridad | Condición | Payload al responder |
|-----------|-----------|----------------------|
| 1 | `postComparacionContinuar === true` | No llamar `obtenerEtapa` hasta nudge `__POST_COMPARACION_CONTINUAR__`; luego `{}` |
| 2 | `etapa === "ETAPA_4"` | `respuestaPaciente` + `interpretacionAgudeza` |
| 3 | `etapa === "ETAPA_5"` && `ajusteLogmarPreGrueso === true` | `respuestaPaciente` + `interpretacionAgudeza` |
| 4 | `etapa === "ETAPA_5"` && `comparacionEstado?.faseComparacion === "preguntando"` | `respuestaPaciente` + `interpretacionComparacion` |
| 5 | `etapa === "ETAPA_6"` && `binocularEstado?.faseBinocular === "binoc_transicion_esperando_listo"` | solo `respuestaPaciente` |
| 6 | `etapa === "ETAPA_6"` && `faseBinocular` ∈ `binoc_esfera_preguntando`, `binoc_cil_preguntando` | `respuestaPaciente` + `interpretacionComparacion` |
| 7 | `etapa === "ETAPA_1"` | solo `respuestaPaciente` |
| 8 | Inicio / duda | `{}` |

**Notas de implementación en prompt:**

- Eliminar referencias a: *«¿Ves mejor con este o con el anterior?»*, *«configuración anterior»*, *«Sigamos»* como disparadores de payload.
- Mantener regla verbatim: solo `pasos[].mensaje`.
- Mantener tool-first ETAPA_4 / pre-grueso.
- Tras C11: ignorar «listo»/«bien» del paciente si `postComparacionContinuar` (referir por flag, no por palabra «Sigamos»).
- Binocular transición: regla 5 cubre también `MSG_BINOC_REINTENTO_LISTO` (misma `faseBinocular`).

### Verificación backend (misma PR)

Confirmar que **toda** respuesta con pregunta comparativa incluye:

- ETAPA_5: `comparacionEstado.faseComparacion === "preguntando"` (ya en `generarPasosEtapa5`)
- ETAPA_6: al emitir pregunta combinada, `faseBinocular` pasa a `binoc_esfera_preguntando` o `binoc_cil_preguntando` en el `contexto` retornado

---

## 8. Payloads: qué cambia

### Respuesta backend (`obtenerEtapa` → agente)

| Situación | Cambia `pasos[].mensaje` | Cambia `contexto` | Cambia cantidad de `hablar` |
|-----------|--------------------------|-------------------|------------------------------|
| C10 agudeza | ✅ variante | No (solo `etapa`, `agudezaEstado`) | No |
| C11 post-comp. | ✅ variante | No (`postComparacionContinuar` igual) | No |
| C12 comparación | ✅ variante | No (`comparacionEstado` igual) | No |
| 1ª comp. gruesa | ✅ C12 | No | **Sí: 2 → 1** |
| Binocular comp. | ✅ variante | No (`binocularEstado` igual) | No |

### Request agente → backend (cuando el paciente responde)

**Sin cambios de estructura** en ningún caso. Solo cambia la **regla del prompt** que elige los campos.

---

## 9. Plan de implementación

### 9.1 `motorExamen.js`

| # | Tarea | Detalle |
|---|-------|---------|
| M1 | Helper + contadores | `elegirVariante`, `contadoresCopy` en `estadoExamen` + `inicializarExamen()` |
| M2 | C10 | `MSG_AGUDEZA_LETRA_PANTALLA_VARIANTES` en `pasosTvYLecturaAgudeza` |
| M3 | C11 | `MSG_POST_COMPARACION_LENTES_VARIANTES` en los 3 returns con `postComparacionContinuar` (~2016, 2115, 2213) |
| M4 | C12 | `MSG_COMPARACION_LENTES_VARIANTES`; reemplazar `mensajePreguntaComparacion` local |
| M5 | Ex-C13 | Eliminar intro `esferico_grueso` en rama `iniciando` |
| M6 | Binocular | `MSG_BINOC_PREGUNTA_COMBINADA_VARIANTES`; eliminar constantes sueltas C15/C16 si no se usan |
| M7 | Comentarios | Actualizar comentarios que citen `Sigamos con este.` |

### 9.2 `chatSupervisor/index.ts`

| # | Tarea | Detalle |
|---|-------|---------|
| A1 | Tabla «Qué mandar» | Reemplazar filas con frases literales por reglas §7 |
| A2 | ETAPA_5 / ETAPA_6 | Quitar líneas 79, 84 que citan frases fijas; usar `faseComparacion` / `faseBinocular` |
| A3 | Ejemplo línea 13 | Quitar ejemplo con frase única; reforzar verbatim genérico |
| A4 | Post-comparación | Referir `postComparacionContinuar`, no «Sigamos» |
| A5 | Tool description | Alinear descripción de `obtenerEtapa` con matching por contexto |

### 9.3 Documentación

| # | Tarea |
|---|-------|
| D1 | `DOCUMENTACION.md` — mensaje estándar ETAPA_5 y binocular |
| D2 | Grep repo — frases legacy en docs activos (planes históricos pueden quedar) |

### 9.4 Deploy

1. Railway: `foroptero-server` (motor)
2. Frontend: `chatSupervisor` (mismo PR o inmediatamente después)
3. QA: examen completo + registro CSV

### 9.5 Futuro (fuera v1)

- Copys C01–C09, C14, C17–C19 (§5.4)
- Módulo `copysExamen.js` si el inventario crece

---

## 10. Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `reference/foroptero-server/motorExamen.js` | **Principal** |
| `src/app/agentConfigs/chatSupervisor/index.ts` | Matching §7 |
| `DOCUMENTACION.md` | Contrato ETAPA_5 / binocular |

**No tocar:** `postComparacionContinuar.ts`, firmware, lógica numérica de comparación.

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Agente no manda `interpretacionComparacion` tras copys nuevos | Matching por `faseComparacion` / `faseBinocular` en mismo PR |
| `comparacionEstado` ausente en algún return | Verificación M4 + grep `faseComparacion` en paths ETAPA_5 |
| Regresión post-comparación (auto-avance) | QA: `postComparacionContinuar` intacto; C11 no es pregunta |
| Paciente dice «este» / «nuevo» | Tabla preferencias del prompt sin cambios |
| Desincronización motor ↔ agente por textos | Una sola fuente de routing: **contexto**, no strings |

---

## 12. QA y criterios de aceptación

### Checklist manual

- [ ] Agudeza: rotan variantes C10; payload `interpretacionAgudeza` correcto (`etapa` ETAPA_4).
- [ ] Comparación ETAPA_5: variantes C12; payload `interpretacionComparacion` (`faseComparacion === preguntando`).
- [ ] 1ª comparación esférico grueso: **un solo** `hablar` (sin intro).
- [ ] Post-comparación: variantes C11; avance **sin** «listo» del paciente.
- [ ] Binocular: variantes combinadas; comparación con `interpretacionComparacion`; «listo» solo con `faseBinocular` transición.
- [ ] CSV columna Oftalmólogo: textos nuevos (sin campos extra).
- [ ] Sin regresión clínica (protocolo tipo registro-14/16).

### Criterios globales

1. Naturalidad percibida por operador clínico.
2. Verbatim: TTS = `pasos[].mensaje`.
3. Sin regresión de fluidez post-comparación (`PLAN_FEEDBACK_CLIENTE_EXAMEN.md` §2.3).

---

## 13. Checklist de seguimiento

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Diseño y copys §5 | ✅ |
| 2 | Estrategia matching §7 | ✅ |
| 3 | Implementar motor M1–M7 | ✅ |
| 4 | Implementar agente A1–A5 | ✅ |
| 5 | Docs D1–D2 | ✅ |
| 6 | Deploy + QA §12 | ⬜ |
| 7 | Validación tono operador (D10) | ⬜ |

---

## Anexo A — Evidencia de repetición

`examen-registro-13.csv` (~15 min ETAPA_5): **14×** pregunta comparación idéntica, **10×** «Sigamos con este.»

---

## Anexo B — Referencias

- `src/app/agentConfigs/chatSupervisor/index.ts`
- `reference/foroptero-server/motorExamen.js` (~936, 1209, 1775, 2838, 3002, 3505)
- `PLAN_FEEDBACK_CLIENTE_EXAMEN.md` §2.3
- `PLAN_RATE_LIMIT_EXAMEN.md` (pacing independiente del copy)

---

## Anexo C — Alternativas descartadas

| Alternativa | Motivo |
|-------------|--------|
| Parafraseo libre por el LLM | Riesgo clínico y de protocolo |
| Listas literales de 3 variantes en prompt | Desincronización motor ↔ agente; menos estable que contexto |
| `tipoDialogo` / `copyVersion` / `varianteIndice` | Redundante con campos existentes; no deseado por producto |
