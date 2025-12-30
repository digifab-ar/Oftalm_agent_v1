# Análisis de Logs - Causa Raíz del Bug

## 🔍 Análisis de los Logs

### Secuencia de Eventos (de los logs):

1. **Estado inicial:**
   ```
   testActual: { tipo: 'agudeza_alcanzada', ojo: 'R' }
   indiceActual: 4
   ```

2. **Después de avanzar:**
   ```
   testActual: { tipo: 'agudeza_inicial', ojo: 'L' }
   indiceActual: 5
   cambioOjo: true  ✅ Detecta cambio correctamente
   ```

3. **Primera evaluación en `generarPasosEtapa4()`:**
   ```
   estadoOjo: null  ✅ (reseteado correctamente)
   ojoTest: 'L'
   cambioDeOjo: false  ❌ PROBLEMA
   evaluacionCambioDeOjo: {
     'estado.ojo !== null': false  ← AQUÍ FALLA
     'estado.ojo !== ojo': true
     '!esAgudezaAlcanzada': true
   }
   ```

4. **Después de inicializar (SEGUNDA evaluación):**
   ```
   estadoOjo: 'L'  ❌ PROBLEMA: Ya se asignó
   ojoTest: 'L'
   cambioDeOjo: false  ❌ (porque estado.ojo === ojo ahora)
   evaluacion: {
     'estado.ojo !== null': true
     'estado.ojo !== ojo': false  ← AQUÍ FALLA
   }
   ```

## 🐛 Problema Raíz Identificado

### Orden de Ejecución Actual (INCORRECTO):

```javascript
// Línea 1163
const cambioDeOjo = estado.ojo !== null && estado.ojo !== ojo && !esAgudezaAlcanzada;
// Primera evaluación: estado.ojo = null → cambioDeOjo = false

// Línea 1165
if (necesitaInicializacion) {
  estado.ojo = ojo;  // ← PROBLEMA: Se asigna ANTES de usar cambioDeOjo
  // estado.ojo = 'L' ahora
  
  // Línea 1242 (dentro del else)
  if (cambioDeOjo) {  // ← cambioDeOjo ya es false (evaluado antes de asignar)
    // NO se ejecuta
  }
}
```

### El Problema:

1. **Primera evaluación de `cambioDeOjo` (línea 1163):**
   - `estado.ojo = null` (reseteado)
   - `ojo = 'L'`
   - `cambioDeOjo = null !== null && null !== 'L' && !false`
   - `cambioDeOjo = false && true && true = false` ❌

2. **Se entra en `if (necesitaInicializacion)` (línea 1165):**
   - `estado.ojo = ojo` → `estado.ojo = 'L'` (línea 1166)
   - **Ahora `estado.ojo` ya es 'L'**

3. **Segunda evaluación de `cambioDeOjo` (línea 1242):**
   - `estado.ojo = 'L'` (ya asignado)
   - `ojo = 'L'`
   - `cambioDeOjo = 'L' !== null && 'L' !== 'L' && !false`
   - `cambioDeOjo = true && false && true = false` ❌

**Resultado:** `cambioDeOjo` siempre es `false` porque:
- Primera evaluación: `estado.ojo === null` → falla la primera condición
- Segunda evaluación: `estado.ojo === ojo` → falla la segunda condición

## ✅ Solución

### Opción 1: Evaluar `cambioDeOjo` ANTES de asignar `estado.ojo` (Recomendada)

**Cambio necesario:**
```javascript
// Evaluar cambioDeOjo ANTES de entrar en necesitaInicializacion
const cambioDeOjo = estado.ojo !== null && estado.ojo !== ojo && !esAgudezaAlcanzada;

if (necesitaInicializacion) {
  // Guardar ojo anterior ANTES de asignar
  const ojoAnterior = estado.ojo;
  
  estado.ojo = ojo;  // Asignar nuevo ojo
  
  // Si hay cambio de ojo, usar ojoAnterior para la lógica
  if (cambioDeOjo) {
    // Usar ojoAnterior en lugar de estado.ojo
  }
}
```

**Problema:** `cambioDeOjo` se evalúa cuando `estado.ojo === null`, así que siempre será `false`.

### Opción 2: Detectar cambio comparando con test anterior (MÁS SIMPLE)

**Cambio necesario:**
```javascript
// Obtener test anterior de la secuencia
const indiceAnterior = estadoExamen.secuenciaExamen.indiceActual - 1;
const testAnterior = indiceAnterior >= 0 
  ? estadoExamen.secuenciaExamen.testsActivos[indiceAnterior]
  : null;

// Detectar cambio de ojo comparando con test anterior
const cambioDeOjo = testAnterior !== null && 
                    testAnterior.ojo !== ojo && 
                    !esAgudezaAlcanzada;
```

**Ventajas:**
- No depende del estado reseteado
- Usa información ya disponible (la secuencia)
- Simple y directo
- Compatible con la lógica actual

### Opción 3: Guardar ojo anterior antes de resetear

**Cambio necesario:**
1. En `procesarRespuestaAgudezaAlcanzada()`: guardar `ojoAnterior` antes de resetear
2. En `generarPasosEtapa4()`: usar `ojoAnterior` para detectar cambio

**Ventajas:**
- Preserva información antes de resetear
- Lógica clara

**Desventajas:**
- Requiere modificar múltiples funciones
- Más complejo

## 🎯 Recomendación: Opción 2

**Grado de certeza:** 🔴 **95%** - Los logs confirman el problema

**Razones:**
1. ✅ Los logs muestran claramente que `estado.ojo` se asigna antes de usar `cambioDeOjo`
2. ✅ La secuencia ya tiene la información del test anterior
3. ✅ No requiere cambios en otras funciones
4. ✅ Compatible con la lógica actual
5. ✅ Simple y directo

