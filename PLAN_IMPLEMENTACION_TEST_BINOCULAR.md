# Plan de Implementación: Test Binocular

## 📋 Resumen Ejecutivo

Implementar el test binocular como último test antes de finalizar el examen. El objetivo es realizar un ajuste final de confort visual con ambos ojos abiertos, ajustando solo las lentes esféricas para acercar los valores entre ambos ojos.

---

## 🎯 Objetivos

1. **Posición:** Último test de la secuencia, después de `agudeza_alcanzada` L
2. **Objetivo:** Ajuste final de confort con ambos ojos abiertos
3. **Ajuste:** Solo esfera, cambios de ±0.25 dioptrías
4. **Estrategia:** Acercar valores entre ojos (ej: R +0.75 / L +1.50)
5. **Confirmación:** Doble confirmación antes de valor final
6. **Resultado:** Un valor por cada ojo (R y L)
7. **Registro:** En API `/api/examen/detalle` con formato específico

---

## 📐 Especificaciones Técnicas

### 1. Posición en la Secuencia

- **Test anterior:** `agudeza_alcanzada` L
- **Test actual:** `binocular` (ojo: 'B')
- **Test siguiente:** FINALIZADO (marca fin del examen)

### 2. Valores Iniciales del Foróptero

```javascript
// Valores iniciales para configurar el foróptero
{
  R: {
    esfera: resultadoEsfericoFinoR,
    cilindro: resultadoCilindricoR || valorRecalculadoCilindroR,
    angulo: resultadoCilindricoAnguloR || valorRecalculadoAnguloR,
    occlusion: 'open'
  },
  L: {
    esfera: resultadoEsfericoFinoL,
    cilindro: resultadoCilindricoL || valorRecalculadoCilindroL,
    angulo: resultadoCilindricoAnguloL || valorRecalculadoAnguloL,
    occlusion: 'open'
  }
}
```

**Prioridad de valores:**
- **Esfera:** Solo `esfericoFino` (no usar esfericoGrueso ni recalculado)
- **Cilindro:** `cilindrico` > `valoresRecalculados.cilindro`
- **Ángulo:** `cilindricoAngulo` > `valoresRecalculados.angulo`

### 3. Configuración de TV

```javascript
// LogMAR = máximo entre agudezaAlcanzada R y L
const logmarTV = Math.max(
  resultados.R.agudezaAlcanzada || 0.4,
  resultados.L.agudezaAlcanzada || 0.4
);
// Letra inicial: 'H'
const letraTV = 'H';
```

### 4. Algoritmo de Ajuste

**Objetivo:** Acercar los valores esféricos entre ambos ojos

**Estrategia:**
1. Calcular diferencia: `diferencia = Math.abs(esferaR - esferaL)`
2. Si diferencia > 0.25, ajustar:
   - **Opción A:** Subir el valor más bajo en +0.25
   - **Opción B:** Bajar el valor más alto en -0.25
3. Probar ambas opciones y elegir la que mejore el confort

**Algoritmo específico:**
```
1. Valores iniciales: R = +0.75, L = +1.50
2. Diferencia: 0.75
3. Probar:
   - Opción 1: R = +1.00 (subir R en +0.25), L = +1.50 (sin cambio)
   - Opción 2: R = +0.75 (sin cambio), L = +1.25 (bajar L en -0.25)
4. Comparar confort entre ambas opciones
5. Confirmar con doble confirmación
```

### 5. Sistema de Confirmación

- **Doble confirmación:** Requiere 2 respuestas positivas antes de confirmar resultado
- **Mismo esquema que tests de lentes:** Usar sistema similar a `comparacionActual`
- **Fases:**
  - `iniciando`: Mostrar primera opción
  - `mostrando_alternativo`: Mostrando segunda opción
  - `preguntando`: Esperando respuesta
  - `confirmando`: Confirmando valor elegido
  - `confirmado`: Resultado confirmado

### 6. Estructura de Resultados

**En estado del examen:**
```javascript
resultados: {
  R: {
    // ... resultados existentes ...
    binocular: null  // Nuevo campo para resultado binocular R
  },
  L: {
    // ... resultados existentes ...
    binocular: null  // Nuevo campo para resultado binocular L
  }
}
```

**En API `/api/examen/detalle`:**
```javascript
{
  indice: 13,
  tipo: "binocular",
  ojo: "B",
  estado: "completado",
  resultadoR: 1.00,
  resultadoL: 1.25
}
```

