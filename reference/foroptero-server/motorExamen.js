/**
 * MOTOR DE EXAMEN VISUAL
 * 
 * State Machine que maneja toda la lógica del examen visual.
 * El agente solo ejecuta pasos, el backend decide TODO.
 * 
 * FASE 1: El backend ejecuta comandos automáticamente (foróptero, TV)
 * y solo retorna pasos de tipo "hablar" al agente.
 */

// Importar funciones de ejecución interna desde server.js
// Nota: Estas funciones se importarán dinámicamente para evitar dependencia circular
let ejecutarComandoForopteroInterno = null;
let ejecutarComandoTVInterno = null;
let obtenerEstadoForoptero = null;

/**
 * Inicializa las funciones de ejecución interna
 * Se debe llamar desde server.js después de crear las funciones
 */
export function inicializarEjecutores(foropteroFn, tvFn, estadoForopteroFn) {
  ejecutarComandoForopteroInterno = foropteroFn;
  ejecutarComandoTVInterno = tvFn;
  obtenerEstadoForoptero = estadoForopteroFn;
  console.log('✅ Ejecutores internos inicializados');
}

// Estado global del examen (en memoria para MVP)
let estadoExamen = {
  // Identificación
  sessionId: null,
  
  // Etapa actual
  etapa: 'INICIO', // 'INICIO' | 'ETAPA_1' | 'ETAPA_2' | 'ETAPA_3' | 'ETAPA_4' | 'ETAPA_5' | 'FINALIZADO'
  subEtapa: null,
  
  // Datos del examen
  valoresIniciales: {
    R: { esfera: null, cilindro: null, angulo: null },
    L: { esfera: null, cilindro: null, angulo: null }
  },
  valoresRecalculados: {
    R: { esfera: null, cilindro: null, angulo: null },
    L: { esfera: null, cilindro: null, angulo: null }
  },
  
  // Progreso por ojo
  ojoActual: 'R',
  
  // Agudeza visual
  agudezaVisual: {
    R: { logmar: null, letra: null, confirmado: false },
    L: { logmar: null, letra: null, confirmado: false }
  },
  
  // Tests de lentes
  lentes: {
    R: {
      esfericoGrueso: { valor: null, confirmado: false },
      esfericoFino: { valor: null, confirmado: false },
      cilindrico: { valor: null, confirmado: false }
    },
    L: {
      esfericoGrueso: { valor: null, confirmado: false },
      esfericoFino: { valor: null, confirmado: false },
      cilindrico: { valor: null, confirmado: false }
    }
  },
  
  // Estado de comparación (para tests de lentes) - Estrategia de 3 valores
  comparacionActual: {
    tipo: null,              // 'esferico_grueso', 'esferico_fino', etc.
    ojo: null,              // 'R' | 'L'
    valorBase: null,        // Valor base del test (ej: +0.75)
    
    // Navegación adaptativa
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
  },
  
  // Estado de agudeza (para navegación logMAR)
  agudezaEstado: {
    ojo: null,
    logmarActual: null,
    letraActual: null,
    mejorLogmar: null,
    ultimoLogmarCorrecto: null,
    letrasUsadas: [],
    intentos: 0,
    confirmaciones: 0
  },
  
  // Respuesta pendiente del paciente (para procesamiento)
  respuestaPendiente: null,
  
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
  },
  
  // Timestamps
  iniciado: null,
  finalizado: null
};

/**
 * Inicializa el examen (resetea todo el estado)
 */
export function inicializarExamen() {
  estadoExamen = {
    sessionId: null,
    etapa: 'INICIO',
    subEtapa: null,
    valoresIniciales: {
      R: { esfera: null, cilindro: null, angulo: null },
      L: { esfera: null, cilindro: null, angulo: null }
    },
    valoresRecalculados: {
      R: { esfera: null, cilindro: null, angulo: null },
      L: { esfera: null, cilindro: null, angulo: null }
    },
    ojoActual: 'R',
    agudezaVisual: {
      R: { logmar: null, letra: null, confirmado: false },
      L: { logmar: null, letra: null, confirmado: false }
    },
    lentes: {
      R: {
        esfericoGrueso: { valor: null, confirmado: false },
        esfericoFino: { valor: null, confirmado: false },
        cilindrico: { valor: null, confirmado: false }
      },
      L: {
        esfericoGrueso: { valor: null, confirmado: false },
        esfericoFino: { valor: null, confirmado: false },
        cilindrico: { valor: null, confirmado: false }
      }
    },
    comparacionActual: {
      tipo: null,
      ojo: null,
      valorBase: null,
      valorActual: null,
      valorAnterior: null,
      valorConfirmado: null,
      confirmaciones: 0,
      direccion: null,
      faseComparacion: null,
      letraActual: null,
      logmarActual: null,
      saltoActual: null,
      valorMas: null,
      valorMenos: null,
      valoresProbados: {
        mas: false,
        menos: false,
        base: false
      }
    },
    agudezaEstado: {
      ojo: null,
      logmarActual: null,
      letraActual: null,
      mejorLogmar: null,
      ultimoLogmarCorrecto: null,
      letrasUsadas: [],
      intentos: 0,
      confirmaciones: 0
    },
    respuestaPendiente: null,
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
    },
    iniciado: Date.now(),
    finalizado: null
  };
  
  console.log('✅ Examen inicializado');
  return estadoExamen;
}

/**
 * Valida y parsea los valores iniciales del autorefractómetro
 * Formato esperado: "<R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0"
 */
export function validarValoresIniciales(texto) {
  if (!texto || typeof texto !== 'string') {
    return { valido: false, error: 'El texto está vacío o no es válido' };
  }
  
  // Limpiar el texto
  const textoLimpio = texto.trim();
  
  // Patrón regex para validar formato
  // Formato: <R> esfera, cilindro, angulo / <L> esfera, cilindro, angulo
  const patron = /<R>\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*,\s*(\d+)\s*\/\s*<L>\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*,\s*(\d+)/i;
  
  const match = textoLimpio.match(patron);
  
  if (!match) {
    return { 
      valido: false, 
      error: 'Formato incorrecto. Ejemplo: <R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0' 
    };
  }
  
  // Extraer valores
  const valores = {
    R: {
      esfera: parseFloat(match[1]),
      cilindro: parseFloat(match[2]),
      angulo: parseInt(match[3])
    },
    L: {
      esfera: parseFloat(match[4]),
      cilindro: parseFloat(match[5]),
      angulo: parseInt(match[6])
    }
  };
  
  // Validar rangos
  if (valores.R.angulo < 0 || valores.R.angulo > 180) {
    return { valido: false, error: 'El ángulo del ojo derecho debe estar entre 0 y 180' };
  }
  
  if (valores.L.angulo < 0 || valores.L.angulo > 180) {
    return { valido: false, error: 'El ángulo del ojo izquierdo debe estar entre 0 y 180' };
  }
  
  return { valido: true, valores };
}

/**
 * Procesa una respuesta del paciente según la etapa actual
 */
export function procesarRespuesta(respuestaPaciente) {
  if (!respuestaPaciente || typeof respuestaPaciente !== 'string') {
    return { ok: false, error: 'Respuesta inválida' };
  }
  
  console.log(`📥 Procesando respuesta en etapa ${estadoExamen.etapa}:`, respuestaPaciente);
  
  switch (estadoExamen.etapa) {
    case 'ETAPA_1':
      return procesarRespuestaEtapa1(respuestaPaciente);
    
    case 'ETAPA_2':
      // Etapa 2 es silenciosa, no procesa respuestas del paciente
      // El recálculo se hace automáticamente en generarPasos()
      return { ok: true };
    
    case 'ETAPA_3':
      // Etapa 3: después de configurar el foróptero, cualquier respuesta del paciente
      // significa que está listo, pasar a ETAPA_4
      if (estadoExamen.subEtapa === 'FOROPTERO_CONFIGURADO') {
        estadoExamen.etapa = 'ETAPA_4';
        estadoExamen.ojoActual = estadoExamen.secuenciaExamen.testActual?.ojo || 'R';
        estadoExamen.subEtapa = null;
        console.log('✅ Foróptero configurado, pasando a ETAPA_4');
      }
      return { ok: true };
    
    case 'ETAPA_4':
      // ETAPA_4 se procesa directamente en obtenerInstrucciones() con interpretacionAgudeza
      // Este case no se debería ejecutar, pero por seguridad retornamos ok
      return { ok: true };
    
    case 'ETAPA_5':
      // ETAPA_5 se procesa directamente en obtenerInstrucciones() con interpretacionComparacion
      // Este case no se debería ejecutar, pero por seguridad retornamos ok
      return { ok: true };
    
    default:
      return { ok: false, error: `Etapa ${estadoExamen.etapa} no implementada aún` };
  }
}

/**
 * Procesa respuesta de la Etapa 1 (recolección de valores)
 */
function procesarRespuestaEtapa1(respuestaPaciente) {
  const validacion = validarValoresIniciales(respuestaPaciente);
  
  if (!validacion.valido) {
    // Generar pasos de error
    return {
      ok: true,
      pasos: [
        {
          tipo: 'hablar',
          orden: 1,
          mensaje: `Los valores no están completos o no tienen el formato correcto. Revisalos por favor. Ejemplo: <R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0`
        }
      ]
    };
  }
  
  // Guardar valores
  estadoExamen.valoresIniciales = validacion.valores;
  estadoExamen.etapa = 'ETAPA_2';
  
  console.log('✅ Valores iniciales guardados:', validacion.valores);
  
  // La Etapa 2 se procesa automáticamente en generarPasos()
  return { ok: true };
}

/**
 * Genera pasos atómicos según la etapa actual
 */
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
    
    default:
      return {
        ok: false,
        error: `Etapa ${estadoExamen.etapa} no implementada aún`
      };
  }
}

/**
 * Genera pasos para INICIO
 */
function generarPasosInicio() {
  estadoExamen.etapa = 'ETAPA_1';
  
  return {
    ok: true,
    pasos: [
      {
        tipo: 'hablar',
        orden: 1,
        mensaje: 'Hola, escribí los valores del autorefractómetro antes de iniciar el test. Ejemplo de formato: <R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0'
      }
    ],
    contexto: {
      etapa: 'ETAPA_1',
      subEtapa: null
    }
  };
}

/**
 * Genera pasos para ETAPA_1
 */
