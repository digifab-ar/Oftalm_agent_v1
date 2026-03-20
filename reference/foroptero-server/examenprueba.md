## Modo de Examen de Prueba

Este documento describe la implementación del **modo de examen de prueba** en el motor de examen visual (`motorExamen.js`) y su integración con los endpoints HTTP existentes.

El objetivo es poder **ejecutar aisladamente subconjuntos de tests** (agudeza, esféricos, cilíndricos, binocular) sin romper la lógica clínica ni el flujo de examen normal.

---

### 1. Estados y modos del examen

- **Estado base (`estadoExamen`)**  
  Se agrega una nueva propiedad:
  - `modo: 'normal' | 'testag' | 'testesf' | 'testcil' | 'testbin'`

- **Valores permitidos**
  - `'normal'`: modo por defecto, examen completo estándar (flujo actual).
  - `'testag'`: modo prueba de **agudeza visual inicial** (ambos ojos).
  - `'testesf'`: modo prueba de **lentes esféricos** (grueso y fino en ambos ojos).
  - `'testcil'`: modo prueba de **lentes cilíndricos** (y ángulo cuando aplique).
  - `'testbin'`: modo prueba de **test binocular**.

- **Inicialización y reinicio**
  - En `inicializarExamen(modo?)`:
    - si se pasa un `modo` válido, inicializa con ese modo.
    - si no se pasa modo, inicializa en `'normal'`.
  - En el endpoint `POST /api/examen/reiniciar`:
    - sin body (o sin `modo`) reinicia en `'normal'`.
    - con body válido (`testag`, `testesf`, `testcil`, `testbin`) reinicia en ese modo de prueba.

---

### 2. Activación de modo prueba por endpoint `reiniciar`

La activación del modo prueba se hace exclusivamente vía endpoint:

- **Endpoint:** `POST /api/examen/reiniciar`
- **Body opcional:** `{ "modo": "normal" | "testag" | "testesf" | "testcil" | "testbin" }`

Reglas:

1. Si no se envía body, o no se envía `modo`, el examen reinicia en modo `'normal'`.
2. Si se envía un `modo` válido (`testag`, `testesf`, `testcil`, `testbin`), reinicia directamente en ese modo de prueba.
3. Si se envía un modo inválido, el endpoint responde `400` con mensaje de error.

En este diseño, **ETAPA_1 solo procesa valores del autorefractómetro**. Ya no se activa el modo prueba por texto conversacional del paciente.

---

### 3. Reutilización de ETAPA_2 (recálculo)

La **ETAPA_2** mantiene su comportamiento actual:

- Aplica reglas de recálculo cilíndrico y esférico.
- Guarda los resultados en `estadoExamen.valoresRecalculados`.
- No depende de `estadoExamen.modo`.

El modo de examen (normal o prueba) solo afecta a partir de **ETAPA_3 (preparación y secuencia)**.

---

### 4. Generación de secuencia según modo (ETAPA_3)

En la lógica actual de **ETAPA_3**, se genera la secuencia completa del examen:

- Hoy:
  - `const secuencia = generarSecuenciaExamen();`
  - `estadoExamen.secuenciaExamen.testsActivos = secuencia;`
  - `indiceActual`, `testActual` y `etapa` se inicializan en base a esa secuencia.

Con modo prueba se ajusta de la siguiente forma:

- **Modo normal (`modo === 'normal'`)**
  - Se mantiene exactamente la lógica actual:
    - `testsActivos = generarSecuenciaExamen();`

- **Modo prueba (`modo !== 'normal'`)**
  - Se utiliza una nueva función:
    - `testsActivos = generarSecuenciaPrueba(estadoExamen.modo);`
  - Luego se inicializan:
    - `indiceActual = 0`
    - `testActual = testsActivos[0] || null`
    - `estadoExamen.etapa = mapearTipoTestAEtapa(testActual.tipo)`
  - El resto de la lógica de ETAPA_3 (configuración de foróptero inicial, ojo actual, mensajes al paciente) se mantiene, ajustándose automáticamente a que la secuencia sea más corta.

---

### 5. Definición de `generarSecuenciaPrueba(modo)`

La función `generarSecuenciaPrueba(modo)` construye una secuencia reducida de tests activos, utilizando los **mismos tipos de test** que el examen normal:

- Tipos reutilizados:
  - `agudeza_inicial`
  - `esferico_grueso`
  - `esferico_fino`
  - `cilindrico`
  - `cilindrico_angulo`
  - `binocular`

En todos los casos, los tests de prueba se realizan **en ambos ojos** cuando aplica, **primero ojo derecho (R) y luego ojo izquierdo (L)**, excepto el binocular que es siempre `ojo: 'B'`.

#### 5.1. Modo `testag` – Prueba de agudeza visual

- Secuencia:
  - `[{ tipo: 'agudeza_inicial', ojo: 'R' },`
  - ` { tipo: 'agudeza_inicial', ojo: 'L' }]`
- Solo se realiza **agudeza visual inicial** por cada ojo.
- No se incluyen:
  - esféricos,
  - cilíndricos,
  - agudeza alcanzada,
  - binocular.

#### 5.2. Modo `testesf` – Prueba de lentes esféricos

- Secuencia:
  - Ojo derecho (R):
    - `{ tipo: 'esferico_grueso', ojo: 'R' }`
    - `{ tipo: 'esferico_fino', ojo: 'R' }`
  - Ojo izquierdo (L):
    - `{ tipo: 'esferico_grueso', ojo: 'L' }`
    - `{ tipo: 'esferico_fino', ojo: 'L' }`
