# Plan de Implementación: Agudeza Alcanzada

## 📋 Resumen Ejecutivo

Este documento define el plan de implementación para el test `agudeza_alcanzada`, que se ejecuta después de completar todos los tests de lentes (esférico grueso, fino, cilíndrico, etc.) para verificar si el paciente puede ver mejor con los lentes optimizados.

**Diferencia clave con `agudeza_inicial`:** 
- `agudeza_inicial`: Busca el mejor logMAR desde 0.4, navegando hacia arriba o abajo según respuestas
- `agudeza_alcanzada`: Empieza desde `agudeza_inicial` y baja progresivamente hasta 0.0, usando los lentes optimizados

---

## 🎯 Objetivos

1. **Implementar lógica específica para `agudeza_alcanzada`** que difiere de `agudeza_inicial`
2. **Configurar foróptero con valores finales** antes de iniciar el test
3. **Navegación logMAR progresiva** que baja desde `agudeza_inicial` hasta 0.0
4. **Guardado correcto** en campo `agudezaAlcanzada`

---

## 🔍 Análisis de Diferencias

### Comparación: `agudeza_inicial` vs `agudeza_alcanzada`

| Aspecto | `agudeza_inicial` | `agudeza_alcanzada` |
|---------|-------------------|---------------------|
| **Estado inicial logMAR** | 0.4 (fijo) | `agudeza_inicial` (dinámico, desde resultado previo) |
| **Valores foróptero** | `valoresRecalculados` | Valores finales (esfera fino + cilindro + ángulo) |
| **Objetivo** | Encontrar mejor logMAR posible | Bajar progresivamente desde `agudeza_inicial` hasta 0.0 |
| **Navegación** | Completa (subir/bajar según respuestas) | Solo bajar progresivamente (0.4→0.3→0.2→0.1→0.0) |
| **Campo resultado** | `agudezaInicial` | `agudezaAlcanzada` |
| **Dependencias** | Ninguna | Requiere `agudeza_inicial` y tests de lentes completos |

---

## 📐 Lógica de Navegación para `agudeza_alcanzada`

### Algoritmo Progresivo (Similar a `agudeza_inicial` pero solo bajando)

```
1. Obtener agudeza_inicial del ojo actual (ej: 0.4)
2. Empezar desde agudeza_inicial (0.4)
3. Mostrar letra en logMAR actual
4. Si paciente ve correctamente:
   - Confirmar 2 veces en ese logMAR
   - Bajar al siguiente logMAR más pequeño (0.4 → 0.3 → 0.2 → 0.1 → 0.0)
   - Repetir hasta llegar a 0.0 o hasta que no vea
5. Si paciente NO ve:
   - Volver al logMAR anterior (el último donde sí veía)
   - Confirmar 2 veces en ese logMAR
   - Guardar como agudezaAlcanzada
```

### Ejemplo de Flujo

**Caso 1: Mejora progresiva exitosa hasta 0.0**
```
agudeza_inicial = 0.4
→ Mostrar letra en 0.4 → Paciente ve "D" ✅
→ Confirmar 0.4 con otra letra → Paciente ve "H" ✅
→ Bajar a 0.3 → Mostrar letra → Paciente ve "K" ✅
→ Confirmar 0.3 con otra letra → Paciente ve "S" ✅
→ Bajar a 0.2 → Mostrar letra → Paciente ve "C" ✅
→ Confirmar 0.2 con otra letra → Paciente ve "N" ✅
→ Bajar a 0.1 → Mostrar letra → Paciente ve "O" ✅
→ Confirmar 0.1 con otra letra → Paciente ve "R" ✅
→ Bajar a 0.0 → Mostrar letra → Paciente ve "V" ✅
→ Confirmar 0.0 con otra letra → Paciente ve "Z" ✅
→ ✅ agudezaAlcanzada = 0.0 (mejoró desde 0.4)
```

**Caso 2: Mejora parcial (se detiene antes de 0.0)**
```
agudeza_inicial = 0.4
→ Mostrar letra en 0.4 → Paciente ve "D" ✅
→ Confirmar 0.4 con otra letra → Paciente ve "H" ✅
→ Bajar a 0.3 → Mostrar letra → Paciente ve "K" ✅
→ Confirmar 0.3 con otra letra → Paciente ve "S" ✅
→ Bajar a 0.2 → Mostrar letra → Paciente ve "C" ✅
→ Confirmar 0.2 con otra letra → Paciente ve "N" ✅
→ Bajar a 0.1 → Mostrar letra → Paciente NO ve ❌
→ Volver a 0.2 → Confirmar 0.2 con otra letra → Paciente ve "O" ✅
→ Confirmar 0.2 otra vez → Paciente ve "R" ✅
→ ✅ agudezaAlcanzada = 0.2 (mejoró desde 0.4)
```

