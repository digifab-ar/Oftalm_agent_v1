# Logs Agregados para Debugging - Cambio de Ojo

## 📍 Ubicación de los Logs

### 1. **`resetearEstadoAgudeza()`** (línea ~1085)
**Logs:**
- `🔄 [RESET AGUDEZA] Estado ANTES de resetear:` - Muestra el estado completo antes del reset
- `🔄 [RESET AGUDEZA] Estado DESPUÉS de resetear:` - Muestra el estado después del reset

**Qué verificar:**
- Si `estado.ojo` tiene valor antes de resetear (debería ser 'R')
- Si `estado.ojo` es `null` después de resetear

---

### 2. **`procesarRespuestaAgudezaAlcanzada()`** (línea ~960)
**Logs:**
- `🔍 [AGUDEZA_ALCANZADA] ANTES de resetear y avanzar:` - Estado antes de resetear y avanzar
- `🔍 [AGUDEZA_ALCANZADA] DESPUÉS de resetear y avanzar:` - Estado después de resetear y avanzar

**Qué verificar:**
- `ojoActual`: Ojo que se completó (debería ser 'R')
- `estadoOjo`: Valor de `estado.ojo` antes del reset
- `estadoOjoDespuesReset`: Valor de `estado.ojo` después del reset (debería ser `null`)
- `siguienteTest`: El nuevo test al que se avanzó (debería ser `agudeza_inicial L`)
- `testActual`: El test actual en la secuencia
- `etapa`: La etapa actual (debería ser 'ETAPA_4')

---

### 3. **`avanzarTest()`** (línea ~667)
**Logs:**
- `➡️ [AVANZAR_TEST] Estado ANTES de avanzar:` - Estado antes de avanzar
- `➡️ [AVANZAR_TEST] Avanzando a test:` - El nuevo test al que se avanzó
- `➡️ [AVANZAR_TEST] Cambio de ojo:` - Información sobre si hubo cambio de ojo

**Qué verificar:**
- `testAnterior`: El test anterior (debería ser `agudeza_alcanzada R`)
- `testActual`: El nuevo test (debería ser `agudeza_inicial L`)
- `cambioOjo`: Si detectó cambio de ojo (debería ser `true`)

---

### 4. **`generarPasosEtapa4()`** (línea ~1139)
**Logs:**
- `🔧 [GENERAR_PASOS_ETAPA4] INICIO:` - Estado al inicio de la función
- `🔧 [GENERAR_PASOS_ETAPA4] Estado de agudeza:` - Estado completo de agudeza
- `🔧 [GENERAR_PASOS_ETAPA4] Evaluación de condiciones:` - Evaluación detallada de las condiciones
- `🔧 [GENERAR_PASOS_ETAPA4] Evaluando cambio de ojo para agudeza_inicial:` - Evaluación específica del cambio de ojo
- `✅ [GENERAR_PASOS_ETAPA4] CAMBIO DE OJO DETECTADO` - Si se detectó cambio de ojo
- `⚠️ [GENERAR_PASOS_ETAPA4] NO se detectó cambio de ojo` - Si NO se detectó cambio de ojo
- `🔧 [GENERAR_PASOS_ETAPA4] Generando pasos normales` - Cuando genera pasos normales

**Qué verificar:**
- `ojoTest`: El ojo del test actual (debería ser 'L')
- `estadoOjo`: El valor de `estado.ojo` (debería ser `null` después del reset)
- `cambioDeOjo`: Si se detectó cambio de ojo (debería ser `false` porque `estado.ojo === null`)
- `evaluacionCambioDeOjo`: Desglose detallado de por qué `cambioDeOjo` es `false` o `true`

---

### 5. **`obtenerInstrucciones()`** (línea ~1685)
**Logs:**
- `🔍 [OBTENER_INSTRUCCIONES] Resultado confirmado, generando pasos del siguiente test:` - Cuando detecta resultado confirmado
- `🔍 [OBTENER_INSTRUCCIONES] Pasos generados:` - Información sobre los pasos generados

