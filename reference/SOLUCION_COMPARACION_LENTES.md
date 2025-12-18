# Solución: Secuencia de Comparación de Lentes (FASE 4)

## 🎯 Problema

Necesitamos implementar la siguiente secuencia para los tests de lentes:

```
ComandoForoptero (lente1) 
  → Tiempo de ajuste de lente 
  → Lente 1 listo 
  → Tiempo de paciente para ver la letra 
  → ComandoForoptero (lente2) 
  → Tiempo de ajuste de lente 
  → Lente 2 listo 
  → Tiempo de paciente para ver la letra 
  → Mensaje "Ves mejor con este lente o con el anterior" 
  → Respuesta del paciente 
  → Interpretar respuesta 
  → LOOP (si es necesario)
```

## 💡 Solución Propuesta

### ⚠️ IMPORTANTE: Consideración del Estado del Foróptero

**El foróptero publica su estado vía MQTT:**
- `status: "ready"` → Lente está en posición, listo para usar
- `status: "busy"` → Lente está ajustándose físicamente
- `status: "offline"` → Dispositivo no responde

**Tiene MUCHO sentido esperar a que el foróptero esté "ready" antes de:**
1. Mostrar la letra en la TV (el lente debe estar físicamente en posición)
2. Continuar con el siguiente paso de la secuencia

**Ventajas:**
- ✅ Garantiza precisión: el paciente ve la letra con el lente correcto en posición
- ✅ Evita confusión: no muestra letra mientras el lente se está moviendo
- ✅ Mejora la experiencia: secuencia más fluida y profesional

### 1. Extender Estado de Comparación

Agregar un campo `faseComparacion` al estado `comparacionActual` para rastrear en qué punto de la secuencia estamos:

```javascript
comparacionActual: {
  tipo: null,              // 'esferico_grueso', 'esferico_fino', etc.
  ojo: null,              // 'R' | 'L'
  valorBase: null,        // Valor base del test (ej: +0.75)
  
  // Navegación adaptativa (SECUENCIA NATURAL)
  valorActual: null,      // Valor que está mostrándose actualmente (ej: +1.25)
  valorAnterior: null,    // Último valor mostrado antes del actual (ej: +0.75)
  valorConfirmado: null,  // Valor que se está confirmando (ej: +0.75)
  confirmaciones: 0,      // Número de confirmaciones (0, 1, 2)
  direccion: null,        // 'subiendo' | 'bajando' | null
  
  // Estado de la secuencia
  faseComparacion: null,  // 'iniciando' | 'mostrando_alternativo' | 'preguntando' | 'confirmando' | 'navegando'
  letraActual: null,      // Letra que se está mostrando en la TV
  logmarActual: null,     // LogMAR de la letra actual
  
  // Saltos y valores pre-calculados (para estrategia de 3 valores)
  saltoActual: null,      // Salto actual (ej: 0.50 para esférico grueso, 0.25 para fino)
  valorMas: null,         // Valor base + salto (ej: +1.25 si base es +0.75)
  valorMenos: null,       // Valor base - salto (ej: +0.25 si base es +0.75)
  valoresProbados: {      // Rastrear qué valores ya probamos
    mas: false,           // ¿Ya probamos +salto?
    menos: false,         // ¿Ya probamos -salto?
    base: false          // ¿Ya confirmamos base?
  }
}
```

### 2. Flujo de Estados (State Machine) - SECUENCIA NATURAL

**⚠️ ACTUALIZACIÓN:** Basado en secuencia natural descrita, cambiamos de comparación binaria a **navegación adaptativa**.

```
┌─────────────────┐
│   INICIANDO     │ → Valor base (ej: +0.75) en foróptero
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ MOSTRANDO_ALT   │ → Mensaje introductorio
│                 │ → Foróptero(valor alternativo, ej: +1.25) 
│                 │ → esperar_foroptero → TV(letra) → esperar(3s)
└────────┬────────┘
         │
         ↓ (automático después de esperar)
┌─────────────────┐
│ PREGUNTANDO     │ → "Ves mejor con este o con el anterior?"
└────────┬────────┘
         │
         ↓ (respuesta del paciente)
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌─────────┐
│ANTERIOR│ │ ACTUAL  │
└────┬────┘ └────┬────┘
     │          │
     │          ↓
     │    ┌──────────────┐
     │    │ NAVEGAR ARRIBA│ → Probar valor más alto
     │    └──────┬───────┘
     │           │
     ↓           │
┌──────────────┐ │
│ NAVEGAR ABAJO│ │ → Probar valor más bajo
└──────┬───────┘ │
       │         │
       └────┬────┘
            │
            ↓
    ┌───────────────┐
    │ VALIDAR VALOR │ → Primera confirmación
    └───────┬───────┘
            │
            ↓ (mostrar valor opuesto para confirmar)
    ┌───────────────┐
    │ CONFIRMANDO  │ → Mostrar valor opuesto → Preguntar
    └───────┬───────┘
            │
            ↓ (si 2 confirmaciones iguales)
    ┌───────────────┐
    │   CONFIRMADO  │ → Guardar resultado → Avanzar test
    └───────────────┘
```