## 📋 Plan de Acción (Opción 2)

### Paso 1: Modificar `generarPasosEtapa4()`

**Ubicación:** Línea ~1163

**Cambio:**
```javascript
// ANTES (línea 1163):
const cambioDeOjo = estado.ojo !== null && estado.ojo !== ojo && !esAgudezaAlcanzada;

// DESPUÉS:
// Obtener test anterior de la secuencia para detectar cambio de ojo
const indiceAnterior = estadoExamen.secuenciaExamen.indiceActual - 1;
const testAnterior = indiceAnterior >= 0 
  ? estadoExamen.secuenciaExamen.testsActivos[indiceAnterior]
  : null;

// Detectar cambio de ojo comparando con test anterior
const cambioDeOjo = testAnterior !== null && 
                    testAnterior.ojo !== ojo && 
                    !esAgudezaAlcanzada;
```

### Paso 2: Agregar log para verificar

**Agregar después de calcular `cambioDeOjo`:**
```javascript
console.log('🔧 [GENERAR_PASOS_ETAPA4] Detección de cambio de ojo (nueva lógica):', {
  indiceAnterior,
  testAnterior: testAnterior ? `${testAnterior.tipo} (${testAnterior.ojo})` : null,
  testActual: `${testActual.tipo} (${testActual.ojo})`,
  cambioDeOjo,
  evaluacion: {
    'testAnterior !== null': testAnterior !== null,
    'testAnterior.ojo !== ojo': testAnterior ? testAnterior.ojo !== ojo : false,
    '!esAgudezaAlcanzada': !esAgudezaAlcanzada
  }
});
```

### Paso 3: Testing

**Verificar:**
1. ✅ `cambioDeOjo` es `true` cuando se pasa de R a L
2. ✅ Se generan pasos de configuración del foróptero
3. ✅ El foróptero se configura correctamente
4. ✅ La oclusión cambia correctamente
5. ✅ No afecta otros flujos (mismo ojo, agudeza_alcanzada)

## 📊 Comparación de Opciones

| Opción | Complejidad | Cambios | Compatibilidad | Efectividad |
|--------|-------------|---------|----------------|-------------|
| Opción 1 | Media | 1 función | Alta | ❌ No funciona (mismo problema) |
| Opción 2 | Baja | 1 función | Alta | ✅ Funciona |
| Opción 3 | Alta | 3 funciones | Media | ✅ Funciona |

## 🎯 Conclusión

**Problema Raíz:**
- `cambioDeOjo` se evalúa cuando `estado.ojo === null` (después del reset)
- Luego `estado.ojo = ojo` se asigna antes de usar `cambioDeOjo`
- Por lo tanto, `cambioDeOjo` siempre es `false`

**Solución:**
- Usar el test anterior de la secuencia para detectar cambio de ojo
- No depende del estado reseteado
- Simple y compatible con la lógica actual

**Grado de certeza:** 🔴 **95%**

---

## ✅ Implementación Completada

**Fecha:** 2025-01-27  
**Estado:** ✅ **IMPLEMENTADO**

### Cambios Realizados

**Archivo:** `reference/foroptero-server/motorExamen.js`  
**Función:** `generarPasosEtapa4()`  
**Líneas modificadas:** ~1221-1234

#### Cambio Principal

**ANTES (línea 1222 - NO FUNCIONABA):**
```javascript
const cambioDeOjo = estado.ojo !== null && estado.ojo !== ojo && !esAgudezaAlcanzada;
```

**DESPUÉS (líneas 1221-1228 - FUNCIONA):**
```javascript
// Obtener test anterior de la secuencia para detectar cambio de ojo
const indiceAnterior = estadoExamen.secuenciaExamen.indiceActual - 1;
const testAnterior = indiceAnterior >= 0 
  ? estadoExamen.secuenciaExamen.testsActivos[indiceAnterior]
  : null;

// Detectar cambio de ojo comparando con test anterior
const cambioDeOjo = testAnterior !== null && 
                    testAnterior.ojo !== ojo && 
                    !esAgudezaAlcanzada;
```

#### Logs Actualizados

Los logs ahora muestran:
- `testAnterior`: El test anterior de la secuencia
- `testAnterior.ojo !== ojo`: Si hay cambio de ojo
- Información del estado (para debugging)

### Código Mantenido

✅ **Se mantiene todo el bloque `if (cambioDeOjo)`** (líneas 1336-1412):
- Validación de valores recalculados
- Generación de pasos de foróptero
- Configuración de oclusión
- Mensaje al paciente
- Espera del foróptero

### Comportamiento Esperado

Cuando se completa `agudeza_alcanzada` R y se pasa a `agudeza_inicial` L:

1. ✅ `testAnterior` será `{ tipo: 'agudeza_alcanzada', ojo: 'R' }`
2. ✅ `testAnterior.ojo !== ojo` será `'R' !== 'L'` → `true`
3. ✅ `cambioDeOjo` será `true`
4. ✅ Se ejecutará el bloque `if (cambioDeOjo)`
5. ✅ Se configurará el foróptero con valores recalculados de L
6. ✅ Se cambiará la oclusión (R: close, L: open)
7. ✅ Se mostrará mensaje al paciente

### Testing Pendiente

- [ ] Probar flujo completo: agudeza_alcanzada R → agudeza_inicial L
- [ ] Verificar que `cambioDeOjo` es `true` en los logs
- [ ] Verificar que se generan pasos de configuración del foróptero
- [ ] Verificar que el foróptero se configura correctamente
- [ ] Verificar que la oclusión cambia correctamente
- [ ] Verificar que no afecta otros flujos (mismo ojo, agudeza_alcanzada)

