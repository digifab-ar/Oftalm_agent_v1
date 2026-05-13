# Plan de implementación — Reanclaje del foróptero al resultado de cada comparativa de lentes

**Estado:** planificación — **decisiones de producto acordadas** en §4.3 (implementación de código pendiente).  
**Relacionado:** `DOCUMENTACION.md`, `motorExamen.js`, `src/app/agentConfigs/chatSupervisor/index.ts`, `DEFINICIONES_EXAMEN_BINOCULAR.md`.

---

## 1. Objetivo y regla normativa unificada

### 1.1 Regla que debe cumplirse en todos los contextos comparativos

Después de cada respuesta del paciente a una pregunta de preferencia entre **configuración anterior** y **actual** (y el tratamiento acordado de **igual**; ver §4.3):

1. El **resultado de la comparación** queda definido como la corrección (o par R/L en binocular) que el paciente **eligió** según la semántica `anterior` / `actual` / `igual` (con la resolución de `igual` indicada en §4.3).
2. El **hardware del foróptero** debe reflejar **ese resultado** como estado de referencia **antes** de presentar la **siguiente** prueba comparativa, **cuando haga falta un movimiento** (p. ej. eligió **anterior** y el dispositivo aún muestra la **actual** / variante). Si ya estaba en el resultado, **no** se envía comando foróptero redundante por reanclaje.
3. **Siempre**, antes de la siguiente prueba comparativa (o del siguiente bloque comparativo en binocular), se aplica la **pausa fija** y el **mensaje único** de §4.3 (tiempo de reacomodo visual + texto que el agente repite literal).
4. Durante el tramo de **reanclaje** foróptero, la **TV no se modifica** (§4.3); la TV solo entra en los pasos habituales de presentación de la **siguiente** prueba.

Esta regla aplica por igual a:

- **ETAPA_5:** `esferico_grueso`, `esferico_fino`, `cilindrico`, `cilindrico_angulo` (monocular, un ojo abierto).
- **ETAPA_6:** comparación binocular esférica y, si aplica, cilíndrica (`DEFINICIONES_EXAMEN_BINOCULAR.md` §8).

---

## 2. Verificación contra la documentación y el código

### 2.1 `DOCUMENTACION.md`

| Qué documenta hoy | Relación con la regla §1 |
|-------------------|---------------------------|
| ETAPA_5: algoritmo de 3 valores, confirmaciones, mensaje estándar “¿Ves mejor con este o con el anterior?” | Describe **lógica de búsqueda** y contrato conversacional (≥1 `hablar`), **no** exige explícitamente un paso de **reanclaje físico** al valor elegido antes del siguiente salto. |
| ETAPA_6: variante aplicada antes del `hablar` combinado; respuestas con `interpretacionComparacion` | Alinea **percepción** con la pregunta mientras hay variante puesta; **no** documenta un paso intermedio “volver a la Rx elegida y esperar” antes de la **siguiente** ronda (p. ej. esfera → cilindro). |
| Garantía ETAPA_5: siempre al menos un paso `hablar` | Compatible con la regla nueva; habrá que **ordenar** nuevos `hablar` / esperas sin romper esta garantía. |

**Conclusión:** La regla §1 debe **incorporarse** a `DOCUMENTACION.md` (y a `DEFINICIONES_EXAMEN_BINOCULAR.md` §11 o nuevo apartado) como **contrato de hardware** explícito, no solo como algoritmo de valores.

### 2.2 `reference/foroptero-server/motorExamen.js`

#### ETAPA_5 — Flujo relevante

- Tras `procesarRespuestaComparacionLentes`, si `necesitaMostrarLente` es verdadero, `obtenerInstrucciones` genera **un único** bloque `pasosMostrar` con `valorAMostrar` y ejecuta `ejecutarPasosAutomaticamente`, luego `generarPasosEtapa5()` para la pregunta.
- `valorAMostrar` representa el **siguiente valor del algoritmo** (p. ej. tras “anterior” con `valorActual === valorMas` se pide mostrar `valorMenos`), **no** necesariamente el **valor recién elegido** por el paciente como parada intermedia en el hardware.
- `generarPasosMostrarLente` / cilíndrico / ángulo ya incluyen `foroptero` → `esperar_foroptero` → `tv`, pero **una sola** transición por llamada.