**Ejemplo de Secuencia Natural:**
1. Valor base: +0.75 → Mensaje introductorio
2. Mostrar alternativo: +1.25 → "Ves mejor con este o con el anterior?"
3. Respuesta: "anterior" → Validar +0.75 (1ra confirmación) → Navegar abajo
4. Mostrar alternativo: +0.25 → "Ves mejor con este o con el anterior?"
5. Respuesta: "con este" → Validar +0.25 (1ra confirmación) → Navegar arriba
6. Mostrar alternativo: +0.75 → "Ves mejor con este o con el anterior?"
7. Respuesta: "con el anterior" → Validar +0.25 (2da confirmación) → CONFIRMADO

### 3. Funciones para Manejo del Estado del Foróptero

#### 3.1. Función `esperarForopteroReady()` (NUEVA)

```javascript
/**
 * Espera a que el foróptero esté en estado "ready"
 * @param {number} timeoutMs - Tiempo máximo de espera en milisegundos (default: 10000 = 10s)
 * @param {number} intervaloMs - Intervalo de verificación en milisegundos (default: 200)
 * @returns {Promise<object>} - { ok: boolean, status: string, tiempoEsperado: number }
 */
async function esperarForopteroReady(timeoutMs = 10000, intervaloMs = 200) {
  // Importar función para obtener estado (desde server.js)
  // Necesitamos acceso a ultimoEstado desde server.js
  
  const inicio = Date.now();
  let intentos = 0;
  const maxIntentos = Math.ceil(timeoutMs / intervaloMs);
  
  while (intentos < maxIntentos) {
    // Obtener estado actual del foróptero
    // Nota: Necesitamos acceso a ultimoEstado desde server.js
    // Opción 1: Exportar función obtenerEstadoForoptero() desde server.js
    // Opción 2: Pasar estado como parámetro
    const estado = obtenerEstadoForoptero(); // Función a implementar en server.js
    
    if (estado.status === 'ready') {
      const tiempoEsperado = Date.now() - inicio;
      console.log(`✅ Foróptero listo después de ${tiempoEsperado}ms`);
      return {
        ok: true,
        status: 'ready',
        tiempoEsperado
      };
    }
    
    if (estado.status === 'offline') {
      console.warn('⚠️ Foróptero está offline');
      return {
        ok: false,
        status: 'offline',
        error: 'Foróptero no responde'
      };
    }
    
    // Esperar antes de verificar de nuevo
    await new Promise(resolve => setTimeout(resolve, intervaloMs));
    intentos++;
  }
  
  // Timeout alcanzado
  const tiempoEsperado = Date.now() - inicio;
  console.warn(`⚠️ Timeout esperando foróptero (${tiempoEsperado}ms)`);
  return {
    ok: false,
    status: 'timeout',
    tiempoEsperado,
    error: `Foróptero no está ready después de ${timeoutMs}ms`
  };
}
```

**Nota:** Esta función necesita acceso al estado del foróptero. Opciones:

**Opción A (Recomendada):** Exportar función desde `server.js`:
```javascript
// En server.js
export function obtenerEstadoForoptero() {
  return { ...ultimoEstado };
}
```

**Opción B:** Pasar estado como parámetro desde `ejecutarPasosAutomaticamente()`

#### 3.2. Modificar `ejecutarComandoForopteroInterno()` para Esperar Ready