---

## 🔧 Cambios Requeridos en el Código

### 1. Modificar Estado del Examen

**Archivo:** `motorExamen.js`

**Cambio 1.1: Agregar estado de binocular**

```javascript
// En estadoExamen, agregar después de comparacionActual:
binocularEstado: {
  esferaR: null,           // Valor esférico R inicial
  esferaL: null,           // Valor esférico L inicial
  esferaRActual: null,     // Valor esférico R que se está probando
  esferaLActual: null,     // Valor esférico L que se está probando
  esferaRAnterior: null,   // Valor esférico R anterior
  esferaLAnterior: null,   // Valor esférico L anterior
  esferaRConfirmada: null, // Valor esférico R confirmado
  esferaLConfirmada: null, // Valor esférico L confirmado
  confirmaciones: 0,       // Número de confirmaciones (0, 1, 2)
  faseBinocular: null,     // 'iniciando' | 'mostrando_alternativo' | 'preguntando' | 'confirmando' | 'confirmado'
  letraActual: null,       // Letra actual en TV
  logmarActual: null,      // LogMAR actual en TV
  opcionActual: null,      // 'subir_R' | 'bajar_L' | 'base'
  valoresProbados: {
    subirR: false,         // ¿Ya probamos subir R?
    bajarL: false          // ¿Ya probamos bajar L?
  }
}
```

**Cambio 1.2: Agregar campos binocular en resultados**

```javascript
// En secuenciaExamen.resultados, agregar:
resultados: {
  R: {
    // ... campos existentes ...
    binocular: null  // Nuevo campo
  },
  L: {
    // ... campos existentes ...
    binocular: null  // Nuevo campo
  }
}
```

**Cambio 1.3: Actualizar inicializarExamen()**

Agregar inicialización de `binocularEstado` y `resultados[ojo].binocular` en la función `inicializarExamen()`.

### 2. Modificar Generación de Secuencia

**Archivo:** `motorExamen.js`

**Función:** `generarSecuenciaExamen()`

**Cambio:** Descomentar y activar el test binocular

```javascript
// Cambiar de:
// Binocular (opcional, se implementará después)
// secuencia.push({ tipo: 'binocular', ojo: 'B' });

// A:
secuencia.push({ tipo: 'binocular', ojo: 'B' });
```

### 3. Agregar Mapeo de Tipo a Etapa

**Archivo:** `motorExamen.js`

**Función:** `mapearTipoTestAEtapa()`

**Cambio:** Agregar mapeo para binocular

```javascript
function mapearTipoTestAEtapa(tipo) {
  const mapa = {
    'agudeza_inicial': 'ETAPA_4',
    'esferico_grueso': 'ETAPA_5',
    'esferico_fino': 'ETAPA_5',
    'cilindrico': 'ETAPA_5',
    'cilindrico_angulo': 'ETAPA_5',
    'agudeza_alcanzada': 'ETAPA_4',
    'binocular': 'ETAPA_6'  // Nueva etapa para binocular
  };
  return mapa[tipo] || 'ETAPA_4';
}
```

**Nota:** Se puede usar `ETAPA_5` también, pero se recomienda `ETAPA_6` para mantener separación lógica.

### 4. Crear Estado Binocular

**Archivo:** `motorExamen.js`

**Función nueva:** `iniciarBinocular()`

