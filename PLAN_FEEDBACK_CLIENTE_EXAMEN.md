# Plan de implementación — Feedback cliente (examen visual)

**Versión:** 1.3  
**Fecha:** 2026-07-03  
**Estado:** **Puntos 1–4 cerrados (implementado + QA OK)** — Puntos 5–6 pendientes (medición + firmware)  
**Proyecto:** `openai-realtime-agents-main-2`  
**Alcance:** Planificación y registro de entregas. **Punto 1** (`14c2768`, `54c1ef0`); **Punto 2** (`b1bb8fa`); **Punto 3** (`a20b305`); **Punto 4** (`f30ee41`).

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Ítems del feedback](#2-ítems-del-feedback)
   - [2.1 Texto original](#21-texto-original)
   - [2.2 Preguntas abiertas](#22-preguntas-abiertas-para-cerrar-con-el-cliente)
   - [2.3 Ítem 1 — Fluidez](#23-ítem-1--fluidez-del-examen-bug-1)
     - [2.3.8 Implementación y cierre (Fase 1)](#238-implementación-y-cierre-fase-1)
   - [2.4 Ítem 2 — Valor esférico](#24-ítem-2--valor-esférico-en-etapa-cilíndrica)
     - [2.4.5 Implementación y cierre (Punto 2)](#245-implementación-y-cierre-punto-2)
   - [2.5 Ítem 3 — Velocidad / foróptero](#25-ítem-3--velocidad--fluidez-del-foróptero)
     - [2.5.10 Implementación y cierre (Punto 4)](#2510-implementación-y-cierre-punto-4--fase-a)
   - [2.6 Ítem 4 — Cilíndrico siempre](#26-ítem-4--examen-cilíndrico-siempre)
3. [Mapa del sistema actual](#3-mapa-del-sistema-actual)
4. [Evidencia de campo — registros CSV](#4-evidencia-de-campo--registros-csv)
   - [4.0.1 examen-registro-8 — Fase 1a/1b](#401-examen-registro-8--regresión-intermedia-fase-1a-y-validación-fase-1b)
   - [4.0.2 examen-registro-9 — QA Punto 1 OK](#402-examen-registro-9--qa-punto-1-ok-post-fix)
   - [4.0.3 examen-registro-10 — QA Punto 2 OK](#403-examen-registro-10--qa-punto-2-ok-post-fix)
   - [4.0.4 examen-registro-11 — QA Punto 3 OK](#404-examen-registro-11--qa-punto-3-ok-post-fix)
   - [4.0.5 examen-registro-13 — QA Punto 4 OK](#405-examen-registro-13--qa-punto-4-ok-post-fix)
   - [4.0.6 examen-registro-14 — QA fix B3 cilíndrico secuencial](#406-examen-registro-14--qa-fix-b3-cilíndrico-secuencial-post-fix)
   - [4.0.7 examen-registro-15 — QA fix B1 Rx entrada binocular](#407-examen-registro-15--qa-fix-b1-rx-entrada-binocular-post-fix)
   - [4.0.8 examen-registro-16 — QA fix B4 omitir pasos no-op binocular](#408-examen-registro-16--qa-fix-b4-omitir-pasos-no-op-binocular-post-fix)
   - [4.0.9 Copy natural v1.0 + fixes P0 orquestación](#409-copy-natural-v10--fixes-p0-orquestación-post-reg17)
5. [Orden de trabajo sugerido](#5-orden-de-trabajo-sugerido)
   - [5.1 Plan de QA por entrega](#51-plan-de-qa-por-entrega-un-punto-a-la-vez)
6. [Criterios de aceptación globales](#6-criterios-de-aceptación-globales)
7. [Riesgos y dependencias](#7-riesgos-y-dependencias)
8. [Checklist de seguimiento](#8-checklist-de-seguimiento)

---
## 1. Resumen ejecutivo

El cliente reportó cuatro problemas de experiencia clínica durante el examen automatizado con foróptero digital y agente de voz:

| # | Feedback | Área principal | Severidad percibida |
|---|----------|----------------|---------------------|
| 1 | Hay que decir "Bien"/"listo" para que avance tras Sigamos | Agente Realtime (no encadena tool call) | Alta — **cerrado §2.3.8** |
| 2 | Error en valor esférico: no se usa el resultado esférico al pasar a cilíndrico | Backend (`motorExamen.js`) | Alta — **cerrado §2.4.5** |
| 3 | El movimiento del foróptero para lentes esféricos debería ser más rápido | Firmware ESP32 + backend (Fase A cerrada) | Media — **Fase A cerrada §2.5.10**; Fase B pendiente |
| 4 | El examen cilíndrico debe realizarse siempre, no condicionado a ciertos valores | Backend (secuencia del examen) | Alta — **cerrado §2.6, §4.0.4** |

**Estado por ítem (v1.3):**

- **Bug 1** (ítem 1) **implementado y QA OK** (§2.3.8, §4.0.2): tras `Sigamos con este.` el examen avanza **sin** input del paciente vía `auto_chain` + señal `__POST_COMPARACION_CONTINUAR__`. Pre-fix: `examen-registro-6.csv` (§4.0). Regresión intermedia: `examen-registro-8` (§4.0.1). **Evidencia post-fix:** `registros-examen/examen-registro-9.csv`.
- **Bug 2** (ítem 2) **implementado y QA OK** (§2.4.5, §4.0.3): esfera confirmada (incl. **0.00 D**) se usa en toda configuración cilíndrica vía `calcularValoresFinalesForoptero`. Pre-fix: `examen-registro-5.csv`, `examen-registro-7.csv` (§4.1, §4.1.1). **Evidencia post-fix:** `registros-examen/examen-registro-10.csv` (commit `b1bb8fa`).
- **Bug 4** (ítem 4) **implementado y QA OK** (§2.6, §4.0.4): test `cilindrico` siempre por ojo; modo `cilindricoSecuencialBajo` para bases `0` / `−0,25`. Pre-fix: `examen-registro-5.csv` (§4.2). **Evidencia post-fix:** `registros-examen/examen-registro-11.csv` (commit `a20b305`).
- **Ítem 3 — Fase A** (preajuste bilateral + R→L) **implementado y QA OK** (§2.5.10, §4.0.5): ETAPA_3 posiciona ambos ojos; transición OD→OI solo oclusión. Pre-fix: `examen-registro-5.csv` (§4, salto 19:12:32). **Evidencia post-fix:** `registros-examen/examen-registro-13.csv` (commit `f30ee41`).
- **Ítem 3 — Fase B** (velocidad esférica −50 % en grueso: **7 s → 3,5 s / 0,50 D**, Q5) — **pendiente** (Puntos 5–6; §2.5.7).

---


## 2. Ítems del feedback

### 2.1 Texto original

1. *El examen es poco fluido. Hay que decirle continuar / Listo para que se haga todo el examen.*
2. *Error en valor esférico. No se toma el valor resultado de esférico para la etapa cilíndrico.*
3. *El movimiento del foróptero para los lentes esféricos debería ser más rápido.*
4. *Examen cilíndrico: siempre debe realizarse el examen cilíndrico, no desde ciertos valores como hoy en día está especificado.*

### 2.2 Preguntas abiertas para cerrar con el cliente

| ID | Pregunta | Impacto | Estado |
|----|----------|---------|--------|
| Q1 | ¿"Poco fluido" se refiere a **todo** el examen o a momentos concretos? | Ítem 1 | **Cerrada** — momento concreto: hay que **decirle algo al agente** tras `Sigamos con este.` (§2.3.1) |
| Q2 | ¿El "listo" lo pide el agente o la UI? | Ítem 1 | **Cerrada (evidencia)** — **ni backend ni UI** lo piden tras Sigamos; el agente Realtime **cede el turno** y el paciente habla por iniciativa propia (§2.3.3, §4.0). No requiere más input del cliente. |
| Q3 | ¿Caso reproducible del error esférico→cilíndrico? | Ítem 2 | **Cerrada** — ver §4.1 y §4.1.1 (`examen-registro-5.csv`, `examen-registro-7.csv`) |
| Q4 | Para cilíndrico "siempre": ¿incluye también **cilíndrico ángulo** o solo potencia cilíndrica? | Ítem 4 | **Cerrada** — **no se implementa** cilíndrico ángulo; queda **pendiente** / fuera de alcance de este ítem (§2.6.3) |
| Q5 | ¿Qué tan rápido esperan el movimiento esférico (referencia en segundos)? | Ítem 3 | **Cerrada** — reducción **50 %** en esférico grueso: **7 s → 3,5 s por 0,50 D** (§2.5.3, §2.5.7.7) |

---


### 2.3 Ítem 1 — Fluidez del examen (Bug 1)

#### 2.3.1 Síntoma reportado

El examen **se detiene** hasta que el paciente dice "Bien", "listo" u equivalente — en particular **después de** `Sigamos con este.` (**Q1 cerrada:** ese momento concreto es lo que el cliente describe como "poco fluido"). Confirmado en prueba 2026-07-01 (§4.0).

#### 2.3.2 Aclaración de producto

| Qué | Rol |
|-----|-----|
| **`Sigamos con este.`** | Feedback clínico intencional (lente elegido). **Se mantiene.** |
| **Espera de respuesta del paciente** | **Es el bug.** El agente no debe pedir ni aguardar turno tras Sigamos cuando `postComparacionContinuar: true`. |

#### 2.3.3 Diagnóstico

**Causa raíz:** el agente Realtime **no encadena** `obtenerEtapa({})` al terminar de pronunciar Sigamos; cede el turno al paciente como si hubiera una pregunta pendiente.

**Cadena causal:**

```
Backend → Sigamos + postComparacionContinuar: true
  → Agente pronuncia Sigamos (OK)
  → Agente DEBERÍA llamar obtenerEtapa({}) sin respuestaPaciente
  → FALLA: espera input del usuario ("Bien", "listo", …)
  → Paciente habla para destrabar (no llega al servidor si el agente no la reenvía)
  → Agente llama obtenerEtapa → backend ejecuta deferred → continúa el examen
```

**Nota Q2:** Tras Sigamos, el backend envía `postComparacionContinuar: true` y **no** incluye pregunta al paciente. La UI tampoco muestra un prompt de "listo". El paciente habla porque el agente Realtime **no encadena** la tool call y queda un silencio ambiguo — no porque el sistema lo solicite explícitamente.

**Nota sobre el CSV:** la ausencia de fila `Paciente` en esos momentos es **consecuencia** del Bug 1 en el agente, no un defecto del export (§4.0).

**Otros checkpoints con respuesta legítima (no Bug 1):**

| Momento | ¿Espera paciente? |
|---------|-------------------|
| Pre-grueso *"decime si ves bien"* | Sí — clínico |
| Binocular *"avisame cuando estés listo"* | Sí — clínico |
| Cambio de ojo R→L (foróptero) | Espera mecánica — ver §2.5 |

#### 2.3.4 Objetivo

> Mantener `Sigamos con este.` Eliminar la **espera obligatoria** de respuesta del paciente inmediatamente después.

#### 2.3.5 Plan de implementación

Archivos: `src/app/agentConfigs/chatSupervisor/index.ts`; posiblemente `App.tsx` / cliente Realtime GA.

| ID | Tarea | Estado |
|----|-------|--------|
| 1.1 | Tras `postComparacionContinuar: true`, pronunciar pasos y **no** esperar paciente | ✅ Prompt + `auto_chain` |
| 1.2 | Backend: `contexto.requiereRespuestaPaciente: false` en respuestas post-Sigamos | ✅ `motorExamen.js` |
| 1.3 | Hook post-TTS en cliente (`audio_stopped` → señal interna) | ✅ `postComparacionContinuar.ts` |
| 1.4 | Ignorar "bien"/"listo" espontáneo tras Sigamos (no llamar `obtenerEtapa`) | ✅ Prompt § línea 76 |

**Fuera de alcance (v0.5):** cambios al esquema o generación del CSV.

#### 2.3.6 Validación

- [x] Tras Sigamos, siguiente pregunta en **< 5 s** **sin** que el paciente hable.
- [x] Logs UI: breadcrumb `auto_chain: postComparacionContinuar` → `obtenerEtapa` **sin** turno paciente intercalado.
- [x] Binocular y pre-grueso siguen esperando respuesta cuando corresponde.

#### 2.3.7 Criterios de aceptación

- [x] Tras cada `Sigamos con este.` con `postComparacionContinuar`, avance **sin** input del paciente.
- [x] `Sigamos con este.` se preserva como mensaje clínico.

#### 2.3.8 Implementación y cierre (Fase 1)

**Estado:** ✅ **Implementado y probado (QA OK)** — 2026-07-01.

**Commits:**

| Commit | Descripción |
|--------|-------------|
| `14c2768` | Fase 1a: `postComparacionContinuar.ts`, hook `audio_stopped` → señal interna; prompt inicial; `requiereRespuestaPaciente: false` en motor |
| `54c1ef0` | Fase 1b: prompt alineado — **solo** `auto_chain` dispara `obtenerEtapa({})`; eliminada doble vía modelo + nudge |

**Archivos tocados:**

| Archivo | Rol |
|---------|-----|
| `src/app/lib/postComparacionContinuar.ts` | `attachPostComparacionContinuarHandlers`: tras tool con `postComparacionContinuar: true`, en `audio_stopped` envía `__POST_COMPARACION_CONTINUAR__` |
| `src/app/hooks/useRealtimeSession.ts` | Activa handlers si `enablePostComparacionAutoChain` |
| `src/app/hooks/useHandleSessionHistory.ts` | Breadcrumb `auto_chain: postComparacionContinuar` (no muestra la señal al usuario) |
| `src/app/App.tsx` | `enablePostComparacionAutoChain: true` para `chatSupervisor` |
| `src/app/agentConfigs/chatSupervisor/index.ts` | Prompt: pronunciar `pasos[].mensaje`, esperar señal, llamar `obtenerEtapa({})` solo al recibirla |
| `reference/foroptero-server/motorExamen.js` | `contexto.requiereRespuestaPaciente: false` en respuestas post-Sigamos |

**Arquitectura final (acordada):**

```
Backend → Sigamos + postComparacionContinuar: true
  → Agente pronuncia pasos[].mensaje (Sigamos)
  → Agente NO llama obtenerEtapa por iniciativa propia
  → Cliente: audio_stopped → sendMessage(__POST_COMPARACION_CONTINUAR__)
  → Agente recibe señal → obtenerEtapa({})
  → Backend ejecuta deferred → siguiente pregunta
```

**Lección de la Fase 1a:** si el prompt **y** el `auto_chain` piden al modelo llamar `obtenerEtapa({})`, se producen **dobles llamadas** y preguntas duplicadas (§4.0.1). La Fase 1b resuelve delegando el encadenado **exclusivamente** a la señal.

**QA manual (post `54c1ef0`):** examen completo ETAPA_5/6 — ciclos Sigamos avanzan sin "Bien"/"listo"; pre-grueso y binocular siguen esperando respuesta; sin bucles de pregunta comparativa. **Resultado: OK.** Evidencia CSV: `registros-examen/examen-registro-9.csv` (§4.0.2).

**Gate Punto 2:** cumplido — se puede iniciar ítem 2 (esfera → cilíndrico).

---


### 2.4 Ítem 2 — Valor esférico en etapa cilíndrica

#### 2.4.1 Síntoma reportado

Al iniciar el test cilíndrico, el foróptero **no** refleja el resultado del refinamiento esférico (grueso/fino); parece usar otro valor (típicamente el recalculado del autorefractómetro).

#### 2.4.2 Diagnóstico — causa raíz probable (confirmada en campo §4.1)

Existe una función **correcta** que ya prioriza resultados de tests:

```875:898:reference/foroptero-server/motorExamen.js
function calcularValoresFinalesForoptero(ojo) {
  // Esfera: Prioridad: esfericoFino > esfericoGrueso > valoresRecalculados
  const esfera = resultados.esfericoFino !== null && resultados.esfericoFino !== undefined
    ? resultados.esfericoFino
    : (resultados.esfericoGrueso !== null && resultados.esfericoGrueso !== undefined
      ? resultados.esfericoGrueso
      : valoresRecalculados.esfera);
  // ...
}
```

Pero en los generadores de pasos para cilíndrico se usa el operador `||`:

```2670:2672:reference/foroptero-server/motorExamen.js
  const esferaFinal = estadoExamen.secuenciaExamen.resultados[ojo].esfericoFino
    || estadoExamen.secuenciaExamen.resultados[ojo].esfericoGrueso
    || estadoExamen.valoresRecalculados[ojo].esfera;
```

**Problema:** En JavaScript, `0`, `0.00` y `-0.00` son **falsy**. Si el resultado esférico fino es plano (`0.00`), se ignora y se cae al valor recalculado o al grueso.

**Ocurrencias a corregir (mínimo):**

| Función | Líneas aprox. | Uso |
|---------|---------------|-----|
| `generarPasosMostrarLenteCilindrico` | ~2670 | Cada comparativa cilíndrica |
| `generarPasosMostrarLenteCilindricoAngulo` | ~2724 | Cada comparativa de ángulo |
| `generarPasosSoloForopteroComparacion` | ~1801, ~1815 | Reanclaje / ritual entre tests |
| Bloques post-confirmación cilíndrico / ángulo | ~3268, ~3299 | Actualización foróptero tras confirmar |

#### 2.4.3 Plan de implementación (borrador)

#### Fase 1 — Corrección mínima (recomendada como primer PR)

- [x] **Centralizar** lectura de esfera confirmada: reutilizar `calcularValoresFinalesForoptero(ojo).esfera` (o extraer helper `obtenerEsferaConfirmada(ojo)`) en todos los puntos listados arriba.
- [x] Eliminar todos los `||` sobre valores dióptricos que puedan ser cero.
- [x] Aplicar el mismo criterio estricto (`!== null && !== undefined`) para cilindro y ángulo donde corresponda.

#### Fase 2 — Ritual fino → cilindro

- [x] Verificar que `construirRitualEntreTestsLentes('esferico_fino', …)` reancla con `valorFinal` del fino antes del primer comparativo cilíndrico.
- [x] Caso de prueba: fino confirma `0.00` → primer paso cilíndrico debe enviar `esfera: 0.00`, no el recalculado.

#### Fase 3 — Tests automatizados

- [ ] Añadir tests unitarios en `reference/foroptero-server/` (si no existen, crear archivo de test mínimo) para:
  - `esfericoFino = 0` → esfera usada en config cilíndrica = `0`
  - `esfericoFino = +0.25` → esfera = `0.25`
  - Solo `esfericoGrueso = -1.00` (fino null) → esfera = `-1.00`
  - Ningún resultado → fallback a `valoresRecalculados.esfera`

- [x] Caso de regresión **`examen-registro-5.csv`**: fino L = 0 → cilíndrico L con `esfera: 0.00`, no +0.50. *(Validado en registro-10 para OD; ver §4.0.3.)*

#### 2.4.4 Criterios de aceptación (ítem 2)

- [x] Tras completar esférico fino, **toda** configuración de foróptero en test cilíndrico usa la esfera confirmada.
- [x] Caso borde `0.00` D funciona correctamente.
- [x] `calcularValoresFinalesForoptero` y los generadores de pasos devuelven la misma esfera en el mismo estado de examen.

#### 2.4.5 Implementación y cierre (Punto 2)

**Estado:** ✅ **Implementado y probado (QA OK)** — 2026-07-01.

**Commit:** `b1bb8fa` — `fix(esfera): usar resultado esférico confirmado en etapa cilíndrica`

**Archivo tocado:** `reference/foroptero-server/motorExamen.js` — 6 bloques que usaban `esfericoFino || esfericoGrueso || recalculado` reemplazados por `calcularValoresFinalesForoptero(ojo)` en:

- `generarPasosSoloForopteroComparacion` (cilíndrico / ángulo)
- `generarPasosMostrarLenteCilindrico`
- `generarPasosMostrarLenteCilindricoAngulo`
- `confirmarResultado` (cilíndrico / ángulo)

**QA manual (post `b1bb8fa`):** examen completo con OD grueso+fino = 0 y cilindro recalculado −0.50 → primer paso cilíndrico OD lleva **Esf +0.00** (no +0.50). **Resultado: OK.** Evidencia CSV: `registros-examen/examen-registro-10.csv` (§4.0.3).

**Gate Punto 3:** ✅ cumplido (cerrado en §2.6.6, §4.0.4).

---

---


### 2.5 Ítem 3 — Velocidad / fluidez del foróptero

#### 2.5.1 Síntoma reportado

Los movimientos del foróptero — en particular los **esféricos** y los **ajustes iniciales por ojo** — se perciben lentos. El cliente asocia esto con la fluidez general del examen.

#### 2.5.2 Comportamiento actual del backend (ETAPA_3)

Hoy `generarPasosEtapa3()` configura **solo el ojo derecho** con valores recalculados; el izquierdo queda con **oclusión cerrada** sin recibir esfera/cilindro/ángulo:

```1463:1477:reference/foroptero-server/motorExamen.js
  foroptero: {
    R: { esfera, cilindro, angulo, occlusion: 'open' },
    L: { occlusion: 'close' }   // ← sin lentes; hardware permanece en ~0;0×0°
  }
```

Al terminar OD y pasar a OI, `necesitaAdaptacionTrasAgudezaOtroOjo` dispara un **segundo acomodo general**: mover L desde 0 hasta los valores recalculados (+ cambio de oclusión). Eso coincide con la premisa 3 del cliente.

En el registro `examen-registro-5.csv`, el cambio R→L (19:12:32) muestra un salto grande: `<R> (close); <L> Esf +0.50 / Cil -1.00 / @20°` tras haber tenido R en Esf +0.00.

#### 2.5.3 Hipótesis del cliente — preajuste bilateral al inicio

**Premisas (aceptadas para evaluación):**

| ID | Premisa |
|----|---------|
| P1 | Foróptero en reposo: OD y OI en **0; 0 × 0°** |
| P2 | Los mayores tiempos de ajuste ocurren al pasar de **0 → valores recalculados** |
| P3 | Hay **dos ventanas** de acomodo general: inicio OD y cambio a OI |
| P4 | Esfera (baseline medido): **~7 s por 0,50 D** en esférico grueso (~14 s/D) |
| P5 | Movimiento **secuencial** por eje (firmware `ejecutarMovimientoSecuencial`) |
| **O5** | **Objetivo Q5:** reducción **50 %** → **≤ 3,5 s por 0,50 D** en esférico grueso (~7 s/D) |

**Hipótesis:** Si en ETAPA_3 se posicionan **ambos ojos** a valores recalculados (OI ocluido pero con lentes ya colocadas), las comparativas esféricas gruesas/finas serían más fluidas y el **cambio de ojo** sería casi solo oclusión.

#### 2.5.4 Evaluación de la hipótesis

**Veredicto: plausible y alineada con el código actual — recomendada para implementar y medir.**

| Aspecto | Análisis |
|---------|----------|
| **Tiempo total de motor** | No desaparece: mover R + L al inicio ≈ mismo trabajo que mover R al inicio + L al cambio de ojo. La secuencia firmware sigue siendo R-esfera → R-cil → R-áng → R-ocl → L-esfera → … |
| **Tiempo percibido** | **Mejora:** una sola espera larga al inicio (cuando el paciente ya espera) vs segunda espera larga **en medio del examen** al cambiar de ojo — momento más crítico para la UX |
| **Comparativas OD** | Durante grueso/fino de R, los saltos son ±0.50 / ±0.25 desde el recalculado — grueso ~7 s/salto (P4); objetivo **3,5 s** (O5) |
| **Comparativas OI** | Si L ya está en +0.50 / -1.00 / 20°, el inicio de OI es **solo oclusión** (motores DD/DI) → segundos, no decenas de segundos |
| **Registro §2** | El salto 19:12:32 confirma que hoy el cambio de ojo paga el costo completo de posicionar L |

**Estimación ilustrativa** con P4 (~7 s/0,50 D), caso del registro — OI recalculado +0.50, -1.00, 20°:

| Escenario | Movimiento esférico L | + cilindro + ángulo + secuencial | Cuándo lo paga el paciente |
|-----------|----------------------|-----------------------------------|----------------------------|
| **Actual** | ~7 s (+0.50 D) | + cil + áng + oclusión | Al **cambio de ojo** (~mitad del examen) |
| **Preajuste bilateral** | Idem | Idem | Al **inicio** (antes del primer test OD) |

**Limitaciones / riesgos:**

1. **Inicio más largo:** el primer mensaje ("esperemos que se muevan los lentes") cubriría R **y** L; hay que validar copy y tolerancia del paciente.
2. **OI ocluido con lentes puestas:** clínicamente aceptable si la oclusión es físicamente opaca; verificar que no haya fuga de visión.
3. **Refinamientos de OD no afectan L:** durante tests de R solo cambia R; L permanece en recalculado hasta que empiece su propia secuencia — correcto.
4. **No acelera ±0.25/±0.50 intra-test:** la hipótesis **no sustituye** subir `maxSpeed` en firmware si las comparativas sueltas siguen siendo lentas.
5. **Binocular:** al final ambos ojos ya estarán cerca de valores finales — posible ventaja adicional.

#### 2.5.5 Estrategia integrada de fluidez (dos palancas)

La fluidez del examen depende de **dos palancas complementarias**, no excluyentes:

| Palanca | Qué resuelve | Dónde | Impacto principal |
|---------|--------------|-------|-------------------|
| **A — Preajuste bilateral + R→L** | Elimina (o acorta) la **segunda ventana larga** de acomodo al cambiar de ojo | Backend `motorExamen.js` | Transición R→L, inicio OI |
| **B — Velocidad esférica** | Acorta cada salto **±0.50 / ±0.25** durante comparativas | Firmware ESP32 | Toda ETAPA_5 esférica |

**Objetivo combinado:** menos tiempo muerto en momentos críticos (cambio de ojo) **y** comparativas esféricas más ágiles.

---

#### 2.5.6 Fase A — Preajuste bilateral y simplificación R→L

##### 2.5.6.1 Estado actual (dos puntos de acomodo)

**Inicio (ETAPA_3):** solo OD recibe lentes; OI queda en hardware ~0;0×0°.

**Cambio R→L:** al primer `esferico_grueso` de OI tras `agudeza_alcanzada` R, `debeEmitirBundleAdaptacion` envía **lentes completas** de OI desde recalculados + cierra R:

```2836:2850:reference/foroptero-server/motorExamen.js
    foroptero: {
      [ojo]: { esfera: vr.esfera, cilindro: vr.cilindro, angulo: vr.angulo, occlusion: 'open' },
      [otro]: { occlusion: 'close' }   // sin tocar lentes del otro ojo
    }
```

Si OI nunca fue posicionado, el firmware ejecuta secuencia completa L-esfera → L-cilindro → L-ángulo → oclusiones + R-occlusión. En el registro §4, eso coincide con el salto pesado de 19:12:32.

##### 2.5.6.2 Comportamiento objetivo

**Al inicio (ETAPA_3):**

```
Comando foróptero único:
  R: esfera/cilindro/ángulo recalculados + open
  L: esfera/cilindro/ángulo recalculados + close   ← NUEVO: lentes ya montadas, ojo cerrado
```

**Durante examen OD:** solo se mueven ejes de R (comparativas ±0.50 / ±0.25). OI permanece en recalculados (sin ver).

**Al cambiar R→L (primer `esferico_grueso` OI):**

```
Comando mínimo (transición oclusión):
  R: occlusion close          ← sin recomandar esfera/cilindro/ángulo de R
  L: occlusion open           ← lentes ya en recalculados; sin recomando óptico
→ TV H @ logMAR 0.3
→ `MSG_PRE_GRUESO_OI_SOLO_OCLUSION`: *"Ahora vamos con el ojo izquierdo. Tomate tu tiempo y decime si ves bien."*
```

El firmware **ya omite** ejes cuyo valor no cambió (`"ya está en X, omitiendo movimiento"`). Con preajuste, la transición R→L debería limitarse a **motores de oclusión** (DD/DI).

##### 2.5.6.3 Tareas de implementación (backend)

Archivo principal: `reference/foroptero-server/motorExamen.js`

| ID | Tarea | Detalle |
|----|-------|---------|
| A1 | Preajuste en `generarPasosEtapa3()` | Incluir `L: { esfera, cilindro, angulo, occlusion: 'close' }` en el primer comando — ✅ `f30ee41` |
| A2 | Flag de estado | Añadir `estadoExamen.lentesPreajustadasBilateral = true` tras ETAPA_3 — ✅ |
| A3 | Simplificar bundle R→L | En `debeEmitirBundleAdaptacion`: si `lentesPreajustadasBilateral`, emitir **solo oclusión** en R y L — ✅ |
| A4 | Copy transición OI | `MSG_PRE_GRUESO_OI_SOLO_OCLUSION` — *"Ahora vamos con el ojo izquierdo. Tomate tu tiempo y decime si ves bien."* — ✅ |
| A5 | Agudeza alcanzada → OI | Verificar que `generarPasosEtapa4` no recomanda L completo — ✅ |
| A6 | Caso borde: refinamientos OD | Transición no resetea R ni L — ✅ registro-13 |
| A7 | Reinicio / modos test | Propagar flag en `inicializarExamen()` — ✅ |

##### 2.5.6.4 Estimación de mejora — transición R→L

Caso registro §4 (OI recalculado +0.50, -1.00, 20°; P4 ≈ 7 s/0,50 D):

| Componente | Actual (aprox.) | Con preajuste + R→L simplificado |
|------------|-----------------|-----------------------------------|
| L-esfera +0.50 D | ~7 s | **0 s** (ya posicionado) |
| L-cilindro -1.00 D | ~? s | **0 s** |
| L-ángulo 20° | ~? s | **0 s** |
| R close + L open | ~2–5 s | ~2–5 s |
| **Total transición** | **~15–30+ s** | **~2–8 s** |

**Criterio de aceptación A:** transición R→L (fin agudeza OD → primer mensaje OI) **< 10 s** en caso tipo registro §4.

##### 2.5.6.5 Riesgos Fase A

| Riesgo | Mitigación |
|--------|------------|
| Oclusión L insuficiente con lentes montadas | Prueba física en banco |
| Inicio ETAPA_3 más largo (R + L de una vez) | Copy único; el paciente ya espera al inicio |
| `esperar` fijo 2 s + `esperar_foroptero` redundantes | Revisar en A8 (ver §2.5.7) |

---

#### 2.5.7 Fase B — Velocidad del foróptero en lentes esféricas

##### 2.5.7.1 Alcance: qué sí mejora y qué no

| Escenario | ¿Afecta velocidad esférica? | Notas |
|-----------|------------------------------|-------|
| Comparativa gruesa ±0.50 D | **Sí** | **~7 s/movimiento** (P4) → objetivo **≤ 3,5 s** (O5) |
| Comparativa fina ±0.25 D | **Sí** | ~3,5 s/movimiento (extrapolado de P4; validar en banco) |
| Ajuste inicial 0 → recalculado | Parcialmente | Fase A **reubica** el costo al inicio; no reduce s/D |
| Transición R→L | **No** (Fase A) | No es velocidad esférica; es preajuste |
| Cilindro / ángulo | No en esta fase | Mantener perfil conservador |

##### 2.5.7.2 Baseline hardware (firmware actual)

```676:684:reference_ESP32/Foroptero_v0_5_3_release_1/Foroptero_v0_5_3_release_1.ino
  auto cfg = [](AccelStepper& m){ m.setMaxSpeed(800); m.setAcceleration(500); };
```

- Motores esféricos: `controlCD` (R), `controlCI` (L).
- Movimiento secuencial por eje; **solo ejecuta ejes con delta** > 0.001 D.
- Baseline medido (Q5): **~7 s / 0,50 D** en esférico grueso → **~3,5 s / 0,25 D** (extrapolación lineal; validar en banco con M1).

##### 2.5.7.3 Modelo de impacto en fluidez del examen

Durante ETAPA_5 esférica, cada comparativa implica al menos un movimiento de esfera + `esperar_foroptero`. En un examen típico (2 ojos × grueso + fino):

| Magnitud del salto | Movimientos aprox. por ojo | Baseline (P4) | Objetivo (O5, −50 %) |
|--------------------|----------------------------|---------------|----------------------|
| ±0.50 D (grueso) | 2–4 | 7–14 s/ojo | **3,5–7 s/ojo** |
| ±0.25 D (fino) | 2–4 | ~3,5–7 s/ojo | ~1,75–3,5 s/ojo (validar) |

**Interpretación:** acelerar esfera **no elimina** pausas clínicas (`Sigamos con este.`, respuesta del paciente), pero reduce el **tiempo muerto mecánico** entre preguntas — el paciente percibe menos “espera al foróptero”.

**Ganancia combinada estimada (caso registro §4):**

| Intervención | Ahorro percibido orientativo |
|--------------|------------------------------|
| Solo Fase A (preajuste + R→L) | ~15–25 s en **un** punto (cambio de ojo) |
| Solo Fase B (−50 % esfera, O5) | ~50 % en **cada** salto esférico grueso (~7–14 s acumulados en examen completo) |
| **A + B** | Efecto aditivo en UX: cambio de ojo rápido **y** comparativas más ágiles |

##### 2.5.7.4 Plan de medición (antes de tocar firmware)

| ID | Medición | Método |
|----|----------|--------|
| M1 | Confirmar baseline P4 y objetivo O5 | Log Serial / MQTT `busy` → `ready` para saltos **0,50 D (grueso)** y 0,25 D (fino) |
| M2 | Tiempo por comparativa | Registro CSV: delta entre `Foroptero-TV` consecutivos en ETAPA_5 esférica |
| M3 | Baseline R→L | Timestamp fin agudeza OD → primer foróptero OI (registro §4: referencia) |
| M4 | % ejes omitidos | Verificar logs `"omitiendo movimiento"` en comparativas intra-test |

##### 2.5.7.5 Tareas de implementación (firmware)

Archivo: `reference_ESP32/Foroptero_v0_5_3_release_1/Foroptero_v0_5_3_release_1.ino`

| ID | Tarea | Propuesta | Validación |
|----|-------|-----------|------------|
| B1 | Perfil esférico dedicado | `setMaxSpeed` / `setAcceleration` **solo** en `controlCD` y `controlCI` | Sin pérdida de pasos en ±0.50 repetido |
| B2 | Incremento gradual | Escalones hasta alcanzar O5: **×1.25 → ×1.5 → ×2.0** (objetivo ≈ **−50 %** en ±0,50 D grueso) | Medir s/0,50 D tras cada escalón |
| B3 | Cilindro/ángulo sin cambio | Mantener 800/500 en BD/BI/AD/AI/DD/DI | Evitar vibración en ejes sensibles |
| B4 | Telemetría opcional | Publicar duración del movimiento en MQTT o Serial | Comparar antes/después |

**Valores a explorar (hipótesis — confirmar en banco):**

| Escalón | MaxSpeed esférico | Acceleration esférica | s/0,50 D grueso (orientativo) |
|---------|-------------------|----------------------|-------------------------------|
| Baseline | 800 | 500 | **~7 s** (P4) |
| ×1.25 | 1000 | 625 | ~5,6 s |
| ×1.5 | 1200 | 750 | ~4,7 s |
| ×2.0 | 1600 | 1000 | **~3,5 s** (O5) |

> La relación no es estrictamente lineal (perfil trapezoidal AccelStepper). M1 es obligatoria antes de fijar objetivo.

##### 2.5.7.6 Tareas backend complementarias (opcional, baja prioridad)

| ID | Tarea | Beneficio |
|----|-------|-----------|
| B5 | En comparativas esféricas, payload mínimo: solo `{ esfera, occlusion }` por ojo | Evita re-evaluar cilindro/ángulo en JSON (firmware ya omite; claridad) |
| B6 | Revisar `esperar` fijo 2 s en ETAPA_3 si `esperar_foroptero` ya sincroniza | −2 s en inicio |
| B7 | Documentar tiempos objetivo post-medición en `DOCUMENTACION.md` | Trazabilidad |

##### 2.5.7.7 Criterios de aceptación Fase B

- [ ] M1 confirma baseline P4: esférico grueso **~7 s / 0,50 D**.
- [ ] Objetivo O5 (Q5): esférico grueso **≤ 3,5 s / 0,50 D** (−50 % vs baseline).
- [ ] Salto ±0,25 D (fino): reducción proporcional sin errores de posicionamiento (validar tras M1).
- [ ] 0 pérdidas de pasos / 0 timeouts en `esperarForopteroReady` tras 20 ciclos en banco.
- [ ] Cilindro y ángulo sin regresión de precisión.

---

#### 2.5.8 Plan de implementación por PRs y orden

| PR | Contenido | Dependencias |
|----|-----------|--------------|
| **PR-3a** | Preajuste bilateral ETAPA_3 (A1–A2) | Ninguna |
| **PR-3b** | Transición R→L solo oclusión (A3–A5, A4 copy) | PR-3a |
| **PR-3c** | Medición baseline M1–M4 | Hardware |
| **PR-3d** | Firmware velocidad esférica escalonada (B1–B4) | PR-3c |
| **PR-3e** | Backend payloads mínimos + esperas (B5–B6, opcional) | PR-3a |

**Orden recomendado:** PR-3a → PR-3b → PR-3c → PR-3d (validar A antes de B en producción; pueden desarrollarse en paralelo).

**Validación integrada (caso `examen-registro-5.csv`):**

- [x] Inicio: ambos ojos posicionados; primer test OD sin sorpresa. *(registro-13, §4.0.5)*
- [x] Transición 19:12:32 equivalente: **solo oclusión**, < 10 s. *(registro-13: `<R> (close); <L> (open)` en 1 s)*
- [ ] Comparativas esféricas OI: tiempo entre preguntas reducido vs registro original (post PR-3d).

#### 2.5.9 Criterios de aceptación globales (ítem 3)

- [x] **Fase A:** cambio R→L sin recomando óptico de OI si preajuste activo.
- [x] **Fase A:** transición R→L < 10 s (caso registro §4).
- [ ] **Fase B:** esférico grueso ±0,50 D **≤ 3,5 s** por movimiento (O5; −50 % vs ~7 s baseline).
- [x] Sin regresión dióptrica, oclusión ni timeouts. *(examen completo FINALIZADO, registro-13)*
- [ ] Inicio ETAPA_3: copy alineado al acomodo bilateral (una sola expectativa de espera).

#### 2.5.10 Implementación y cierre (Punto 4 — Fase A)

**Estado:** ✅ **Implementado y probado (QA OK)** — 2026-07-03.

**Commit:** `f30ee41` — `feat(etapa3): preajuste bilateral y transición R→L solo oclusión`

**Archivo tocado:** `reference/foroptero-server/motorExamen.js` — preajuste bilateral en `generarPasosEtapa3`, flag `lentesPreajustadasBilateral`, bundle solo oclusión en `generarPasosEtapa5`, `MSG_PRE_GRUESO_OI_SOLO_OCLUSION`.

**QA manual (post `f30ee41`):** examen completo con mismos valores que registro-11; inicio con R+L recalculados; transición OD→OI en **1 s** mecánico (solo oclusión); copy OI correcto; Puntos 2–3 sin regresión. **Resultado: OK.** Evidencia CSV: `registros-examen/examen-registro-13.csv` (§4.0.5).

**Gate Punto 5:** ✅ cumplido — se puede iniciar medición baseline M1–M4.

---


### 2.6 Ítem 4 — Examen cilíndrico siempre

#### 2.6.1 Síntoma reportado

El test cilíndrico debe ejecutarse **siempre**, independientemente del valor cilíndrico recalculado. Hoy se omite en ciertos rangos.

#### 2.6.2 Comportamiento actual (confirmado en campo §4.2)

```630:654:reference/foroptero-server/motorExamen.js
function determinarTestsActivos(cilindro) {
  const tests = { cilindrico: false, cilindricoAngulo: false };
  if (cilindro === 0 || cilindro === -0.25) {
    tests.cilindrico = false;
    tests.cilindricoAngulo = false;
  } else if (cilindro <= -0.50 && cilindro >= -1.75) {
    tests.cilindrico = true;
    tests.cilindricoAngulo = false;
  } else if (cilindro <= -2.00 && cilindro >= -6.00) {
    tests.cilindrico = true;
    tests.cilindricoAngulo = true;
  }
  return tests;
}
```

Documentado en `DOCUMENTACION.md`:

| Cilindro recalculado | Test cilíndrico | Test cilíndrico ángulo |
|----------------------|-----------------|------------------------|
| 0 o -0.25 | No | No |
| -0.50 a -1.75 | Sí | No |
| -2.00 a -6.00 | Sí | Sí |

Además, `generarPasosEtapa5` rechaza cilíndrico si `valorBase === 0 || valorBase === -0.25`.

#### 2.6.3 Objetivo de producto

> Incluir **siempre** `cilindrico` (potencia cilíndrica) en la secuencia por ojo. **`cilindrico_angulo` no se implementa** en este ciclo — queda **pendiente** (respuesta Q4).

**Decisiones:**

| ID | Decisión | Estado |
|----|----------|--------|
| D4.1 | ¿Cilíndrico con valor base 0 / -0.25? | **Cerrada:** algoritmo **secuencial en 2 comparativas** (§2.6.3.1). Bases `≤ −0,50`: sin cambio — bracket **±0,50 D** sobre la base |
| D4.1b | ¿Confirmaciones por comparativa? | **Cerrada:** **1 confirmación** por paso → **2 comparativas en total** (no doble confirmación como esférico) |
| D4.1c | ¿Respuesta `igual` en bases bajas? | **Cerrada:** quedarse con el valor **más cercano a 0** (`0` > `−0,25` > `−0,50`) y pasar al siguiente paso con ese candidato |
| D4.1d | ¿Reanclaje del foróptero entre comparativas? | **Cerrada:** **sí** — mismo contrato ETAPA_5 intra-test (§2.6.3.2): tras cada preferencia, foróptero al lente elegido; al cerrar paso 2, foróptero en resultado final |
| D4.2 | ¿Cilíndrico ángulo también siempre? | **Cerrada (Q4):** **no** — sin cambios; test de ángulo **fuera de alcance**; queda pendiente para futuro |
| D4.3 | ¿Afecta examen binocular? | **Pendiente** — sin feedback del cliente aún; no modificar ETAPA_6 hasta definir |

#### 2.6.3.1 Algoritmo cilíndrico — bases `0` y `−0,25` (D4.1)

Modo dedicado `cilindricoSecuencialBajo`, activado solo cuando `valorBase === 0` o `valorBase === -0.25`. Dos comparativas con **1 confirmación cada una**; el candidato del paso 1 alimenta el paso 2.

| Base | Paso 1 (1 comparativa) | Paso 2 (1 comparativa) | Resultados finales posibles |
|------|------------------------|------------------------|----------------------------|
| `0` | `0` vs `−0,25` | ganador paso 1 vs `−0,50` | `0`, `−0,25` o `−0,50` |
| `−0,25` | `−0,25` vs `0` | ganador paso 1 vs `−0,50` | `0`, `−0,25` o `−0,50` |

**Reglas de transición:**

- Tras paso 1: `confirmarResultado` **no** — guardar candidato `C1` y pasar a paso 2.
- Tras paso 2: `confirmarResultado(C2)` con el valor elegido en la segunda comparativa.
- Si `igual` en cualquier paso: candidato = valor **más cercano a 0** entre los dos lentes del par actual; en paso 1 continuar a paso 2 con ese candidato; en paso 2 confirmar ese valor.

**Bases `≤ −0,50`:** algoritmo bilateral actual sin cambios (`valorBase`, `valorBase ± 0,50`).

#### 2.6.3.2 Reanclaje del foróptero — modo `cilindricoSecuencialBajo` (D4.1d)

El modo secuencial **no cambia** el contrato mecánico de ETAPA_5 entre comparativas del **mismo** test `cilindrico`. Reutilizar el path existente `necesitaMostrarLente` + `valorElegidoReanclaje` + `generarPasosSoloForopteroComparacion` en `obtenerInstrucciones` — **no** inventar un flujo paralelo.

| Momento | Comportamiento del foróptero |
|---------|------------------------------|
| Tras elegir en **paso 1** | Se mueve al cilindro elegido `C1` (reanclaje si difiere del valor en cara); **sin** `confirmarResultado` — solo se guarda `C1` en estado |
| Inicio **paso 2** | Comparativa `C1` (referencia / `valorAnterior`) vs `−0,50` (`valorAMostrar`); el paciente alterna entre ambos según la pregunta |
| Tras elegir en **paso 2** | `confirmarResultado(C2)`; foróptero queda en el cilindro definitivo (`0`, `−0,25` o `−0,50`) vía actualización post-confirmación en `confirmarResultado` |

**Ritual `Sigamos con este.`** entre comparativas del mismo test (paso 1 → paso 2): reglas actuales de `necesitaRitualSigamosPostComparacionLentes`:

- Preferencia **`actual`** (ya tenía el lente elegido en cara) → siguiente comparativa **directa**, sin `Sigamos`.
- Preferencia **`anterior`** o **`igual`** con cambio de cilindro → reanclaje + pausa 3 s + `Sigamos` + siguiente comparativa (mismo contrato que cilíndrico normal).

**Ejemplo (base `0`, paso 1):** paciente prefiere `−0,25` → foróptero a `Cil −0,25` → paso 2 muestra `Cil −0,50` frente a `−0,25` como referencia. Si al cerrar paso 2 elige `−0,25`, el foróptero termina en `Cil −0,25`.

#### 2.6.4 Plan de implementación ✅ (commit `a20b305`)

#### Fase 1 — Secuencia

Archivo: `reference/foroptero-server/motorExamen.js`

- [x] Modificar `determinarTestsActivos` (o eliminarla y fijar `cilindrico: true` en `generarSecuenciaExamen`). **`cilindrico_angulo` sin cambios** (Q4).
- [x] Actualizar `generarSecuenciaPrueba` / modos test si deben reflejar la misma regla.
- [x] Quitar validación que bloquea cilíndrico con base 0 / -0.25 en `generarPasosEtapa5`.

#### Fase 2 — Algoritmo de comparación con cilindro bajo (D4.1, D4.1b, D4.1c, D4.1d)

- [x] En `iniciarComparacionLentes`: si `tipo === 'cilindrico'` y base `0` / `−0,25`, activar modo `cilindricoSecuencialBajo` con `paso: 1`, alternativos del §2.6.3.1 y `paso2Fijo: -0.50`.
- [x] En `generarPasosEtapa5` (fase `iniciando`): arrancar paso 1 mostrando el alternativo (no `valorMas` genérico); `valorAnterior = valorBase`.
- [x] En `procesarRespuestaComparacionLentes`: rama `cilindricoSecuencialBajo` — paso 1 → guardar `C1` (1 confirmación; `igual` → más cercano a 0) y devolver `necesitaMostrarLente` con `valorElegidoReanclaje = C1` y `valorAMostrar = -0.50` para paso 2; paso 2 → `confirmarResultado` (misma regla `igual`).
- [x] **Reanclaje (D4.1d):** no duplicar lógica — el paso 1→2 debe entrar al path existente de `obtenerInstrucciones` (`pasosReanchor` + ritual `Sigamos` si aplica + `pasosMostrar`).
- [x] Bases `≤ −0,50`: sin cambios en el bracket ±0,50 actual.
- [x] Ajustar `ALGORITMO_REGLAS_TESTS.md` y `DOCUMENTACION.md`.

#### Fase 3 — Binocular y resultados finales

- [ ] **En espera (D4.3):** sin cambios en ETAPA_6 hasta feedback del cliente.
- [ ] Documentar estado actual en `DEFINICIONES_EXAMEN_BINOCULAR.md` como referencia.

#### Fase 4 — Validación

- [x] Autorefractómetro con cilindro `0.00` en ambos ojos → secuencia incluye `cilindrico` R y L.
- [ ] Autorefractómetro con `-0.25` → idem. *(No en registro-11; validación manual OK por operador.)*
- [x] Sin errores `El test de cilindro no aplica para este ojo`.
- [x] Base `0`: CSV muestra comparativa `0`/`−0,25` y luego ganador vs `−0,50` (2 comparativas).
- [ ] Base `−0,25`: CSV muestra comparativa `−0,25`/`0` y luego ganador vs `−0,50` (2 comparativas). *(No en registro-11; validación manual OK por operador.)*
- [x] Caso de regresión **`examen-registro-5.csv`**: cilindro R recalculado 0 → secuencia incluye `cilindrico` R.

#### 2.6.5 Criterios de aceptación (ítem 4)

- [x] Toda secuencia normal incluye `cilindrico` por ojo (R y L).
- [x] El examen completa sin error con cilindro inicial `0` o `−0,25`, usando el algoritmo secuencial §2.6.3.1 (2 comparativas, 1 confirmación cada una).
- [x] Reanclaje foróptero según §2.6.3.2: tras paso 1 queda en `C1`; al cerrar paso 2 queda en resultado confirmado.
- [x] Cilindro `≤ −0,50`: sin regresión del bracket ±0,50 actual.
- [x] `cilindrico_angulo` permanece con la regla actual; no se activa “siempre” (Q4).

#### 2.6.6 Implementación y cierre (Punto 3)

**Estado:** ✅ **Implementado y probado (QA OK)** — 2026-07-02.

**Commit:** `a20b305` — `feat(secuencia): incluir test cilíndrico siempre con modo secuencial bajo`

**Archivo tocado:** `reference/foroptero-server/motorExamen.js` — `determinarTestsActivos` (cilíndrico siempre), `cilindricoSecuencialBajo` en `iniciarComparacionLentes` / `procesarRespuestaComparacionLentes`, eliminación del guard en `generarPasosEtapa5`.

**QA manual (post `a20b305`):** examen completo con OD cilindro recalculado `0` → cilíndrico R en modo secuencial (2 comparativas, reanclaje); OI cilindro `−1.00` sin regresión ±0,50; base `−0,25` validada manualmente por operador. **Resultado: OK.** Evidencia CSV: `registros-examen/examen-registro-11.csv` (§4.0.4).

**Gate Punto 4:** ✅ cumplido — se puede iniciar ítem 3a (preajuste bilateral + R→L).

#### 2.6.7 Fix B3 — `valorAnterior` en cilíndrico secuencial bajo paso 2 ✅

**Contexto:** En `examen-registro-13` (§4.0.5), el cilíndrico OD con base `0` cerró en **−0,25** pese a que el paciente eligió «con el anterior» en el paso 2 (esperaba **0,0**). Diagnóstico y plan: `PLAN_FIX_BINOCULAR_CILINDRICO_REG13.md` (B3).

**Causa:** Tras paso 1, `obtenerInstrucciones` asignaba `valorAnterior = valorActual` (−0,25 en cara) en lugar de `candidatoPaso1` (0,0).

**Fix:** commit `a7ca9ad` — en paso 2 de `cilindricoSecuencialBajo`, `valorAnterior = candidatoPaso1`.

**QA post-fix:** `registros-examen/examen-registro-14.csv` (§4.0.6) — mismo protocolo; `Cilíndrico (R) = 0`; foróptero post paso 2 en `Cil +0.00`.

---


## 3. Mapa del sistema actual

```
Paciente (voz)
    ↓
Agente Realtime (chatSupervisor/index.ts)
    ↓ obtenerEtapa()
Backend clínico (reference/foroptero-server/motorExamen.js)
    ↓ pasos automáticos: foroptero | tv | esperar | esperar_foroptero
MQTT → Firmware ESP32 (reference_ESP32/Foroptero_v0_5_3_release_1.ino)
    ↓
Foróptero físico
```

**Archivos clave por ítem:**

| Ítem | Backend | Agente | Firmware | Docs de referencia |
|------|---------|--------|----------|-------------------|
| 1 | — | `chatSupervisor/index.ts` + runtime Realtime | — | `PLAN_REANCLAJE_POST_COMPARATIVA_LENTES.md` |
| 2 | `motorExamen.js` (`generarPasosMostrarLenteCilindrico`, `calcularValoresFinalesForoptero`) | — | — | `ALGORITMO_REGLAS_TESTS.md` |
| 3 | `motorExamen.js` (`esperar_foroptero`, `POST_COMPARACION_ESPERA_SEG`) | — | `Foroptero_v0_5_3_release_1.ino` | `DOCUMENTACION.md` |
| 4 | `motorExamen.js` (`determinarTestsActivos`, `generarSecuenciaExamen`, `cilindricoSecuencialBajo`) | — | — | `DOCUMENTACION.md` §Determinación de Tests Opcionales; `ALGORITMO_REGLAS_TESTS.md` §Cilíndrico bajo |

---


## 4. Evidencia de campo — registros CSV

### 4.0 `examen-registro-6.csv` — Bug 1 confirmado

**Archivo:** `registros-examen/examen-registro-6.csv`  
**Sesión:** 2026-07-01, 14:03–14:13 (exportado 14:30)  
**Valores iniciales:** `<R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0`  
**Estado al exportar:** ETAPA_6 (examen casi completo)

#### Bug 1 — Agente espera respuesta del paciente cuando no debe

**Síntoma real:** Tras pronunciar **`Sigamos con este.`**, el flujo **se detiene** hasta que el paciente dice "Bien", "listo" u equivalente. El backend **no** solicita esa respuesta; el contrato exige que el agente llame `obtenerEtapa({})` con body vacío tras `postComparacionContinuar: true`.

**Aclaración:** `Sigamos con este.` es feedback clínico correcto. **El bug no es el mensaje**, sino la **espera de turno del paciente** inmediatamente después.

**Evidencia UI (logs Realtime):**

| Hora | Evento |
|------|--------|
| 14:05:02 | `function call: obtenerEtapa` |
| 14:05:15 | Resultado → agente dice **"Sigamos con este."** |
| 14:05:26 | Paciente: **"Bien."** (~11 s después) |
| 14:05:26 | `function call: obtenerEtapa` (recién entonces) |

**Evidencia indirecta en CSV (no es un bug del export):**

Los huecos Oftalmologo → Foróptero tras cada Sigamos **no muestran** fila `Paciente` con "Bien"/"listo" porque el agente Realtime **no reenvía** esa frase al servidor — ocurre solo en el entorno de voz. El CSV refleja lo que llega al backend; sirve como **síntoma visible** del Bug 1 (pausas 6–16 s), no como defecto del registro.

| Sigamos | Siguiente evento | Gap |
|---------|------------------|-----|
| 14:05:15 | Foróptero 14:05:26 | **11 s** |
| 14:05:58 | Foróptero 14:06:14 | **16 s** |
| … | … | 6–8 s en otros casos |

**Contraste:** cuando el backend **sí** pide respuesta (`decime si ves bien`, binocular *listo*), el CSV registra `Paciente` con normalidad.

**Decisión de producto (v0.5):** **No modificar** el esquema ni la generación del CSV por este motivo.

**Caso de regresión:** tras `Sigamos con este.` + `postComparacionContinuar`, el agente encadena `obtenerEtapa({})` **sin** esperar al paciente; siguiente pregunta en < 5 s. **Cerrado** — ver §2.3.8 y §4.0.1.

### 4.0.1 `examen-registro-8` — Regresión intermedia Fase 1a y validación Fase 1b

**Archivo:** `examen-registro-8.csv` (sesión 2026-07-01, 15:53–16:05; exportado 16:05)  
**Contexto:** prueba tras commit `14c2768` (prompt pedía al modelo **y** el cliente enviaba nudge → doble `obtenerEtapa`).

**Síntoma observado:**

- Preguntas comparativas **duplicadas** (p. ej. 15:55:33 y 15:55:38; 15:55:51 ×2).
- Logs UI: dos `function call: obtenerEtapa` seguidos + breadcrumb `auto_chain: postComparacionContinuar` entre medias.

**Causa:** condición de carrera — prompt ("llamá `obtenerEtapa` inmediatamente") + `auto_chain` (señal tras `audio_stopped`) disparaban la misma tool dos veces; la segunda llamada vacía re-preguntaba en `faseComparacion === 'preguntando'`.

**Fix:** commit `54c1ef0` — prompt delega el encadenado **solo** a `__POST_COMPARACION_CONTINUAR__` (§2.3.8).

**QA post-fix:** validación manual completa — flujo Sigamos sin pausa ni bucle; **OK**. Evidencia archivada: `registros-examen/examen-registro-9.csv` (§4.0.2).

### 4.0.2 `examen-registro-9` — QA Punto 1 OK (post-fix)

**Archivo:** `registros-examen/examen-registro-9.csv`  
**Sesión:** 2026-07-01, 16:49–17:01 (exportado 17:01)  
**Valores iniciales:** `<R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0`  
**Estado al exportar:** FINALIZADO  
**Contexto:** prueba tras commit `54c1ef0` (encadenado solo vía `__POST_COMPARACION_CONTINUAR__`).

**Criterio Punto 1 — ciclos Sigamos sin input del paciente:**

| Sigamos | Siguiente evento (foróptero / pregunta) | Gap | Fila Paciente intercalada |
|---------|----------------------------------------|-----|---------------------------|
| 16:51:25 | Foróptero 16:51:27 | **2 s** | No |
| 16:51:56 | Foróptero 16:51:58 | **2 s** | No |
| 16:52:31 | Foróptero 16:52:33 | **2 s** | No |
| 16:52:52 | Foróptero 16:52:53 | **1 s** | No |
| 16:55:12 | Foróptero 16:55:14 | **2 s** | No |
| 16:55:43 | Foróptero 16:55:45 | **2 s** | No |
| 16:56:09 | Foróptero 16:56:12 | **3 s** | No |

**Contraste vs registro-6 (pre-fix):** gaps de 6–16 s y paciente decía "Bien"/"listo" para destrabar.  
**Contraste vs registro-8 (Fase 1a):** sin preguntas comparativas duplicadas en el mismo ciclo.

**Checkpoints clínicos que sí esperan paciente (OK):** pre-grueso OI (16:54:42 "Veo bien"); binocular listo (17:00:29 "Estoy listo").

**Resultado:** ✅ **QA Punto 1 cerrado** con evidencia CSV archivada.

### 4.0.3 `examen-registro-10` — QA Punto 2 OK (post-fix)

**Archivo:** `registros-examen/examen-registro-10.csv`  
**Sesión:** 2026-07-01, 17:28–17:41 (exportado 17:41)  
**Valores iniciales:** `<R> +0.50 , -1.00 , 60 / <L> +0.50 , 0.00 , 0`  
**Valores recalculados:** `<R> +0.50 , -0.50 , 60 / <L> +0.50 , +0.00 , 0`  
**Estado al exportar:** FINALIZADO  
**Contexto:** prueba tras commit `b1bb8fa` (esfera confirmada vía `calcularValoresFinalesForoptero` en generadores cilíndricos).

**Resultados esféricos OD al cierre:**

| Test | Resultado |
|------|-----------|
| Esférico grueso (R) | 0 |
| Esférico fino (R) | 0 |

**Criterio Punto 2 — esfera al iniciar cilíndrico (OD):**

| Timestamp | Evento | Esfera | Cilindro |
|-----------|--------|--------|----------|
| 17:31:56 | Fin esférico fino (`Sigamos`) + reanclaje | **+0.00** ✓ | -0.50 |
| 17:31:57 | **Inicio cilíndrico** (primer comparativo) | **+0.00** ✓ | +0.00 |
| 17:32:15 | Comparativa cilíndrica | **+0.00** ✓ | -0.50 |
| 17:32:25 | Post-comparación / reanclaje | **+0.00** ✓ | +0.00 |

**Contraste vs registro-7 (pre-fix):** mismo patrón clínico (fino = 0, recalculado +0.50) pero el inicio cilíndrico ya **no** cae a +0.50.

**Notas fuera de alcance Punto 2 (esperado en registro-10):** OI con cilindro recalculado 0 → cilíndrico L seguía `pendiente` (Bug 4 / Punto 3). **Corregido** en registro-11 (§4.0.4). Punto 1 (Sigamos sin pausa) se mantiene OK en los ciclos del registro.

**Resultado:** ✅ **QA Punto 2 cerrado** con evidencia CSV archivada.

### 4.0.4 `examen-registro-11` — QA Punto 3 OK (post-fix)

**Archivo:** `registros-examen/examen-registro-11.csv`  
**Sesión:** 2026-07-02, 10:40–10:52 (exportado 10:52)  
**Valores iniciales:** `<R> +0.25, -0.50, 175 / <L> +0.50, -1.50, 20`  
**Valores recalculados:** `<R> +0.25 , +0.00 , 175 / <L> +0.50 , -1.00 , 20`  
**Estado al exportar:** FINALIZADO  
**Contexto:** prueba tras commit `a20b305` (`cilindrico` siempre + `cilindricoSecuencialBajo`).

**Resultados al cierre:**

| Test | R (OD) | L (OI) |
|------|--------|--------|
| Esférico fino | 0 | 0 |
| Cilíndrico | **−0.25** | **−1.00** |
| Cilíndrico ángulo | pendiente | pendiente |

**Criterio Punto 3 — OD con cilindro recalculado `0.00` (modo secuencial §2.6.3.1):**

| Timestamp | Evento | Esfera | Cilindro |
|-----------|--------|--------|----------|
| 10:42:28 | Fin esférico fino + `Sigamos` | +0.00 ✓ | +0.00 |
| 10:42:30 | **Paso 1** cilíndrico (base `0` vs `−0,25`) | +0.00 ✓ | **−0.25** |
| 10:42:41 | Eligió `actual` → `C1 = −0,25` | +0.00 ✓ | −0.25 |
| 10:42:41 | **Paso 2** (`C1` vs `−0,50`) | +0.00 ✓ | **−0.50** |
| 10:42:52 | Eligió `anterior` → reanclaje | +0.00 ✓ | **−0.25** ✓ |

**Contraste vs registro-5 / registro-10 (pre-fix Punto 3):** con cilindro R recalculado `0`, el test **ya no se omite**; `Cilíndrico (R)` = **−0.25** (no `pendiente`).

**Criterio Punto 3 — OI con cilindro recalculado `−1.00` (bracket ±0,50 sin regresión):**

| Timestamp | Cilindro mostrado | Notas |
|-----------|-------------------|-------|
| 10:47:40 | −0.50 | Comparativa estándar |
| 10:48:19 | −1.50 | Segunda alternativa |
| 10:48:42 | −1.00 | Resultado confirmado |

**Smoke Puntos 1–2 en el mismo registro:** ciclos `Sigamos` sin pausa anómala; esfera **+0.00** en todo el bloque cilíndrico OD (Punto 2).

**Resultado:** ✅ **QA Punto 3 cerrado** con evidencia CSV archivada.

### 4.0.5 `examen-registro-13` — QA Punto 4 OK (post-fix)

**Archivo:** `registros-examen/examen-registro-13.csv`  
**Sesión:** 2026-07-03, 10:15–10:29 (exportado 10:29)  
**Valores iniciales:** `<R> +0.25, -0.50, 175 / <L> +0.50, -1.50, 20`  
**Valores recalculados:** `<R> +0.25 , +0.00 , 175 / <L> +0.50 , -1.00 , 20`  
**Estado al exportar:** FINALIZADO  
**Contexto:** prueba tras commit `f30ee41` (preajuste bilateral ETAPA_3 + transición R→L solo oclusión).

**Criterio Punto 4 — Preajuste bilateral al inicio (A1):**

| Timestamp | Evento | Foróptero |
|-----------|--------|-----------|
| 10:15:32 | **ETAPA_3** primer comando | `<R> Esf +0.25 / Cil +0.00 / (open); <L> Esf +0.50 / Cil -1.00 / @20° / (close)` ✓ |

Durante todo el bloque OD (líneas 15–82): L permanece `(close)` sin cambios ópticos; solo R se mueve en comparativas ✓

**Criterio Punto 4 — Transición R→L solo oclusión (A3):**

| Timestamp | Evento | Foróptero | Δ vs pre-fix |
|-----------|--------|-----------|--------------|
| 10:20:41 | Fin agudeza OD → inicio OI | `<R> (close); <L> (open)` ✓ | registro-5 (19:12:32): `<L> Esf +0.50 / Cil -1.00 / @20° / (open)` ❌ |
| 10:20:42 | Copy OI | *"Tomate tu tiempo y decime si ves bien."* ✓ | Sin "esperemos que se ajusten los lentes" |

**Tiempo mecánico transición:** comando foróptero 10:20:41 → TV 10:20:42 = **~1 s** (< 10 s, criterio §2.5.6.4).

**Resultados al cierre (smoke Puntos 2–3):**

| Test | R (OD) | L (OI) |
|------|--------|--------|
| Esférico fino | 0 | 0 |
| Cilíndrico | **−0.25** ⚠️ | **−0.50** |
| Agudeza alcanzada | 0 | 0.3 |

Esfera **+0.00** coherente en cilíndrico OD; cilíndrico R activo con base `0` (modo secuencial). Examen completo OD + OI + binocular sin errores.

**Nota B3 (post-análisis):** `Cilíndrico (R) = −0.25` en este registro refleja el bug B3 (paso 2 secuencial bajo); corregido en `a7ca9ad`, evidencia post-fix en `examen-registro-14.csv` (§4.0.6).

**Resultado:** ✅ **QA Punto 4 cerrado** con evidencia CSV archivada.

---

### 4.0.6 `examen-registro-14` — QA fix B3 cilíndrico secuencial (post-fix)

**Archivo:** `registros-examen/examen-registro-14.csv`  
**Sesión:** 2026-07-03, 11:01–11:15 (exportado 11:15)  
**Valores iniciales:** `<R> +0.25, -0.50, 175 / <L> +0.50, -1.50, 20`  
**Valores recalculados:** `<R> +0.25 , +0.00 , 175 / <L> +0.50 , -1.00 , 20`  
**Estado al exportar:** FINALIZADO  
**Contexto:** reproducción deliberada del tramo cilíndrico OD de registro-13 tras commit `a7ca9ad` (`fix(cilindrico): use C1 as reference in secuencial bajo step 2`).

**Criterio B3 — paso 2 «con el anterior» confirma C1 (0,0):**

| Timestamp | Línea | Evento | Foróptero OD |
|-----------|-------|--------|--------------|
| 11:04:37 | 47 | Fin esférico fino | `Esf +0.00 / Cil +0.00` |
| 11:04:50 | 49–50 | Paso 1 secuencial: alternativo | `Cil −0.25` |
| 11:04:58 | 52–54 | Paso 1: «con el anterior» | `Cil +0.00` (C1) ✓ |
| 11:05:05 | 56–58 | Paso 2: alternativo fijo | `Cil −0.50` |
| 11:05:14 | 59–61 | Paso 2: «con el anterior» | `Cil +0.00` ✅ (registro-13: `−0.25` ❌) |

**Resultado al cierre:**

| Test | R (OD) | L (OI) |
|------|--------|--------|
| Esférico fino | 0 | 0 |
| Cilíndrico | **0** ✅ | −0.50 |
| Agudeza alcanzada | 0.2 | 0.2 |

**Contraste registro-13 vs 14:** misma secuencia de respuestas en cilíndrico OD; única divergencia en foróptero y resultado tras paso 2.

**Bug B1 (binocular, pre-fix en este registro):** al abrir ambos ojos (l. 160), OI muestra `Cil −1,00` (recalc) en lugar de `Cil −0,50` (resultado monocular l. 186) porque `cilindricoAngulo` está `pendiente`. Corregido en `fe7d53f`; evidencia post-fix en `examen-registro-15.csv` (§4.0.7).

**Verificación de no regresión:** cilíndrico OI bracket ±0,50 normal; examen completo FINALIZADO; Puntos 1–4 sin regresión observable en cilíndrico OD (B3).

**Resultado:** ✅ **Fix B3 cerrado** — ver también `PLAN_FIX_BINOCULAR_CILINDRICO_REG13.md` §8.

---

### 4.0.7 `examen-registro-15` — QA fix B1 Rx entrada binocular (post-fix)

**Archivo:** `registros-examen/examen-registro-15.csv`  
**Sesión:** 2026-07-03, 11:48–12:02 (exportado 12:02)  
**Valores iniciales:** `<R> +0.25, -0.50, 175 / <L> +0.50, -1.50, 20`  
**Valores recalculados:** `<R> +0.25 , +0.00 , 175 / <L> +0.50 , -1.00 , 20`  
**Estado al exportar:** FINALIZADO  
**Contexto:** reproducción del escenario registro-14 (cilíndrico OI −0,50, ángulo pendiente) tras commit `fe7d53f` (`resolverCilindroYAnguloOjo` en línea base binocular).

**Criterio B1 — monocular → binocular sin salto de cilindro OI:**

| Timestamp | Línea | Evento | Registro-14 (pre-fix) | Registro-15 (post-fix) |
|-----------|-------|--------|----------------------|------------------------|
| — | 186 / 179 | Resultado `Cilíndrico (L)` | −0,50 | −0,50 |
| — | 155 / 150 | Última agudeza OI monocular | `L Cil −0.50` | `L Cil −0.50` |
| 11:13:33 / 12:00:35 | 160 / **155** | Entrada binocular (ambos ojos) | `L Cil −1.00` ❌ | `L Cil −0.50` ✅ |
| 11:13:56 / 12:01:01 | 164 / **159** | Tras «listo» | `L Cil −1.00` | `L Cil −0.50` ✅ |
| 12:01:15 / 12:01:15 | 171 / **164** | Variante cilíndrica | −1,00 → −0,50 | −0,50 → 0,00 ✅ |

**Resultado al cierre:**

| Test | R (OD) | L (OI) |
|------|--------|--------|
| Esférico fino | 0 | 0 |
| Cilíndrico | 0 | −0.50 |
| Cilíndrico ángulo | pendiente | pendiente |
| Agudeza alcanzada | 0.2 | 0.3 |
| Binocular | Cil 0 @ 0° | Cil 0 @ 0° (2× «actual») |

**Verificación de no regresión:** cilíndrico OD secuencial bajo → 0; examen completo FINALIZADO; B3 sin regresión en la misma sesión.

**Resultado:** ✅ **Fix B1 cerrado** — ver también `PLAN_FIX_BINOCULAR_CILINDRICO_REG13.md` §9.  
**Nota B4 (pre-fix en este registro):** l. 161–163 — ronda esférica binocular sin contraste; corregido en `26a8d40`; evidencia post-fix en `examen-registro-16.csv` (§4.0.8).

---

### 4.0.8 `examen-registro-16` — QA fix B4 omitir pasos no-op binocular (post-fix)

**Archivo:** `registros-examen/examen-registro-16.csv`  
**Sesión:** 2026-07-03, 12:54–13:07 (exportado 13:07)  
**Valores iniciales / recalculados:** idénticos a registro-15 (esf 0/0, L cil −0,50)  
**Estado al exportar:** FINALIZADO  
**Contexto:** reproducción del escenario registro-15 tras commit `26a8d40` (`varianteBinocularEsNoOp`, `prepararBinocularPostEsfera`).

**Criterio B4 — tras «listo», sin ronda esférica vacía:**

| Timestamp | Línea | Evento | Registro-15 (pre-fix B4) | Registro-16 (post-fix) |
|-----------|-------|--------|--------------------------|------------------------|
| 12:00:35 / 13:06:54 | 155 | Entrada binocular | `L Cil −0.50` | `L Cil −0.50` ✓ |
| 12:01:01 / 13:07:00 | 158 | Paciente «listo» | idem | idem |
| 12:01:02 / — | 161–163 | 1.ª comparativa ETAPA_6 | Esfera sin cambio ❌ | **omitida** ✅ |
| 12:01:15 / 13:07:00 | 164 / **159** | 1.er cambio post-listo | `L Cil 0.00` | `L Cil 0.00` ✅ |
| 12:01:21 / 13:07:05 | 166–168 / **161–163** | Rondas comparativas | **2** | **1** ✅ |

**Resultado al cierre:**

| Test | R (OD) | L (OI) |
|------|--------|--------|
| Esférico fino | 0 | 0 |
| Cilíndrico | 0 | −0.50 |
| Agudeza alcanzada | 0.2 | 0.3 |
| Binocular | Cil 0 @ 0° | Cil 0 @ 0° (1× «actual») |

**Verificación de no regresión:** B1 (L Cil −0,50 al entrar binocular); B3 (cilíndrico OD → 0); examen FINALIZADO.

**Resultado:** ✅ **Fix B4 cerrado** — ver también `PLAN_FIX_BINOCULAR_CILINDRICO_REG13.md` §10.

---

### 4.0.9 Copy natural v1.0 + fixes P0 orquestación (post-reg17)

**Plan:** `PLAN_COPY_NATURAL_AGENTE.md` (Anexos D y E)  
**Commits:** `d549358` (copy + routing por contexto), `b08e35c` (fixes P0 orquestación)  
**Evidencia CSV:** `registros-examen/examen-registro-17.csv` (copy v1.0, 2026-07-03 15:30–15:43)  
**QA operador adicional:** 2026-07-03 tarde — múltiples reinicios; **OK** tras `b08e35c`

#### Entrega copy natural (`d549358`)

| Ítem | Resultado |
|------|-----------|
| Variantes C10/C11/C12 + binocular | ✅ 3 variantes rotativas en CSV |
| 1ª comparación gruesa sin intro | ✅ 1× `hablar` (vs reg16: 2×) |
| Routing por `faseComparacion` / `faseBinocular` | ✅ 14/14 comparaciones con `interpretacionComparacion` |
| Sin regresión clínica vs reg16 | ✅ |

#### Regresiones detectadas en QA extendido (mismo día, pre-`b08e35c`)

| ID | Síntoma | Causa |
|----|---------|--------|
| E1 | Loop intermitente ETAPA_1 (improvisación *«procesando»* / *«confirmamos listos»*) | Sin tool-first ETAPA_1; `{}` en duda; silencio backend ~10–23 s |
| E2 | Agente verbaliza `POST_COMPARACION_CONTINUAR` tras ritual C11 | Token/flag expuesto en prompt y tool `description` |

#### Fixes P0 (`b08e35c`) — cerrados

| Fix | Archivo | Verificación |
|-----|---------|--------------|
| Tool-first ETAPA_1 + frases prohibidas | `chatSupervisor/index.ts` | Valores en 1.er intento sin loop |
| REGLA POST-COMPARACIÓN; sin token en tool description | `chatSupervisor/index.ts` | Solo C11 audible; `auto_chain` sin jerga |

**Nota ritual post-comparación:** C11 reemplazó el copy fijo *«Sigamos con este.»*; el contrato `postComparacionContinuar` + `auto_chain` se mantiene (Punto 1 §2.3.8).

**Pendiente P1 (no bloqueante):** ack backend tras ETAPA_1; `audio_started` antes de nudge; Modo B cliente — ver `PLAN_COPY_NATURAL_AGENTE.md` Anexo E.

---

### 4.1 `examen-registro-5.csv` — Bug 2 confirmado

Resultados esféricos de OI al cierre del registro:

| Test | Resultado |
|------|-----------|
| Esférico grueso (L) | 0 |
| Esférico fino (L) | 0 |

Al iniciar el test **cilíndrico**, el foróptero envió **Esf +0.50** (valor recalculado) en lugar de **+0.00** (resultado confirmado):

| Timestamp | Evento | Esfera | Cilindro |
|-----------|--------|--------|----------|
| 19:16:21 | Fin esférico (reanclaje) | **+0.00** | -1.00 |
| 19:16:36 | Inicio cilíndrico | **+0.50** ❌ | -0.50 |
| 19:16:57 | Comparativa | **+0.50** ❌ | -1.00 |
| 19:17:50 | Post-comparación | **+0.00** ✓ | -1.00 |

Encaja con el bug del operador `||` cuando `esfericoFino = 0` y `esfericoGrueso = 0` son falsy → fallback a `valoresRecalculados.esfera = +0.50`.

**Caso de regresión acordado:** mismos valores de autorefractómetro → primer paso cilíndrico OI debe llevar `esfera: 0.00`.

### 4.1.1 `examen-registro-7.csv` — Bug 2 reconfirmado (prueba controlada)

Prueba deliberada con autorefractómetro `<R> +0.50, -1.50, 150 / <L> +0.50, -1.50, 20` → recalculados `<R> +0.50 , -1.00 , 150 / <L> +0.50 , -1.00 , 20`.

Resultados esféricos de **OD** al cierre:

| Test | Resultado |
|------|-----------|
| Esférico grueso (R) | 0 |
| Esférico fino (R) | 0 |

Durante el esférico fino el foróptero **sí** muestra `Esf +0.00` correctamente (líneas 35, 42, 49). Al pasar a cilíndrico, vuelve al recalculado:

| Timestamp | Evento | Esfera | Cilindro |
|-----------|--------|--------|----------|
| 14:58:41 | Fin esférico fino (reanclaje) | **+0.00** ✓ | -1.00 |
| 14:58:50 | `Sigamos con este.` | — | — |
| 14:58:57 | **Inicio cilíndrico** | **+0.50** ❌ | -0.50 |
| 14:59:16 | Comparativa cilíndrica | **+0.50** ❌ | -1.00 |

Misma causa: `esfericoFino = 0` y `esfericoGrueso = 0` son falsy con `||` → `valoresRecalculados.esfera = +0.50`.

**Condición necesaria (validada en registro-5, registro-6 y registro-7):** el bug solo se manifiesta cuando grueso **y/o** fino confirman **0.00**; si el fino es distinto de cero (p. ej. registro-6: R fino +1.00), el `||` devuelve el valor correcto.

**Caso de regresión adicional:** mismos valores de autorefractómetro del registro-7 → primer paso cilíndrico OD debe llevar `esfera: 0.00`.

### 4.2 `examen-registro-5.csv` — Bug 4 confirmado

Cilindro recalculado de OD = **+0.00** → la secuencia actual **omite** el test cilíndrico.

Secuencia observada:

1. Esférico grueso R → **+0.25**
2. Esférico fino R → **0**
3. **Salto directo** a agudeza alcanzada (19:10:59, sin comparativa cilíndrica)

Resumen del CSV:

```
Cilíndrico (R),pendiente
Cilíndrico ángulo (R),pendiente
```

En OI (cilindro recalculado **-1.00**) sí se ejecutó cilíndrico → resultado **-1.00**.

**Caso de regresión acordado:** con cilindro recalculado 0 en OD, la secuencia debe incluir `cilindrico` para R.

### 4.3 Notas ítem 1 en registro-5

- `Sigamos con este.` ×8 — comportamiento esperado (feedback clínico).
- Hueco 31 s con `correcta` espontánea (19:09:11→19:09:42) — misma familia que Bug 1 (agente espera input).

---

### 4.4 Referencia cruzada de bugs por registro

| Bug | registro-5 | registro-6 | registro-7 | registro-10 | registro-11 |
|-----|------------|------------|------------|-------------|-------------|
| **1** Agente espera respuesta post-Sigamos | Sospecha (hueco 31 s) | **Confirmado** (UI; CSV muestra pausa sin fila Paciente) | — | **No reproduce** (post-fix Punto 1) | **No reproduce** |
| **2** Esfera → cilindro | **Confirmado** (OI) pre-fix | **No reproduce** (fino R +1.00, L +2.50; sin cil. L) | **Confirmado** (OD) pre-fix | **No reproduce** (OD fino 0 → cil. **Esf +0.00**; §4.0.3) | **No reproduce** (OD Esf +0.00 en cil.; §4.0.4) |
| **4** Cilíndrico siempre | **Confirmado** (OD omitido) | Parcial (R sí; L omitido, cil. 0) | — (examen cortado en cil. R) | Parcial (R cil. OK; L `pendiente`, cil. 0) | **No reproduce** (R cil. −0.25; L cil. −1.00; §4.0.4) |

---


## 5. Orden de trabajo sugerido

| Orden | Ítem | Motivo |
|-------|------|--------|
| 1 | **Bug 1** — Agente espera respuesta post-Sigamos | ✅ **Cerrado** (§2.3.8) |
| 2 | **Ítem 2** — Valor esférico | ✅ **Cerrado** (§2.4.5) |
| 3 | **Ítem 4** — Cilíndrico siempre | ✅ **Cerrado** (§2.6, §4.0.4) |
| 4 | **Ítem 3a** — Preajuste bilateral + R→L | ✅ **Cerrado** (§2.5.10, §4.0.5) |
| 5 | **Medición baseline** — M1–M4 | Obligatoria antes de firmware (Q5) |
| 6 | **Ítem 3b** — Velocidad esférica firmware | Tras baseline documentado |

**Regla de trabajo:** **un punto a la vez**. No iniciar el punto N+1 hasta que el N pase su checklist de §5.1 y se exporte CSV de evidencia.

**PRs sugeridos (cuando pasemos a código):**

1. ~~`fix(agente): encadenar obtenerEtapa tras postComparacionContinuar`~~ — **Punto 1 cerrado** (`14c2768`, `54c1ef0`)
2. ~~`fix(esfera): usar resultado esférico confirmado en etapa cilíndrica`~~ — **Punto 2 cerrado** (`b1bb8fa`)
3. ~~`feat(secuencia): incluir test cilíndrico siempre`~~ — **Punto 3 cerrado** (`a20b305`)
4. ~~`feat(etapa3): preajuste bilateral + transición R→L solo oclusión`~~ — **Punto 4 cerrado** (`f30ee41`)
5. *(sin PR — medición en banco)* — Punto 5
6. `perf(firmware): perfil de velocidad esférica escalonado` — Punto 6

**Resumen:** **1 → Agente · 2 → Esfera→cilindro · 3 → Cilindro siempre · 4 → Preajuste R→L · 5 → Medir · 6 → Firmware rápido**

---

### 5.1 Plan de QA por entrega (un punto a la vez)

Cada entrega sigue el mismo ciclo:

1. **Implementar** solo ese punto.
2. **QA manual acotado** (checklist del punto; ignorar deliberadamente lo que aún no se tocó — ver tabla §5.1.8).
3. **Exportar CSV** y archivar en `registros-examen/` (p. ej. `examen-registro-8.csv`).
4. **OK explícito** antes de pasar al siguiente punto.
5. **Smoke mínimo** de puntos ya cerrados si el cambio podría regresarlos (indicado en cada checklist).

#### Punto 1 — Bug 1: agente post-`Sigamos con este.` ✅ CERRADO

**Implementado:** `postComparacionContinuar.ts` + hooks cliente + prompt `chatSupervisor` (§2.3.8). Encadenado **exclusivo** vía señal `__POST_COMPARACION_CONTINUAR__` tras TTS de Sigamos.

| Checklist QA | |
|--------------|--|
| [x] Tras cada `Sigamos con este.`, siguiente pregunta en **< 5 s** **sin** hablar | |
| [x] Logs UI: `auto_chain: postComparacionContinuar` → `obtenerEtapa` (sin turno paciente intercalado) | |
| [x] Comparativas esféricas/cilíndricas: examen avanza **sin** decir "Bien"/"listo" | |
| [x] Pre-grueso ("¿ves bien?") y binocular ("avisame cuando estés listo") **siguen** pidiendo respuesta | |
| [x] Sin bucles de pregunta comparativa duplicada (regresión §4.0.1 corregida en `54c1ef0`) | |

**Evidencia:** pre-fix `examen-registro-6.csv` (§4.0); regresión intermedia `examen-registro-8` (§4.0.1); **post-fix OK** `examen-registro-9.csv` (§4.0.2).

**Gate para Punto 2:** ✅ cumplido.

---

#### Punto 2 — Bug 2: esfera confirmada → cilíndrico ✅ CERRADO

**Implementado:** `reference/foroptero-server/motorExamen.js` — `calcularValoresFinalesForoptero(ojo)` en 6 bloques cilíndricos (§2.4.5, commit `b1bb8fa`).

| Checklist QA | |
|--------------|--|
| [x] Caso **registro-7**: autorefractómetro `<R> +0.50, -1.50, 150 / <L> +0.50, -1.50, 20` | *(Escenario equivalente en registro-10: R recalculado +0.50, fino 0)* |
| [x] Esférico grueso/fino OD = **0** → primer cilíndrico OD: **Esf +0.00**, no +0.50 | |
| [x] Variante **registro-5** (OI fino = 0) si es posible | *(OI sin cilíndrico por cil. 0 — Bug 4; OD validado en registro-10)* |
| [ ] Control negativo (registro-6): fino R = +1.00 → cilíndrico sigue con **+1.00** | *(No ejecutado en registro-10; sin regresión esperada por cambio acotado)* |
| [x] CSV: línea Foróptero al inicio cilíndrico coherente con esfera confirmada | |

**Evidencia:** pre-fix `examen-registro-5.csv` (§4.1), `examen-registro-7.csv` (§4.1.1); **post-fix OK** `examen-registro-10.csv` (§4.0.3).

**Gate para Punto 3:** ✅ cumplido.

---

#### Punto 3 — Ítem 4: cilíndrico siempre (solo potencia) ✅ CERRADO

**Implementado:** `reference/foroptero-server/motorExamen.js` — `determinarTestsActivos`, `cilindricoSecuencialBajo`, reanclaje ETAPA_5 (§2.6.3.1–§2.6.3.2, commit `a20b305`).

**Por qué tercero:** fix de secuencia backend; D4.3 (binocular) **fuera de alcance**.

| Checklist QA | |
|--------------|--|
| [x] Cilindro recalculado **0.00** en OD → **sí** corre cilíndrico R | |
| [x] Base `0` → paso 1: **`0` vs `−0,25`**; paso 2: ganador vs **`−0,50`** (2 comparativas) | |
| [x] Base `−0,25` → paso 1: **`−0,25` vs `0`**; paso 2: ganador vs **`−0,50`** (2 comparativas) | *(Validación manual OK; no en registro-11)* |
| [x] 1 confirmación por comparativa (no doble confirmación esférica) | |
| [x] Tras paso 1: foróptero en `C1` elegido; paso 2 compara `C1` vs `−0,50` (§2.6.3.2) | |
| [x] Al cerrar paso 2: foróptero queda en cilindro confirmado | |
| [x] Cilindro normal (`−1.00`, etc.) → sin regresión (±0,50) | |
| [x] Cilíndrico ángulo **no** se activa "siempre" | |
| [x] **No** validar cambios binocular (D4.3 pendiente) | |
| [x] Re-validar Punto 2: fino = 0 + cilindro activo → esfera correcta | |

**Caso de regresión:** OD con cilindro R recalculado `0` ya no omite cilíndrico; secuencia §2.6.3.1 validada en registro-11.

**Evidencia:** pre-fix `examen-registro-5.csv` (§4.2), `examen-registro-10.csv` (L `pendiente`); **post-fix OK** `examen-registro-11.csv` (§4.0.4).

**Gate para Punto 4:** ✅ cumplido.

---

#### Punto 4 — Ítem 3a: preajuste bilateral + transición R→L ✅ CERRADO

**Implementado:** `reference/foroptero-server/motorExamen.js` — preajuste bilateral ETAPA_3, `lentesPreajustadasBilateral`, bundle solo oclusión R→L, `MSG_PRE_GRUESO_OI_SOLO_OCLUSION` (§2.5.10, commit `f30ee41`).

**Por qué cuarto:** mejora mecánica; conviene con lógica clínica (Puntos 2–3) ya correcta.

| Checklist QA | |
|--------------|--|
| [x] Inicio: foróptero mueve R **y** L a recalculados (L ocluido) | |
| [x] Comparativas OD: solo se mueve R | |
| [x] Fin agudeza OD → inicio OI: transición **< 10 s**, sin recomando óptico grande de L | |
| [x] Copy OI (solo oclusión): agente dice *"Ahora vamos con el ojo izquierdo. Tomate tu tiempo y decime si ves bien."* — no el `MSG_PRE_GRUESO_OI` con "esperemos que se ajusten los lentes" | |
| [x] Valores finales OD/OI correctos (Puntos 2–3 no regresan) | |
| [x] CSV: timestamp fin OD → primer foróptero OI vs registro-5 | |

**Evidencia:** pre-fix `examen-registro-5.csv` (§4, 19:12:32); **post-fix OK** `examen-registro-13.csv` (§4.0.5).

**Gate para Punto 5:** ✅ cumplido.

---

#### Punto 5 — Medición baseline (M1–M4)

**Implementar:** ningún cambio de código — solo medición en banco (§2.5.7.4).

**Por qué aquí:** Q5 exige −50 %; hay que documentar baseline **antes** de tocar firmware.

| Checklist QA | |
|--------------|--|
| [ ] **M1:** salto ±0,50 D esférico grueso ≈ **7 s** (baseline P4) | |
| [ ] **M2:** delta CSV entre líneas Foróptero en ETAPA_5 esférica | |
| [ ] **M3:** baseline transición R→L (post Punto 4) | |
| [ ] Resultados anotados (plan o nota de QA) | |

**Gate para Punto 6:** baseline documentado con números reales.

---

#### Punto 6 — Ítem 3b: velocidad esférica firmware

**Implementar:** perfil esférico escalonado ×1.25 → ×1.5 → ×2.0 en ESP32 (§2.5.7.5).

**Por qué último:** hardware; riesgo de pérdida de pasos; impacto en todo el examen esférico.

| Checklist QA (por escalón) | |
|----------------------------|--|
| [ ] ±0,50 D grueso: objetivo **≤ 3,5 s** (−50 % vs ~7 s, O5) | |
| [ ] ±0,25 D fino: mejora proporcional, sin error de posicionamiento | |
| [ ] 20 ciclos ±0,50 sin timeout ni pérdida de pasos | |
| [ ] Cilindro/ángulo sin regresión de precisión | |
| [ ] Punto 1 re-validado en examen completo más rápido | |

**Gate final:** O5 cumplido + examen completo OD + OI + binocular sin errores.

---

#### 5.1.7 CSV de referencia por punto

| Punto | CSV principal | Qué mirar en el export |
|-------|---------------|------------------------|
| 1 | `examen-registro-6.csv` | Gaps Oftalmologo → Foróptero post-Sigamos |
| 2 | `examen-registro-10.csv` (+ registro-7 pre-fix) | Esfera al iniciar cilíndrico |
| 3 | `examen-registro-11.csv` (+ registro-5 pre-fix) | Cilíndrico (R) con cil. 0; secuencial 2 pasos |
| 4 | `examen-registro-13.csv` (+ registro-5 pre-fix) | Preajuste bilateral inicio; transición R→L solo oclusión |
| 5 | Cualquier examen esférico | Tiempos entre líneas Foróptero |
| 6 | Nuevo export post-fix | ≤ 3,5 s / 0,50 D en grueso |

Cada punto validado debe generar un **nuevo CSV** archivado en `registros-examen/`.

#### 5.1.8 Alcance de QA — qué ignorar en cada punto

| Punto | Ignorar deliberadamente en QA |
|-------|-------------------------------|
| 1 | Valores esféricos en cilíndrico, cilindro 0, velocidad motor |
| 2 | Fluidez post-Sigamos (cerrado), cilindro siempre, velocidad |
| 3 | Binocular (D4.3), ángulo cilíndrico, firmware |
| 4 | Velocidad ±0,50 (aún no tocada) |
| 5 | Cambios de comportamiento clínico |
| 6 | Secuencia cilíndrica / esfera (solo timing y precisión mecánica) |

---


## 6. Criterios de aceptación globales

- [ ] Examen completo OD + OI + binocular sin errores en backend.
- [ ] Casos de regresión `registros-examen/` (§4.0, §4.1, §4.1.1, §4.2) pasan.
- [ ] Valores finales de foróptero coherentes con resultados de cada test.
- [ ] Agente solo habla textos de `pasos[].mensaje`; `Sigamos con este.` se preserva.
- [ ] Documentación alineada con el comportamiento nuevo.

---


## 7. Riesgos y dependencias

| Riesgo | Ítem | Mitigación |
|--------|------|------------|
| Preajuste bilateral alarga inicio percibido | 3a | Copy claro; una sola espera; medir vs doble espera actual — **QA OK** registro-13 |
| Oclusión L insuficiente con lentes pre-montadas | 3a | Verificación física en banco — **sin incidencia** en registro-13 |
| Transición R→L envía lentes completas por error | 3b | Flag `lentesPreajustadasBilateral` + tests — **QA OK** registro-13 |
| Aumentar velocidad de motores causa pérdida de pasos | 3b | Escalones ×1.25 → ×1.5 → ×2; banco 20 ciclos |
| Cilíndrico con base 0 confunde al paciente | 4 | Algoritmo secuencial §2.6.3.1 (2 comparativas cortas) + copy clínico si hace falta |
| Fix de `0.00` falsy revela otros bugs con valores borde | 2 | ✅ Cerrado — `calcularValoresFinalesForoptero` en generadores cilíndricos (§2.4.5) |
| Agente espera respuesta post-Sigamos (Bug 1) | 1 | ✅ Cerrado — `auto_chain` + señal `__POST_COMPARACION_CONTINUAR__` (§2.3.8) |

---


## 8. Checklist de seguimiento

> **Implementación:** un punto a la vez — ver checklists de QA por entrega en **§5.1**.

### Sesión — Bug 1 (agente espera respuesta post-Sigamos) — Punto 1 ✅ CERRADO
- [x] Aclarado: `Sigamos con este.` no es el bug; la espera de respuesta sí
- [x] Q1 cerrada: "poco fluido" = hay que hablar tras Sigamos
- [x] Q2 cerrada (evidencia): ni backend ni UI piden "listo"; agente cede turno (§2.3.3, §4.0)
- [x] Confirmado en registro-6 + logs UI (§4.0)
- [x] CSV: huecos sin fila Paciente = evidencia indirecta; **no** se modifica el export
- [x] Fix agente 1.1–1.4 (§2.3.8)
- [x] Implementado Punto 1: `auto_chain` + señal `__POST_COMPARACION_CONTINUAR__` (`14c2768`, `54c1ef0`)
- [x] QA manual post-fix: **OK** — `examen-registro-9.csv` archivado (§4.0.2)
- [x] Gate Punto 2: cumplido

### Sesión — Ítem 2 (Esfera → cilindro) — Punto 2 ✅ CERRADO
- [x] Caso reproducible: `examen-registro-5.csv` §4.1
- [x] Reconfirmado: `examen-registro-7.csv` §4.1.1 (prueba controlada, OD)
- [x] Confirmación bug `||` con valor 0.00
- [x] Implementación: `b1bb8fa` — `calcularValoresFinalesForoptero` en 6 bloques (§2.4.5)
- [x] QA manual post-fix: **OK** — `examen-registro-10.csv` archivado (§4.0.3)
- [x] Gate Punto 3: cumplido

### Sesión — Ítem 3 (Foróptero: preajuste + velocidad) — Puntos 4–6
- [x] Hipótesis preajuste bilateral documentada §2.5.3–2.5.4
- [x] Plan Fase A: preajuste + R→L simplificado §2.5.6
- [x] Plan Fase B: velocidad esférica y modelo de impacto §2.5.7
- [x] Objetivo Q5: esférico grueso **7 s → 3,5 s / 0,50 D** (−50 %)
- [x] Implementar A1–A7 (PR-3a, PR-3b) — `f30ee41`
- [x] QA manual Fase A: **OK** — `examen-registro-13.csv` archivado (§4.0.5)
- [x] Gate Punto 5: cumplido
- [ ] Medición baseline M1–M4 (PR-3c)
- [ ] Firmware escalonado B1–B4 (PR-3d)
- [ ] Validación integrada Fase B con `examen-registro-5.csv`

### Sesión — Ítem 4 (Cilíndrico siempre) — Punto 3 ✅ CERRADO
- [x] Caso reproducible: `examen-registro-5.csv` §4.2
- [x] Q4 cerrada: cilíndrico ángulo **no se implementa**; queda pendiente
- [x] D4.1 cerrada: algoritmo secuencial 2 comparativas para base `0` / `−0,25` (§2.6.3.1)
- [x] D4.1b cerrada: **1 confirmación** por comparativa
- [x] D4.1c cerrada: `igual` → valor **más cercano a 0**
- [x] D4.1d cerrada: reanclaje foróptero al lente elegido entre comparativas; resultado final en cara (§2.6.3.2)
- [ ] D4.3 (binocular) — sin feedback del cliente aún
- [x] Implementación potencia cilíndrica siempre (`a20b305`)
- [x] QA manual post-fix: **OK** — `examen-registro-11.csv` archivado (§4.0.4)
- [x] Gate Punto 4: cumplido

---


## Referencias internas

- **`registros-examen/`** — Registros CSV de pruebas de campo
  - **`examen-registro-5.csv`** — Bugs 2 y 4 (§4.1, §4.2)
  - **`examen-registro-6.csv`** — Bug 1 pre-fix (§4.0)
  - **`examen-registro-7.csv`** — Bug 2 reconfirmado (§4.1.1)
  - **`examen-registro-8.csv`** — Regresión intermedia Fase 1a (§4.0.1; archivo externo a `registros-examen/`)
  - **`examen-registro-9.csv`** — QA Punto 1 OK post-fix (§4.0.2)
  - **`examen-registro-10.csv`** — QA Punto 2 OK post-fix (§4.0.3)
  - **`examen-registro-11.csv`** — QA Punto 3 OK post-fix (§4.0.4)
  - **`examen-registro-13.csv`** — QA Punto 4 OK post-fix (§4.0.5); evidencia pre-fix B3 cilíndrico OD
  - **`examen-registro-14.csv`** — QA fix B3 OK post-fix (§4.0.6)
  - **`examen-registro-15.csv`** — QA fix B1 OK post-fix (§4.0.7); evidencia pre-fix B4 (l. 161–163)
  - **`examen-registro-16.csv`** — QA fix B4 OK post-fix (§4.0.8)
  - **`examen-registro-17.csv`** — QA copy natural v1.0 + fixes P0 orquestación (§4.0.9)
- `PLAN_COPY_NATURAL_AGENTE.md` — Copy rotativo C10–C12/C11; Anexos D (QA reg17) y E (fixes P0)
- `PLAN_FIX_BINOCULAR_CILINDRICO_REG13.md` — Bugs binocular/cilíndrico: **B1**, **B3** y **B4** cerrados; **B2** pendiente
- `src/app/lib/postComparacionContinuar.ts` — Hook `auto_chain` y señal `__POST_COMPARACION_CONTINUAR__`
- `src/app/agentConfigs/chatSupervisor/index.ts` — Instrucciones del agente
- `DOCUMENTACION.md` — Flujo ETAPA_1–6 y tests opcionales
- `reference/ALGORITMO_REGLAS_TESTS.md` — Saltos por tipo de test
- `reference/foroptero-server/PLAN_REANCLAJE_POST_COMPARATIVA_LENTES.md` — Rituales post-comparación
- `reference/foroptero-server/PLAN_IMPLEMENTACION_ETAPA2_LOGMAR_GRUESO.md` — Pre-grueso visual
- `reference/foroptero-server/DEFINICIONES_EXAMEN_BINOCULAR.md` — ETAPA_6

---

*Próximo paso: **Punto 5** (§5.1) — medición baseline M1–M4 en banco; anotar resultados; OK antes de Punto 6 (firmware).*