```javascript
// En server.js - Modificar función existente
export async function ejecutarComandoForopteroInterno(config) {
  return new Promise(async (resolve) => {
    const { R, L } = config;
    
    // Validar que al menos uno tenga configuración
    if (!R && !L) {
      resolve({ 
        ok: false, 
        error: 'Debe incluir al menos R o L' 
      });
      return;
    }
    
    // Construir comando con token interno
    const comando = {
      accion: 'movimiento',
      ...(R && { R }),
      ...(L && { L }),
      token: TOKEN_ESPERADO,
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    // Publicar comando MQTT
    mqttClient.publish(MQTT_TOPIC_CMD, JSON.stringify(comando));
    console.log("📤 [INTERNO] Comando MQTT → foróptero:", comando);
    
    // Esperar a que el foróptero esté "ready"
    // Nota: El foróptero primero pasa a "busy" cuando recibe el comando,
    // luego vuelve a "ready" cuando termina de ajustarse
    const resultadoEspera = await esperarForopteroReady(10000, 200);
    
    if (!resultadoEspera.ok) {
      // Si hay error (timeout u offline), retornar pero continuar
      console.warn('⚠️ No se pudo confirmar que el foróptero esté ready:', resultadoEspera.error);
      // Continuar de todas formas (el comando se envió)
    }
    
    resolve({ 
      ok: true, 
      status: resultadoEspera.status || 'sent',
      tiempoEsperado: resultadoEspera.tiempoEsperado || 0,
      timestamp: comando.timestamp 
    });
  });
}
```

**Alternativa más simple (sin esperar en ejecutarComandoForopteroInterno):**

Mantener `ejecutarComandoForopteroInterno()` como está (solo envía comando), y agregar un paso especial `"esperar_foroptero"` que se ejecute después de comandos de foróptero:

```javascript
// En motorExamen.js - Modificar ejecutarPasosAutomaticamente()
async function ejecutarPasosAutomaticamente(pasos) {
  // ... código existente ...
  
  for (const paso of pasosAEjecutar) {
    try {
      if (paso.tipo === 'foroptero') {
        // ... enviar comando ...
        
        // DESPUÉS de enviar comando, esperar a que esté ready
        const resultadoEspera = await esperarForopteroReady(10000, 200);
        
        if (!resultadoEspera.ok) {
          console.warn('⚠️ Foróptero no está ready después de enviar comando');
          // Continuar de todas formas
        }
        
      } else if (paso.tipo === 'esperar_foroptero') {
        // Paso explícito para esperar foróptero
        const resultadoEspera = await esperarForopteroReady(
          paso.timeoutMs || 10000, 
          paso.intervaloMs || 200
        );
        
        if (!resultadoEspera.ok) {
          console.warn('⚠️ Timeout esperando foróptero:', resultadoEspera.error);
        }
        
        ejecutados.push({ tipo: 'esperar_foroptero', resultado: resultadoEspera });
        
      } else if (paso.tipo === 'tv') {
        // IMPORTANTE: Solo mostrar TV si el foróptero está ready
        const estado = obtenerEstadoForoptero();
        
        if (estado.status !== 'ready') {
          console.warn('⚠️ Foróptero no está ready, esperando antes de mostrar TV...');
          const resultadoEspera = await esperarForopteroReady(5000, 200);
          
          if (!resultadoEspera.ok) {
            console.warn('⚠️ Mostrando TV de todas formas (foróptero puede estar ajustándose)');
          }
        }
        
        // ... ejecutar comando TV ...
      }
    } catch (error) {
      // ... manejo de errores ...
    }
  }
}
```

### 4. Implementación Detallada

#### 4.1. Función `iniciarComparacionLentes()` - ACTUALIZADA PARA SECUENCIA NATURAL

```javascript
function iniciarComparacionLentes(tipo, ojo, valorBase) {
  const comparacion = estadoExamen.comparacionActual;
  const salto = obtenerSaltosPorTipo(tipo);
  
  // Inicializar estado de navegación adaptativa
  comparacion.tipo = tipo;
  comparacion.ojo = ojo;
  comparacion.valorBase = valorBase;
  comparacion.valorActual = valorBase;  // Empezar con valor base en foróptero
  comparacion.valorAnterior = null;
  comparacion.valorConfirmado = null;
  comparacion.confirmaciones = 0;
  comparacion.direccion = null;
  comparacion.saltoActual = salto;
  comparacion.faseComparacion = 'iniciando';
  
  // Generar letra inicial (usar logMAR 0.4 como en agudeza)
  comparacion.letraActual = generarLetraSloan([]);
  comparacion.logmarActual = 0.4;
  
  console.log(`🔍 Iniciando comparación ${tipo} para ${ojo}:`, {
    valorBase,
    saltoActual: salto
  });
}
```

#### 3.2. Función `generarPasosEtapa5()`