function generarPasosEtapa1() {
  // Si ya hay valores guardados, significa que se validaron correctamente
  // y ya se pasó a ETAPA_2, así que no deberíamos estar aquí
  if (estadoExamen.valoresIniciales.R.esfera !== null) {
    // Ya se procesaron los valores, generar pasos de confirmación breve
    return {
      ok: true,
      pasos: [
        {
          tipo: 'hablar',
          orden: 1,
          mensaje: 'Perfecto, los valores son correctos. Vamos a comenzar.'
        }
      ]
    };
  }
  
  // Si no hay valores, pedirlos de nuevo
  return {
    ok: true,
    pasos: [
      {
        tipo: 'hablar',
        orden: 1,
        mensaje: 'Escribí los valores del autorefractómetro. Ejemplo: <R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0'
      }
    ]
  };
}

/**
 * Aplica las reglas de recálculo cilíndrico según protocolo clínico
 * @param {number} cilindro - Valor cilíndrico original
 * @returns {number} - Valor cilíndrico recalculado
 */
export function aplicarRecalculoCilindrico(cilindro) {
  // Reglas de ajuste:
  // - Cilindro entre -0.50 y -2.00 (inclusive) → sumar +0.50 (menos negativo)
  // - Entre -2.25 y -4.00 (inclusive) → sumar +0.75
  // - Entre -4.25 y -6.00 (inclusive) → sumar +1.50
  // - Si es 0 o -0.25 → mantener igual
  // - Si es menor a -6.00 → no modificar
  
  // NOTA: Para números negativos, "entre X y Y" significa:
  // cilindro <= X (más negativo) && cilindro >= Y (menos negativo)
  // Los valores entre rangos (ej: entre -2.00 y -2.25) se tratan con la regla más cercana
  
  if (cilindro === 0 || cilindro === -0.25) {
    return cilindro; // Mantener igual
  }
  
  if (cilindro < -6.00) {
    return cilindro; // No modificar
  }
  
  // Entre -0.50 y -2.00 (inclusive): cilindro <= -0.50 && cilindro >= -2.00
  if (cilindro <= -0.50 && cilindro >= -2.00) {
    return cilindro + 0.50; // Sumar +0.50
  }
  
  // Entre -2.00 y -2.25 (gap): aplicar regla de -2.25 a -4.00 (más cercana)
  // O mejor: extender el rango -0.50 a -2.00 hasta -2.24 para cubrir el gap
  if (cilindro < -2.00 && cilindro > -2.25) {
    // Valores entre -2.00 y -2.25: aplicar regla de -2.25 (sumar +0.75)
    return cilindro + 0.75;
  }
  
  // Entre -2.25 y -4.00 (inclusive): cilindro <= -2.25 && cilindro >= -4.00
  if (cilindro <= -2.25 && cilindro >= -4.00) {
    return cilindro + 0.75; // Sumar +0.75
  }
  
  // Entre -4.00 y -4.25 (gap): aplicar regla de -4.25 a -6.00 (más cercana)
  if (cilindro < -4.00 && cilindro > -4.25) {
    // Valores entre -4.00 y -4.25: aplicar regla de -4.25 (sumar +1.50)
    return cilindro + 1.50;
  }
  
  // Entre -4.25 y -6.00 (inclusive): cilindro <= -4.25 && cilindro >= -6.00
  if (cilindro <= -4.25 && cilindro >= -6.00) {
    return cilindro + 1.50; // Sumar +1.50
  }
  
  // Para valores fuera de los rangos definidos (ej: entre -0.25 y -0.50), mantener igual
  return cilindro;
}

/**
 * Determina qué tests de cilindro incluir según el valor del cilindro recalculado
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
  } else if (cilindro <= -0.50 && cilindro >= -1.75) {
    // Incluir test de cilindro, pero NO de ángulo
    // Rango: -1.75 a -0.50 (inclusive)
    // Para números negativos: <= -0.50 significa más negativo, >= -1.75 significa menos negativo
    tests.cilindrico = true;
    tests.cilindricoAngulo = false;
  } else if (cilindro <= -2.00 && cilindro >= -6.00) {
    // Incluir ambos tests
    // Rango: -6.00 a -2.00 (inclusive)
    // Para números negativos: <= -2.00 significa más negativo, >= -6.00 significa menos negativo
    tests.cilindrico = true;
    tests.cilindricoAngulo = true;
  }
  
  return tests;
}

/**
 * Genera la secuencia completa del examen basada en valores recalculados
 * @returns {array} - Array de tests activos en orden de ejecución
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

/**
 * Obtiene el test actual que se está ejecutando
 * @returns {object|null} - Test actual o null si no hay
 */
export function obtenerTestActual() {
  return estadoExamen.secuenciaExamen.testActual;
}

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

/**
 * Avanza al siguiente test en la secuencia
 * @returns {object|null} - Nuevo test actual o null si se completó el examen
 */
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
  
  // Actualizar etapa según el tipo de test siguiente
  if (secuencia.testActual) {
    estadoExamen.etapa = mapearTipoTestAEtapa(secuencia.testActual.tipo);
    console.log(`➡️ Avanzando a test: ${secuencia.testActual.tipo} (${secuencia.testActual.ojo}) → Etapa: ${estadoExamen.etapa}`);
  }
  
  return secuencia.testActual;
}

/**
 * Funciones auxiliares para agudeza visual
 */

/**
 * Baja el valor logMAR al siguiente más pequeño
 */
function bajarLogMAR(logmar) {
  const secuencia = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0];
  const indice = secuencia.indexOf(logmar);
  if (indice > 0) {
    return secuencia[indice - 1];
  }
  return logmar; // Ya está en el mínimo
}

/**
 * Sube el valor logMAR al siguiente más grande
 */
function subirLogMAR(logmar) {
  const secuencia = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0];
  const indice = secuencia.indexOf(logmar);
  if (indice < secuencia.length - 1) {
    return secuencia[indice + 1];
  }
  return logmar; // Ya está en el máximo
}

/**
 * Genera una letra Sloan diferente a las usadas
 */
function generarLetraSloan(letrasUsadas) {
  const letrasSloan = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'V', 'Z'];
  const disponibles = letrasSloan.filter(l => !letrasUsadas.includes(l));
  
  if (disponibles.length === 0) {
    // Si se usaron todas, resetear y elegir una diferente a la última
    const ultima = letrasUsadas[letrasUsadas.length - 1];
    const sinUltima = letrasSloan.filter(l => l !== ultima);
    return sinUltima[Math.floor(Math.random() * sinUltima.length)];
  }
  
  return disponibles[Math.floor(Math.random() * disponibles.length)];
}

/**
 * Calcula los valores finales del foróptero para agudeza_alcanzada
 * Combina valores recalculados con resultados de tests de lentes
 * @param {string} ojo - 'R' o 'L'
 * @returns {object} - { esfera, cilindro, angulo }
 */
function calcularValoresFinalesForoptero(ojo) {
  const resultados = estadoExamen.secuenciaExamen.resultados[ojo];
  const valoresRecalculados = estadoExamen.valoresRecalculados[ojo];
  
  // Esfera: Prioridad: esfericoFino > esfericoGrueso > valoresRecalculados
  const esfera = resultados.esfericoFino !== null && resultados.esfericoFino !== undefined
    ? resultados.esfericoFino
    : (resultados.esfericoGrueso !== null && resultados.esfericoGrueso !== undefined
      ? resultados.esfericoGrueso
      : valoresRecalculados.esfera);
  
  // Cilindro: Prioridad: cilindrico > valoresRecalculados
  const cilindro = resultados.cilindrico !== null && resultados.cilindrico !== undefined
    ? resultados.cilindrico
    : valoresRecalculados.cilindro;
  
  // Ángulo: Prioridad: cilindricoAngulo > valoresRecalculados
  const angulo = resultados.cilindricoAngulo !== null && resultados.cilindricoAngulo !== undefined
    ? resultados.cilindricoAngulo
    : valoresRecalculados.angulo;
  
  console.log(`🔧 Valores finales foróptero para ${ojo}:`, { esfera, cilindro, angulo });
  
  return { esfera, cilindro, angulo };
}

/**
 * Procesa respuesta del paciente en test de agudeza visual
 * @param {string} respuestaPaciente - Respuesta del paciente (texto crudo)
 * @param {object} interpretacionAgudeza - Interpretación estructurada del agente
 * @returns {object} - Resultado del procesamiento
 */
function procesarRespuestaAgudeza(respuestaPaciente, interpretacionAgudeza) {
  const estado = estadoExamen.agudezaEstado;
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // Validar que estamos en test de agudeza
  if (!testActual || (testActual.tipo !== 'agudeza_inicial' && testActual.tipo !== 'agudeza_alcanzada')) {
    return { ok: false, error: 'No estamos en test de agudeza' };
  }
  
  const esAgudezaAlcanzada = testActual.tipo === 'agudeza_alcanzada';
  
  // Si es agudeza_alcanzada, usar función específica
  if (esAgudezaAlcanzada) {
    return procesarRespuestaAgudezaAlcanzada(respuestaPaciente, interpretacionAgudeza, estado, testActual.ojo);
  }
  
  const ojo = testActual.ojo;
  const resultado = interpretacionAgudeza?.resultado || 'no_se';
  
  console.log(`📊 Procesando respuesta agudeza (${ojo}):`, {
    respuestaPaciente,
    resultado,
    logmarActual: estado.logmarActual,
    ultimoLogmarCorrecto: estado.ultimoLogmarCorrecto,
    confirmaciones: estado.confirmaciones
  });
  
  // Procesar según interpretación
  if (resultado === 'correcta') {
    // Letra correcta
    // Verificar si es el mismo logMAR que el último correcto (ANTES de actualizar)
    const esMismoLogMAR = estado.logmarActual === estado.ultimoLogmarCorrecto;
    
    // Actualizar último logMAR correcto
    estado.ultimoLogmarCorrecto = estado.logmarActual;
    estado.mejorLogmar = estado.mejorLogmar === null 
      ? estado.logmarActual 
      : Math.min(estado.mejorLogmar, estado.logmarActual);
    
    // Si es el mismo logMAR que el último correcto, incrementar confirmaciones
    if (esMismoLogMAR && estado.ultimoLogmarCorrecto !== null) {
      estado.confirmaciones += 1;
      
      console.log(`✅ Confirmación ${estado.confirmaciones}/2 en logMAR ${estado.logmarActual}`);
      
      // Si hay 2 confirmaciones, resultado confirmado
      if (estado.confirmaciones >= 2) {
        // Guardar resultado
        estadoExamen.agudezaVisual[ojo] = {
          logmar: estado.logmarActual,
          letra: interpretacionAgudeza.letraIdentificada || estado.letraActual,
          confirmado: true
        };
        
        // Guardar en secuencia usando mapeo correcto
        const campoResultado = mapearTipoTestAResultado(testActual.tipo);
        if (campoResultado) {
          estadoExamen.secuenciaExamen.resultados[ojo][campoResultado] = estado.logmarActual;
        } else {
          console.error(`❌ No se pudo mapear tipo de test a resultado: ${testActual.tipo}`);
        }
        
        console.log(`✅ Agudeza confirmada para ${ojo}: logMAR ${estado.logmarActual}`);
        
        // Resetear estado de agudeza para el siguiente test
        resetearEstadoAgudeza(estado);
        
        // Avanzar al siguiente test
        const siguienteTest = avanzarTest();
        
        return { 
          ok: true, 
          resultadoConfirmado: true,
          logmarFinal: estadoExamen.agudezaVisual[ojo].logmar,
          siguienteTest
        };
      }
      
      // Si aún no hay 2 confirmaciones, mostrar otra letra en el mismo logMAR
      const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas.push(nuevaLetra);
      
      // NO bajar logMAR, mantener el mismo para confirmar
      return { ok: true, necesitaNuevaLetra: true };
    } else {
      // Nuevo logMAR o primera respuesta correcta, resetear confirmaciones a 1
      estado.confirmaciones = 1;
      
      // Bajar logMAR (si no está en 0.0)
      if (estado.logmarActual > 0.0) {
        estado.logmarActual = bajarLogMAR(estado.logmarActual);
      }
      
      // Generar nueva letra
      const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas.push(nuevaLetra);
    }
    
  } else {
    // Respuesta incorrecta, borroso, no ve, etc.
    
    if (estado.ultimoLogmarCorrecto !== null) {
      // Volver al último correcto
      estado.logmarActual = estado.ultimoLogmarCorrecto;
      // Resetear confirmaciones porque estamos empezando a confirmar de nuevo este logMAR
      estado.confirmaciones = 0;
      
      // Generar nueva letra
      const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas.push(nuevaLetra);
      
    } else {
      // Primera respuesta, subir logMAR
      estado.logmarActual = subirLogMAR(estado.logmarActual);
      
      // Generar nueva letra
      const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas.push(nuevaLetra);
    }
  }
  
  estado.intentos += 1;
  
  return { ok: true, necesitaNuevaLetra: true };
}