```javascript
/**
 * Inicializa el estado de binocular
 * @returns {object} - Resultado de la inicialización
 */
function iniciarBinocular() {
  const resultados = estadoExamen.secuenciaExamen.resultados;
  
  // Obtener valores esféricos finales de cada ojo (SOLO esfericoFino)
  const esferaR = resultados.R.esfericoFino;
  const esferaL = resultados.L.esfericoFino;
  
  // Validar que existen valores de esfericoFino
  if (esferaR === null || esferaR === undefined) {
    return { ok: false, error: 'No se encontró resultado de esférico fino para ojo R' };
  }
  
  if (esferaL === null || esferaL === undefined) {
    return { ok: false, error: 'No se encontró resultado de esférico fino para ojo L' };
  }
  
  // Obtener logMAR máximo para TV
  const logmarR = resultados.R.agudezaAlcanzada || 0.4;
  const logmarL = resultados.L.agudezaAlcanzada || 0.4;
  const logmarMaximo = Math.max(logmarR, logmarL);
  
  // Inicializar estado binocular
  estadoExamen.binocularEstado = {
    esferaR: esferaR,
    esferaL: esferaL,
    esferaRActual: esferaR,
    esferaLActual: esferaL,
    esferaRAnterior: null,
    esferaLAnterior: null,
    esferaRConfirmada: null,
    esferaLConfirmada: null,
    confirmaciones: 0,
    faseBinocular: 'iniciando',
    letraActual: 'H',
    logmarActual: logmarMaximo,
    opcionActual: null,
    valoresProbados: {
      subirR: false,
      bajarL: false
    }
  };
  
  console.log(`🔍 Iniciando test binocular:`, {
    esferaR,
    esferaL,
    diferencia: Math.abs(esferaR - esferaL),
    logmarMaximo
  });
  
  return { ok: true, binocularIniciado: true };
}
```

### 5. Crear Función para Generar Pasos de Binocular

**Archivo:** `motorExamen.js`

**Función nueva:** `generarPasosEtapa6()` o `generarPasosBinocular()`

```javascript
/**
 * Genera pasos para ETAPA_6 (test binocular)
 */
function generarPasosEtapa6() {
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // Validar que estamos en test binocular
  if (!testActual || testActual.tipo !== 'binocular') {
    return {
      ok: false,
      error: 'No estamos en test binocular'
    };
  }
  
  const estado = estadoExamen.binocularEstado;
  const resultados = estadoExamen.secuenciaExamen.resultados;
  
  // Si no hay estado binocular iniciado, inicializarlo
  if (!estado || !estado.esferaR !== null) {
    const resultado = iniciarBinocular();
    if (!resultado.ok) {
      return resultado;
    }
  }
  
  // Si el resultado ya está confirmado, avanzar al siguiente test (FINALIZADO)
  if (resultados.R.binocular !== null && resultados.L.binocular !== null) {
    const siguienteTest = avanzarTest();
    // avanzarTest() debería retornar null y marcar etapa como FINALIZADO
    return generarPasos(); // Generar pasos de FINALIZADO
  }
  
  // Generar pasos según la fase
  const pasos = [];
  
  if (estado.faseBinocular === 'iniciando') {
    // Configurar foróptero con valores iniciales
    const valoresFinalesR = calcularValoresFinalesForoptero('R');
    const valoresFinalesL = calcularValoresFinalesForoptero('L');
    
    pasos.push({
      tipo: 'foroptero',
      orden: 1,
      foroptero: {
        R: {
          esfera: estado.esferaR,
          cilindro: valoresFinalesR.cilindro,
          angulo: valoresFinalesR.angulo,
          occlusion: 'open'
        },
        L: {
          esfera: estado.esferaL,
          cilindro: valoresFinalesL.cilindro,
          angulo: valoresFinalesL.angulo,
          occlusion: 'open'
        }
      }
    });
    
    pasos.push({
      tipo: 'esperar_foroptero',
      orden: 2
    });
    
    pasos.push({
      tipo: 'tv',
      orden: 3,
      letra: estado.letraActual,
      logmar: estado.logmarActual
    });
    
    pasos.push({
      tipo: 'hablar',
      orden: 4,
      mensaje: 'Ahora vamos a hacer un último ajuste con ambos ojos abiertos. Vamos a comparar algunos lentes para mejorar el confort.'
    });
    
    // Calcular diferencia y decidir qué probar primero
    const diferencia = Math.abs(estado.esferaR - estado.esferaL);
    
    if (diferencia > 0.25) {
      // Hay diferencia significativa, probar ajuste
      // Probar primero: subir el más bajo
      if (estado.esferaR < estado.esferaL) {
        // R es menor, subir R
        estado.esferaRActual = estado.esferaR + 0.25;
        estado.esferaLActual = estado.esferaL;
        estado.opcionActual = 'subir_R';
        estado.faseBinocular = 'mostrando_alternativo';
      } else {
        // L es menor, subir L (o bajar R)
        estado.esferaRActual = estado.esferaR;
        estado.esferaLActual = estado.esferaL + 0.25;
        estado.opcionActual = 'subir_L';
        estado.faseBinocular = 'mostrando_alternativo';
      }
    } else {
      // Diferencia pequeña, confirmar valores actuales
      estado.faseBinocular = 'confirmando';
    }
    
  } else if (estado.faseBinocular === 'mostrando_alternativo') {
    // Mostrar alternativa (ya configurado en iniciando)
    // Solo generar pasos de foróptero y TV
    const valoresFinalesR = calcularValoresFinalesForoptero('R');
    const valoresFinalesL = calcularValoresFinalesForoptero('L');
    
    pasos.push({
      tipo: 'foroptero',
      orden: 1,
      foroptero: {
        R: {
          esfera: estado.esferaRActual,
          cilindro: valoresFinalesR.cilindro,
          angulo: valoresFinalesR.angulo,
          occlusion: 'open'
        },
        L: {
          esfera: estado.esferaLActual,
          cilindro: valoresFinalesL.cilindro,
          angulo: valoresFinalesL.angulo,
          occlusion: 'open'
        }
      }
    });
    
    pasos.push({
      tipo: 'esperar_foroptero',
      orden: 2
    });
    
    pasos.push({
      tipo: 'tv',
      orden: 3,
      letra: estado.letraActual,
      logmar: estado.logmarActual
    });
    
    pasos.push({
      tipo: 'hablar',
      orden: 4,
      mensaje: 'Ves mejor con esta configuración o con la anterior?'
    });
    
    estado.faseBinocular = 'preguntando';
    
  } else if (estado.faseBinocular === 'preguntando') {
    // Esperando respuesta, no generar pasos
    return {
      ok: true,
      pasos: [],
      contexto: {
        etapa: 'ETAPA_6',
        testActual,
        binocularEstado: {
          faseBinocular: estado.faseBinocular,
          esferaRActual: estado.esferaRActual,
          esferaLActual: estado.esferaLActual,
          confirmaciones: estado.confirmaciones
        }
      }
    };
  }
  
  return {
    ok: true,
    pasos,
    contexto: {
      etapa: 'ETAPA_6',
      testActual,
      binocularEstado: {
        faseBinocular: estado.faseBinocular,
        esferaRActual: estado.esferaRActual,
        esferaLActual: estado.esferaLActual,
        confirmaciones: estado.confirmaciones
      }
    }
  };
}
```