```javascript
function generarPasosEtapa5() {
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // Validar que estamos en test de lentes
  if (!testActual || !testActual.tipo.startsWith('esferico_') && 
      testActual.tipo !== 'cilindrico' && testActual.tipo !== 'cilindrico_angulo') {
    return {
      ok: false,
      error: 'No estamos en test de lentes'
    };
  }
  
  const comparacion = estadoExamen.comparacionActual;
  const ojo = testActual.ojo;
  
  // Si no hay comparación iniciada, iniciarla
  if (comparacion.faseComparacion === null || comparacion.faseComparacion === 'iniciando') {
    // Obtener valor base según tipo
    const valorBase = obtenerValorBaseTest(testActual.tipo, ojo);
    
    if (valorBase === null) {
      return {
        ok: false,
        error: `No se puede obtener valor base para test ${testActual.tipo}`
      };
    }
    
    iniciarComparacionLentes(testActual.tipo, ojo, valorBase);
  }
  
  // Generar pasos según fase actual
  switch (comparacion.faseComparacion) {
    case 'iniciando':
      // Primera vez: mostrar lente1
      comparacion.faseComparacion = 'mostrando_lente1';
      comparacion.lenteActual = 'lente1';
      
      return generarPasosMostrarLente(comparacion.lente1, ojo);
    
    case 'mostrando_lente1':
      // Ya mostramos lente1, ahora mostrar lente2
      comparacion.faseComparacion = 'mostrando_lente2';
      comparacion.lenteActual = 'lente2';
      
      return generarPasosMostrarLente(comparacion.lente2, ojo);
    
    case 'mostrando_lente2':
      // Ya mostramos ambos lentes, preguntar preferencia
      comparacion.faseComparacion = 'preguntando_preferencia';
      
      return {
        ok: true,
        pasos: [
          {
            tipo: 'hablar',
            orden: 1,
            mensaje: 'Ves mejor con este lente o con el anterior?'
          }
        ]
      };
    
    case 'preguntando_preferencia':
      // Ya preguntamos, esperando respuesta (no generar pasos nuevos)
      return {
        ok: true,
        pasos: []
      };
    
    case 'confirmando':
      // Mostrando lente opuesto para confirmar
      const lenteOpuesto = comparacion.primeraEleccion === 'lente1' ? 'lente2' : 'lente1';
      comparacion.lenteActual = lenteOpuesto;
      
      return generarPasosMostrarLente(
        lenteOpuesto === 'lente1' ? comparacion.lente1 : comparacion.lente2,
        ojo
      );
    
    default:
      return {
        ok: false,
        error: `Fase de comparación desconocida: ${comparacion.faseComparacion}`
      };
  }
}

/**
 * Genera pasos para mostrar un lente específico
 * IMPORTANTE: Incluye espera del estado del foróptero
 */
function generarPasosMostrarLente(valorLente, ojo) {
  const comparacion = estadoExamen.comparacionActual;
  const tipo = comparacion.tipo;
  
  // Construir configuración del foróptero
  const configForoptero = construirConfigForoptero(tipo, ojo, valorLente);
  
  // Generar nueva letra si es necesario
  if (!comparacion.letraActual) {
    comparacion.letraActual = generarLetraSloan([]);
    comparacion.logmarActual = 0.4;
  }
  
  return {
    ok: true,
    pasos: [
      {
        tipo: 'foroptero',
        orden: 1,
        foroptero: configForoptero
      },
      {
        tipo: 'esperar_foroptero',  // NUEVO: Espera a que foróptero esté "ready"
        orden: 2,
        timeoutMs: 10000,  // Máximo 10 segundos
        intervaloMs: 200   // Verificar cada 200ms
      },
      {
        tipo: 'tv',
        orden: 3,
        letra: comparacion.letraActual,
        logmar: comparacion.logmarActual
      },
      {
        tipo: 'esperar',
        orden: 4,
        esperarSegundos: 3  // Tiempo para que el paciente vea la letra
      }
    ]
  };
}
```

#### 3.3. Función `procesarRespuestaComparacionLentes()`