- Consideraciones:
  - Se reutiliza **toda la lógica de ETAPA_5** para esférico grueso y fino:
    - valor base desde `valoresRecalculados`,
    - estrategia de 3 valores,
    - sistema de confirmaciones,
    - límites de seguridad.
  - No se ejecutan en este modo:
    - agudeza inicial/final (salvo que se hagan en otro examen),
    - tests cilíndricos,
    - binocular.

#### 5.3. Modo `testcil` – Prueba de lentes cilíndricos

- Secuencia:
  - Para cada ojo (R y L), se reutiliza la función `determinarTestsActivos(cilindroRecalc)` para decidir:
    - si se incluye `cilindrico`,
    - si se incluye `cilindrico_angulo`.
  - El orden es:
    - Todos los tests cilíndricos del ojo derecho (R) primero.
    - Luego todos los tests cilíndricos del ojo izquierdo (L).

- Consideraciones:
  - Se **respeta exactamente** la lógica actual de inclusión de tests:
    - Si el cilindro recalculado es 0 o -0.25, no hay tests de cilindro para ese ojo.
    - Si entra en los rangos definidos, se incluyen los tests correspondientes.
  - No se fuerza la ejecución de tests de cilindro cuando la lógica actual los desactiva.

#### 5.4. Modo `testbin` – Prueba binocular

- Secuencia:
  - `[{ tipo: 'binocular', ojo: 'B' }]`
- Consideraciones:
  - Se reutiliza la lógica actual de **ETAPA_6** para test binocular:
    - uso de `binocularEstado`,
    - esferas iniciales R/L,
    - estrategia de comparación y confirmación.
  - En este modo, el test binocular se ejecuta sin requerir que se hayan ejecutado previamente todos los tests monoculares del examen completo.

---

### 6. Relleno de resultados para mantener coherencia clínica

Para que la estructura de resultados y las funciones auxiliares sigan funcionando tanto en exámenes normales como en exámenes de prueba, se aplican las siguientes reglas:

- **Agudeza visual (cuando no sea el test de agudeza)**
  - En modos distintos de `testag`:
    - `estadoExamen.secuenciaExamen.resultados[ojo].agudezaInicial` se puede setear a `0`.
    - `estadoExamen.secuenciaExamen.resultados[ojo].agudezaAlcanzada` se puede setear a `0`.
  - Esto permite reutilizar funciones que esperan un valor numérico (p. ej. para `calcularValoresFinalesForoptero`) sin dejar `null`.

- **Lentes no probados en el examen de prueba**
  - En cada modo de prueba, para los componentes **no testados**, se reutilizan directamente los valores recalculados:
    - Ejemplo (modo `testesf` – solo esféricos):
      - `resultados[ojo].cilindrico = valoresRecalculados[ojo].cilindro`
      - `resultados[ojo].cilindricoAngulo = valoresRecalculados[ojo].angulo`
    - Ejemplo (modo `testcil` – solo cilíndricos):
      - `resultados[ojo].esfericoGrueso` y/o `esfericoFino` pueden tomar como base la esfera recalculada cuando no se hayan probado en este examen.
  - De esta forma:
    - `calcularValoresFinalesForoptero(ojo)` siempre obtiene una combinación coherente de esfera, cilindro y ángulo.
    - El endpoint de detalle muestra una "receta" completa aunque parte de ella provenga directamente del recálculo, no de tests de prueba.

---

### 7. Endpoint `/api/examen/detalle`

El endpoint `GET /api/examen/detalle` ya utiliza `obtenerDetalleExamen()` para devolver:

- `valoresIniciales`
- `valoresRecalculados`
- `tests` (secuencia de tests con estado y resultados)
- `resultados` (valores por ojo)
- `estadoActual`
- `timestamps`

Se realiza la siguiente extensión mínima:

- Dentro de `detalle`, se agrega el campo:
  - `modo: estadoExamen.modo`

Ejemplo de respuesta (esquemático):

```json
{
  "ok": true,
  "detalle": {
    "modo": "testesf",
    "valoresIniciales": { ... },
    "valoresRecalculados": { ... },
    "tests": [ ... ],
    "resultados": { ... },
    "estadoActual": { ... },
    "timestamps": { ... }
  }
}
```

Esto permite al usuario distinguir exámenes normales de exámenes de prueba, manteniendo el resto del contrato del endpoint intacto.

---

### 8. Integración con el agente `chatSupervisor`

- El agente `chatSupervisor` **no requiere cambios**:
  - Sigue llamando `obtenerEtapa()` al inicio y después de cada respuesta del paciente.
  - Envía `respuestaPaciente` tal cual se introduce (p. ej. `"testag"`).
  - Repite exactamente los mensajes `hablar` que el backend le devuelve.

- En modo prueba:
  - La activación se hace exclusivamente vía `POST /api/examen/reiniciar` enviando `{ "modo": "testag" | "testesf" | "testcil" | "testbin" }`.
  - El backend enviará mensajes claros al paciente indicando que se trata de un **test de prueba** y especificando qué componente se está probando.

Con este diseño, el modo de examen de prueba:

- Reutiliza al máximo la lógica clínica ya existente.
- Mantiene el flujo normal sin cambios cuando `modo === 'normal'`.
- Proporciona secuencias de prueba claras, acotadas y trazables vía `/api/examen/detalle`.