/**
 * Procesa respuesta del paciente en test de agudeza_alcanzada
 * Lógica progresiva: baja desde agudeza_inicial hasta 0.0
 * Similar a agudeza_inicial pero solo bajando (no subiendo)
 * @param {string} respuestaPaciente - Respuesta del paciente
 * @param {object} interpretacionAgudeza - Interpretación estructurada
 * @param {object} estado - Estado de agudeza
 * @param {string} ojo - 'R' o 'L'
 * @returns {object} - Resultado del procesamiento
 */
function procesarRespuestaAgudezaAlcanzada(respuestaPaciente, interpretacionAgudeza, estado, ojo) {
  const resultado = interpretacionAgudeza?.resultado || 'no_se';
  const agudezaInicial = estado.agudezaInicialReferencia;
  
  console.log(`📊 Procesando agudeza_alcanzada (${ojo}):`, {
    agudezaInicial,
    logmarActual: estado.logmarActual,
    ultimoLogmarCorrecto: estado.ultimoLogmarCorrecto,
    confirmaciones: estado.confirmaciones,
    resultado
  });
  
  if (resultado === 'correcta') {
    // Paciente ve correctamente
    const esMismoLogMAR = estado.logmarActual === estado.ultimoLogmarCorrecto;
    
    // Actualizar último logMAR correcto
    estado.ultimoLogmarCorrecto = estado.logmarActual;
    estado.mejorLogmar = estado.mejorLogmar === null 
      ? estado.logmarActual 
      : Math.min(estado.mejorLogmar, estado.logmarActual);
    
    if (esMismoLogMAR && estado.ultimoLogmarCorrecto !== null) {
      // Segunda confirmación en el mismo logMAR
      estado.confirmaciones += 1;
      
      console.log(`✅ Confirmación ${estado.confirmaciones}/2 en logMAR ${estado.logmarActual}`);
      
      if (estado.confirmaciones >= 2) {
        // Confirmado en este logMAR
        // Si ya estamos en 0.0, guardar y terminar
        if (estado.logmarActual === 0.0) {
          const logmarFinal = 0.0;
          
          const campoResultado = mapearTipoTestAResultado('agudeza_alcanzada');
          if (campoResultado) {
            estadoExamen.secuenciaExamen.resultados[ojo][campoResultado] = logmarFinal;
          }
          
          estadoExamen.agudezaVisual[ojo] = {
            logmar: logmarFinal,
            letra: interpretacionAgudeza.letraIdentificada || estado.letraActual,
            confirmado: true
          };
          
          console.log(`✅ Agudeza alcanzada confirmada para ${ojo}: logMAR ${logmarFinal} (mejoró desde ${agudezaInicial})`);
          
          resetearEstadoAgudeza(estado);
          
          const siguienteTest = avanzarTest();
          
          return {
            ok: true,
            resultadoConfirmado: true,
            logmarFinal,
            mejorado: agudezaInicial > logmarFinal,
            agudezaInicial,
            siguienteTest
          };
        }
        
        // No estamos en 0.0, intentar bajar al siguiente logMAR más pequeño
        const siguienteLogMAR = bajarLogMAR(estado.logmarActual);
        
        if (siguienteLogMAR < estado.logmarActual) {
          // Hay un logMAR más pequeño disponible, bajar
          estado.logmarActual = siguienteLogMAR;
          estado.ultimoLogmarCorrecto = null; // Resetear para el nuevo logMAR
          estado.confirmaciones = 0; // Empezar confirmaciones desde 0
          
          const nuevaLetra = generarLetraSloan([]); // Resetear letras usadas
          estado.letraActual = nuevaLetra;
          estado.letrasUsadas = [nuevaLetra];
          
          console.log(`⬇️ Bajando a logMAR ${siguienteLogMAR}`);
          
          return { ok: true, necesitaNuevaLetra: true };
        } else {
          // Ya estamos en el mínimo (0.0) o no podemos bajar más
          // Guardar el resultado actual (esto puede pasar si volvimos al logMAR anterior)
          const logmarFinal = estado.logmarActual;
          
          const campoResultado = mapearTipoTestAResultado('agudeza_alcanzada');
          if (campoResultado) {
            estadoExamen.secuenciaExamen.resultados[ojo][campoResultado] = logmarFinal;
          }
          
          estadoExamen.agudezaVisual[ojo] = {
            logmar: logmarFinal,
            letra: interpretacionAgudeza.letraIdentificada || estado.letraActual,
            confirmado: true
          };
          
          console.log(`✅ Agudeza alcanzada confirmada para ${ojo}: logMAR ${logmarFinal} (${agudezaInicial > logmarFinal ? 'mejoró desde' : agudezaInicial === logmarFinal ? 'igual que' : 'empeoró desde'} ${agudezaInicial})`);
          
          resetearEstadoAgudeza(estado);
          
          const siguienteTest = avanzarTest();
          
          return {
            ok: true,
            resultadoConfirmado: true,
            logmarFinal,
            mejorado: agudezaInicial > logmarFinal,
            agudezaInicial,
            siguienteTest
          };
        }
      }
      
      // Aún no hay 2 confirmaciones, mostrar otra letra en el mismo logMAR
      const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas.push(nuevaLetra);
      
      return { ok: true, necesitaNuevaLetra: true };
      
    } else {
      // Primera confirmación en este logMAR
      estado.confirmaciones = 1;
      
      // Generar nueva letra para segunda confirmación
      const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas.push(nuevaLetra);
      
      return { ok: true, necesitaNuevaLetra: true };
    }
    
  } else {
    // Paciente NO ve correctamente
    // Volver al logMAR anterior (donde sí veía) y confirmar ahí
    
    if (estado.ultimoLogmarCorrecto !== null) {
      // Hay un logMAR anterior donde sí veía
      const logmarAnterior = estado.ultimoLogmarCorrecto;
      estado.logmarActual = logmarAnterior;
      estado.ultimoLogmarCorrecto = null; // Resetear para empezar confirmaciones desde 0
      estado.confirmaciones = 0; // Resetear confirmaciones
      
      const nuevaLetra = generarLetraSloan([]); // Resetear letras usadas
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas = [nuevaLetra];
      
      console.log(`⬇️ No ve en logMAR actual, volviendo a ${logmarAnterior} para confirmar`);
      
      return { ok: true, necesitaNuevaLetra: true };
      
    } else {
      // No hay logMAR anterior (primera respuesta incorrecta)
      // Esto no debería pasar si empezamos desde agudeza_inicial (donde ya veía)
      // Pero por seguridad, volver a agudeza_inicial y confirmar ahí
      estado.logmarActual = agudezaInicial;
      estado.ultimoLogmarCorrecto = null; // Resetear para empezar confirmaciones desde 0
      estado.confirmaciones = 0;
      
      const nuevaLetra = generarLetraSloan([]);
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas = [nuevaLetra];
      
      console.log(`⚠️ Primera respuesta incorrecta, volviendo a agudeza_inicial: ${agudezaInicial}`);
      
      return { ok: true, necesitaNuevaLetra: true };
    }
  }
}

/**
 * Resetea el estado de agudeza para el siguiente test
 * @param {object} estado - Estado de agudeza a resetear
 */
function resetearEstadoAgudeza(estado) {
  estado.ojo = null;
  estado.logmarActual = null;
  estado.letraActual = null;
  estado.mejorLogmar = null;
  estado.ultimoLogmarCorrecto = null;
  estado.letrasUsadas = [];
  estado.intentos = 0;
  estado.confirmaciones = 0;
  estado.esAgudezaAlcanzada = false;
  estado.agudezaInicialReferencia = null;
}

/**
 * Genera pasos para ETAPA_2 (cálculo silencioso)
 * Esta etapa no genera pasos visibles, solo procesa internamente
 */
function generarPasosEtapa2() {
  // Aplicar recálculo cilíndrico a ambos ojos
  const valoresR = { ...estadoExamen.valoresIniciales.R };
  const valoresL = { ...estadoExamen.valoresIniciales.L };
  
  valoresR.cilindro = aplicarRecalculoCilindrico(valoresR.cilindro);
  valoresL.cilindro = aplicarRecalculoCilindrico(valoresL.cilindro);
  
  // Guardar valores recalculados
  estadoExamen.valoresRecalculados = {
    R: valoresR,
    L: valoresL
  };
  
  // Pasar a ETAPA_3
  estadoExamen.etapa = 'ETAPA_3';
  
  console.log('✅ Valores recalculados:');
  console.log('  Iniciales R:', estadoExamen.valoresIniciales.R);
  console.log('  Recalculados R:', estadoExamen.valoresRecalculados.R);
  console.log('  Iniciales L:', estadoExamen.valoresIniciales.L);
  console.log('  Recalculados L:', estadoExamen.valoresRecalculados.L);
  
  // Esta etapa es silenciosa, no genera pasos visibles
  // La transición a ETAPA_3 se hace automáticamente
  // Generar pasos de ETAPA_3 inmediatamente
  return generarPasosEtapa3();
}