```javascript
function procesarRespuestaComparacionLentes(respuestaPaciente, interpretacionComparacion) {
  const comparacion = estadoExamen.comparacionActual;
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // Validar que estamos en test de lentes
  if (!testActual || comparacion.tipo === null) {
    return { ok: false, error: 'No estamos en test de lentes' };
  }
  
  // Interpretar respuesta del paciente
  const preferencia = interpretarPreferenciaLente(respuestaPaciente, interpretacionComparacion);
  
  console.log(`📊 Procesando respuesta comparación (${comparacion.tipo}):`, {
    respuestaPaciente,
    preferencia,
    faseActual: comparacion.faseComparacion,
    lenteActual: comparacion.lenteActual,
    primeraEleccion: comparacion.primeraEleccion,
    segundaEleccion: comparacion.segundaEleccion
  });
  
  // Procesar según fase actual
  if (comparacion.faseComparacion === 'preguntando_preferencia') {
    // Primera pregunta de preferencia
    if (preferencia === 'igual') {
      // Si dice "igual", aumentar separación y repetir
      return aumentarSeparacionYRepetir();
    } else if (preferencia === 'lente1' || preferencia === 'lente2') {
      // Guardar primera elección
      comparacion.primeraEleccion = preferencia;
      
      // Cambiar a fase de confirmación: mostrar el otro lente
      comparacion.faseComparacion = 'confirmando';
      
      // Generar pasos para mostrar lente opuesto
      const lenteOpuesto = preferencia === 'lente1' ? 'lente2' : 'lente1';
      comparacion.lenteActual = lenteOpuesto;
      
      return {
        ok: true,
        necesitaMostrarLente: true,
        lente: lenteOpuesto
      };
    } else {
      // Respuesta no clara, pedir clarificación
      return {
        ok: true,
        pasos: [
          {
            tipo: 'hablar',
            orden: 1,
            mensaje: 'No entendí bien. Decime si ves mejor con este lente o con el anterior.'
          }
        ]
      };
    }
  } else if (comparacion.faseComparacion === 'confirmando') {
    // Segunda pregunta (confirmación)
    if (preferencia === 'igual') {
      // Si dice "igual" en confirmación, usar la primera elección
      preferencia = comparacion.primeraEleccion;
    }
    
    if (preferencia === comparacion.primeraEleccion) {
      // Dos elecciones iguales → confirmar resultado
      comparacion.segundaEleccion = preferencia;
      
      // Calcular valor final
      const valorFinal = preferencia === 'lente1' 
        ? comparacion.lente1 
        : comparacion.lente2;
      
      // Guardar resultado
      const campoResultado = mapearTipoTestAResultado(comparacion.tipo);
      estadoExamen.secuenciaExamen.resultados[comparacion.ojo][campoResultado] = valorFinal;
      
      console.log(`✅ Comparación confirmada para ${comparacion.tipo} (${comparacion.ojo}):`, valorFinal);
      
      // Resetear estado de comparación
      comparacion.tipo = null;
      comparacion.ojo = null;
      comparacion.lente1 = null;
      comparacion.lente2 = null;
      comparacion.valorBase = null;
      comparacion.faseComparacion = null;
      comparacion.lenteActual = null;
      comparacion.primeraEleccion = null;
      comparacion.segundaEleccion = null;
      comparacion.letraActual = null;
      comparacion.logmarActual = null;
      
      // Avanzar al siguiente test
      const siguienteTest = avanzarTest();
      
      return {
        ok: true,
        resultadoConfirmado: true,
        valorFinal,
        siguienteTest
      };
    } else {
      // Elecciones diferentes, volver a preguntar desde el principio
      comparacion.primeraEleccion = null;
      comparacion.segundaEleccion = null;
      comparacion.faseComparacion = 'mostrando_lente1';
      comparacion.lenteActual = 'lente1';
      
      return {
        ok: true,
        necesitaRepetir: true
      };
    }
  }
  
  return { ok: true };
}
```

#### 3.4. Función `interpretarPreferenciaLente()`

```javascript
function interpretarPreferenciaLente(respuestaPaciente, interpretacionComparacion) {
  // Si hay interpretación estructurada del agente, usarla
  if (interpretacionComparacion?.preferencia) {
    return interpretacionComparacion.preferencia;
  }
  
  // Interpretación simple basada en texto
  const texto = respuestaPaciente.toLowerCase().trim();
  
  // Preferencia por lente actual (el que se está mostrando)
  if (texto.includes('este') || texto.includes('esta') || 
      texto.includes('mejor esta') || texto.includes('con esta')) {
    return estadoExamen.comparacionActual.lenteActual === 'lente1' 
      ? 'lente1' 
      : 'lente2';
  }
  
  // Preferencia por lente anterior/otro
  if (texto.includes('anterior') || texto.includes('otro') || 
      texto.includes('otra') || texto.includes('la otra')) {
    return estadoExamen.comparacionActual.lenteActual === 'lente1' 
      ? 'lente2' 
      : 'lente1';
  }
  
  // Sin preferencia
  if (texto.includes('igual') || texto.includes('iguales') || 
      texto.includes('no hay diferencia') || texto.includes('mismo')) {
    return 'igual';
  }
  
  // No se pudo interpretar
  return null;
}
```