**Brecha:** No existe hoy una secuencia genérica **dos fases**: (A) aplicar Rx/lente = **resultado de la comparación**; (B) aplicar siguiente **prueba**. Cuando el resultado elegido ≠ `valorAMostrar` del primer comando, el paciente puede no tener referencia clara de “contra qué” viene el siguiente lente.

#### ETAPA_6 — Flujo relevante

- `generarPasosEtapa6`: en `FB_ESF_MOSTRAR` / `FB_CIL_MOSTRAR` aplica `foropteroDesdeRx(estadoActual.rxVariante)`, luego `esperar_foroptero`, TV, y el mensaje combinado (`MSG_BINOC_PREGUNTA_COMBINADA`).
- `procesarRespuestaBinocular`: interpreta preferencia (con `igual` → `anterior`); actualiza `rxActiva`; en paso esférico, si no termina, asigna `rxBasePaso` desde `rxActiva`, calcula `rxVariante` para el **siguiente** paso (cilindro) y pone `faseBinocular = FB_CIL_MOSTRAR`, devolviendo `necesitaMostrarLente: true`.
- La siguiente generación de pasos muestra **directamente** la nueva `rxVariante` (p. ej. variante cilíndrica), **sin** un paso explícito previo de “solo `rxActiva` / `rxBasePaso` elegido” + espera, antes de introducir la variante del siguiente eje.

**Brecha:** Tras una respuesta, si el paciente estaba viendo la **variante** y eligió **anterior**, el código fija la base en estado pero el **primer** comando foróptero de la siguiente tanda puede ser ya la **nueva** variante (otro eje). **Decisión acordada (§4.3):** entre comparación esférica binocular y la cilíndrica, el **reanclaje foróptero explícito** al resultado elegido ocurre **solo** si la preferencia fue **anterior**; si fue **actual**, no hay ese paso intermedio de solo-Rx-elegida, pero sí la pausa + mensaje global.

### 2.3 `src/app/agentConfigs/chatSupervisor/index.ts`

- El agente **solo** verbaliza `pasos[].mensaje` del backend, sin improvisar.
- Ya existe mención a mensajes de **espera técnica** (“esperá que se muevan los lentes”) con instrucción de llamar de nuevo a `obtenerEtapa()` **sin** esperar respuesta del paciente.
- Payload: `interpretacionComparacion` en ETAPA_5 (comparativa) y ETAPA_6 cuando el mensaje incluye la pregunta comparativa; no en transición “listo”.

**Implicación:** Pausa y mensaje de §4.3 deben materializarse en **pasos** que el agente pueda verbalizar (`hablar`) y/o ejecutar en orden; la pausa fija puede ser paso dedicado (`esperar_ms` o equivalente) **entre** movimiento foróptero (si hubo) y el `hablar`, según implementación — siempre sin texto generado por el modelo.

---

## 3. Matriz de cobertura (regla §1 vs. implementación actual)

| Contexto | Comparativa | Resultado elegido mapeado en código | ¿Foróptero queda en resultado antes de siguiente prueba? |
|----------|-------------|-------------------------------------|----------------------------------------------------------|
| ETAPA_5 | Esférico grueso/fino | `procesarRespuestaComparacionLentes` + `valorAMostrar` | **Parcial / no garantizado** — siguiente comando suele ser el siguiente salto del algoritmo. |
| ETAPA_5 | Cilíndrico / ángulo | Idem | Idem. |
| ETAPA_6 | Esférico binocular | `rxActiva` → `rxBasePaso` | **No explícito** — siguiente bloque aplica `rxVariante` del paso cilíndrico. |
| ETAPA_6 | Cilíndrico binocular | `rxActiva` → confirmación o fin | Última ronda: confirma; no hay “siguiente comparativa” salvo redefinición futura. |

---

## 4. Especificación funcional (para implementación futura)

### 4.1 Definiciones

- **Resultado de comparación (Rx de referencia):** el valor o par R/L que corresponde a la opción elegida (`anterior` / `actual`) **en la ronda que acaba de cerrarse**, o el desempate por **igual** según §4.3.
- **Siguiente prueba:** el siguiente valor o `rxVariante` que el algoritmo quiere mostrar para **nueva** pregunta comparativa (o fin de test).

### 4.2 Secuencia lógica tras cada respuesta comparativa (plantilla)

