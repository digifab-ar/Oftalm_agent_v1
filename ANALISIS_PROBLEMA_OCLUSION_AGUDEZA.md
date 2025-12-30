# Análisis: Problema de Oclusión en Transición de Lentes a Agudeza Visual

## Problema Reportado

Al finalizar el test **esférico fino (L)**, antes de iniciar **agudeza visual (L)**, se cambia incorrectamente la oclusión:
- **L** se cambia a `close` ❌
- **R** se cambia a `open` ❌

**Comportamiento esperado:**
- **L** debe estar en `open` ✅
- **R** debe estar en `close` ✅

## Confirmación con Logs

**Estado del foróptero cuando ocurre el problema:**
```
R: { esfera: 1.5, cilindro: 0, angulo: 0, occlusion: 'open' }  ❌
L: { esfera: 1.75, cilindro: 0, angulo: 0, occlusion: 'close' } ❌
```

**Condiciones evaluadas:**
- `necesitaInicializacion: false` → NO entra en bloque de inicialización
- `cambioDeOjo: false` → No detecta cambio (mismo ojo L)
- `testAnterior: 'esferico_fino (L)'`
- `testActual: 'agudeza_alcanzada (L)'`
- Resultado: Solo genera pasos de TV + Hablar, SIN configurar foróptero

## Causa Raíz

### Flujo del Problema

1. **Test esférico fino (L) se completa:**
   - `confirmarResultado()` se ejecuta (línea 2809)
   - El foróptero queda configurado con: L=`open`, R=`close` (correcto para test de lentes)
   - Se llama a `avanzarTest()` (línea 2916)
   - El test actual cambia a `agudeza_inicial (L)`
   - La etapa cambia a `ETAPA_4`

2. **Se generan pasos para agudeza_inicial (L):**
   - Se llama a `generarPasosEtapa4()` (línea 1231)
   - Se evalúa la condición `cambioDeOjo` (líneas 1277-1279):
     ```javascript
     const cambioDeOjo = testAnterior !== null && 
                         testAnterior.ojo !== ojo && 
                         !esAgudezaAlcanzada;
     ```
   - **Evaluación:**
     - `testAnterior.ojo === 'L'` (esferico_fino L)
     - `ojo === 'L'` (agudeza_inicial L)
     - `testAnterior.ojo !== ojo` = **`false`**
     - Por lo tanto: `cambioDeOjo = false`

3. **Como `cambioDeOjo = false`:**
   - NO entra en el bloque que configura el foróptero (línea 1396)
   - Continúa con la lógica normal (línea 1526-1539)
   - Solo genera pasos de **TV + Hablar**, SIN configurar el foróptero
   - El foróptero mantiene la configuración del test anterior

4. **Problema adicional:**
   - Si hay algún comando de foróptero ejecutado en otro lugar (posiblemente en `confirmarResultado()` para otros tipos de test), podría estar cambiando la oclusión incorrectamente
   - O el foróptero físico mantiene la última configuración y no se está actualizando correctamente

### Análisis del Código

#### Función `generarPasosEtapa4()` (línea 1231)

**Condición de cambio de ojo (líneas 1277-1279):**
```javascript
const cambioDeOjo = testAnterior !== null && 
                    testAnterior.ojo !== ojo && 
                    !esAgudezaAlcanzada;
```

**Problema 1:** Esta condición solo detecta cambios de **ojo**, pero NO detecta cambios de **tipo de test** cuando el ojo es el mismo.

**Escenario problemático:**
- Test anterior: `esferico_fino (L)` → ojo: `L`, tipo: `esferico_fino`
- Test actual: `agudeza_alcanzada (L)` → ojo: `L`, tipo: `agudeza_alcanzada`
- `testAnterior.ojo !== ojo` = `false` → `cambioDeOjo = false`
- **Resultado:** NO se configura el foróptero, aunque cambió el tipo de test