/**
 * Genera pasos para ETAPA_4 (test de agudeza visual)
 */
function generarPasosEtapa4() {
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // Validar que estamos en test de agudeza
  if (!testActual || (testActual.tipo !== 'agudeza_inicial' && testActual.tipo !== 'agudeza_alcanzada')) {
    return {
      ok: false,
      error: 'No estamos en test de agudeza visual'
    };
  }
  
  const ojo = testActual.ojo;
  const estado = estadoExamen.agudezaEstado;
  const esAgudezaAlcanzada = testActual.tipo === 'agudeza_alcanzada';
  
  // Inicializar estado de agudeza si es la primera vez
  if (estado.ojo !== ojo || estado.logmarActual === null) {
    estado.ojo = ojo;
    
    if (esAgudezaAlcanzada) {
      // Lógica específica para agudeza_alcanzada
      const agudezaInicial = estadoExamen.secuenciaExamen.resultados[ojo].agudezaInicial;
      
      if (agudezaInicial === null || agudezaInicial === undefined) {
        return {
          ok: false,
          error: `No se encontró agudeza_inicial para ${ojo}. No se puede ejecutar agudeza_alcanzada.`
        };
      }
      
      // Empezar desde agudeza_inicial (no desde agudeza_inicial - 0.1)
      // El algoritmo bajará progresivamente desde aquí hasta 0.0
      estado.logmarActual = agudezaInicial;
      estado.agudezaInicialReferencia = agudezaInicial; // Guardar referencia
      estado.letraActual = 'H';
      estado.mejorLogmar = null;
      estado.ultimoLogmarCorrecto = null;
      estado.letrasUsadas = ['H'];
      estado.intentos = 0;
      estado.confirmaciones = 0;
      estado.esAgudezaAlcanzada = true; // Flag para diferenciar
      
      console.log(`🔍 Iniciando test de agudeza alcanzada para ${ojo}`);
      console.log(`   Agudeza inicial: ${agudezaInicial}, Empezando desde: ${agudezaInicial}`);
      
      // Configurar foróptero con valores finales ANTES de mostrar TV
      const valoresFinales = calcularValoresFinalesForoptero(ojo);
      
      // Generar pasos: Foróptero + Esperar + TV + Hablar
      const pasos = [
        {
          tipo: 'foroptero',
          orden: 1,
          foroptero: {
            [ojo]: {
              esfera: valoresFinales.esfera,
              cilindro: valoresFinales.cilindro,
              angulo: valoresFinales.angulo,
              occlusion: ojo === 'R' ? 'open' : 'close'
            },
            [ojo === 'R' ? 'L' : 'R']: {
              occlusion: ojo === 'R' ? 'close' : 'open'
            }
          }
        },
        {
          tipo: 'esperar_foroptero',
          orden: 2
        },
        {
          tipo: 'tv',
          orden: 3,
          letra: estado.letraActual,
          logmar: estado.logmarActual
        },
        {
          tipo: 'hablar',
          orden: 4,
          mensaje: 'Mirá la pantalla. Decime qué letra ves.'
        }
      ];
      
      return {
        ok: true,
        pasos,
        contexto: {
          etapa: 'ETAPA_4',
          testActual,
          agudezaEstado: {
            logmarActual: estado.logmarActual,
            letraActual: estado.letraActual,
            agudezaInicialReferencia: estado.agudezaInicialReferencia
          }
        }
      };
      
    } else {
      // Lógica original para agudeza_inicial
      estado.logmarActual = 0.4; // Inicio con logMAR 0.4
      estado.letraActual = 'H'; // Primera letra siempre 'H'
      estado.mejorLogmar = null;
      estado.ultimoLogmarCorrecto = null;
      estado.letrasUsadas = ['H'];
      estado.intentos = 0;
      estado.confirmaciones = 0;
      estado.esAgudezaAlcanzada = false;
      
      console.log(`🔍 Iniciando test de agudeza visual inicial para ${ojo}`);
    }
  }
  
  // Si el resultado ya está confirmado, avanzar al siguiente test
  if (estadoExamen.agudezaVisual[ojo]?.confirmado) {
    const siguienteTest = avanzarTest();
    if (siguienteTest) {
      // avanzarTest() ya actualizó la etapa automáticamente
      // Generar pasos de la nueva etapa
      return generarPasos();
    } else {
      // Examen completado (avanzarTest() ya cambió etapa a FINALIZADO)
      return {
        ok: true,
        pasos: [
          {
            tipo: 'hablar',
            orden: 1,
            mensaje: 'Perfecto, hemos completado el examen visual.'
          }
        ]
      };
    }
  }
  
  // Generar pasos: TV + Hablar
  const pasos = [
    {
      tipo: 'tv',
      orden: 1,
      letra: estado.letraActual,
      logmar: estado.logmarActual
    },
    {
      tipo: 'hablar',
      orden: 2,
      mensaje: 'Mirá la pantalla. Decime qué letra ves.'
    }
  ];
  
  return {
    ok: true,
    pasos,
    contexto: {
      etapa: 'ETAPA_4',
      testActual,
      agudezaEstado: {
        logmarActual: estado.logmarActual,
        letraActual: estado.letraActual,
        mejorLogmar: estado.mejorLogmar,
        ultimoLogmarCorrecto: estado.ultimoLogmarCorrecto,
        confirmaciones: estado.confirmaciones
      }
    }
  };
}

/**
 * Genera pasos para ETAPA_3 (preparación del foróptero y definición de secuencia)
 */
function generarPasosEtapa3() {
  // Verificar si ya se generaron los pasos de ETAPA_3
  // Si ya se generaron, no volver a generarlos (evitar loop)
  if (estadoExamen.subEtapa === 'FOROPTERO_CONFIGURADO') {
    // Ya se configuró el foróptero, pasar a ETAPA_4
    estadoExamen.etapa = 'ETAPA_4';
    estadoExamen.ojoActual = estadoExamen.secuenciaExamen.testActual?.ojo || 'R';
    
    // Retornar pasos vacíos para que el agente espere respuesta
    // (ETAPA_4 se implementará en Fase 3)
    return {
      ok: true,
      pasos: [],
      contexto: {
        etapa: 'ETAPA_4',
        testActual: estadoExamen.secuenciaExamen.testActual
      }
    };
  }
  
  // 1. Generar secuencia completa del examen
  const secuencia = generarSecuenciaExamen();
  
  // 2. Guardar secuencia en el estado
  estadoExamen.secuenciaExamen.testsActivos = secuencia;
  estadoExamen.secuenciaExamen.indiceActual = 0;
  estadoExamen.secuenciaExamen.testActual = secuencia[0] || null;
  
  console.log('✅ Secuencia del examen generada:');
  console.log('  Total de tests:', secuencia.length);
  console.log('  Tests activos:', secuencia.map(t => `${t.tipo}(${t.ojo})`).join(', '));
  console.log('  Test actual:', estadoExamen.secuenciaExamen.testActual);
  
  // 3. Usar valores recalculados para configurar el foróptero
  const valoresR = estadoExamen.valoresRecalculados.R;
  const valoresL = estadoExamen.valoresRecalculados.L;
  
  // Configuración inicial:
  // - Ojo derecho (R): valores recalculados, oclusión: "open"
  // - Ojo izquierdo (L): oclusión: "close"
  
  // 4. Marcar que se generaron los pasos (para evitar regenerarlos)
  estadoExamen.subEtapa = 'FOROPTERO_CONFIGURADO';
  
  // 5. Establecer ojo actual según el primer test
  estadoExamen.ojoActual = estadoExamen.secuenciaExamen.testActual?.ojo || 'R';
  
  // 6. Pasar a ETAPA_4 (el primer test se ejecutará en Etapa 4)
  estadoExamen.etapa = 'ETAPA_4';
  
  return {
    ok: true,
    pasos: [
      {
        tipo: 'foroptero',
        orden: 1,
        foroptero: {
          R: {
            esfera: valoresR.esfera,
            cilindro: valoresR.cilindro,
            angulo: valoresR.angulo,
            occlusion: 'open'
          },
          L: {
            occlusion: 'close'
          }
        }
      },
      {
        tipo: 'esperar',
        orden: 2,
        esperarSegundos: 2
      },
      {
        tipo: 'hablar',
        orden: 3,
        mensaje: 'Vamos a empezar con el ojo rerecho, esperemos a que se termine de mover los lentes.'
      }
    ],
    contexto: {
      etapa: 'ETAPA_4',
      testActual: estadoExamen.secuenciaExamen.testActual,
      totalTests: secuencia.length,
      indiceActual: 0
    }
  };
}

/**
 * Ejecuta pasos automáticamente (foróptero, TV, esperar)
 * Solo ejecuta pasos que no son de tipo "hablar"
 * @param {Array} pasos - Array de pasos a ejecutar
 * @returns {Promise<object>} - Resultado de la ejecución
 */
