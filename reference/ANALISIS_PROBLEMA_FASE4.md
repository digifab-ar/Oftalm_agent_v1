# Análisis del Problema: Transición de ETAPA_4 a ETAPA_5

## 🔍 Problema Identificado

**Síntoma:** Al finalizar la agudeza visual R, el sistema no logra continuar a la secuencia de esférico grueso. El backend retorna error "Error del servidor" cuando el agente intenta obtener instrucciones.

**Estado observado:**
- `estadoActual.etapa`: "ETAPA_4" (debería ser "ETAPA_5")
- `estadoActual.testActual`: `{ "tipo": "esferico_grueso", "ojo": "R" }` ✅ (correcto)
- `estadoActual.indiceActual`: 1 ✅ (correcto)

## 🔎 Causa Raíz

### Flujo del Problema:

1. **Completación de agudeza visual:**
   - `procesarRespuestaAgudeza()` detecta 2 confirmaciones
   - Guarda resultado en `estadoExamen.agudezaVisual[ojo].confirmado = true`
   - Llama `avanzarTest()` que:
     - ✅ Actualiza `testActual` a `esferico_grueso`
     - ✅ Actualiza `indiceActual` a 1
     - ❌ **NO cambia `estadoExamen.etapa`** (solo la cambia si el examen está completo)

2. **Generación de pasos:**
   - `obtenerInstrucciones()` detecta `resultadoConfirmado: true`
   - Llama `generarPasos()` que usa un `switch` basado en `estadoExamen.etapa`
   - Como `etapa` sigue siendo "ETAPA_4", llama a `generarPasosEtapa4()`

3. **Validación fallida:**
   - `generarPasosEtapa4()` valida: `if (!testActual || testActual.tipo !== 'agudeza_inicial')`
   - Como `testActual.tipo` ahora es `'esferico_grueso'`, la validación falla
   - Retorna error: `'No estamos en test de agudeza visual'`

### Ubicación del Bug:

**Archivo:** `reference/foroptero-server/motorExamen.js`

**Función:** `avanzarTest()` (líneas 602-620)

**Problema:** La función `avanzarTest()` solo actualiza `testActual` e `indiceActual`, pero **NO actualiza `estadoExamen.etapa`** según el tipo de test siguiente.

**Código actual:**
```javascript
export function avanzarTest() {
  const secuencia = estadoExamen.secuenciaExamen;
  
  if (secuencia.indiceActual >= secuencia.testsActivos.length - 1) {
    // Se completó el examen
    estadoExamen.etapa = 'FINALIZADO';
    estadoExamen.finalizado = Date.now();
    secuencia.testActual = null;
    return null;
  }
  
  // Avanzar al siguiente test
  secuencia.indiceActual += 1;
  secuencia.testActual = secuencia.testsActivos[secuencia.indiceActual];
  
  console.log(`➡️ Avanzando a test: ${secuencia.testActual.tipo} (${secuencia.testActual.ojo})`);
  
  return secuencia.testActual;
  // ❌ FALTA: Actualizar estadoExamen.etapa según el tipo de test
}
```

**Nota:** Existe lógica en `generarPasosEtapa4()` (líneas 863-874) que intenta cambiar la etapa cuando detecta que el test actual ya está confirmado, pero esta lógica solo funciona cuando se llama directamente desde `generarPasosEtapa4()`, no cuando se llama desde `obtenerInstrucciones()` después de confirmar agudeza.

## 📋 Plan de Acción

### Opción 1: Actualizar etapa en `avanzarTest()` (Recomendada)

**Ventajas:**
- Centraliza la lógica de transición de etapas
- Más robusto y mantenible
- Evita inconsistencias entre `testActual` y `etapa`

**Implementación:**
1. Modificar `avanzarTest()` para que actualice `estadoExamen.etapa` según el tipo de test siguiente:
   - `'agudeza_inicial'` → `'ETAPA_4'`
   - `'esferico_grueso'` → `'ETAPA_5'`
   - `'esferico_fino'` → `'ETAPA_5'` (mismo que grueso)
   - `'cilindrico'` → `'ETAPA_5'` (mismo que grueso)
   - `'cilindrico_angulo'` → `'ETAPA_5'` (mismo que grueso)
   - `'agudeza_alcanzada'` → `'ETAPA_4'` (similar a inicial)
   - `null` (examen completado) → `'FINALIZADO'`