**Problema 2:** Cuando `necesitaInicializacion = false` (porque el estado ya está inicializado), NO entra en el bloque `if (necesitaInicializacion)` (línea 1296), por lo que:
- Para `agudeza_alcanzada`: NO se ejecuta la lógica de configuración del foróptero (líneas 1325-1360)
- Va directo a "Generando pasos normales" (línea 1490) que solo genera TV + Hablar

**BUG CRÍTICO en línea 1338:** La lógica de oclusión para `agudeza_alcanzada` está **INVERTIDA**:
```javascript
occlusion: ojo === 'R' ? 'open' : 'close'  // ❌ INCORRECTO
```
- Si `ojo === 'L'`, pone `'close'` cuando debería ser `'open'`
- Si `ojo === 'R'`, pone `'open'` (correcto por casualidad)

**Debería ser:**
```javascript
occlusion: 'open'  // Para el ojo del test
```

**BUG CRÍTICO en línea 1341:** Similar error:
```javascript
occlusion: ojo === 'R' ? 'close' : 'open'  // ❌ INCORRECTO
```
- Si `ojo === 'L'`, pone `'open'` cuando debería ser `'close'` (para el ojo opuesto)

**Debería ser:**
```javascript
occlusion: 'close'  // Para el ojo opuesto
```

#### Función `confirmarResultado()` (línea 2809)

**Observación importante:**
- Para `esferico_fino` y `esferico_grueso`: **NO actualiza el foróptero** (solo guarda el resultado)
- Para `cilindrico` y `cilindrico_angulo`: **SÍ actualiza el foróptero** (líneas 2832-2851 y 2867-2886)

**Esto significa que:**
- Después de `esferico_fino (L)`, el foróptero mantiene la configuración del último test de lentes
- Cuando se avanza a `agudeza_inicial (L)`, si no se detecta el cambio, no se reconfigura el foróptero
- El foróptero podría tener valores incorrectos (esfera del test de lentes en lugar de valores recalculados)

#### Lógica de pasos normales (línea 1526-1539)

Cuando `cambioDeOjo = false` y `necesitaInicializacion = true`:
- Solo genera pasos de **TV + Hablar**
- **NO genera pasos de foróptero**
- Asume que el foróptero ya está configurado correctamente (pero no lo está)

## Plan de Acción

### Objetivo
Asegurar que cuando se transiciona de un test de lentes a un test de agudeza visual (incluso si es el mismo ojo), se configure correctamente el foróptero con:
- El ojo del test en `open`
- El ojo opuesto en `close`
- Los valores correctos (recalculados para agudeza_inicial, finales para agudeza_alcanzada)

### Solución Propuesta

#### CRÍTICO: Corregir bugs de oclusión en línea 1338 y 1341

**Primero corregir los bugs críticos:**
- Línea 1338: Cambiar `occlusion: ojo === 'R' ? 'open' : 'close'` → `occlusion: 'open'`
- Línea 1341: Cambiar `occlusion: ojo === 'R' ? 'close' : 'open'` → `occlusion: 'close'`

#### Opción 1: Detectar cambio de tipo de test (RECOMENDADA)

Modificar la condición en `generarPasosEtapa4()` para detectar también cambios de tipo de test:

```javascript
// Detectar cambio de ojo O cambio de tipo de test
const cambioDeOjo = testAnterior !== null && 
                    testAnterior.ojo !== ojo && 
                    !esAgudezaAlcanzada;

// NUEVO: Detectar cambio de tipo de test (de lentes a agudeza)
const cambioDeTipoTest = testAnterior !== null && 
                         testAnterior.tipo !== testActual.tipo &&
                         (testAnterior.tipo === 'esferico_grueso' || 
                          testAnterior.tipo === 'esferico_fino' || 
                          testAnterior.tipo === 'cilindrico' || 
                          testAnterior.tipo === 'cilindrico_angulo') &&
                         (testActual.tipo === 'agudeza_inicial' || 
                          testActual.tipo === 'agudeza_alcanzada');

const necesitaConfigurarForoptero = cambioDeOjo || cambioDeTipoTest;
```