async function ejecutarPasosAutomaticamente(pasos) {
  if (!pasos || pasos.length === 0) {
    return { ok: true, ejecutados: [] };
  }
  
  const pasosAEjecutar = pasos.filter(p => 
    p.tipo === 'foroptero' || p.tipo === 'tv' || p.tipo === 'esperar' || p.tipo === 'esperar_foroptero'
  );
  
  if (pasosAEjecutar.length === 0) {
    return { ok: true, ejecutados: [] };
  }
  
  const ejecutados = [];
  const errores = [];
  
  console.log(`🔧 Ejecutando ${pasosAEjecutar.length} pasos automáticamente...`);
  
  for (const paso of pasosAEjecutar) {
    try {
      if (paso.tipo === 'foroptero') {
        if (!ejecutarComandoForopteroInterno) {
          console.warn('⚠️ ejecutarComandoForopteroInterno no inicializado');
          continue;
        }
        const resultado = await ejecutarComandoForopteroInterno(paso.foroptero);
        ejecutados.push({ tipo: 'foroptero', resultado });
        console.log('✅ Comando foróptero ejecutado:', resultado);
        
        // Esperar un momento después de ejecutar foróptero (para que el dispositivo procese)
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } else if (paso.tipo === 'tv') {
        // Antes de mostrar TV, verificar que el foróptero esté ready
        if (obtenerEstadoForoptero) {
          const estadoForoptero = obtenerEstadoForoptero();
          if (estadoForoptero.status !== 'ready') {
            console.log('⏳ Foróptero no está ready, esperando...');
            await esperarForopteroReady(10000, 200);
          }
        }
        
        if (!ejecutarComandoTVInterno) {
          console.warn('⚠️ ejecutarComandoTVInterno no inicializado');
          continue;
        }
        const resultado = await ejecutarComandoTVInterno({
          letra: paso.letra,
          logmar: paso.logmar
        });
        ejecutados.push({ tipo: 'tv', resultado });
        console.log('✅ Comando TV ejecutado:', resultado);
        
        // Esperar un momento después de ejecutar TV
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } else if (paso.tipo === 'esperar') {
        const segundos = paso.esperarSegundos || 0;
        console.log(`⏳ Esperando ${segundos} segundos...`);
        await new Promise(resolve => setTimeout(resolve, segundos * 1000));
        ejecutados.push({ tipo: 'esperar', segundos });
      } else if (paso.tipo === 'esperar_foroptero') {
        // Esperar a que el foróptero esté "ready"
        console.log('⏳ Esperando a que el foróptero esté ready...');
        const resultado = await esperarForopteroReady(10000, 200);
        ejecutados.push({ tipo: 'esperar_foroptero', resultado });
        console.log('✅ Estado del foróptero:', resultado);
      }
    } catch (error) {
      console.error(`❌ Error ejecutando paso ${paso.tipo}:`, error);
      errores.push({ tipo: paso.tipo, error: error.message });
      // Continuar con el siguiente paso aunque haya error
    }
  }
  
  return {
    ok: errores.length === 0,
    ejecutados,
    errores: errores.length > 0 ? errores : undefined
  };
}

/**
 * Obtiene instrucciones (pasos) para el agente
 * Si hay respuestaPaciente, la procesa primero
 * Ejecuta automáticamente los comandos de dispositivos (foróptero, TV)
 * y solo retorna pasos de tipo "hablar" al agente
 * @param {string|null} respuestaPaciente - Respuesta del paciente
 * @param {object|null} interpretacionAgudeza - Interpretación estructurada del agente (para ETAPA_4)
 */
