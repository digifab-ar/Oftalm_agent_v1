# Análisis: Problema de Agudeza Alcanzada Saltada

## 📋 Resumen del Problema

**Síntoma:** Después de completar los tests de lentes (esférico grueso, fino, cilindro), el sistema **salta el test de `agudeza_alcanzada`** y va directamente al siguiente test, dejando `agudeza_alcanzada` con estado "pendiente" y resultado `null`.

**Evidencia del problema:**
```json
{
  "indice": 3,
  "tipo": "cilindrico",
  "ojo": "R",
  "estado": "completado",
  "resultado": -0.75
},
{
  "indice": 4,
  "tipo": "agudeza_alcanzada",
  "ojo": "R",
  "estado": "pendiente",  // ❌ NO SE EJECUTÓ
  "resultado": null
},
{
  "indice": 5,
  "tipo": "agudeza_inicial",
  "ojo": "L",
  "estado": "completado",  // ✅ SE EJECUTÓ (saltó agudeza_alcanzada R)
  "resultado": 0
}
```

---

## 🔍 Análisis del Código

### **Flujo Esperado:**

1. Se completa test de `cilindrico` R (índice 3)
2. `confirmarResultado()` llama a `avanzarTest()`
3. `avanzarTest()` actualiza `indiceActual = 4` y `testActual = agudeza_alcanzada R`
4. `avanzarTest()` actualiza `etapa = ETAPA_4` (mediante `mapearTipoTestAEtapa()`)
5. `obtenerInstrucciones()` llama a `generarPasos()`
6. `generarPasos()` llama a `generarPasosEtapa4()`
7. `generarPasosEtapa4()` debería inicializar `agudeza_alcanzada` R
8. **PROBLEMA:** No inicializa correctamente y avanza al siguiente test

### **Causa Raíz Identificada:**

**Ubicación:** `generarPasosEtapa4()`, línea 1155

**Código problemático:**
```javascript
// Inicializar estado de agudeza si es la primera vez
if (estado.ojo !== ojo || estado.logmarActual === null) {
  estado.ojo = ojo;
  
  if (esAgudezaAlcanzada) {
    // Lógica específica para agudeza_alcanzada
    // ...
  }
}
```

**Problema:**

Cuando se completa `agudeza_inicial` R, el estado queda así:
- `estado.ojo = 'R'`
- `estado.logmarActual = 0.3` (resultado confirmado)
- `estadoExamen.agudezaVisual['R'].confirmado = true`

Luego, cuando se avanza a `agudeza_alcanzada` R:
- `testActual.ojo = 'R'` (mismo ojo)
- `estado.ojo = 'R'` (mismo ojo)
- `estado.logmarActual = 0.3` (NO es null)

**La condición `estado.ojo !== ojo || estado.logmarActual === null` es FALSA porque:**
- `estado.ojo === ojo` (ambos son 'R') → primera parte FALSA
- `estado.logmarActual !== null` (es 0.3) → segunda parte FALSA

**Resultado:** NO entra en el bloque de inicialización para `agudeza_alcanzada`.

**Luego, en línea 1251:**
```javascript
// Si el resultado ya está confirmado, avanzar al siguiente test
if (estadoExamen.agudezaVisual[ojo]?.confirmado) {
  const siguienteTest = avanzarTest();
  // ...
}
```

Como `agudeza_inicial` R ya está confirmado (`estadoExamen.agudezaVisual['R'].confirmado = true`), esta condición es TRUE, entonces **avanza al siguiente test sin ejecutar `agudeza_alcanzada`**.

---

## 🐛 Problemas Identificados

### **Problema 1: Condición de Inicialización Incorrecta**

**Ubicación:** `generarPasosEtapa4()`, línea 1155

**Problema:** La condición `estado.ojo !== ojo || estado.logmarActual === null` no distingue entre:
- `agudeza_inicial` completado → estado tiene valores
- `agudeza_alcanzada` nuevo → necesita inicialización

**Impacto:** Cuando se avanza de `agudeza_inicial` R a `agudeza_alcanzada` R (mismo ojo), no se inicializa porque el estado todavía tiene valores del test anterior.