**Ventajas:**
- Detecta explícitamente la transición de lentes a agudeza
- Funciona tanto para cambio de ojo como para cambio de tipo de test
- No afecta otros flujos

#### Opción 2: Configurar foróptero cuando cambia tipo de test (incluso si no necesita inicialización)

**Problema identificado:** Cuando `necesitaInicializacion = false` (porque el estado ya está inicializado), NO se configura el foróptero aunque cambió el tipo de test.

**Solución:** Agregar lógica para detectar cambio de tipo de test y configurar foróptero incluso si `necesitaInicializacion = false`:

```javascript
// Después de la evaluación de necesitaInicializacion
const cambioDeTipoTest = testAnterior !== null && 
                         testAnterior.tipo !== testActual.tipo &&
                         (testAnterior.tipo === 'esferico_grueso' || 
                          testAnterior.tipo === 'esferico_fino' || 
                          testAnterior.tipo === 'cilindrico' || 
                          testAnterior.tipo === 'cilindrico_angulo') &&
                         (testActual.tipo === 'agudeza_inicial' || 
                          testActual.tipo === 'agudeza_alcanzada');

// Si cambió el tipo de test pero no necesita inicialización, configurar foróptero
if (!necesitaInicializacion && cambioDeTipoTest) {
  if (esAgudezaAlcanzada) {
    // Configurar foróptero con valores finales
    const valoresFinales = calcularValoresFinalesForoptero(ojo);
    // ... generar pasos de foróptero ...
  } else {
    // Configurar foróptero con valores recalculados
    const valoresRecalculados = estadoExamen.valoresRecalculados[ojo];
    // ... generar pasos de foróptero ...
  }
}
```

#### Opción 3: Siempre configurar foróptero en inicialización

Modificar la lógica para que cuando `necesitaInicializacion = true` y es `agudeza_inicial`, siempre se configure el foróptero:

```javascript
if (necesitaInicializacion) {
  estado.ojo = ojo;
  
  if (esAgudezaAlcanzada) {
    // ... lógica existente ...
  } else {
    // Lógica para agudeza_inicial
    // ...
    
    // SIEMPRE configurar foróptero al iniciar agudeza_inicial
    // (no solo cuando hay cambio de ojo)
    const valoresRecalculados = estadoExamen.valoresRecalculados[ojo];
    
    // Validar valores
    if (!valoresRecalculados || ...) {
      return { ok: false, error: ... };
    }
    
    // Generar pasos con foróptero
    const pasos = [
      {
        tipo: 'foroptero',
        orden: 1,
        foroptero: {
          [ojo]: {
            esfera: valoresRecalculados.esfera,
            cilindro: valoresRecalculados.cilindro,
            angulo: valoresRecalculados.angulo,
            occlusion: 'open'
          },
          [ojo === 'R' ? 'L' : 'R']: {
            occlusion: 'close'
          }
        }
      },
      // ... resto de pasos ...
    ];
    
    return { ok: true, pasos, ... };
  }
}
```

**Ventajas:**
- Más simple y directo
- Garantiza que siempre se configure el foróptero al iniciar agudeza_inicial
- No depende de detectar cambios

**Desventajas:**
- Podría generar comandos de foróptero innecesarios si ya está configurado correctamente
- Menos eficiente (pero probablemente aceptable)

#### Opción 3: Configurar foróptero en `confirmarResultado()` para esférico

Agregar lógica en `confirmarResultado()` para actualizar el foróptero después de confirmar esférico fino/grueso:

```javascript
} else if (tipo === 'esferico_fino') {
  estadoExamen.secuenciaExamen.resultados[ojo].esfericoFino = valorFinal;
  console.log(`✅ Resultado confirmado para ${ojo} (esférico fino): ${valorFinal}`);
  
  // NUEVO: Actualizar foróptero con el nuevo valor de esfera
  // (similar a como se hace para cilíndrico)
  const cilindroFinal = estadoExamen.secuenciaExamen.resultados[ojo].cilindrico 
    || estadoExamen.valoresRecalculados[ojo].cilindro;
  const anguloFinal = estadoExamen.secuenciaExamen.resultados[ojo].cilindricoAngulo 
    || estadoExamen.valoresRecalculados[ojo].angulo;
  
  if (ejecutarComandoForopteroInterno) {
    const configForoptero = {
      [ojo]: {
        esfera: valorFinal,
        cilindro: cilindroFinal,
        angulo: anguloFinal,
        occlusion: 'open'
      },
      [ojo === 'R' ? 'L' : 'R']: {
        occlusion: 'close'
      }
    };
    
    ejecutarComandoForopteroInterno(configForoptero).catch(err => {
      console.error(`⚠️ Error actualizando foróptero después de confirmar esférico fino:`, err);
    });
  }
}
```

**Ventajas:**
- Mantiene el foróptero actualizado después de cada test
- Consistente con el comportamiento de cilíndrico

**Desventajas:**
- No resuelve el problema directamente (el problema es en la transición a agudeza)
- Podría generar comandos innecesarios

### Recomendación

**Implementar en este orden:**

1. **CRÍTICO: Corregir bugs de oclusión** (líneas 1338 y 1341)
   - Cambiar lógica invertida de oclusión para `agudeza_alcanzada`

2. **Implementar Opción 2** (detectar cambio de tipo de test incluso si no necesita inicialización)
   - Esto resuelve el caso donde `necesitaInicializacion = false` pero cambió el tipo de test

3. **Como medida adicional**, implementar Opción 1 para detectar explícitamente la transición de lentes a agudeza

Esto asegura:
- Corrección de bugs críticos de oclusión
- Detección correcta de la transición (incluso cuando el estado ya está inicializado)
- Configuración garantizada del foróptero
- Valores correctos (recalculados para agudeza_inicial, finales para agudeza_alcanzada)

### Archivos a Modificar

1. **`reference/foroptero-server/motorExamen.js`**
   - **Líneas 1338 y 1341:** Corregir bugs críticos de oclusión invertida
   - **Función `generarPasosEtapa4()` (línea 1231):**
     - Agregar detección de cambio de tipo de test
     - Configurar foróptero cuando cambia tipo de test (incluso si `necesitaInicializacion = false`)
     - Asegurar que siempre se configure el foróptero al iniciar `agudeza_inicial` o `agudeza_alcanzada`

### Casos de Prueba a Verificar

1. **Transición esférico_fino (L) → agudeza_inicial (L):**
   - Verificar que L esté en `open` y R en `close`
   - Verificar que se usen valores recalculados

2. **Transición esférico_fino (R) → agudeza_inicial (R):**
   - Verificar que R esté en `open` y L en `close`

3. **Transición esférico_fino (L) → agudeza_alcanzada (L):**
   - Verificar que L esté en `open` y R en `close`
   - Verificar que se usen valores finales

4. **Transición agudeza_inicial (R) → esférico_grueso (R):**
   - Verificar que R esté en `open` y L en `close`
   - (Este caso debería funcionar correctamente con la lógica actual)

5. **Transición entre ojos:**
   - Verificar que funcione correctamente cuando cambia el ojo

### Notas Adicionales

- El problema también podría ocurrir en la transición de `agudeza_inicial` a `agudeza_alcanzada` si no se detecta correctamente
- La función `generarPasosEtapa4()` ya tiene lógica para `agudeza_alcanzada` (línea 1299-1374) que configura el foróptero, pero debería verificarse que funcione correctamente
- Considerar agregar logs adicionales para debugging de la configuración del foróptero