### 6. Crear Función para Procesar Respuesta Binocular

**Archivo:** `motorExamen.js`

**Función nueva:** `procesarRespuestaBinocular()`

```javascript
/**
 * Procesa la respuesta del paciente en test binocular
 * @param {string} respuestaPaciente - Respuesta del paciente (texto crudo)
 * @param {object} interpretacionComparacion - Interpretación estructurada del agente
 * @returns {object} - Resultado del procesamiento
 */
function procesarRespuestaBinocular(respuestaPaciente, interpretacionComparacion) {
  const estado = estadoExamen.binocularEstado;
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // Validar que estamos en test binocular
  if (!estado || !testActual || testActual.tipo !== 'binocular') {
    return { ok: false, error: 'No estamos en test binocular' };
  }
  
  // Interpretar preferencia (usar función existente)
  const preferencia = interpretarPreferenciaLente(respuestaPaciente, interpretacionComparacion);
  
  if (!preferencia) {
    return { ok: false, error: 'No se pudo interpretar la preferencia del paciente' };
  }
  
  console.log(`📊 Procesando respuesta binocular:`, {
    respuestaPaciente,
    preferencia,
    esferaRActual: estado.esferaRActual,
    esferaLActual: estado.esferaLActual,
    esferaRAnterior: estado.esferaRAnterior,
    esferaLAnterior: estado.esferaLAnterior,
    confirmaciones: estado.confirmaciones
  });
  
  // Procesar según preferencia
  if (preferencia === 'actual') {
    // Eligió la configuración actual (alternativa)
    estado.confirmaciones += 1;
    
    if (estado.confirmaciones >= 2) {
      // Confirmado
      return confirmarResultadoBinocular(estado.esferaRActual, estado.esferaLActual);
    }
    
    // Aún necesita otra confirmación
    // Mostrar nuevamente la configuración actual
    estado.faseBinocular = 'mostrando_alternativo';
    return { ok: true, necesitaMostrarLente: true };
    
  } else if (preferencia === 'anterior') {
    // Eligió la configuración anterior (base)
    estado.confirmaciones += 1;
    
    if (estado.confirmaciones >= 2) {
      // Confirmado con valores base
      return confirmarResultadoBinocular(estado.esferaR, estado.esferaL);
    }
    
    // Aún necesita otra confirmación
    // Volver a valores base y mostrar nuevamente
    estado.esferaRActual = estado.esferaR;
    estado.esferaLActual = estado.esferaL;
    estado.faseBinocular = 'mostrando_alternativo';
    return { ok: true, necesitaMostrarLente: true };
    
  } else if (preferencia === 'igual') {
    // Dice que son iguales
    if (estado.confirmaciones === 0) {
      // Primera vez que dice igual, reintentar
      estado.faseBinocular = 'mostrando_alternativo';
      return { ok: true, necesitaMostrarLente: true };
    } else {
      // Ya dijo igual antes, usar valores base (originales)
      return confirmarResultadoBinocular(estado.esferaR, estado.esferaL);
    }
  }
  
  return { ok: true };
}
```