**Qué verificar:**
- `cantidadPasos`: Cuántos pasos se generaron
- `tiposPasos`: Qué tipos de pasos se generaron (debería incluir 'foroptero' si hay cambio de ojo)
- `etapa`: La etapa actual

---

## 🔍 Qué Buscar en los Logs de Railway

### Secuencia Esperada (cuando funciona correctamente):

```
1. ✅ Agudeza alcanzada confirmada para R: logMAR 0
2. 🔍 [AGUDEZA_ALCANZADA] ANTES de resetear y avanzar:
   - ojoActual: 'R'
   - estadoOjo: 'R'  ← Debería tener valor
3. 🔄 [RESET AGUDEZA] Estado ANTES de resetear:
   - ojo: 'R'  ← Debería tener valor
4. 🔄 [RESET AGUDEZA] Estado DESPUÉS de resetear:
   - ojo: null  ← Se reseteó
5. ➡️ [AVANZAR_TEST] Cambio de ojo:
   - cambioOjo: true  ← Detectó cambio
6. 🔍 [AGUDEZA_ALCANZADA] DESPUÉS de resetear y avanzar:
   - estadoOjoDespuesReset: null  ← Confirmado
   - siguienteTest: { tipo: 'agudeza_inicial', ojo: 'L' }
7. 🔧 [GENERAR_PASOS_ETAPA4] Estado de agudeza:
   - estadoOjo: null  ← PROBLEMA: Es null
   - ojoTest: 'L'
8. 🔧 [GENERAR_PASOS_ETAPA4] Evaluación de condiciones:
   - cambioDeOjo: false  ← PROBLEMA: No detecta cambio porque estado.ojo es null
   - evaluacionCambioDeOjo: {
       'estado.ojo !== null': false  ← AQUÍ ESTÁ EL PROBLEMA
     }
9. ⚠️ [GENERAR_PASOS_ETAPA4] NO se detectó cambio de ojo
```

### Problema Identificado:

La condición `cambioDeOjo` requiere:
```javascript
estado.ojo !== null && estado.ojo !== ojo && !esAgudezaAlcanzada
```

Pero después de `resetearEstadoAgudeza()`, `estado.ojo` es `null`, por lo que:
- `estado.ojo !== null` → `false`
- `cambioDeOjo` → `false`

---

## 📊 Información Clave a Verificar

1. **¿Cuál es el valor de `estado.ojo` antes de resetear?**
   - Debería ser 'R'
   - Si es `null`, hay un problema anterior

2. **¿Cuál es el valor de `estado.ojo` después de resetear?**
   - Debería ser `null`
   - Si no es `null`, el reset no funcionó

3. **¿Se detecta el cambio de ojo en `avanzarTest()`?**
   - `cambioOjo: true` → Sí
   - `cambioOjo: false` → No (problema)

4. **¿Se detecta el cambio de ojo en `generarPasosEtapa4()`?**
   - `cambioDeOjo: true` → Sí (funciona)
   - `cambioDeOjo: false` → No (problema actual)

5. **¿Por qué `cambioDeOjo` es `false`?**
   - Ver `evaluacionCambioDeOjo`:
     - `'estado.ojo !== null': false` → Problema: estado reseteado
     - `'estado.ojo !== ojo': true` → Correcto
     - `'!esAgudezaAlcanzada': true` → Correcto

---

## 🎯 Conclusión Esperada

Los logs deberían confirmar que:
1. ✅ `resetearEstadoAgudeza()` resetea `estado.ojo = null`
2. ✅ `avanzarTest()` detecta cambio de ojo correctamente
3. ❌ `generarPasosEtapa4()` NO detecta cambio de ojo porque `estado.ojo === null`
4. ❌ Por lo tanto, no se configura el foróptero

**Solución:** Necesitamos guardar el ojo anterior antes de resetear, o detectar el cambio de otra manera (comparando con el test anterior en la secuencia).