---

### **Problema 2: Verificación de Confirmación Incorrecta**

**Ubicación:** `generarPasosEtapa4()`, línea 1251

**Problema:** La verificación `estadoExamen.agudezaVisual[ojo]?.confirmado` no distingue entre:
- `agudeza_inicial` confirmado → `confirmado = true`
- `agudeza_alcanzada` pendiente → aún no existe en `agudezaVisual`

**Impacto:** Si `agudeza_inicial` está confirmado, la función asume que el test actual también está confirmado y avanza al siguiente test, incluso si el test actual es `agudeza_alcanzada` que aún no se ha ejecutado.

---

### **Problema 3: Falta de Reset del Estado de Agudeza**

**Ubicación:** `resetearEstadoAgudeza()` se llama solo cuando se confirma un test de agudeza, pero no cuando se avanza de un test de lentes a `agudeza_alcanzada`.

**Problema:** El estado de agudeza mantiene valores del test anterior (`agudeza_inicial`), lo que interfiere con la inicialización de `agudeza_alcanzada`.

**Impacto:** La condición de inicialización no se cumple porque el estado todavía tiene valores.

---

## 📊 Flujo del Problema (Paso a Paso)

### **Escenario: Completar Cilindro R → Avanzar a Agudeza Alcanzada R**

1. **Test de cilindro R se completa:**
   - `confirmarResultado(-0.75)` se llama
   - Guarda resultado: `resultados.R.cilindrico = -0.75`
   - Llama `avanzarTest()`

2. **`avanzarTest()` ejecuta:**
   - `indiceActual = 4`
   - `testActual = { tipo: 'agudeza_alcanzada', ojo: 'R' }`
   - `etapa = 'ETAPA_4'` (mediante `mapearTipoTestAEtapa()`)
   - ✅ **Correcto hasta aquí**

3. **`obtenerInstrucciones()` llama `generarPasos()`:**
   - Detecta `etapa = 'ETAPA_4'`
   - Llama `generarPasosEtapa4()`

4. **`generarPasosEtapa4()` ejecuta:**
   - `testActual = { tipo: 'agudeza_alcanzada', ojo: 'R' }`
   - `esAgudezaAlcanzada = true`
   - **Línea 1155:** Verifica condición de inicialización:
     ```javascript
     if (estado.ojo !== ojo || estado.logmarActual === null)
     ```
     - `estado.ojo = 'R'` (del test anterior)
     - `ojo = 'R'` (del test actual)
     - `estado.logmarActual = 0.3` (del test anterior)
     - **Condición: FALSE** → NO entra en bloque de inicialización

5. **Línea 1251:** Verifica si está confirmado:
   ```javascript
   if (estadoExamen.agudezaVisual[ojo]?.confirmado)
   ```
   - `estadoExamen.agudezaVisual['R'].confirmado = true` (de `agudeza_inicial`)
   - **Condición: TRUE** → Avanza al siguiente test

6. **Resultado:** Se salta `agudeza_alcanzada` R y avanza a `agudeza_inicial` L

---

## 🎯 Plan de Acción

### **Solución 1: Mejorar Condición de Inicialización** (Recomendada)

**Ubicación:** `generarPasosEtapa4()`, línea 1155

**Cambio requerido:**

La condición debe verificar si el test actual es diferente al test anterior, no solo si el ojo o logmarActual cambian.

**Solución:**
```javascript
// Inicializar estado de agudeza si es la primera vez O si cambió el tipo de test
const necesitaInicializacion = 
  estado.ojo !== ojo || 
  estado.logmarActual === null ||
  (esAgudezaAlcanzada && !estado.esAgudezaAlcanzada) ||  // Cambió de inicial a alcanzada
  (!esAgudezaAlcanzada && estado.esAgudezaAlcanzada);   // Cambió de alcanzada a inicial

if (necesitaInicializacion) {
  estado.ojo = ojo;
  
  if (esAgudezaAlcanzada) {
    // Lógica específica para agudeza_alcanzada
    // ...
  }
}
```