**Caso 3: No mejora (ya estaba en su mejor agudeza)**
```
agudeza_inicial = 0.1
→ Mostrar letra en 0.1 → Paciente ve "D" ✅
→ Confirmar 0.1 con otra letra → Paciente ve "H" ✅
→ Bajar a 0.0 → Mostrar letra → Paciente NO ve ❌
→ Volver a 0.1 → Confirmar 0.1 con otra letra → Paciente ve "K" ✅
→ Confirmar 0.1 otra vez → Paciente ve "S" ✅
→ ✅ agudezaAlcanzada = 0.1 (igual que inicial)
```

**Caso 4: Agudeza inicial ya es 0.0**
```
agudeza_inicial = 0.0
→ Mostrar letra en 0.0 → Paciente ve "D" ✅
→ Confirmar 0.0 con otra letra → Paciente ve "H" ✅
→ ✅ agudezaAlcanzada = 0.0 (ya estaba en el máximo)
```

---

## 🛠️ Implementación Técnica

### 1. Extender `generarPasosEtapa4()` para detectar `agudeza_alcanzada`

**Ubicación:** `reference/foroptero-server/motorExamen.js`, línea 859

**Cambios requeridos:**

```javascript
function generarPasosEtapa4() {
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // ✅ CAMBIO 1: Aceptar ambos tipos de test de agudeza
  if (!testActual || (testActual.tipo !== 'agudeza_inicial' && testActual.tipo !== 'agudeza_alcanzada')) {
    return {
      ok: false,
      error: 'No estamos en test de agudeza visual'
    };
  }
  
  const ojo = testActual.ojo;
  const estado = estadoExamen.agudezaEstado;
  
  // ✅ CAMBIO 2: Lógica de inicialización diferente según tipo de test
  if (estado.ojo !== ojo || estado.logmarActual === null) {
    estado.ojo = ojo;
    
    if (testActual.tipo === 'agudeza_alcanzada') {
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
      console.log(`   Agudeza inicial: ${agudezaInicial}, Objetivo: ${logmarObjetivo}`);
      
      // ✅ CAMBIO 3: Configurar foróptero con valores finales ANTES de mostrar TV
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
      estado.logmarActual = 0.4;
      estado.letraActual = 'H';
      estado.mejorLogmar = null;
      estado.ultimoLogmarCorrecto = null;
      estado.letrasUsadas = ['H'];
      estado.intentos = 0;
      estado.confirmaciones = 0;
      estado.esAgudezaAlcanzada = false;
      
      console.log(`🔍 Iniciando test de agudeza visual inicial para ${ojo}`);
    }
  }
  
  // ... resto del código original para agudeza_inicial
}
```

### 2. Crear función `calcularValoresFinalesForoptero()`

**Nueva función a agregar:**

```javascript
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
```

### 3. Extender `procesarRespuestaAgudeza()` para `agudeza_alcanzada`

**Ubicación:** `reference/foroptero-server/motorExamen.js`, línea 698

**Cambios requeridos:**

```javascript
function procesarRespuestaAgudeza(respuestaPaciente, interpretacionAgudeza) {
  const estado = estadoExamen.agudezaEstado;
  const testActual = estadoExamen.secuenciaExamen.testActual;
  
  // ✅ CAMBIO 1: Aceptar ambos tipos de test de agudeza
  if (!testActual || (testActual.tipo !== 'agudeza_inicial' && testActual.tipo !== 'agudeza_alcanzada')) {
    return { ok: false, error: 'No estamos en test de agudeza' };
  }
  
  const ojo = testActual.ojo;
  const resultado = interpretacionAgudeza?.resultado || 'no_se';
  const esAgudezaAlcanzada = testActual.tipo === 'agudeza_alcanzada';
  
  console.log(`📊 Procesando respuesta agudeza (${ojo}, tipo: ${testActual.tipo}):`, {
    respuestaPaciente,
    resultado,
    logmarActual: estado.logmarActual,
    ultimoLogmarCorrecto: estado.ultimoLogmarCorrecto,
    confirmaciones: estado.confirmaciones
  });
  
  // ✅ CAMBIO 2: Lógica diferente para agudeza_alcanzada
  if (esAgudezaAlcanzada) {
    return procesarRespuestaAgudezaAlcanzada(respuestaPaciente, interpretacionAgudeza, estado, ojo);
  }
  
  // Lógica original para agudeza_inicial
  // ... (código existente)
}
```