### 4. Integración con `obtenerInstrucciones()`

```javascript
export async function obtenerInstrucciones(respuestaPaciente = null, interpretacionAgudeza = null, interpretacionComparacion = null) {
  // ... código existente para ETAPA_4 ...
  
  // Si estamos en ETAPA_5 y hay respuesta, procesarla
  if (estadoExamen.etapa === 'ETAPA_5' && respuestaPaciente) {
    const resultado = procesarRespuestaComparacionLentes(respuestaPaciente, interpretacionComparacion);
    
    if (!resultado.ok) {
      return {
        ok: false,
        error: resultado.error || 'Error procesando respuesta de comparación'
      };
    }
    
    // Si se confirmó el resultado, generar pasos del siguiente test
    if (resultado.resultadoConfirmado) {
      const pasos = generarPasos();
      await ejecutarPasosAutomaticamente(pasos.pasos || []);
      const pasosParaAgente = (pasos.pasos || []).filter(p => p.tipo === 'hablar');
      
      return {
        ok: true,
        pasos: pasosParaAgente,
        contexto: pasos.contexto
      };
    }
    
    // Si necesita mostrar lente o repetir, generar pasos
    if (resultado.necesitaMostrarLente || resultado.necesitaRepetir) {
      const pasos = generarPasosEtapa5();
      await ejecutarPasosAutomaticamente(pasos.pasos || []);
      const pasosParaAgente = (pasos.pasos || []).filter(p => p.tipo === 'hablar');
      
      return {
        ok: true,
        pasos: pasosParaAgente,
        contexto: pasos.contexto
      };
    }
    
    // Si hay pasos de error (ej: clarificación), retornarlos
    if (resultado.pasos) {
      await ejecutarPasosAutomaticamente(resultado.pasos);
      const pasosParaAgente = resultado.pasos.filter(p => p.tipo === 'hablar');
      
      return {
        ok: true,
        pasos: pasosParaAgente,
        contexto: {
          etapa: estadoExamen.etapa,
          testActual: estadoExamen.secuenciaExamen.testActual
        }
      };
    }
  }
  
  // ... resto del código existente ...
  
  // Agregar case 'ETAPA_5' en generarPasos()
  switch (estadoExamen.etapa) {
    // ... casos existentes ...
    case 'ETAPA_5':
      return generarPasosEtapa5();
    // ...
  }
}
```

### 5. Funciones Auxiliares