1. Calcular **resultado** de la ronda (monocular o binocular).
2. **Movimiento foróptero al resultado** si y solo si el dispositivo no está ya en ese resultado (caso típico: **anterior** con variante aún en cara). **Sin pasos de TV** en este tramo.
3. Si hubo comando foróptero: `esperar_foroptero` como hoy.
4. **Siempre:** pausa fija **3 s** (reacomodo del ojo; independiente del tiempo del motor salvo que el orden de implementación requiera encadenarla después de `esperar_foroptero`).
5. **Siempre:** un paso `hablar` con el **único** texto de §4.3 (backend; el agente lo repite literal).
6. **Siguiente prueba:** pasos habituales (foróptero variante / siguiente salto, TV si corresponde, pregunta comparativa).

### 4.3 Decisiones de producto acordadas (definiciones cerradas)

| Tema | Decisión |
|------|----------|
| **Mensaje tras cada comparación** | **Siempre** una pequeña pausa y un breve mensaje; **una sola versión** de texto en todo el examen (ETAPA_5 y ETAPA_6), **100 % backend**, tono natural. Texto canónico: **`Sigamos con este.`** (sin variantes por tipo de test ni etapa). |
| **Pausa** | **Pausa fija de 3 segundos** para reacomodo del ojo del paciente (además de `esperar_foroptero` cuando corresponda por movimiento real). |
| **TV en reanclaje** | **No** modificar la TV durante el tramo de reanclaje foróptero; la TV solo se actualiza en la presentación normal de la **siguiente** prueba. |
| **Binocular: esfera → cilindro** | Bloque **extra** “foróptero al resultado elegido de la esfera + espera + (sin TV)” **solo** si la preferencia en esa ronda fue **`anterior`**. Si fue **`actual`**, no se inserta ese reanclaje foróptero intermedio; igualmente aplican pausa 3 s + `Sigamos con este.` antes de mostrar la variante cilíndrica. |
| **Respuesta `igual` (ETAPA_5)** | Resolver el desempate **cayendo en el valor más pequeño** (alineado con la lógica ya existente en `motorExamen.js` cuando el paciente insiste en “igual”). Documentar el mismo criterio en specs si hiciera falta distinguir primera vs segunda vez. |
| **Respuesta `igual` (ETAPA_6)** | Mantener la semántica ya definida en `DEFINICIONES_EXAMEN_BINOCULAR.md` (equivalente a **anterior** en esa ronda) para el **resultado**; el reanclaje foróptero explícito esfera→cilindro sigue la fila **anterior** de la tabla anterior (en la práctica, `igual` → tratamiento como anterior para ese criterio). |
| **Agente** | Sin cambios de filosofía: solo dicta `pasos[].mensaje` del backend. Cualquier ajuste en `chatSupervisor/index.ts` es opcional (p. ej. mencionar el nuevo mensaje en ejemplos) si ayuda a operadores; **no** se introducen variantes de texto en el prompt. |

**Orden sugerido del bloque “siempre pausa + mensaje”:** tras `esperar_foroptero` (si hubo movimiento), ejecutar **espera 3 s**, luego `hablar` con `Sigamos con este.` — de modo que el mensaje cae cuando el ojo ya tuvo tiempo tras el fin de movimiento.

---

## 5. Plan de implementación por fases (código — futuro)

### Fase 1 — Especificación y contrato

- Actualizar `DOCUMENTACION.md` (ETAPA_5, ETAPA_6) y `DEFINICIONES_EXAMEN_BINOCULAR.md` con la regla §1, la secuencia §4.2 y la tabla §4.3.
- Añadir en código (cuando se implemente) constante única para `MSG_POST_COMPARACION = 'Sigamos con este.'` y documentarla en un solo lugar.

### Fase 2 — ETAPA_5 (`motorExamen.js`)

- Extender el retorno de `procesarRespuestaComparacionLentes` (o la capa en `obtenerInstrucciones`) para distinguir:
  - **Reanclaje foróptero** al resultado (solo si hace falta; **sin** TV en ese sub-bloque),
  - **Pausa 3 s + `hablar`** siempre antes de la siguiente prueba,
  - **Siguiente prueba** con generación actual (foróptero + TV + pregunta).
- Posible refactor: helpers `generarPasosSoloForoptero*` / flag en generadores existentes para omitir TV en reanclaje.
- Revisar actualización de `valorActual`, `valorAnterior`, `faseComparacion` y `valoresProbados` **después** del reanclaje para que la siguiente pregunta siga siendo semánticamente correcta.
- Rama **`igual`:** confirmar que el desempate final sigue **valor más pequeño** y que el bloque pausa+mensaje encaja antes del siguiente estado o confirmación.