### 4. Crear función `procesarRespuestaAgudezaAlcanzada()`

**Nueva función a agregar:**

```javascript
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
        
        // No estamos en 0.0, bajar al siguiente logMAR más pequeño
        const siguienteLogMAR = bajarLogMAR(estado.logmarActual);
        
        if (siguienteLogMAR < estado.logmarActual) {
          // Hay un logMAR más pequeño disponible
          estado.logmarActual = siguienteLogMAR;
          estado.ultimoLogmarCorrecto = null; // Resetear para el nuevo logMAR
          estado.confirmaciones = 0; // Empezar confirmaciones desde 0
          
          const nuevaLetra = generarLetraSloan([]); // Resetear letras usadas
          estado.letraActual = nuevaLetra;
          estado.letrasUsadas = [nuevaLetra];
          
          console.log(`⬇️ Bajando a logMAR ${siguienteLogMAR}`);
          
          return { ok: true, necesitaNuevaLetra: true };
        } else {
          // Ya estamos en el mínimo (0.0), no debería pasar aquí
          // Pero por seguridad, guardar el resultado actual
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
      estado.logmarActual = estado.ultimoLogmarCorrecto;
      estado.ultimoLogmarCorrecto = estado.logmarActual; // Mantener como referencia
      estado.confirmaciones = 0; // Resetear confirmaciones
      
      const nuevaLetra = generarLetraSloan([]); // Resetear letras usadas
      estado.letraActual = nuevaLetra;
      estado.letrasUsadas = [nuevaLetra];
      
      console.log(`⬇️ No ve en ${estado.logmarActual}, volviendo a ${estado.ultimoLogmarCorrecto}`);
      
      return { ok: true, necesitaNuevaLetra: true };
      
    } else {
      // No hay logMAR anterior (primera respuesta incorrecta)
      // Esto no debería pasar si empezamos desde agudeza_inicial (donde ya veía)
      // Pero por seguridad, volver a agudeza_inicial
      estado.logmarActual = agudezaInicial;
      estado.ultimoLogmarCorrecto = agudezaInicial;
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
```

### 5. Actualizar guardado de resultados en `procesarRespuestaAgudeza()` original

**Ubicación:** `reference/foroptero-server/motorExamen.js`, línea 746

**Cambio requerido:**

```javascript
// ❌ ANTES (línea 746):
estadoExamen.secuenciaExamen.resultados[ojo].agudezaInicial = estado.logmarActual;

// ✅ DESPUÉS:
const campoResultado = mapearTipoTestAResultado(testActual.tipo);
if (campoResultado) {
  estadoExamen.secuenciaExamen.resultados[ojo][campoResultado] = estado.logmarActual;
} else {
  console.error(`❌ No se pudo mapear tipo de test a resultado: ${testActual.tipo}`);
}
```

---

## 📝 Checklist de Implementación

### Backend (`motorExamen.js`)

- [ ] **1. Extender validación en `generarPasosEtapa4()`**
  - [ ] Aceptar `agudeza_alcanzada` además de `agudeza_inicial`
  - [ ] Agregar lógica de inicialización específica para `agudeza_alcanzada`
  - [ ] Empezar desde `agudeza_inicial` (no desde `agudeza_inicial - 0.1`)
  - [ ] Validar que existe `agudeza_inicial` antes de continuar

- [ ] **2. Crear función `calcularValoresFinalesForoptero()`**
  - [ ] Priorizar `esfericoFino` sobre `esfericoGrueso`
  - [ ] Usar `cilindrico` si está disponible
  - [ ] Usar `cilindricoAngulo` si está disponible
  - [ ] Fallback a `valoresRecalculados` si no hay resultados

- [ ] **3. Agregar configuración de foróptero en `generarPasosEtapa4()`**
  - [ ] Generar paso `foroptero` con valores finales
  - [ ] Agregar paso `esperar_foroptero`
  - [ ] Configurar oclusión correcta (ojo actual `open`, otro `close`)

- [ ] **4. Extender `procesarRespuestaAgudeza()`**
  - [ ] Aceptar `agudeza_alcanzada` además de `agudeza_inicial`
  - [ ] Llamar a `procesarRespuestaAgudezaAlcanzada()` cuando corresponda
  - [ ] Actualizar guardado para usar `mapearTipoTestAResultado()`

