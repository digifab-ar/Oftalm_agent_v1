# Plan de Acción: Etapa 3 Completa - Definición de Secuencia del Examen

## 📋 Análisis del Problema Actual

### Estado Actual de Etapa 3
- ✅ Configura el foróptero (R abierto, L cerrado)
- ✅ Genera pasos: foróptero → esperar → hablar
- ❌ **NO define la secuencia completa del examen**
- ❌ **NO determina qué tests incluir según valores del cilindro**
- ❌ **NO guarda el orden de ejecución de tests**

### Requerimientos de Etapa 3 (según instructionsModular.ts)

**Objetivo:** Definir internamente el orden completo del examen, activar los tests disponibles, y preparar el foróptero para comenzar.

**Reglas para determinar tests según cilindro:**

1. **Cilindro = 0 o -0.25:**
   - ❌ Omitir test de lente cilíndrico
   - ❌ Omitir test de lente cilíndrico ángulo
   - ✅ Incluir: agudeza inicial, esférico grueso, esférico fino, agudeza alcanzada

2. **Cilindro entre -0.50 y -1.75:**
   - ✅ Incluir test de lente cilíndrico
   - ❌ Omitir test de lente cilíndrico ángulo (mantener ángulo inicial)
   - ✅ Incluir: agudeza inicial, esférico grueso, esférico fino, cilíndrico, agudeza alcanzada

3. **Cilindro entre -2.00 y -6.00:**
   - ✅ Incluir test de lente cilíndrico
   - ✅ Incluir test de lente cilíndrico ángulo
   - ✅ Incluir: agudeza inicial, esférico grueso, esférico fino, cilíndrico, cilíndrico ángulo, agudeza alcanzada

**Secuencia completa (si todos los tests aplican):**
1. Agudeza visual inicial <R>
2. Lente esférico grueso <R>
3. Lente esférico fino <R>
4. Lente cilíndrico <R> *(opcional)*
5. Lente cilíndrico ángulo <R> *(opcional)*
6. Agudeza visual alcanzada <R>
7. Agudeza visual inicial <L>
8. Lente esférico grueso <L>
9. Lente esférico fino <L>
10. Lente cilíndrico <L> *(opcional)*
11. Lente cilíndrico ángulo <L> *(opcional)*
12. Agudeza visual alcanzada <L>
13. Binocular *(opcional - se implementará después)*

---

## 🎯 Objetivos de la Implementación

1. **Definir secuencia completa** basada en valores recalculados del cilindro
2. **Guardar secuencia en el estado** del examen
3. **Mantener registro del progreso** (qué test se está ejecutando actualmente)
4. **Preparar foróptero** para comenzar (R abierto, L cerrado)
5. **Transición a Etapa 4** con el primer test de la secuencia

---

## 📐 Diseño de la Solución

### 1. Estructura de Datos para la Secuencia

**Agregar al estado del examen:**

```javascript
// En estadoExamen, agregar:
secuenciaExamen: {
  tests: [
    {
      id: 1,
      tipo: 'agudeza_inicial',
      ojo: 'R',
      activo: true,
      completado: false,
      resultado: null
    },
    {
      id: 2,
      tipo: 'esferico_grueso',
      ojo: 'R',
      activo: true,
      completado: false,
      resultado: null
    },
    {
      id: 3,
      tipo: 'esferico_fino',
      ojo: 'R',
      activo: true,
      completado: false,
      resultado: null
    },
    {
      id: 4,
      tipo: 'cilindrico',
      ojo: 'R',
      activo: false, // Se determina según cilindro
      completado: false,
      resultado: null
    },
    {
      id: 5,
      tipo: 'cilindrico_angulo',
      ojo: 'R',
      activo: false, // Se determina según cilindro
      completado: false,
      resultado: null
    },
    {
      id: 6,
      tipo: 'agudeza_alcanzada',
      ojo: 'R',
      activo: true,
      completado: false,
      resultado: null
    },
    // ... repetir para ojo L
    {
      id: 13,
      tipo: 'binocular',
      ojo: 'B',
      activo: false, // Opcional, se implementará después
      completado: false,
      resultado: null
    }
  ],
  testActual: null, // ID del test que se está ejecutando
  testAnterior: null, // ID del test anterior (para navegación)
  indiceActual: 0 // Índice en el array de tests activos
}
```

**Alternativa más simple (recomendada para MVP):**