### Fase 3 — ETAPA_6 (`motorExamen.js`)

- Entre respuesta de la comparación **esférica** y `FB_CIL_MOSTRAR`: si preferencia fue **`anterior`** (incluye mapeo `igual` → anterior), insertar `foropteroDesdeRx(rxActiva normalizada / resultado esférico)` + `esperar_foroptero`, **sin TV**.
- Si preferencia fue **`actual`**: **no** insertar ese reanclaje foróptero intermedio.
- En **ambos** casos, antes de aplicar la variante cilíndrica: **pausa 3 s** + `hablar` `Sigamos con este.` (§4.3).
- Introducir paso de espera **3000 ms** en el ejecutor de pasos si aún no existe tipo reutilizable.

### Fase 4 — Agente (`chatSupervisor/index.ts`)

- Solo si el backend emite nuevos tipos de mensaje: ajustar tablas “Qué mandar al backend” si cambia el contexto (p. ej. flags `reanclajePendiente` en `contexto`).
- Mantener la regla: **no** texto generado por el modelo fuera de `pasos[].mensaje`.

### Fase 5 — Pruebas

- Casos ETAPA_5: cada tipo de test; ramas `anterior`, `actual`, `igual`; límites de rango; cambio de ojo R→L.
- Casos ETAPA_6: `anterior`/`actual` en esfera con y sin segundo paso cilíndrico; `igual`; `testbin`.
- Pruebas de regresión del contrato HTTP (solo `hablar` al agente tras auto-ejecución).

---

## 6. Archivos previstos a tocar (implementación futura)

| Archivo | Motivo |
|---------|--------|
| `reference/foroptero-server/motorExamen.js` | Orquestación ETAPA_5/6 y generación de pasos. |
| `DOCUMENTACION.md` | Contrato y flujo documentado para frontend/agente/operador. |
| `reference/foroptero-server/DEFINICIONES_EXAMEN_BINOCULAR.md` | Binocular: semántica + flujo post-respuesta. |
| `reference/foroptero-server/examenprueba.md` (si existe checklist) | Modos `testesf` / `testcil` / `testbin`. |
| `src/app/agentConfigs/chatSupervisor/index.ts` | Solo si cambia `contexto` o guiones de espera. |

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Alargar el examen | Coste aceptado: 3 s fijos por ronda comparativa + movimientos necesarios; no añadir variantes de texto. |
| Incoherencia `valorActual` / pregunta “este/anterior” | Tests de estado y trazas; revisar orden de mutación de `comparacionActual`. |
| Binocular: doble movimiento si anterior + cilindro | Solo cuando eligió anterior; orden: resultado → esperar_foroptero → 3 s → mensaje → variante cil. |
| Regresión del contrato “solo mensajes backend al paciente” | Un único string backend `Sigamos con este.` |
| TV parpadea o cambia en reanclaje | Tests que aseguren cero pasos `tv` en el sub-bloque de reanclaje. |

---

## 8. Criterios de aceptación (borrador)

- Tras cada respuesta de comparación válida, **antes** de la siguiente prueba comparativa: **siempre** espera **3 s** + `hablar` **`Sigamos con este.`** (única redacción).
- Reanclaje **foróptero** al resultado de la ronda cuando el hardware **no** coincida ya con ese resultado; en transición **binocular esfera → cilindro**, el reanclaje foróptero explícito **solo** si la preferencia fue **anterior** (y equivalente `igual` según §4.3).
- En el tramo solo de reanclaje: **ningún** paso que modifique la TV; la TV se actualiza solo al armar la siguiente prueba.
- Documentación y comportamiento alineados con §4.3; modos de prueba verificados.

---

## 9. Resumen ejecutivo

La regla unificada **“lentes al resultado cuando haga falta + pausa y mensaje siempre antes de la siguiente comparación”** no está hoy **explicitada** en `DOCUMENTACION.md` ni **implementada** de forma uniforme en `motorExamen.js`. Las decisiones de **§4.3** (mensaje único `Sigamos con este.`, 3 s, TV intacta en reanclaje, binocular solo-foróptero-intermedio si **anterior**, `igual` ETAPA_5 → valor más pequeño) cierran el contrato para implementación y para alinear `DEFINICIONES_EXAMEN_BINOCULAR.md` y el agente, que seguirá **solo** dictando textos del backend.