export async function obtenerInstrucciones(respuestaPaciente = null, interpretacionAgudeza = null, interpretacionComparacion = null) {
  // Si hay respuesta del paciente, procesarla primero
  if (respuestaPaciente) {
    // Si estamos en ETAPA_5 y hay interpretación de comparación, procesarla
    if (estadoExamen.etapa === 'ETAPA_5' && interpretacionComparacion) {
      const resultado = procesarRespuestaComparacionLentes(respuestaPaciente, interpretacionComparacion);
      
      if (!resultado.ok) {
        return {
          ok: false,
          error: resultado.error || 'Error procesando respuesta de comparación'
        };
      }
      
      // Si se confirmó el resultado, generar pasos del siguiente test
      if (resultado.resultadoConfirmado) {
        // Generar pasos del siguiente test
        const pasos = generarPasos();
        
        // Ejecutar pasos automáticamente
        await ejecutarPasosAutomaticamente(pasos.pasos || []);
        
        // Filtrar: solo retornar pasos de tipo "hablar"
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
        const estado = estadoExamen.comparacionActual;
        const testActual = estadoExamen.secuenciaExamen.testActual;
        
        // Usar la función correcta según el tipo de test
        let pasosMostrar;
        if (testActual?.tipo === 'cilindrico') {
          pasosMostrar = generarPasosMostrarLenteCilindrico(
            estado.ojo,
            resultado.valorAMostrar,
            estado.letraActual,
            estado.logmarActual
          );
        } else if (testActual?.tipo === 'cilindrico_angulo') {
          pasosMostrar = generarPasosMostrarLenteCilindricoAngulo(
            estado.ojo,
            resultado.valorAMostrar,
            estado.letraActual,
            estado.logmarActual
          );
        } else {
          pasosMostrar = generarPasosMostrarLente(
            estado.ojo,
            resultado.valorAMostrar,
            estado.letraActual,
            estado.logmarActual
          );
        }
        
        // Actualizar estado
        estado.valorAnterior = estado.valorActual;
        estado.valorActual = resultado.valorAMostrar;
        estado.faseComparacion = 'mostrando_alternativo';
        
        // Ejecutar pasos automáticamente
        await ejecutarPasosAutomaticamente(pasosMostrar);
        
        // Generar pasos de pregunta
        const pasos = generarPasosEtapa5();
        
        // Ejecutar pasos automáticamente (si hay más)
        await ejecutarPasosAutomaticamente(pasos.pasos || []);
        
        // Filtrar: solo retornar pasos de tipo "hablar"
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
    
    // Si estamos en ETAPA_4 y hay interpretación, usar procesarRespuestaAgudeza directamente
    if (estadoExamen.etapa === 'ETAPA_4' && interpretacionAgudeza) {
      const resultado = procesarRespuestaAgudeza(respuestaPaciente, interpretacionAgudeza);
      
      if (!resultado.ok) {
        return {
          ok: false,
          error: resultado.error || 'Error procesando respuesta de agudeza'
        };
      }
      
      // Si se confirmó el resultado, generar pasos del siguiente test
      if (resultado.resultadoConfirmado) {
        // Generar pasos del siguiente test
        const pasos = generarPasos();
        
        // Ejecutar pasos automáticamente
        await ejecutarPasosAutomaticamente(pasos.pasos || []);
        
        // Filtrar: solo retornar pasos de tipo "hablar"
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
      
      // Si necesita nueva letra, generar pasos
      if (resultado.necesitaNuevaLetra) {
        const pasos = generarPasosEtapa4();
        
        // Ejecutar pasos automáticamente
        await ejecutarPasosAutomaticamente(pasos.pasos || []);
        
        // Filtrar: solo retornar pasos de tipo "hablar"
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
    
    // Procesamiento normal para otras etapas
    const resultado = procesarRespuesta(respuestaPaciente);
    
    if (!resultado.ok) {
      return {
        ok: false,
        error: resultado.error || 'Error procesando respuesta'
      };
    }
    
    // Si el procesamiento generó pasos (ej: error de validación), retornarlos
    if (resultado.pasos) {
      // Ejecutar pasos automáticamente (aunque en este caso solo deberían ser "hablar")
      await ejecutarPasosAutomaticamente(resultado.pasos);
      
      // Filtrar: solo retornar pasos de tipo "hablar"
      const pasosParaAgente = resultado.pasos.filter(p => p.tipo === 'hablar');
      
      return {
        ok: true,
        pasos: pasosParaAgente,
        contexto: {
          etapa: estadoExamen.etapa,
          subEtapa: estadoExamen.subEtapa
        }
      };
    }
  }
  
  // Generar pasos según la etapa actual
  const pasos = generarPasos();
  
  if (!pasos.ok) {
    return pasos;
  }
  
  // Si la etapa generó pasos vacíos (como ETAPA_2 silenciosa),
  // generar pasos de la siguiente etapa automáticamente
  if (pasos.pasos && pasos.pasos.length === 0) {
    // La etapa cambió internamente, generar pasos de la nueva etapa
    const nuevosPasos = generarPasos();
    if (nuevosPasos.ok) {
      // Ejecutar pasos automáticamente antes de retornar
      await ejecutarPasosAutomaticamente(nuevosPasos.pasos || []);
      
      // Filtrar: solo retornar pasos de tipo "hablar" al agente
      const pasosParaAgente = (nuevosPasos.pasos || []).filter(p => p.tipo === 'hablar');
      
      return {
        ok: true,
        pasos: pasosParaAgente,
        contexto: nuevosPasos.contexto || {
          etapa: estadoExamen.etapa,
          subEtapa: estadoExamen.subEtapa
        }
      };
    }
  }
  
  // Ejecutar pasos automáticamente (foróptero, TV, esperar)
  await ejecutarPasosAutomaticamente(pasos.pasos || []);
  
  // Filtrar: solo retornar pasos de tipo "hablar" al agente
  const pasosParaAgente = (pasos.pasos || []).filter(p => p.tipo === 'hablar');
  
  return {
    ok: true,
    pasos: pasosParaAgente,
    contexto: pasos.contexto || {
      etapa: estadoExamen.etapa,
      subEtapa: estadoExamen.subEtapa
    }
  };
}

/**
 * Obtiene el estado actual del examen
 */
export function obtenerEstado() {
  return {
    ok: true,
    estado: {
      etapa: estadoExamen.etapa,
      ojoActual: estadoExamen.ojoActual,
      testActual: estadoExamen.secuenciaExamen.testActual,
      totalTests: estadoExamen.secuenciaExamen.testsActivos.length,
      indiceActual: estadoExamen.secuenciaExamen.indiceActual,
      progreso: calcularProgreso(),
      ultimaAccion: obtenerUltimaAccion()
    }
  };
}

/**
 * Calcula el progreso del examen (0-100%)
 */
function calcularProgreso() {
  // Placeholder - se implementará cuando todas las etapas estén listas
  const etapas = ['INICIO', 'ETAPA_1', 'ETAPA_2', 'ETAPA_3', 'ETAPA_4', 'ETAPA_5', 'FINALIZADO'];
  const etapaActual = etapas.indexOf(estadoExamen.etapa);
  return Math.round((etapaActual / (etapas.length - 1)) * 100);
}

/**
 * Obtiene descripción de la última acción
 */
function obtenerUltimaAccion() {
  switch (estadoExamen.etapa) {
    case 'INICIO':
      return 'Iniciando examen';
    case 'ETAPA_1':
      return 'Esperando valores del autorefractómetro';
    case 'ETAPA_2':
      return 'Calculando valores iniciales (silencioso)';
    case 'ETAPA_3':
      return 'Preparando examen visual - ajustando foróptero';
    case 'ETAPA_4':
      return 'Test de agudeza visual';
    case 'ETAPA_5':
      return 'Test de comparación de lentes';
    default:
      return `En etapa ${estadoExamen.etapa}`;
  }
}

/**
 * Mapea el tipo de test a su campo correspondiente en resultados
 */
function mapearTipoTestAResultado(tipo) {
  const mapa = {
    'agudeza_inicial': 'agudezaInicial',
    'esferico_grueso': 'esfericoGrueso',
    'esferico_fino': 'esfericoFino',
    'cilindrico': 'cilindrico',
    'cilindrico_angulo': 'cilindricoAngulo',
    'agudeza_alcanzada': 'agudezaAlcanzada'
  };
  return mapa[tipo] || null;
}

/**
 * Obtiene el estado de un test (pendiente, en_curso, completado)
 */
function obtenerEstadoTest(indice, tipo, ojo) {
  const indiceActual = estadoExamen.secuenciaExamen.indiceActual;
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

/**
 * Obtiene el resultado de un test específico
 */
function obtenerResultadoTest(tipo, ojo) {
  const campoResultado = mapearTipoTestAResultado(tipo);
  if (!campoResultado) return null;
  
  return estadoExamen.secuenciaExamen.resultados[ojo]?.[campoResultado] ?? null;
}

/**
 * Espera a que el foróptero esté en estado "ready"
 * @param {number} timeoutMs - Tiempo máximo de espera en ms (default: 10000)
 * @param {number} intervaloMs - Intervalo de verificación en ms (default: 200)
 * @returns {Promise<object>} - { ok: boolean, status: string, tiempoEsperado: number }
 */
async function esperarForopteroReady(timeoutMs = 10000, intervaloMs = 200) {
  if (!obtenerEstadoForoptero) {
    console.warn('⚠️ obtenerEstadoForoptero no inicializado, continuando...');
    return { ok: true, status: 'unknown', tiempoEsperado: 0 };
  }
  
  const inicio = Date.now();
  const timeout = inicio + timeoutMs;
  
  while (Date.now() < timeout) {
    const estado = obtenerEstadoForoptero();
    
    if (estado.status === 'ready') {
      const tiempoEsperado = Date.now() - inicio;
      console.log(`✅ Foróptero ready después de ${tiempoEsperado}ms`);
      return { ok: true, status: 'ready', tiempoEsperado };
    }
    
    // Esperar antes de verificar de nuevo
    await new Promise(resolve => setTimeout(resolve, intervaloMs));
  }
  
  // Timeout alcanzado
  const tiempoEsperado = Date.now() - inicio;
  const estadoFinal = obtenerEstadoForoptero();
  console.warn(`⚠️ Timeout esperando foróptero (${tiempoEsperado}ms), estado actual: ${estadoFinal.status}, continuando...`);
  return { ok: false, status: estadoFinal.status || 'timeout', tiempoEsperado };
}

/**
 * Inicializa el estado de comparación de lentes para un test específico
 * @param {string} tipo - Tipo de test: 'esferico_grueso', 'esferico_fino', etc.
 * @param {string} ojo - Ojo a testear: 'R' | 'L'
 * @param {number} valorBase - Valor base del test (ej: +0.75)
 * @returns {object} - Resultado de la inicialización
 */
function iniciarComparacionLentes(tipo, ojo, valorBase) {
  // Validar tipo
  if (tipo !== 'esferico_grueso' && tipo !== 'esferico_fino' && tipo !== 'cilindrico' && tipo !== 'cilindrico_angulo') {
    return { ok: false, error: `Tipo de test ${tipo} no implementado aún` };
  }
  
  // Validar límites según tipo
  if (tipo === 'cilindrico') {
    // Cilindro típicamente -6.00 a 0 (solo valores negativos o cero)
    if (valorBase < -6.00 || valorBase > 0) {
      return { ok: false, error: `Valor base de cilindro ${valorBase} fuera de rango válido (-6.00 a 0)` };
    }
  } else if (tipo === 'cilindrico_angulo') {
    // Ángulo típicamente 0 a 180 grados
    if (valorBase < 0 || valorBase > 180) {
      return { ok: false, error: `Valor base de ángulo ${valorBase} fuera de rango válido (0 a 180 grados)` };
    }
  } else {
    // Esfera típicamente -6.00 a +6.00
    if (valorBase < -6.00 || valorBase > 6.00) {
      return { ok: false, error: `Valor base ${valorBase} fuera de rango válido (-6.00 a +6.00)` };
    }
  }
  
  // Calcular valores pre-calculados según tipo
  let saltoActual;
  if (tipo === 'esferico_grueso') {
    saltoActual = 0.50; // Para esférico grueso
  } else if (tipo === 'esferico_fino') {
    saltoActual = 0.25; // Para esférico fino (más preciso)
  } else if (tipo === 'cilindrico') {
    saltoActual = 0.50; // Para cilíndrico
  } else if (tipo === 'cilindrico_angulo') {
    saltoActual = 15; // Para cilíndrico ángulo (en grados)
  }
  
  let valorMas = valorBase + saltoActual;
  let valorMenos = valorBase - saltoActual;
  
  // Validar que los valores calculados no excedan límites según tipo
  if (tipo === 'cilindrico') {
    // Cilindro: -6.00 a 0 (solo negativos o cero)
    if (valorMas > 0) {
      valorMas = 0;
      saltoActual = valorMas - valorBase;
    }
    if (valorMenos < -6.00) {
      valorMenos = -6.00;
      saltoActual = valorBase - valorMenos;
    }
  } else if (tipo === 'cilindrico_angulo') {
    // Ángulo: 0 a 180 grados (circular - wraparound)
    if (valorMas > 180) {
      valorMas = valorMas - 180; // Wraparound: 195° → 15°
    }
    if (valorMenos < 0) {
      valorMenos = valorMenos + 180; // Wraparound: -15° → 165°
    }
  } else {
    // Esfera: -6.00 a +6.00
    if (valorMas > 6.00) {
      valorMas = 6.00;
      saltoActual = valorMas - valorBase;
    }
    if (valorMenos < -6.00) {
      valorMenos = -6.00;
      saltoActual = valorBase - valorMenos;
    }
  }
  
  // Obtener letra y logMAR actuales (del test de agudeza)
  const agudeza = estadoExamen.agudezaVisual[ojo];
  const letraActual = agudeza?.letra || 'H';
  const logmarActual = agudeza?.logmar || 0.4;
  
  // Inicializar estado de comparación
  estadoExamen.comparacionActual = {
    tipo,
    ojo,
    valorBase,
    valorActual: valorBase, // Inicialmente el valor base
    valorAnterior: null,
    valorConfirmado: null,
    confirmaciones: 0,
    direccion: null,
    faseComparacion: 'iniciando',
    letraActual,
    logmarActual,
    saltoActual,
    valorMas,
    valorMenos,
    valoresProbados: {
      mas: false,
      menos: false,
      base: false
    }
  };
  
  console.log(`🔍 Iniciando comparación de lentes (${tipo}, ${ojo}):`, {
    valorBase,
    valorMas,
    valorMenos,
    saltoActual
  });
  
  return { ok: true, comparacionIniciada: true };
}

/**
 * Genera pasos para mostrar un lente específico en el foróptero
 * @param {string} ojo - Ojo a configurar: 'R' | 'L'
 * @param {number} valorEsfera - Valor de esfera a mostrar
 * @param {string} letra - Letra a mostrar en TV
 * @param {number} logmar - LogMAR de la letra
 * @returns {Array} - Array de pasos
 */
function generarPasosMostrarLente(ojo, valorEsfera, letra, logmar) {
  const pasos = [];
  
  // 1. Configurar foróptero con el nuevo valor
  const configForoptero = {
    [ojo]: {
      esfera: valorEsfera,
      // Mantener cilindro y ángulo del valor recalculado
      cilindro: estadoExamen.valoresRecalculados[ojo].cilindro,
      angulo: estadoExamen.valoresRecalculados[ojo].angulo,
      occlusion: 'open'
    },
    // Ojo opuesto cerrado
    [ojo === 'R' ? 'L' : 'R']: {
      occlusion: 'close'
    }
  };
  
  pasos.push({
    tipo: 'foroptero',
    orden: 1,
    foroptero: configForoptero
  });
  
  // 2. Esperar a que el foróptero esté ready
  pasos.push({
    tipo: 'esperar_foroptero',
    orden: 2
  });
  
  // 3. Mostrar letra en TV
  pasos.push({
    tipo: 'tv',
    orden: 3,
    letra,
    logmar
  });
  
  return pasos;
}

/**
 * Genera pasos para mostrar un lente con cilindro específico en el foróptero
 * @param {string} ojo - Ojo a configurar: 'R' | 'L'
 * @param {number} valorCilindro - Valor de cilindro a mostrar
 * @param {string} letra - Letra a mostrar en TV
 * @param {number} logmar - LogMAR de la letra
 * @returns {Array} - Array de pasos
 */
function generarPasosMostrarLenteCilindrico(ojo, valorCilindro, letra, logmar) {
  const pasos = [];
  
  // Obtener valores actuales del foróptero (usar resultados de tests anteriores si existen)
  const esferaFinal = estadoExamen.secuenciaExamen.resultados[ojo].esfericoFino 
    || estadoExamen.secuenciaExamen.resultados[ojo].esfericoGrueso 
    || estadoExamen.valoresRecalculados[ojo].esfera;
  
  // 1. Configurar foróptero con el nuevo valor de cilindro
  const configForoptero = {
    [ojo]: {
      esfera: esferaFinal,
      cilindro: valorCilindro,
      // Mantener ángulo del valor recalculado
      angulo: estadoExamen.valoresRecalculados[ojo].angulo,
      occlusion: 'open'
    },
    // Ojo opuesto cerrado
    [ojo === 'R' ? 'L' : 'R']: {
      occlusion: 'close'
    }
  };
  
  pasos.push({
    tipo: 'foroptero',
    orden: 1,
    foroptero: configForoptero
  });
  
  // 2. Esperar a que el foróptero esté ready
  pasos.push({
    tipo: 'esperar_foroptero',
    orden: 2
  });
  
  // 3. Mostrar letra en TV
  pasos.push({
    tipo: 'tv',
    orden: 3,
    letra,
    logmar
  });
  
  return pasos;
}

/**
 * Genera pasos para mostrar un lente con ángulo cilíndrico específico en el foróptero
 * @param {string} ojo - Ojo a configurar: 'R' | 'L'
 * @param {number} valorAngulo - Valor de ángulo a mostrar (0-180 grados)
 * @param {string} letra - Letra a mostrar en TV
 * @param {number} logmar - LogMAR de la letra
 * @returns {Array} - Array de pasos
 */
function generarPasosMostrarLenteCilindricoAngulo(ojo, valorAngulo, letra, logmar) {
  const pasos = [];
  
  // Obtener valores actuales del foróptero (usar resultados de tests anteriores si existen)
  const esferaFinal = estadoExamen.secuenciaExamen.resultados[ojo].esfericoFino 
    || estadoExamen.secuenciaExamen.resultados[ojo].esfericoGrueso 
    || estadoExamen.valoresRecalculados[ojo].esfera;
  
  // Usar el resultado del test de cilindro si existe, sino el valor recalculado
  const cilindroFinal = estadoExamen.secuenciaExamen.resultados[ojo].cilindrico 
    || estadoExamen.valoresRecalculados[ojo].cilindro;
  
  // 1. Configurar foróptero con el nuevo valor de ángulo
  const configForoptero = {
    [ojo]: {
      esfera: esferaFinal,
      cilindro: cilindroFinal,
      angulo: valorAngulo, // Actualizar ángulo
      occlusion: 'open'
    },
    // Ojo opuesto cerrado
    [ojo === 'R' ? 'L' : 'R']: {
      occlusion: 'close'
    }
  };
  
  pasos.push({
    tipo: 'foroptero',
    orden: 1,
    foroptero: configForoptero
  });
  
  // 2. Esperar a que el foróptero esté ready
  pasos.push({
    tipo: 'esperar_foroptero',
    orden: 2
  });
  
  // 3. Mostrar letra en TV
  pasos.push({
    tipo: 'tv',
    orden: 3,
    letra,
    logmar
  });
  
  return pasos;
}

/**
 * Genera pasos para ETAPA_5 (tests de lentes - esférico grueso, esférico fino, etc.)
 */
function generarPasosEtapa5() {
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // Validar que estamos en test de lentes
  if (!testActual || (testActual.tipo !== 'esferico_grueso' && testActual.tipo !== 'esferico_fino' && testActual.tipo !== 'cilindrico' && testActual.tipo !== 'cilindrico_angulo')) {
    return {
      ok: false,
      error: `No estamos en test de lentes válido. Tipo actual: ${testActual?.tipo}`
    };
  }
  
  const ojo = testActual.ojo;
  const tipo = testActual.tipo;
  const comparacion = estadoExamen.comparacionActual;
  
  // Si no hay comparación iniciada o es un tipo diferente, inicializarla
  if (!comparacion.tipo || comparacion.ojo !== ojo || comparacion.tipo !== tipo) {
    let valorBase;
    
    if (tipo === 'esferico_grueso') {
      // El valor base es el valor recalculado de esfera para este ojo
      valorBase = estadoExamen.valoresRecalculados[ojo].esfera;
    } else if (tipo === 'esferico_fino') {
      // El valor base es el resultado del test de esférico grueso
      const resultadoGrueso = estadoExamen.secuenciaExamen.resultados[ojo].esfericoGrueso;
      if (resultadoGrueso === null || resultadoGrueso === undefined) {
        return {
          ok: false,
          error: 'Debe completarse el test de esférico grueso antes de esférico fino'
        };
      }
      valorBase = resultadoGrueso;
    } else if (tipo === 'cilindrico') {
      // El valor base es el valor recalculado de cilindro para este ojo
      valorBase = estadoExamen.valoresRecalculados[ojo].cilindro;
      // Validar que el cilindro no sea 0 ni -0.25 (no debería estar en la secuencia si es así)
      if (valorBase === 0 || valorBase === -0.25) {
        return {
          ok: false,
          error: 'El test de cilindro no aplica para este ojo (cilindro = 0 o -0.25)'
        };
      }
    } else if (tipo === 'cilindrico_angulo') {
      // El valor base es el valor inicial de ángulo (NO recalculado) para este ojo
      valorBase = estadoExamen.valoresIniciales[ojo].angulo;
      // Validar que el ángulo sea válido (0-180)
      if (valorBase === null || valorBase === undefined || valorBase < 0 || valorBase > 180) {
        return {
          ok: false,
          error: `El test de cilíndrico ángulo requiere un ángulo inicial válido (0-180 grados). Ángulo actual: ${valorBase}`
        };
      }
    } else {
      return {
        ok: false,
        error: `Tipo de test ${tipo} no soportado aún`
      };
    }
    
    const resultado = iniciarComparacionLentes(tipo, ojo, valorBase);
    if (!resultado.ok) {
      return resultado;
    }
  }
  
  const estado = estadoExamen.comparacionActual;
  const pasos = [];
  
  // Generar pasos según la fase de comparación
  if (estado.faseComparacion === 'iniciando') {
    // Fase inicial: mensaje introductorio + mostrar valorMas
    // NOTA: Para esférico fino, cilíndrico y cilíndrico ángulo, no mencionamos que es un test diferente, es parte del flujo continuo
    // Solo mostrar mensaje introductorio en esférico grueso (primera vez)
    let ordenInicial = 1;
    if (tipo === 'esferico_grueso') {
      pasos.push({
        tipo: 'hablar',
        orden: ordenInicial++,
        mensaje: 'Ahora te voy a mostrar otro lente y me vas a decir si ves mejor o peor'
      });
    }
    // Para esférico fino, cilíndrico y cilíndrico ángulo, continuamos directamente sin mensaje adicional (es parte del flujo)
    
    // Generar pasos para mostrar valorMas según el tipo de test
    let pasosMostrar;
    if (tipo === 'cilindrico') {
      pasosMostrar = generarPasosMostrarLenteCilindrico(
        ojo,
        estado.valorMas,
        estado.letraActual,
        estado.logmarActual
      );
    } else if (tipo === 'cilindrico_angulo') {
      pasosMostrar = generarPasosMostrarLenteCilindricoAngulo(
        ojo,
        estado.valorMas,
        estado.letraActual,
        estado.logmarActual
      );
    } else {
      pasosMostrar = generarPasosMostrarLente(
        ojo,
        estado.valorMas,
        estado.letraActual,
        estado.logmarActual
      );
    }
    pasos.push(...pasosMostrar.map((p, i) => ({ ...p, orden: ordenInicial + i })));
    
    // Actualizar estado
    estado.valorActual = estado.valorMas;
    estado.valorAnterior = estado.valorBase;
    estado.valoresProbados.mas = true;
    estado.faseComparacion = 'preguntando';
    
  } else if (estado.faseComparacion === 'mostrando_alternativo') {
    // Ya se mostró un alternativo, preguntar preferencia
    pasos.push({
      tipo: 'hablar',
      orden: 1,
      mensaje: 'Ves mejor con este o con el anterior?'
    });
    
    estado.faseComparacion = 'preguntando';
    
  } else if (estado.faseComparacion === 'preguntando') {
    // Esperando respuesta, no generar pasos
    return {
      ok: true,
      pasos: [],
      contexto: {
        etapa: 'ETAPA_5',
        testActual,
        comparacionEstado: {
          faseComparacion: estado.faseComparacion,
          valorActual: estado.valorActual,
          valorAnterior: estado.valorAnterior,
          confirmaciones: estado.confirmaciones
        }
      }
    };
  }
  
  return {
    ok: true,
    pasos,
    contexto: {
      etapa: 'ETAPA_5',
      testActual,
      comparacionEstado: {
        faseComparacion: estado.faseComparacion,
        valorActual: estado.valorActual,
        valorAnterior: estado.valorAnterior,
        confirmaciones: estado.confirmaciones
      }
    }
  };
}

/**
 * Interpreta la preferencia del paciente sobre los lentes
 * @param {string} respuestaPaciente - Respuesta del paciente (texto crudo)
 * @param {object} interpretacionComparacion - Interpretación estructurada del agente
 * @returns {string|null} - 'anterior' | 'actual' | 'igual' | null
 */
function interpretarPreferenciaLente(respuestaPaciente, interpretacionComparacion) {
  // Prioridad: usar interpretación estructurada del agente (100% confianza)
  if (interpretacionComparacion?.preferencia) {
    const pref = interpretacionComparacion.preferencia;
    if (['anterior', 'actual', 'igual'].includes(pref)) {
      return pref;
    }
  }
  
  // Fallback: interpretar texto (aunque debería venir estructurado)
  const texto = (respuestaPaciente || '').toLowerCase();
  
  if (texto.includes('anterior') || texto.includes('otro') || texto.includes('otra')) {
    return 'anterior';
  }
  
  if (texto.includes('este') || texto.includes('esta') || texto.includes('con este')) {
    return 'actual';
  }
  
  if (texto.includes('igual') || texto.includes('iguales')) {
    return 'igual';
  }
  
  return null;
}

/**
 * Procesa la respuesta del paciente en la comparación de lentes
 * @param {string} respuestaPaciente - Respuesta del paciente (texto crudo)
 * @param {object} interpretacionComparacion - Interpretación estructurada del agente
 * @returns {object} - Resultado del procesamiento
 */
function procesarRespuestaComparacionLentes(respuestaPaciente, interpretacionComparacion) {
  const estado = estadoExamen.comparacionActual;
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // Validar que estamos en comparación de lentes
  if (!estado.tipo || !testActual) {
    return { ok: false, error: 'No estamos en comparación de lentes' };
  }
  
  // Validar que el tipo de test coincide con el estado de comparación
  if (testActual.tipo !== estado.tipo) {
    return { ok: false, error: `Tipo de test no coincide: esperado ${estado.tipo}, actual ${testActual.tipo}` };
  }
  
  // Validar que el tipo es uno de los soportados
  if (estado.tipo !== 'esferico_grueso' && estado.tipo !== 'esferico_fino' && estado.tipo !== 'cilindrico' && estado.tipo !== 'cilindrico_angulo') {
    return { ok: false, error: `Tipo de test ${estado.tipo} no soportado aún` };
  }
  
  // Interpretar preferencia
  const preferencia = interpretarPreferenciaLente(respuestaPaciente, interpretacionComparacion);
  
  if (!preferencia) {
    return { ok: false, error: 'No se pudo interpretar la preferencia del paciente' };
  }
  
  console.log(`📊 Procesando respuesta comparación (${estado.ojo}):`, {
    respuestaPaciente,
    preferencia,
    valorActual: estado.valorActual,
    valorAnterior: estado.valorAnterior,
    valorBase: estado.valorBase,
    confirmaciones: estado.confirmaciones
  });
  
  // Procesar según preferencia y fase
  if (preferencia === 'anterior') {
    // Eligió el lente anterior
    if (estado.valorActual === estado.valorMas) {
      // Estaba mostrando +salto, eligió base
      estado.valorConfirmado = estado.valorBase;
      estado.confirmaciones = 1;
      estado.valorAnterior = estado.valorBase;
      estado.faseComparacion = 'mostrando_alternativo';
      
      // Generar pasos para mostrar valorMenos
      return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorMenos };
      
    } else if (estado.valorActual === estado.valorMenos) {
      // Estaba mostrando -salto, eligió base (segunda confirmación)
      estado.valorConfirmado = estado.valorBase;
      estado.confirmaciones = 2;
      estado.faseComparacion = 'confirmado';
      
      // Confirmar resultado
      return confirmarResultado(estado.valorBase);
      
    } else if (estado.valorActual === estado.valorBase) {
      // Estaba mostrando base, eligió el anterior (que era el alternativo)
      // Esto significa que el alternativo es mejor
      if (estado.valorAnterior === estado.valorMas) {
        // El anterior era +salto, confirmar +salto
        estado.valorConfirmado = estado.valorMas;
        estado.confirmaciones += 1; // Incrementar en lugar de resetear
        
        // Verificar si ya hay suficientes confirmaciones
        if (estado.confirmaciones >= 2) {
          // Confirmar resultado directamente
          estado.faseComparacion = 'confirmado';
          return confirmarResultado(estado.valorMas);
        }
        
        // Si aún no hay 2 confirmaciones, mostrar base para confirmar
        estado.faseComparacion = 'mostrando_alternativo';
        return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorBase };
      } else if (estado.valorAnterior === estado.valorMenos) {
        // El anterior era -salto, confirmar -salto
        estado.valorConfirmado = estado.valorMenos;
        estado.confirmaciones += 1; // Incrementar en lugar de resetear
        
        // Verificar si ya hay suficientes confirmaciones
        if (estado.confirmaciones >= 2) {
          // Confirmar resultado directamente
          estado.faseComparacion = 'confirmado';
          return confirmarResultado(estado.valorMenos);
        }
        
        // Si aún no hay 2 confirmaciones, mostrar base para confirmar
        estado.faseComparacion = 'mostrando_alternativo';
        return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorBase };
      }
    }
    
  } else if (preferencia === 'actual') {
    // Eligió el lente actual
    if (estado.valorActual === estado.valorMas) {
      // Estaba mostrando +salto, eligió +salto
      estado.valorConfirmado = estado.valorMas;
      estado.confirmaciones = 1;
      estado.valorAnterior = estado.valorMas;
      estado.faseComparacion = 'mostrando_alternativo';
      
      // Generar pasos para mostrar base (confirmar)
      return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorBase };
      
    } else if (estado.valorActual === estado.valorMenos) {
      // Estaba mostrando -salto, eligió -salto
      estado.valorConfirmado = estado.valorMenos;
      estado.confirmaciones = 1;
      estado.valorAnterior = estado.valorMenos;
      estado.faseComparacion = 'mostrando_alternativo';
      
      // Generar pasos para mostrar base (confirmar)
      return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorBase };
      
    } else if (estado.valorActual === estado.valorBase) {
      // Estaba mostrando base, eligió base (confirmación)
      estado.confirmaciones += 1;
      
      if (estado.confirmaciones >= 2) {
        // Confirmado
        estado.faseComparacion = 'confirmado';
        return confirmarResultado(estado.valorBase);
      } else {
        // Aún necesita otra confirmación
        estado.faseComparacion = 'mostrando_alternativo';
        // Mostrar el alternativo que no probamos aún
        if (!estado.valoresProbados.mas) {
          return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorMas };
        } else if (!estado.valoresProbados.menos) {
          return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorMenos };
        } else {
          // Ya probamos ambos, volver a mostrar base
          return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorBase };
        }
      }
    }
    
  } else if (preferencia === 'igual') {
    // Dice que son iguales
    // Probar de nuevo esos lentes
    if (estado.confirmaciones === 0) {
      // Primera vez que dice igual, reintentar
      estado.faseComparacion = 'mostrando_alternativo';
      return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorActual };
    } else {
      // Ya dijo igual antes, usar el valor más pequeño
      const valores = [estado.valorMas, estado.valorBase, estado.valorMenos].filter(v => v !== null);
      const valorMasPequeno = Math.min(...valores);
      
      console.log(`⚠️ Paciente dice "igual" repetidamente, usando valor más pequeño: ${valorMasPequeno}`);
      estado.faseComparacion = 'confirmado';
      return confirmarResultado(valorMasPequeno);
    }
  }
  
  return { ok: true };
}