2. Crear función auxiliar `mapearTipoTestAEtapa(tipo)` para mantener la lógica centralizada.

3. Eliminar la lógica redundante en `generarPasosEtapa4()` (líneas 863-874) que intenta cambiar la etapa, ya que `avanzarTest()` lo hará automáticamente.

### Opción 2: Detectar inconsistencia en `generarPasos()`

**Ventajas:**
- Cambio más localizado
- No requiere modificar `avanzarTest()`

**Desventajas:**
- Lógica más compleja y propensa a errores
- Puede haber otros lugares donde se use `avanzarTest()` sin actualizar etapa

**Implementación:**
1. En `generarPasos()`, antes del switch, verificar si `testActual.tipo` es inconsistente con `etapa`.
2. Si hay inconsistencia, actualizar `etapa` según `testActual.tipo`.
3. Luego proceder con el switch normal.

### Opción 3: Actualizar etapa en `obtenerInstrucciones()` después de confirmar

**Ventajas:**
- Cambio muy localizado

**Desventajas:**
- Lógica duplicada (ya existe en `generarPasosEtapa4()`)
- No resuelve el problema si `avanzarTest()` se llama desde otro lugar

## ✅ Recomendación

**Implementar Opción 1** porque:
1. Es la solución más robusta y mantenible
2. Centraliza la lógica de transición de etapas
3. Evita inconsistencias futuras
4. Es más fácil de testear y depurar

## 🔧 Cambios Específicos Requeridos

### 1. Crear función auxiliar `mapearTipoTestAEtapa()`

```javascript
/**
 * Mapea el tipo de test a su etapa correspondiente
 * @param {string} tipo - Tipo de test
 * @returns {string} - Etapa correspondiente
 */
function mapearTipoTestAEtapa(tipo) {
  const mapa = {
    'agudeza_inicial': 'ETAPA_4',
    'esferico_grueso': 'ETAPA_5',
    'esferico_fino': 'ETAPA_5',
    'cilindrico': 'ETAPA_5',
    'cilindrico_angulo': 'ETAPA_5',
    'agudeza_alcanzada': 'ETAPA_4'
  };
  return mapa[tipo] || 'ETAPA_4'; // Default a ETAPA_4 por seguridad
}
```

### 2. Modificar `avanzarTest()` para actualizar etapa

```javascript
export function avanzarTest() {
  const secuencia = estadoExamen.secuenciaExamen;
  
  if (secuencia.indiceActual >= secuencia.testsActivos.length - 1) {
    // Se completó el examen
    estadoExamen.etapa = 'FINALIZADO';
    estadoExamen.finalizado = Date.now();
    secuencia.testActual = null;
    return null;
  }
  
  // Avanzar al siguiente test
  secuencia.indiceActual += 1;
  secuencia.testActual = secuencia.testsActivos[secuencia.indiceActual];
  
  // ✅ NUEVO: Actualizar etapa según el tipo de test
  if (secuencia.testActual) {
    estadoExamen.etapa = mapearTipoTestAEtapa(secuencia.testActual.tipo);
    console.log(`➡️ Avanzando a test: ${secuencia.testActual.tipo} (${secuencia.testActual.ojo}) → Etapa: ${estadoExamen.etapa}`);
  }
  
  return secuencia.testActual;
}
```

### 3. Simplificar `generarPasosEtapa4()` (eliminar lógica redundante)

Eliminar o simplificar las líneas 863-874 que intentan cambiar la etapa, ya que `avanzarTest()` lo hará automáticamente.

## 🧪 Testing

Después de implementar, verificar:
1. ✅ Transición de agudeza_inicial → esferico_grueso actualiza etapa correctamente
2. ✅ Transición de esferico_grueso → esferico_fino mantiene ETAPA_5
3. ✅ Transición de esferico_fino → agudeza_alcanzada cambia a ETAPA_4
4. ✅ Finalización del examen cambia a FINALIZADO

## 📝 Notas Adicionales

- El problema también afectaría cualquier otro lugar donde se llame `avanzarTest()` sin actualizar manualmente la etapa.
- La solución propuesta es defensiva y previene futuros problemas similares.