### 7. Crear Función para Confirmar Resultado Binocular

**Archivo:** `motorExamen.js`

**Función nueva:** `confirmarResultadoBinocular()`

```javascript
/**
 * Confirma el resultado final del test binocular
 * @param {number} esferaRFinal - Valor esférico R final confirmado
 * @param {number} esferaLFinal - Valor esférico L final confirmado
 * @returns {object} - Resultado de la confirmación
 */
function confirmarResultadoBinocular(esferaRFinal, esferaLFinal) {
  const resultados = estadoExamen.secuenciaExamen.resultados;
  
  // Guardar resultados
  resultados.R.binocular = esferaRFinal;
  resultados.L.binocular = esferaLFinal;
  
  console.log(`✅ Resultado binocular confirmado:`, {
    esferaR: esferaRFinal,
    esferaL: esferaLFinal
  });
  
  // Resetear estado binocular
  estadoExamen.binocularEstado = {
    esferaR: null,
    esferaL: null,
    esferaRActual: null,
    esferaLActual: null,
    esferaRAnterior: null,
    esferaLAnterior: null,
    esferaRConfirmada: null,
    esferaLConfirmada: null,
    confirmaciones: 0,
    faseBinocular: null,
    letraActual: null,
    logmarActual: null,
    opcionActual: null,
    valoresProbados: {
      subirR: false,
      bajarL: false
    }
  };
  
  // Avanzar al siguiente test (debería ser FINALIZADO)
  const siguienteTest = avanzarTest();
  
  return {
    ok: true,
    resultadoConfirmado: true,
    esferaRFinal,
    esferaLFinal,
    siguienteTest
  };
}
```

### 8. Modificar generarPasos()

**Archivo:** `motorExamen.js`

**Función:** `generarPasos()`

**Cambio:** Agregar case para ETAPA_6

```javascript
export function generarPasos() {
  console.log(`🔧 Generando pasos para etapa: ${estadoExamen.etapa}`);
  
  switch (estadoExamen.etapa) {
    case 'INICIO':
      return generarPasosInicio();
    
    case 'ETAPA_1':
      return generarPasosEtapa1();
    
    case 'ETAPA_2':
      return generarPasosEtapa2();
    
    case 'ETAPA_3':
      return generarPasosEtapa3();
    
    case 'ETAPA_4':
      return generarPasosEtapa4();
    
    case 'ETAPA_5':
      return generarPasosEtapa5();
    
    case 'ETAPA_6':  // Nueva etapa
      return generarPasosEtapa6();
    
    default:
      return {
        ok: false,
        error: `Etapa ${estadoExamen.etapa} no implementada aún`
      };
  }
}
```

### 9. Modificar obtenerInstrucciones()

**Archivo:** `motorExamen.js`

**Función:** `obtenerInstrucciones()`

**Cambio:** Agregar procesamiento para ETAPA_6