/**
 * Confirma el resultado final del test de lentes
 * @param {number} valorFinal - Valor final confirmado
 * @returns {object} - Resultado de la confirmación
 */
function confirmarResultado(valorFinal) {
  const estado = estadoExamen.comparacionActual;
  const ojo = estado.ojo;
  const tipo = estado.tipo;
  
  // Guardar resultado según el tipo de test
  if (tipo === 'esferico_grueso') {
    estadoExamen.secuenciaExamen.resultados[ojo].esfericoGrueso = valorFinal;
    console.log(`✅ Resultado confirmado para ${ojo} (esférico grueso): ${valorFinal}`);
  } else if (tipo === 'esferico_fino') {
    estadoExamen.secuenciaExamen.resultados[ojo].esfericoFino = valorFinal;
    console.log(`✅ Resultado confirmado para ${ojo} (esférico fino): ${valorFinal}`);
  } else if (tipo === 'cilindrico') {
    estadoExamen.secuenciaExamen.resultados[ojo].cilindrico = valorFinal;
    console.log(`✅ Resultado confirmado para ${ojo} (cilíndrico): ${valorFinal}`);
    
    // Actualizar el foróptero con el nuevo valor de cilindro
    // Obtener valores actuales del foróptero (usar resultados de tests anteriores si existen)
    const esferaFinal = estadoExamen.secuenciaExamen.resultados[ojo].esfericoFino 
      || estadoExamen.secuenciaExamen.resultados[ojo].esfericoGrueso 
      || estadoExamen.valoresRecalculados[ojo].esfera;
    
    // Actualizar foróptero con el nuevo cilindro confirmado
    if (ejecutarComandoForopteroInterno) {
      const configForoptero = {
        [ojo]: {
          esfera: esferaFinal,
          cilindro: valorFinal,
          angulo: estadoExamen.valoresRecalculados[ojo].angulo,
          occlusion: 'open'
        },
        [ojo === 'R' ? 'L' : 'R']: {
          occlusion: 'close'
        }
      };
      
      // Ejecutar de forma asíncrona (no esperar, continuar con el flujo)
      ejecutarComandoForopteroInterno(configForoptero).catch(err => {
        console.error(`⚠️ Error actualizando foróptero después de confirmar cilíndrico:`, err);
      });
      
      console.log(`🔧 Foróptero actualizado con nuevo cilindro para ${ojo}: ${valorFinal}`);
    }
  } else if (tipo === 'cilindrico_angulo') {
    estadoExamen.secuenciaExamen.resultados[ojo].cilindricoAngulo = valorFinal;
    console.log(`✅ Resultado confirmado para ${ojo} (cilíndrico ángulo): ${valorFinal}°`);
    
    // Actualizar el foróptero con el nuevo valor de ángulo
    // Obtener valores actuales del foróptero (usar resultados de tests anteriores si existen)
    const esferaFinal = estadoExamen.secuenciaExamen.resultados[ojo].esfericoFino 
      || estadoExamen.secuenciaExamen.resultados[ojo].esfericoGrueso 
      || estadoExamen.valoresRecalculados[ojo].esfera;
    
    // Usar el resultado del test de cilindro si existe, sino el valor recalculado
    const cilindroFinal = estadoExamen.secuenciaExamen.resultados[ojo].cilindrico 
      || estadoExamen.valoresRecalculados[ojo].cilindro;
    
    // Actualizar foróptero con el nuevo ángulo confirmado
    if (ejecutarComandoForopteroInterno) {
      const configForoptero = {
        [ojo]: {
          esfera: esferaFinal,
          cilindro: cilindroFinal,
          angulo: valorFinal, // Actualizar ángulo
          occlusion: 'open'
        },
        [ojo === 'R' ? 'L' : 'R']: {
          occlusion: 'close'
        }
      };
      
      // Ejecutar de forma asíncrona (no esperar, continuar con el flujo)
      ejecutarComandoForopteroInterno(configForoptero).catch(err => {
        console.error(`⚠️ Error actualizando foróptero después de confirmar cilíndrico ángulo:`, err);
      });
      
      console.log(`🔧 Foróptero actualizado con nuevo ángulo para ${ojo}: ${valorFinal}°`);
    }
  } else {
    console.error(`❌ Tipo de test desconocido al confirmar resultado: ${tipo}`);
    return { ok: false, error: `Tipo de test ${tipo} no soportado` };
  }
  
  // Resetear estado de comparación
  estadoExamen.comparacionActual = {
    tipo: null,
    ojo: null,
    valorBase: null,
    valorActual: null,
    valorAnterior: null,
    valorConfirmado: null,
    confirmaciones: 0,
    direccion: null,
    faseComparacion: null,
    letraActual: null,
    logmarActual: null,
    saltoActual: null,
    valorMas: null,
    valorMenos: null,
    valoresProbados: {
      mas: false,
      menos: false,
      base: false
    }
  };
  
  // Avanzar al siguiente test
  const siguienteTest = avanzarTest();
  
  return {
    ok: true,
    resultadoConfirmado: true,
    valorFinal,
    siguienteTest
  };
}