- [ ] **5. Crear función `procesarRespuestaAgudezaAlcanzada()`**
  - [ ] Manejar respuesta correcta: confirmar 2 veces y bajar progresivamente
  - [ ] Si está en 0.0 y confirma 2 veces, guardar y terminar
  - [ ] Si no está en 0.0 y confirma 2 veces, bajar al siguiente logMAR
  - [ ] Manejar respuesta incorrecta: volver al logMAR anterior donde sí veía
  - [ ] Confirmar 2 veces en el logMAR final antes de guardar
  - [ ] Guardar en campo `agudezaAlcanzada` usando mapeo

- [ ] **6. Crear función `resetearEstadoAgudeza()`**
  - [ ] Resetear todos los campos del estado
  - [ ] Incluir campos específicos de `agudeza_alcanzada`

- [ ] **7. Actualizar guardado en `procesarRespuestaAgudeza()` original**
  - [ ] Usar `mapearTipoTestAResultado()` en lugar de hardcodear `agudezaInicial`

### Testing

- [ ] **8. Probar flujo completo R - mejora progresiva hasta 0.0**
  - [ ] `agudeza_inicial` R = 0.4
  - [ ] Tests de lentes R completos
  - [ ] `agudeza_alcanzada` R baja progresivamente: 0.4 → 0.3 → 0.2 → 0.1 → 0.0
  - [ ] Verificar guardado en `agudezaAlcanzada` = 0.0

- [ ] **9. Probar caso mejora parcial**
  - [ ] `agudeza_inicial` R = 0.4
  - [ ] Tests de lentes R completos
  - [ ] `agudeza_alcanzada` R baja: 0.4 → 0.3 → 0.2 → 0.1 (no ve en 0.0)
  - [ ] Verifica que vuelve a 0.1 y confirma
  - [ ] Verificar guardado en `agudezaAlcanzada` = 0.1

- [ ] **10. Probar caso sin mejora**
  - [ ] `agudeza_inicial` R = 0.1
  - [ ] Tests de lentes R completos
  - [ ] `agudeza_alcanzada` R intenta bajar a 0.0 (no ve)
  - [ ] Vuelve a 0.1 y confirma
  - [ ] Verificar guardado en `agudezaAlcanzada` = 0.1

- [ ] **11. Probar caso agudeza_inicial = 0.0**
  - [ ] `agudeza_inicial` R = 0.0
  - [ ] Tests de lentes R completos
  - [ ] `agudeza_alcanzada` R empieza en 0.0
  - [ ] Confirma 2 veces en 0.0
  - [ ] Verificar que no intenta bajar más (ya está en mínimo)
  - [ ] Verificar guardado en `agudezaAlcanzada` = 0.0

- [ ] **12. Verificar valores finales del foróptero**
  - [ ] Esfera del test fino se usa correctamente
  - [ ] Cilindro se usa si está disponible
  - [ ] Ángulo se usa si está disponible
  - [ ] Fallback a valores recalculados funciona

- [ ] **13. Verificar transiciones**
  - [ ] Después de completar `agudeza_alcanzada` R → avanza a L
  - [ ] Después de completar `agudeza_alcanzada` L → finaliza examen

---

## 🧪 Casos de Prueba

### Caso 1: Mejora progresiva exitosa hasta 0.0
```
Estado inicial:
- agudeza_inicial R = 0.4
- esfericoFino R = 0.5
- cilindrico R = -1.75

Flujo:
1. Configurar foróptero: esfera=0.5, cilindro=-1.75
2. Mostrar letra en logMAR 0.4 → Paciente: "veo una D" ✅
3. Confirmar 0.4 con otra letra → Paciente: "veo una H" ✅
4. Bajar a 0.3 → Mostrar letra → Paciente: "veo una K" ✅
5. Confirmar 0.3 con otra letra → Paciente: "veo una S" ✅
6. Bajar a 0.2 → Mostrar letra → Paciente: "veo una C" ✅
7. Confirmar 0.2 con otra letra → Paciente: "veo una N" ✅
8. Bajar a 0.1 → Mostrar letra → Paciente: "veo una O" ✅
9. Confirmar 0.1 con otra letra → Paciente: "veo una R" ✅
10. Bajar a 0.0 → Mostrar letra → Paciente: "veo una V" ✅
11. Confirmar 0.0 con otra letra → Paciente: "veo una Z" ✅
12. ✅ Guardar agudezaAlcanzada = 0.0 (mejoró desde 0.4)
```