```javascript
// En estadoExamen, agregar:
secuenciaExamen: {
  // Lista de tests activos en orden de ejecución
  testsActivos: [
    { tipo: 'agudeza_inicial', ojo: 'R' },
    { tipo: 'esferico_grueso', ojo: 'R' },
    { tipo: 'esferico_fino', ojo: 'R' },
    // ... según reglas del cilindro
  ],
  indiceActual: 0, // Índice del test actual en testsActivos
  testActual: null, // { tipo: 'agudeza_inicial', ojo: 'R' }
  resultados: {
    R: {
      agudezaInicial: null,
      esfericoGrueso: null,
      esfericoFino: null,
      cilindrico: null,
      cilindricoAngulo: null,
      agudezaAlcanzada: null
    },
    L: {
      agudezaInicial: null,
      esfericoGrueso: null,
      esfericoFino: null,
      cilindrico: null,
      cilindricoAngulo: null,
      agudezaAlcanzada: null
    }
  }
}
```

### 2. Función para Determinar Tests Activos

```javascript
/**
 * Determina qué tests incluir según el valor del cilindro recalculado
 * @param {number} cilindro - Valor cilíndrico recalculado
 * @returns {object} - Configuración de tests activos
 */
function determinarTestsActivos(cilindro) {
  const tests = {
    cilindrico: false,
    cilindricoAngulo: false
  };
  
  if (cilindro === 0 || cilindro === -0.25) {
    // No incluir tests de cilindro
    tests.cilindrico = false;
    tests.cilindricoAngulo = false;
  } else if (cilindro >= -0.50 && cilindro <= -1.75) {
    // Incluir test de cilindro, pero NO de ángulo
    tests.cilindrico = true;
    tests.cilindricoAngulo = false;
  } else if (cilindro >= -2.00 && cilindro <= -6.00) {
    // Incluir ambos tests
    tests.cilindrico = true;
    tests.cilindricoAngulo = true;
  }
  
  return tests;
}
```

### 3. Función para Generar Secuencia Completa

```javascript
/**
 * Genera la secuencia completa del examen basada en valores recalculados
 */
function generarSecuenciaExamen() {
  const valoresR = estadoExamen.valoresRecalculados.R;
  const valoresL = estadoExamen.valoresRecalculados.L;
  
  // Determinar tests activos para cada ojo
  const testsR = determinarTestsActivos(valoresR.cilindro);
  const testsL = determinarTestsActivos(valoresL.cilindro);
  
  // Construir secuencia de tests activos
  const secuencia = [];
  
  // OJO DERECHO (R)
  secuencia.push({ tipo: 'agudeza_inicial', ojo: 'R' });
  secuencia.push({ tipo: 'esferico_grueso', ojo: 'R' });
  secuencia.push({ tipo: 'esferico_fino', ojo: 'R' });
  
  if (testsR.cilindrico) {
    secuencia.push({ tipo: 'cilindrico', ojo: 'R' });
  }
  
  if (testsR.cilindricoAngulo) {
    secuencia.push({ tipo: 'cilindrico_angulo', ojo: 'R' });
  }
  
  secuencia.push({ tipo: 'agudeza_alcanzada', ojo: 'R' });
  
  // OJO IZQUIERDO (L)
  secuencia.push({ tipo: 'agudeza_inicial', ojo: 'L' });
  secuencia.push({ tipo: 'esferico_grueso', ojo: 'L' });
  secuencia.push({ tipo: 'esferico_fino', ojo: 'L' });
  
  if (testsL.cilindrico) {
    secuencia.push({ tipo: 'cilindrico', ojo: 'L' });
  }
  
  if (testsL.cilindricoAngulo) {
    secuencia.push({ tipo: 'cilindrico_angulo', ojo: 'L' });
  }
  
  secuencia.push({ tipo: 'agudeza_alcanzada', ojo: 'L' });
  
  // Binocular (opcional, se implementará después)
  // secuencia.push({ tipo: 'binocular', ojo: 'B' });
  
  return secuencia;
}
```

### 4. Modificación de `generarPasosEtapa3()`

**Flujo actual:**
1. Configura foróptero
2. Genera pasos
3. Pasa a ETAPA_4

**Flujo nuevo:**
1. **Generar secuencia completa** basada en valores recalculados
2. **Guardar secuencia en estado**
3. **Inicializar testActual** (primer test: agudeza_inicial R)
4. Configura foróptero
5. Genera pasos
6. Pasa a ETAPA_4 con información del test actual

---

## 🔧 Cambios Requeridos en el Código

### 1. Modificar Modelo de Estado (`motorExamen.js`)

**Agregar a `estadoExamen`:**
```javascript
// Secuencia del examen
secuenciaExamen: {
  testsActivos: [], // Array de { tipo, ojo }
  indiceActual: 0,
  testActual: null, // { tipo: 'agudeza_inicial', ojo: 'R' }
  resultados: {
    R: {
      agudezaInicial: null,
      esfericoGrueso: null,
      esfericoFino: null,
      cilindrico: null,
      cilindricoAngulo: null,
      agudezaAlcanzada: null
    },
    L: {
      agudezaInicial: null,
      esfericoGrueso: null,
      esfericoFino: null,
      cilindrico: null,
      cilindricoAngulo: null,
      agudezaAlcanzada: null
    }
  }
}
```