```javascript
/**
 * Obtiene saltos según tipo de test
 */
function obtenerSaltosPorTipo(tipo) {
  const saltos = {
    'esferico_grueso': 0.50,
    'esferico_fino': 0.25,
    'cilindrico': 0.50,
    'cilindrico_angulo': 15  // grados
  };
  return saltos[tipo] || 0.50;
}

/**
 * Obtiene valor base según tipo de test
 */
function obtenerValorBaseTest(tipo, ojo) {
  const valores = estadoExamen.valoresRecalculados[ojo];
  const resultados = estadoExamen.secuenciaExamen.resultados[ojo];
  
  switch (tipo) {
    case 'esferico_grueso':
      return valores.esfera;
    case 'esferico_fino':
      // Usar resultado de esférico grueso si existe, sino valor recalculado
      return resultados.esfericoGrueso !== null 
        ? resultados.esfericoGrueso 
        : valores.esfera;
    case 'cilindrico':
      return valores.cilindro;
    case 'cilindrico_angulo':
      return valores.angulo;
    default:
      return null;
  }
}

/**
 * Construye configuración del foróptero para un lente específico
 */
function construirConfigForoptero(tipo, ojo, valorLente) {
  const valores = { ...estadoExamen.valoresRecalculados[ojo] };
  const resultados = estadoExamen.secuenciaExamen.resultados[ojo];
  
  // Construir valores finales del foróptero
  const config = {
    [ojo]: {
      occlusion: ojo === estadoExamen.ojoActual ? 'open' : 'close'
    }
  };
  
  // Aplicar valor del lente según tipo
  if (tipo === 'esferico_grueso' || tipo === 'esferico_fino') {
    config[ojo].esfera = valorLente;
    config[ojo].cilindro = valores.cilindro;
    config[ojo].angulo = valores.angulo;
  } else if (tipo === 'cilindrico') {
    config[ojo].esfera = resultados.esfericoFino !== null 
      ? resultados.esfericoFino 
      : (resultados.esfericoGrueso !== null ? resultados.esfericoGrueso : valores.esfera);
    config[ojo].cilindro = valorLente;
    config[ojo].angulo = valores.angulo;
  } else if (tipo === 'cilindrico_angulo') {
    config[ojo].esfera = resultados.esfericoFino !== null 
      ? resultados.esfericoFino 
      : (resultados.esfericoGrueso !== null ? resultados.esfericoGrueso : valores.esfera);
    config[ojo].cilindro = resultados.cilindrico !== null 
      ? resultados.cilindrico 
      : valores.cilindro;
    config[ojo].angulo = valorLente;
  }
  
  // Configurar ojo opuesto
  const ojoOpuesto = ojo === 'R' ? 'L' : 'R';
  config[ojoOpuesto] = {
    occlusion: 'close'
  };
  
  return config;
}

/**
 * Aumenta separación de valores y repite comparación
 */
function aumentarSeparacionYRepetir() {
  const comparacion = estadoExamen.comparacionActual;
  const tipo = comparacion.tipo;
  const valorBase = comparacion.valorBase;
  
  // Aumentar saltos
  const saltosOriginales = obtenerSaltosPorTipo(tipo);
  const nuevosSaltos = saltosOriginales * 1.5; // Aumentar 50%
  
  // Recalcular lente1 y lente2
  if (tipo === 'esferico_grueso' || tipo === 'esferico_fino') {
    comparacion.lente1 = valorBase + nuevosSaltos;
    comparacion.lente2 = valorBase - nuevosSaltos;
  } else if (tipo === 'cilindrico') {
    comparacion.lente1 = valorBase + nuevosSaltos;
    comparacion.lente2 = valorBase - nuevosSaltos;
  } else if (tipo === 'cilindrico_angulo') {
    comparacion.lente1 = (valorBase + nuevosSaltos) % 180;
    comparacion.lente2 = (valorBase - nuevosSaltos + 180) % 180;
  }
  
  // Reiniciar fase
  comparacion.faseComparacion = 'mostrando_lente1';
  comparacion.lenteActual = 'lente1';
  comparacion.primeraEleccion = null;
  comparacion.segundaEleccion = null;
  
  return {
    ok: true,
    necesitaRepetir: true
  };
}
```

## 📋 Resumen de Cambios

1. **Estado extendido**: Agregar `faseComparacion`, `lenteActual`, `letraActual`, `logmarActual` a `comparacionActual`

2. **Nuevas funciones para estado del foróptero**:
   - `obtenerEstadoForoptero()` - Exportar desde server.js para obtener estado actual
   - `esperarForopteroReady()` - Espera a que foróptero esté "ready" con timeout
   - Modificar `ejecutarPasosAutomaticamente()` - Agregar soporte para paso `"esperar_foroptero"`
   - Modificar `ejecutarComandoTVInterno()` - Verificar estado antes de mostrar TV

3. **Nuevas funciones para comparación de lentes**:
   - `iniciarComparacionLentes()` - Inicia la comparación
   - `generarPasosEtapa5()` - Genera pasos según fase actual
   - `procesarRespuestaComparacionLentes()` - Procesa respuestas del paciente
   - `interpretarPreferenciaLente()` - Interpreta preferencia del paciente
   - `generarPasosMostrarLente()` - Genera pasos para mostrar un lente (con espera de foróptero)
   - Funciones auxiliares varias

4. **Integración**: 
   - Agregar case 'ETAPA_5' en `generarPasos()` y `procesarRespuesta()`
   - Agregar paso `"esperar_foroptero"` en secuencia de pasos

5. **Agente**: Agregar interpretación estructurada para comparaciones (similar a agudeza)

## ✅ Ventajas de esta Solución

1. **Secuencia clara**: Cada fase tiene un propósito específico
2. **Automático**: El backend ejecuta comandos automáticamente
3. **Preciso**: Espera confirmación del foróptero antes de mostrar letras
4. **Robusto**: Maneja timeouts y estados offline del foróptero
5. **Flexible**: Maneja casos edge (respuestas "igual", elecciones diferentes)
6. **Consistente**: Usa el mismo patrón que agudeza visual
7. **Testeable**: Cada función es testeable independientemente

## ⚙️ Consideraciones Técnicas

### Manejo de Timeouts

**Escenario:** El foróptero no responde o tarda más de 10 segundos.

**Estrategia:**
- Si timeout → Continuar de todas formas (el comando se envió)
- Log warning para debugging
- El paciente puede ver la letra aunque el foróptero aún se esté ajustando (mejor que bloquear)

### Verificación de Estado Antes de TV