```javascript
// En obtenerInstrucciones(), agregar después del bloque de ETAPA_5:

// Si estamos en ETAPA_6 y hay interpretación de comparación, procesarla
if (estadoExamen.etapa === 'ETAPA_6' && interpretacionComparacion) {
  const resultado = procesarRespuestaBinocular(respuestaPaciente, interpretacionComparacion);
  
  if (!resultado.ok) {
    return {
      ok: false,
      error: resultado.error || 'Error procesando respuesta binocular'
    };
  }
  
  // Si se confirmó el resultado, generar pasos del siguiente test (FINALIZADO)
  if (resultado.resultadoConfirmado) {
    const pasos = generarPasos();
    
    await ejecutarPasosAutomaticamente(pasos.pasos || []);
    
    const pasosParaAgente = (pasos.pasos || []).filter(p => p.tipo === 'hablar');
    
    return {
      ok: true,
      pasos: pasosParaAgente,
      contexto: pasos.contexto || {
        etapa: estadoExamen.etapa,
        testActual: estadoExamen.secuenciaExamen.testActual
      }
    };
  }
  
  // Si necesita mostrar otro lente, generar pasos
  if (resultado.necesitaMostrarLente) {
    const pasos = generarPasosEtapa6();
    
    await ejecutarPasosAutomaticamente(pasos.pasos || []);
    
    const pasosParaAgente = (pasos.pasos || []).filter(p => p.tipo === 'hablar');
    
    return {
      ok: true,
      pasos: pasosParaAgente,
      contexto: pasos.contexto || {
        etapa: estadoExamen.etapa,
        testActual: estadoExamen.secuenciaExamen.testActual
      }
    };
  }
}
```

### 10. Modificar mapearTipoTestAResultado()

**Archivo:** `motorExamen.js`

**Función:** `mapearTipoTestAResultado()`

**Cambio:** Manejar tipo binocular (retornar null porque se guarda diferente)

```javascript
function mapearTipoTestAResultado(tipo) {
  const mapa = {
    'agudeza_inicial': 'agudezaInicial',
    'esferico_grueso': 'esfericoGrueso',
    'esferico_fino': 'esfericoFino',
    'cilindrico': 'cilindrico',
    'cilindrico_angulo': 'cilindricoAngulo',
    'agudeza_alcanzada': 'agudezaAlcanzada'
    // 'binocular': null  // No se mapea porque se guarda diferente (R y L separados)
  };
  return mapa[tipo] || null;
}
```

### 11. Modificar obtenerEstadoTest()

**Archivo:** `motorExamen.js`

**Función:** `obtenerEstadoTest()`

**Cambio:** Manejar tipo binocular

```javascript
function obtenerEstadoTest(indice, tipo, ojo) {
  const indiceActual = estadoExamen.secuenciaExamen.indiceActual;
  
  // Manejo especial para binocular
  if (tipo === 'binocular') {
    const resultados = estadoExamen.secuenciaExamen.resultados;
    const resultadoR = resultados.R?.binocular;
    const resultadoL = resultados.L?.binocular;
    
    if (resultadoR !== null && resultadoR !== undefined && 
        resultadoL !== null && resultadoL !== undefined) {
      return 'completado';
    } else if (indice === indiceActual) {
      return 'en_curso';
    } else {
      return 'pendiente';
    }
  }
  
  // Lógica normal para otros tests
  const campoResultado = mapearTipoTestAResultado(tipo);
  const resultado = campoResultado ? estadoExamen.secuenciaExamen.resultados[ojo]?.[campoResultado] : null;
  
  if (resultado !== null && resultado !== undefined) {
    return 'completado';
  } else if (indice === indiceActual) {
    return 'en_curso';
  } else {
    return 'pendiente';
  }
}
```

### 12. Modificar obtenerResultadoTest()

**Archivo:** `motorExamen.js`

**Función:** `obtenerResultadoTest()`

**Cambio:** Manejar tipo binocular (retornar objeto con R y L)

```javascript
function obtenerResultadoTest(tipo, ojo) {
  // Manejo especial para binocular
  if (tipo === 'binocular') {
    const resultados = estadoExamen.secuenciaExamen.resultados;
    return {
      resultadoR: resultados.R?.binocular ?? null,
      resultadoL: resultados.L?.binocular ?? null
    };
  }
  
  // Lógica normal para otros tests
  const campoResultado = mapearTipoTestAResultado(tipo);
  if (!campoResultado) return null;
  
  return estadoExamen.secuenciaExamen.resultados[ojo]?.[campoResultado] ?? null;
}
```

### 13. Modificar obtenerDetalleExamen()

**Archivo:** `motorExamen.js`

**Función:** `obtenerDetalleExamen()`

**Cambio:** Modificar mapeo de tests para incluir resultadoR y resultadoL en binocular