**Agregar a `inicializarExamen()`:**
```javascript
secuenciaExamen: {
  testsActivos: [],
  indiceActual: 0,
  testActual: null,
  resultados: {
    R: {
      agudezaInicial: null,
      esfericoGrueso: null,
      esfericoFino: null,
      cilindrico: null,
      cilindricoAngulo: null,
      agudezaAlcanzada: null
    },
    L: {
      agudezaInicial: null,
      esfericoGrueso: null,
      esfericoFino: null,
      cilindrico: null,
      cilindricoAngulo: null,
      agudezaAlcanzada: null
    }
  }
}
```

### 2. Agregar Funciones de Secuencia (`motorExamen.js`)

**Función `determinarTestsActivos(cilindro)`:**
- Determina qué tests de cilindro incluir según el valor

**Función `generarSecuenciaExamen()`:**
- Genera la secuencia completa basada en valores recalculados
- Retorna array de tests activos en orden

**Función `obtenerTestActual()`:**
- Retorna el test que se está ejecutando actualmente
- Útil para Etapa 4 y 5

**Función `avanzarTest()`:**
- Avanza al siguiente test en la secuencia
- Actualiza `indiceActual` y `testActual`
- Retorna el nuevo test o null si se completó el examen

### 3. Modificar `generarPasosEtapa3()` (`motorExamen.js`)

**Cambios:**
1. Llamar `generarSecuenciaExamen()` para crear la secuencia
2. Guardar secuencia en `estadoExamen.secuenciaExamen.testsActivos`
3. Inicializar `testActual` con el primer test (agudeza_inicial R)
4. Configurar foróptero (como está ahora)
5. Generar pasos
6. En el contexto, incluir información del test actual

### 4. Actualizar `obtenerEstado()` (`motorExamen.js`)

**Agregar información de secuencia:**
```javascript
estado: {
  etapa: estadoExamen.etapa,
  ojoActual: estadoExamen.ojoActual,
  testActual: estadoExamen.secuenciaExamen.testActual,
  progreso: calcularProgreso(),
  ultimaAccion: obtenerUltimaAccion()
}
```

---

## 📊 Flujo Completo de Etapa 3

```
1. Etapa 2 completa → valores recalculados guardados
2. generarPasosEtapa2() → llama generarPasosEtapa3()
3. generarPasosEtapa3():
   a. Leer valores recalculados (R y L)
   b. Para cada ojo, determinarTestsActivos(cilindro)
   c. generarSecuenciaExamen() → crea array de tests
   d. Guardar secuencia en estadoExamen.secuenciaExamen
   e. Inicializar testActual = primer test (agudeza_inicial R)
   f. Configurar foróptero (R abierto, L cerrado)
   g. Generar pasos: foróptero → esperar → hablar
   h. Pasar a ETAPA_4
   i. Retornar pasos con contexto: { etapa: 'ETAPA_4', testActual: {...} }
```

---

## 🎯 Plan de Implementación

### FASE 1: Estructura de Datos
- [ ] Agregar `secuenciaExamen` al modelo de estado
- [ ] Actualizar `inicializarExamen()` para incluir secuenciaExamen
- [ ] Agregar estructura de `resultados` por ojo

### FASE 2: Funciones de Secuencia
- [ ] Implementar `determinarTestsActivos(cilindro)`
- [ ] Implementar `generarSecuenciaExamen()`
- [ ] Implementar `obtenerTestActual()`
- [ ] Implementar `avanzarTest()` (para uso futuro en Etapas 4 y 5)

### FASE 3: Modificar Etapa 3
- [ ] Modificar `generarPasosEtapa3()`:
  - [ ] Llamar `generarSecuenciaExamen()`
  - [ ] Guardar secuencia en estado
  - [ ] Inicializar `testActual`
  - [ ] Mantener configuración de foróptero
  - [ ] Incluir información del test actual en contexto

### FASE 4: Testing y Validación
- [ ] Probar con cilindro = 0 (sin tests de cilindro)
- [ ] Probar con cilindro = -1.00 (solo test de cilindro, sin ángulo)
- [ ] Probar con cilindro = -2.75 (ambos tests de cilindro)
- [ ] Verificar que la secuencia se guarda correctamente
- [ ] Verificar que testActual se inicializa correctamente

---

## 🔍 Consideraciones Importantes