**Ventajas:**
- ✅ Distingue entre `agudeza_inicial` y `agudeza_alcanzada` cuando es el mismo ojo
- ✅ Inicializa correctamente cuando cambia el tipo de test
- ✅ Mantiene compatibilidad con cambio de ojo

---

### **Solución 2: Verificar Tipo de Test en Confirmación** (Recomendada)

**Ubicación:** `generarPasosEtapa4()`, línea 1251

**Cambio requerido:**

La verificación de confirmación debe verificar el tipo de test actual, no solo si hay algún test confirmado.

**Solución:**
```javascript
// Si el resultado ya está confirmado, avanzar al siguiente test
// Verificar que el test confirmado sea del mismo tipo que el test actual
const testConfirmado = estadoExamen.agudezaVisual[ojo]?.confirmado;
const tipoTestConfirmado = testActual.tipo === 'agudeza_inicial' 
  ? 'agudeza_inicial' 
  : 'agudeza_alcanzada';

if (testConfirmado && testActual.tipo === tipoTestConfirmado) {
  const siguienteTest = avanzarTest();
  // ...
}
```

**Mejor solución (más robusta):**
```javascript
// Verificar si el test actual ya está confirmado
const campoResultado = mapearTipoTestAResultado(testActual.tipo);
const resultadoConfirmado = campoResultado 
  ? estadoExamen.secuenciaExamen.resultados[ojo][campoResultado] !== null
  : false;

if (resultadoConfirmado) {
  const siguienteTest = avanzarTest();
  // ...
}
```

**Ventajas:**
- ✅ Verifica el tipo de test específico, no solo si hay algún test confirmado
- ✅ Más robusto y explícito
- ✅ Evita falsos positivos

---

### **Solución 3: Resetear Estado al Avanzar de Lentes a Agudeza** (Complementaria)

**Ubicación:** `confirmarResultado()`, después de `avanzarTest()`

**Cambio requerido:**

Si el siguiente test es `agudeza_alcanzada`, resetear el estado de agudeza antes de continuar.

**Solución:**
```javascript
// Avanzar al siguiente test
const siguienteTest = avanzarTest();

// Si el siguiente test es agudeza_alcanzada, resetear estado de agudeza
if (siguienteTest && siguienteTest.tipo === 'agudeza_alcanzada') {
  resetearEstadoAgudeza(estadoExamen.agudezaEstado);
}

return {
  ok: true,
  resultadoConfirmado: true,
  valorFinal,
  siguienteTest
};
```

**Ventajas:**
- ✅ Asegura que el estado esté limpio para `agudeza_alcanzada`
- ✅ Complementa las otras soluciones
- ✅ Previene problemas de estado residual

---

## ✅ Solución Recomendada (Combinada)

**Implementar las 3 soluciones en conjunto:**

1. **Solución 1:** Mejorar condición de inicialización para distinguir entre tipos de test
2. **Solución 2:** Verificar tipo de test específico en confirmación
3. **Solución 3:** Resetear estado al avanzar de lentes a agudeza

**Orden de implementación:**
1. Primero: Solución 1 (más crítica)
2. Segundo: Solución 2 (previene el problema)
3. Tercero: Solución 3 (asegura limpieza)

---

## 🧪 Casos de Prueba

### **Caso 1: Agudeza Inicial R → Tests Lentes R → Agudeza Alcanzada R**

**Estado inicial:**
- `agudeza_inicial` R completado (resultado: 0.3)
- `esferico_grueso` R completado
- `esferico_fino` R completado
- `cilindrico` R completado

**Comportamiento esperado:**
1. ✅ Al avanzar a `agudeza_alcanzada` R, se inicializa correctamente
2. ✅ Se configura foróptero con valores finales
3. ✅ Se muestra letra en logMAR 0.3
4. ✅ El test se ejecuta normalmente

**Comportamiento actual (con bug):**
1. ❌ Al avanzar a `agudeza_alcanzada` R, NO se inicializa
2. ❌ Se detecta que `agudeza_inicial` está confirmado
3. ❌ Se salta `agudeza_alcanzada` R
4. ❌ Se avanza a `agudeza_inicial` L

---