**Escenario:** Mostrar letra en TV.

**Estrategia:**
- Verificar estado del foróptero antes de mostrar TV
- Si no está "ready" → Esperar hasta 5 segundos adicionales
- Si aún no está ready → Mostrar de todas formas (no bloquear)

### Sincronización MQTT

**Nota:** El estado del foróptero se actualiza vía MQTT. Hay un pequeño delay entre:
1. Enviar comando MQTT
2. Foróptero recibe comando y cambia a "busy"
3. Foróptero termina ajuste y cambia a "ready"
4. Backend recibe actualización vía MQTT

**Tiempos típicos:**
- Delay MQTT: ~100-500ms
- Ajuste físico del foróptero: 1-5 segundos (depende del movimiento)
- Total esperado: 1-6 segundos

**Timeout recomendado:** 10 segundos (margen de seguridad)

## ⚠️ REGLAS ESPECÍFICAS POR TIPO DE TEST

### Esférico Grueso
- **Saltos**: ±0.50 (fijo, nunca más)
- **Estrategia**: Testear valor base vs +0.50 y -0.50
- **Límite crítico**: No más de ±0.50 para no marear al paciente
- **Consideración**: Volver al valor base a mitad de test para confirmar

### Esférico Fino
- **Saltos**: ±0.25 (más precisos)
- **Valor base**: Resultado de esférico grueso (no valor recalculado)
- **Estrategia**: Testear valor base vs +0.25 y -0.25

### Cilíndrico
- **Saltos**: ±0.50 (similar a esférico grueso)
- **Valores**: Negativos (ej: -1.75, probar -1.25 y -2.25)

### Cilíndrico Ángulo
- **Saltos**: ±15° (grados)
- **Estrategia**: Navegación por grados

**Ver documento completo:** `reference/ALGORITMO_REGLAS_TESTS.md`

## 🚀 Próximos Pasos

1. **Actualizar estado**: Agregar `valorMas`, `valorMenos`, `valoresProbados` para estrategia de 3 valores
2. **Implementar algoritmo específico por tipo**: 
   - Esférico grueso/fino: estrategia de 3 valores (base, +salto, -salto)
   - Cilíndrico: similar pero con valores negativos
   - Cilíndrico ángulo: navegación por grados
3. **Límite de saltos**: Nunca más de 0.50 (o 0.25 para fino)
4. **Manejar confirmaciones**: 2 confirmaciones del mismo valor = resultado final
5. **Volver a base**: Siempre volver al valor base a mitad de test para no marear
6. **Validar límites**: Evitar valores fuera de rango válido
7. **Mensajes**: Adaptar mensajes según fase (iniciando, navegando, confirmando)
6. **Implementar funciones en `motorExamen.js`**:
   - `iniciarComparacionLentes()` - Actualizada para navegación adaptativa
   - `generarPasosEtapa5()` - Actualizada para secuencia natural
   - `procesarRespuestaComparacionLentes()` - Actualizada para navegación bidireccional
   - `generarPasosMostrarAlternativo()` - Nueva función para mostrar valor alternativo
7. **Agregar interpretación estructurada en el agente** (similar a agudeza)
8. **Probar flujo completo** con secuencia natural
9. **Refinar mensajes y tiempos de espera** según feedback

## 📝 Resumen de Cambios vs Propuesta Original

| Aspecto | Propuesta Original | Secuencia Natural (Actualizada) |
|---------|-------------------|--------------------------------|
| **Tipo** | Comparación binaria fija | Navegación adaptativa |
| **Valores** | Pre-calculados (lente1, lente2) | Calculados dinámicamente |
| **Confirmación** | 2 elecciones entre lente1/lente2 | 2 confirmaciones del mismo valor |
| **Navegación** | Fija (solo entre 2 valores) | Bidireccional (subir/bajar) |
| **Estado** | `lente1`, `lente2`, `lenteActual` | `valorActual`, `valorAnterior`, `valorConfirmado`, `direccion` |
| **Ventaja** | Simple | Más intuitiva y precisa |

## ✅ Recomendaciones Finales

1. **Implementar secuencia natural**: Es más intuitiva y sigue el flujo real de un examen
2. **Mantener espera de foróptero**: Crítico para precisión
3. **Validar límites**: Evitar valores fuera de rango válido
4. **Mensajes claros**: "Ves mejor con este o con el anterior?" es más natural que comparar con nombres fijos
5. **Testing exhaustivo**: Probar todos los casos (subir, bajar, confirmar, cambiar dirección)