```javascript
// En obtenerDetalleExamen(), modificar el mapeo de tests:

const tests = (secuenciaExamen.testsActivos || []).map((test, indice) => {
  const estado = obtenerEstadoTest(indice, test.tipo, test.ojo);
  const resultado = obtenerResultadoTest(test.tipo, test.ojo);
  
  // Manejo especial para binocular
  if (test.tipo === 'binocular') {
    return {
      indice,
      tipo: test.tipo,
      ojo: test.ojo,
      estado,
      resultadoR: resultado?.resultadoR ?? null,
      resultadoL: resultado?.resultadoL ?? null
    };
  }
  
  // Lógica normal para otros tests
  return {
    indice,
    tipo: test.tipo,
    ojo: test.ojo,
    estado,
    resultado
  };
});
```

### 14. Actualizar Función calcularValoresFinalesForoptero()

**Archivo:** `motorExamen.js`

**Nota:** Esta función ya existe y se usa para `agudeza_alcanzada`. Puede reutilizarse para obtener cilindro y ángulo en binocular.

**No requiere cambios**, solo se usa para obtener cilindro y ángulo.

### 15. Agregar Helper para Calcular Valores Finales (Reutilizable)

**Archivo:** `motorExamen.js`

**Función nueva (opcional):** `obtenerValoresFinalesForoptero()`

Ya existe `calcularValoresFinalesForoptero()`, pero se puede crear una versión que también incluya esfera si se necesita.

---

## 🧪 Casos de Prueba

### Caso 1: Valores con diferencia grande
- **R:** +0.75, **L:** +1.50
- **Esperado:** Probar subir R a +1.00 o bajar L a +1.25

### Caso 2: Valores muy cercanos
- **R:** +0.75, **L:** +0.75
- **Esperado:** Confirmar valores base directamente

### Caso 3: Valores invertidos
- **R:** +1.50, **L:** +0.75
- **Esperado:** Probar subir L a +1.00 o bajar R a +1.25

### Caso 4: Confirmación doble
- **Escenario:** Paciente elige "actual" dos veces
- **Esperado:** Confirmar valores alternativos después de 2 confirmaciones

---

## 📝 Checklist de Implementación

- [ ] 1. Agregar `binocularEstado` al estado del examen
- [ ] 2. Agregar `binocular` a resultados.R y resultados.L
- [ ] 3. Actualizar `inicializarExamen()` para inicializar nuevos campos
- [ ] 4. Descomentar test binocular en `generarSecuenciaExamen()`
- [ ] 5. Agregar mapeo `'binocular': 'ETAPA_6'` en `mapearTipoTestAEtapa()`
- [ ] 6. Crear función `iniciarBinocular()`
- [ ] 7. Crear función `generarPasosEtapa6()`
- [ ] 8. Crear función `procesarRespuestaBinocular()`
- [ ] 9. Crear función `confirmarResultadoBinocular()`
- [ ] 10. Agregar case `ETAPA_6` en `generarPasos()`
- [ ] 11. Agregar procesamiento ETAPA_6 en `obtenerInstrucciones()`
- [ ] 12. Modificar `obtenerEstadoTest()` para manejar binocular
- [ ] 13. Modificar `obtenerResultadoTest()` para manejar binocular
- [ ] 14. Modificar `obtenerDetalleExamen()` para incluir resultadoR y resultadoL
- [ ] 15. Probar flujo completo con diferentes valores
- [ ] 16. Verificar que API `/api/examen/detalle` retorna formato correcto

---

## 🚨 Consideraciones Importantes

1. **Interpretación del Agente:** El agente debe interpretar respuestas de comparación (igual que en ETAPA_5) y enviar `interpretacionComparacion` con preferencia.

2. **Mensajes al Paciente:** Los mensajes deben ser claros sobre que se está haciendo un ajuste final de confort con ambos ojos.

3. **Límites de Valores:** Validar que los valores ajustados no excedan los límites del foróptero (típicamente -6.00 a +6.00).

4. **Edge Cases:**
   - ¿Qué pasa si la diferencia es exactamente 0.25?
   - ¿Qué pasa si al subir/bajar se excede el límite?
   - ¿Qué pasa si ambos valores son iguales desde el inicio?

5. **Reset de Estado:** Asegurar que `binocularEstado` se resetee correctamente después de confirmar.

6. **Integración con FINALIZADO:** Verificar que después de confirmar binocular, el examen pase correctamente a FINALIZADO.

---