### **Caso 2: Agudeza Inicial L → Tests Lentes L → Agudeza Alcanzada L**

**Estado inicial:**
- `agudeza_inicial` L completado (resultado: 0.0)
- `esferico_grueso` L completado
- `esferico_fino` L completado

**Comportamiento esperado:**
1. ✅ Al avanzar a `agudeza_alcanzada` L, se inicializa correctamente
2. ✅ Se configura foróptero con valores finales
3. ✅ Se muestra letra en logMAR 0.0
4. ✅ El test se ejecuta normalmente

**Comportamiento actual (con bug):**
1. ❌ Similar al caso 1, se salta el test

---

## 📝 Resumen de Cambios Requeridos

### **Cambio 1: Mejorar Condición de Inicialización**

**Archivo:** `reference/foroptero-server/motorExamen.js`  
**Función:** `generarPasosEtapa4()`  
**Línea:** 1155

**Cambio:**
```javascript
// ANTES:
if (estado.ojo !== ojo || estado.logmarActual === null) {

// DESPUÉS:
const necesitaInicializacion = 
  estado.ojo !== ojo || 
  estado.logmarActual === null ||
  (esAgudezaAlcanzada && !estado.esAgudezaAlcanzada) ||
  (!esAgudezaAlcanzada && estado.esAgudezaAlcanzada);

if (necesitaInicializacion) {
```

---

### **Cambio 2: Verificar Tipo de Test en Confirmación**

**Archivo:** `reference/foroptero-server/motorExamen.js`  
**Función:** `generarPasosEtapa4()`  
**Línea:** 1251

**Cambio:**
```javascript
// ANTES:
if (estadoExamen.agudezaVisual[ojo]?.confirmado) {

// DESPUÉS:
const campoResultado = mapearTipoTestAResultado(testActual.tipo);
const resultadoConfirmado = campoResultado 
  ? estadoExamen.secuenciaExamen.resultados[ojo][campoResultado] !== null
  : false;

if (resultadoConfirmado) {
```

---

### **Cambio 3: Resetear Estado al Avanzar de Lentes a Agudeza**

**Archivo:** `reference/foroptero-server/motorExamen.js`  
**Función:** `confirmarResultado()`  
**Línea:** 2586 (después de `avanzarTest()`)

**Cambio:**
```javascript
// Avanzar al siguiente test
const siguienteTest = avanzarTest();

// Si el siguiente test es agudeza_alcanzada, resetear estado de agudeza
if (siguienteTest && siguienteTest.tipo === 'agudeza_alcanzada') {
  resetearEstadoAgudeza(estadoExamen.agudezaEstado);
}

return {
  ok: true,
  resultadoConfirmado: true,
  valorFinal,
  siguienteTest
};
```

---

## ⚠️ Consideraciones Adicionales

### **Problema Relacionado: Estado de Agudeza Visual**

El campo `estadoExamen.agudezaVisual[ojo]` se usa tanto para `agudeza_inicial` como para `agudeza_alcanzada`, lo que puede causar confusión.

**Recomendación:** Considerar usar campos separados o un objeto con tipo:
```javascript
agudezaVisual: {
  R: {
    inicial: { logmar: 0.3, letra: 'H', confirmado: true },
    alcanzada: { logmar: null, letra: null, confirmado: false }
  },
  L: { ... }
}
```

**Prioridad:** Baja (mejora futura, no crítica para el bug actual)

---

## ✅ Checklist de Validación

Después de implementar las soluciones, verificar:

- [ ] Al completar test de lentes R, se inicializa correctamente `agudeza_alcanzada` R
- [ ] El foróptero se configura con valores finales antes de mostrar TV
- [ ] Se muestra letra en logMAR = `agudeza_inicial` (no en otro valor)
- [ ] El test de `agudeza_alcanzada` se ejecuta completamente
- [ ] Al completar `agudeza_alcanzada` R, se avanza correctamente a `agudeza_inicial` L
- [ ] No se salta ningún test en la secuencia
- [ ] El estado se resetea correctamente entre tests de agudeza

---

**Fecha de análisis:** 2025-01-27  
**Última actualización:** 2025-01-27