### Caso 2: Mejora parcial (se detiene antes de 0.0)
```
Estado inicial:
- agudeza_inicial R = 0.4
- esfericoFino R = 0.5

Flujo:
1. Configurar foróptero: esfera=0.5
2. Mostrar letra en logMAR 0.4 → Paciente: "veo una D" ✅
3. Confirmar 0.4 con otra letra → Paciente: "veo una H" ✅
4. Bajar a 0.3 → Mostrar letra → Paciente: "veo una K" ✅
5. Confirmar 0.3 con otra letra → Paciente: "veo una S" ✅
6. Bajar a 0.2 → Mostrar letra → Paciente: "veo una C" ✅
7. Confirmar 0.2 con otra letra → Paciente: "veo una N" ✅
8. Bajar a 0.1 → Mostrar letra → Paciente: "veo una O" ✅
9. Confirmar 0.1 con otra letra → Paciente: "veo una R" ✅
10. Bajar a 0.0 → Mostrar letra → Paciente: "no veo" ❌
11. Volver a 0.1 → Confirmar 0.1 con otra letra → Paciente: "veo una V" ✅
12. Confirmar 0.1 otra vez → Paciente: "veo una Z" ✅
13. ✅ Guardar agudezaAlcanzada = 0.1 (mejoró desde 0.4)
```

### Caso 3: No mejora (ya estaba en su mejor agudeza)
```
Estado inicial:
- agudeza_inicial R = 0.1
- esfericoFino R = 0.5

Flujo:
1. Configurar foróptero: esfera=0.5
2. Mostrar letra en logMAR 0.1 → Paciente: "veo una D" ✅
3. Confirmar 0.1 con otra letra → Paciente: "veo una H" ✅
4. Bajar a 0.0 → Mostrar letra → Paciente: "no veo" ❌
5. Volver a 0.1 → Confirmar 0.1 con otra letra → Paciente: "veo una K" ✅
6. Confirmar 0.1 otra vez → Paciente: "veo una S" ✅
7. ✅ Guardar agudezaAlcanzada = 0.1 (igual que inicial)
```

### Caso 4: Agudeza inicial ya es 0.0
```
Estado inicial:
- agudeza_inicial R = 0.0
- esfericoFino R = 0.5

Flujo:
1. Configurar foróptero: esfera=0.5
2. Mostrar letra en logMAR 0.0 → Paciente: "veo una D" ✅
3. Confirmar 0.0 con otra letra → Paciente: "veo una H" ✅
4. ✅ Guardar agudezaAlcanzada = 0.0 (ya estaba en el máximo)
```

---

## ⚠️ Consideraciones Importantes

1. **Dependencia de `agudeza_inicial`**: Si no existe `agudeza_inicial` para el ojo actual, el test debe fallar con error claro.

2. **Valores finales del foróptero**: Deben calcularse correctamente antes de iniciar el test. Si algún test de lentes no se completó, usar valores recalculados como fallback.

3. **Confirmación doble**: Mantener la misma lógica de confirmación doble que `agudeza_inicial` para consistencia. Cada logMAR debe confirmarse 2 veces antes de bajar al siguiente.

4. **Navegación solo hacia abajo**: A diferencia de `agudeza_inicial`, `agudeza_alcanzada` solo baja progresivamente. Si el paciente no ve, vuelve al logMAR anterior donde sí veía (no sube más allá de `agudeza_inicial`).

5. **Objetivo final 0.0**: El objetivo es llegar a 0.0 si es posible. Si el paciente confirma 2 veces en 0.0, se guarda y termina el test.

6. **Transición de etapas**: Después de completar `agudeza_alcanzada`, `avanzarTest()` debe actualizar correctamente la etapa según el siguiente test.

---

## 📊 Métricas de Éxito

- ✅ Test `agudeza_alcanzada` se ejecuta correctamente después de tests de lentes
- ✅ Foróptero se configura con valores finales antes de iniciar
- ✅ Empieza desde `agudeza_inicial` y baja progresivamente hasta 0.0
- ✅ Confirma 2 veces en cada logMAR antes de bajar al siguiente
- ✅ Si no ve en un logMAR, vuelve al anterior donde sí veía
- ✅ Si llega a 0.0 y confirma 2 veces, guarda y termina
- ✅ Resultado se guarda en campo `agudezaAlcanzada` correctamente
- ✅ Transición al siguiente ojo o finalización funciona correctamente
- ✅ No hay errores en consola durante la ejecución

---

## 🕐 Tiempo Estimado

- **Implementación:** 4-5 horas
- **Testing:** 2-3 horas
- **Total:** 6-8 horas

---

## 📚 Referencias

- `reference/PLAN_MIGRACION_BACKEND.md` - FASE 6 (líneas 1020-1085)
- `reference/foroptero-server/motorExamen.js` - Funciones relacionadas
- `reference/ANALISIS_PROBLEMA_FASE4.md` - Análisis de transiciones de etapa