## 📚 Referencias

- Función similar: `procesarRespuestaComparacionLentes()` (línea 2521)
- Función similar: `confirmarResultado()` (línea 2685)
- Función similar: `generarPasosEtapa5()` (línea 2323)
- Estado similar: `comparacionActual` (línea 70)

---

## 🔄 Cambios Requeridos en Chat Agent (Frontend)

### Archivo: `src/app/agentConfigs/chatSupervisor/index.ts`

**Análisis:** El test binocular (ETAPA_6) es similar a los tests de comparación de lentes (ETAPA_5), por lo que el agente debe usar `interpretacionComparacion` para procesar las respuestas del paciente.

**Cambios necesarios:**

#### 1. Actualizar Flujo de Trabajo (líneas 24-36)

**Cambio:** Agregar ETAPA_6 al flujo de trabajo

```typescript
6. Cuando el paciente responda:
   - **Si estás en test de agudeza visual (ETAPA_4):** Interpreta la respuesta y llama \`obtenerEtapa(respuestaPaciente, interpretacionAgudeza)\` con la interpretación estructurada
   - **Si estás en test de comparación de lentes (ETAPA_5) o test binocular (ETAPA_6):** Interpreta la preferencia y llama \`obtenerEtapa(respuestaPaciente, null, interpretacionComparacion)\` con la interpretación estructurada
   - **Si no estás en agudeza ni comparación:** Llama \`obtenerEtapa(respuestaPaciente)\` con su respuesta
```

#### 2. Actualizar Sección de Interpretación de Comparación (líneas 52-62)

**Cambio:** Incluir ETAPA_6 en la descripción

```typescript
# Interpretación de Respuestas de Comparación de Lentes

Cuando estás en un test de comparación de lentes (el backend te indica que estás en ETAPA_5) o en test binocular (ETAPA_6), debes interpretar la preferencia del paciente y enviar un formato estructurado:

Formato de interpretación:
- Si el paciente prefiere el lente anterior (ej: "Con el anterior", "El otro", "El primero") → preferencia: "anterior"
- Si el paciente prefiere el lente actual (ej: "Con este", "Este", "El actual") → preferencia: "actual"
- Si el paciente dice que son iguales (ej: "Iguales", "No hay diferencia", "Lo mismo") → preferencia: "igual"

Ejemplo de llamada:
obtenerEtapa con respuestaPaciente: "Con el anterior" e interpretacionComparacion: { preferencia: "anterior" }
```

#### 3. Actualizar Descripción de la Tool `obtenerEtapa` (línea 85)

**Cambio:** Incluir ETAPA_6 en la descripción

```typescript
description: 'Devuelve instrucciones para la etapa actual del examen. Si el paciente acaba de responder, incluye la respuesta en respuestaPaciente. Si estás en test de agudeza visual (ETAPA_4), también incluye interpretacionAgudeza. Si estás en test de comparación de lentes (ETAPA_5) o test binocular (ETAPA_6), también incluye interpretacionComparacion con la interpretación estructurada de la preferencia.',
```

#### 4. Actualizar Descripción de `interpretacionComparacion` (línea 116)

**Cambio:** Incluir ETAPA_6 en la descripción

```typescript
description: 'Interpretación estructurada de la respuesta del paciente en test de comparación de lentes o test binocular. Solo incluir si estás en ETAPA_5 o ETAPA_6 y el paciente acaba de responder sobre su preferencia de lentes.',
```

---

**Resumen de cambios en Chat Agent:**

1. ✅ **Flujo de trabajo:** Agregar ETAPA_6 junto con ETAPA_5 para usar `interpretacionComparacion`
2. ✅ **Sección de interpretación:** Mencionar ETAPA_6 junto con ETAPA_5
3. ✅ **Descripción de tool:** Incluir ETAPA_6 en la descripción de `obtenerEtapa`
4. ✅ **Descripción de parámetro:** Incluir ETAPA_6 en la descripción de `interpretacionComparacion`

**Nota importante:** El test binocular usa la misma lógica de interpretación que los tests de comparación de lentes (ETAPA_5), por lo que no requiere cambios adicionales en la lógica del agente. Solo se necesita actualizar las referencias para incluir ETAPA_6.

---

**Última actualización:** 2025-01-27  
**Estado:** Plan completo listo para implementación (incluye cambios en Chat Agent)