/**
 * Obtiene el detalle completo del examen
 * Incluye valores iniciales, recalculados, lista de tests y resultados
 */
export function obtenerDetalleExamen() {
  const { secuenciaExamen, valoresIniciales, valoresRecalculados } = estadoExamen;
  
  // Mapear tests con su estado y resultado
  // Si testsActivos está vacío o no existe, retornar array vacío
  const tests = (secuenciaExamen.testsActivos || []).map((test, indice) => {
    const estado = obtenerEstadoTest(indice, test.tipo, test.ojo);
    const resultado = obtenerResultadoTest(test.tipo, test.ojo);
    
    return {
      indice,
      tipo: test.tipo,
      ojo: test.ojo,
      estado,
      resultado
    };
  });
  
  return {
    ok: true,
    detalle: {
      // 1. Valores iniciales
      valoresIniciales: {
        R: { ...valoresIniciales.R },
        L: { ...valoresIniciales.L }
      },
      
      // 2. Valores recalculados
      valoresRecalculados: {
        R: { ...valoresRecalculados.R },
        L: { ...valoresRecalculados.L }
      },
      
      // 3. Lista de tests a realizar (con estado)
      tests,
      
      // 4. Valores de los tests (realizados y por realizar)
      resultados: {
        R: { ...(secuenciaExamen.resultados?.R || {}) },
        L: { ...(secuenciaExamen.resultados?.L || {}) }
      },
      
      // 5. Información adicional
      estadoActual: {
        etapa: estadoExamen.etapa,
        ojoActual: estadoExamen.ojoActual,
        testActual: secuenciaExamen.testActual || null,
        indiceActual: secuenciaExamen.indiceActual || 0,
        progreso: calcularProgreso()
      },
      
      timestamps: {
        iniciado: estadoExamen.iniciado,
        finalizado: estadoExamen.finalizado
      }
    }
  };
}