### 1. Valores para Tests de Lentes
- **Esférico grueso:** usa valor esférico recalculado como punto de partida
- **Esférico fino:** usa resultado de esférico grueso como punto de partida
- **Cilíndrico:** usa valor cilíndrico recalculado como punto de partida
- **Cilíndrico ángulo:** usa valor de ángulo inicial (no recalculado)

### 2. Orden de Ejecución
- Siempre comenzar con ojo derecho (R)
- Ejecutar todos los tests de R antes de pasar a L
- Los resultados de cada test se guardan para usar en tests siguientes

### 3. Navegación de Secuencia
- `testActual` indica qué test se está ejecutando
- `avanzarTest()` se usará en Etapas 4 y 5 para pasar al siguiente test
- Cuando se completa el último test, el examen finaliza

### 4. Compatibilidad con Etapas Futuras
- Etapa 4 (Agudeza) usará `testActual` para saber qué test ejecutar
- Etapa 5 (Lentes) usará `testActual` y `resultados` anteriores
- Los resultados se guardan en `secuenciaExamen.resultados` para referencia

---

## 📝 Ejemplo de Secuencia Generada

**Caso 1: Cilindro R = -2.75, Cilindro L = 0**

```javascript
secuenciaExamen: {
  testsActivos: [
    { tipo: 'agudeza_inicial', ojo: 'R' },
    { tipo: 'esferico_grueso', ojo: 'R' },
    { tipo: 'esferico_fino', ojo: 'R' },
    { tipo: 'cilindrico', ojo: 'R' },        // ✅ Incluido (cilindro -2.75)
    { tipo: 'cilindrico_angulo', ojo: 'R' }, // ✅ Incluido (cilindro -2.75)
    { tipo: 'agudeza_alcanzada', ojo: 'R' },
    { tipo: 'agudeza_inicial', ojo: 'L' },
    { tipo: 'esferico_grueso', ojo: 'L' },
    { tipo: 'esferico_fino', ojo: 'L' },
    // ❌ NO incluye cilindrico L (cilindro = 0)
    // ❌ NO incluye cilindrico_angulo L (cilindro = 0)
    { tipo: 'agudeza_alcanzada', ojo: 'L' }
  ],
  indiceActual: 0,
  testActual: { tipo: 'agudeza_inicial', ojo: 'R' }
}
```

**Caso 2: Cilindro R = -1.00, Cilindro L = -1.50**

```javascript
secuenciaExamen: {
  testsActivos: [
    { tipo: 'agudeza_inicial', ojo: 'R' },
    { tipo: 'esferico_grueso', ojo: 'R' },
    { tipo: 'esferico_fino', ojo: 'R' },
    { tipo: 'cilindrico', ojo: 'R' },        // ✅ Incluido (cilindro -1.00)
    // ❌ NO incluye cilindrico_angulo R (cilindro entre -0.50 y -1.75)
    { tipo: 'agudeza_alcanzada', ojo: 'R' },
    { tipo: 'agudeza_inicial', ojo: 'L' },
    { tipo: 'esferico_grueso', ojo: 'L' },
    { tipo: 'esferico_fino', ojo: 'L' },
    { tipo: 'cilindrico', ojo: 'L' },        // ✅ Incluido (cilindro -1.50)
    // ❌ NO incluye cilindrico_angulo L (cilindro entre -0.50 y -1.75)
    { tipo: 'agudeza_alcanzada', ojo: 'L' }
  ],
  indiceActual: 0,
  testActual: { tipo: 'agudeza_inicial', ojo: 'R' }
}
```

---

## ⚠️ Puntos de Atención

1. **Valores del cilindro recalculado:** Usar `valoresRecalculados`, NO `valoresIniciales`
2. **Rangos inclusivos:** Los rangos deben incluir los límites (ej: -2.00 y -1.75)
3. **Orden estricto:** La secuencia debe seguir el orden exacto definido
4. **Resultados por test:** Cada test debe guardar su resultado para usar en tests siguientes
5. **Test actual:** Debe inicializarse correctamente para que Etapa 4 sepa qué ejecutar

---

## ✅ Criterios de Éxito

- [ ] La secuencia se genera correctamente según valores del cilindro
- [ ] Los tests opcionales se incluyen/omiten según las reglas
- [ ] La secuencia se guarda en el estado del examen
- [ ] `testActual` se inicializa con el primer test (agudeza_inicial R)
- [ ] El foróptero se configura correctamente
- [ ] La transición a Etapa 4 incluye información del test actual
- [ ] Los resultados se pueden guardar para cada test (preparación para Etapas 4 y 5)

---

**Fecha de creación:** 2025-01-27  
**Estado:** 📋 Plan definido, pendiente de aprobación e implementación

