# Análisis: Etapa 4 - Test de Agudeza Visual

## 🎯 Objetivo
Determinar el menor valor logMAR que el paciente pueda leer con comodidad para cada ojo.

---

## 🤔 Pregunta Clave: ¿Quién razona si la respuesta es OK o NOK?

### Arquitectura Actual (Ultra-Optimizada)
- **Agente AI:** Solo ejecuta pasos, no razona
- **Backend:** Decide TODO (lógica, estado, flujo)

### Problema con Agudeza Visual
El paciente puede responder de **formas muy diversas**:
- ✅ "H" (letra correcta)
- ✅ "Veo una H"
- ✅ "Es una H"
- ✅ "Hache"
- ❌ "No veo nada"
- ❌ "Está borroso"
- ❌ "No sé"
- ❌ "No la distingo"
- ❌ "No la puedo leer"
- ❌ "M" (letra incorrecta)
- ❌ "No cambió" (si no se cambió la letra)

### Solución Propuesta: **Híbrida**

**El agente AI interpreta la respuesta del paciente** y la convierte en un formato estructurado que el backend puede procesar.

**El backend decide la lógica** de subir/bajar logMAR basándose en esa interpretación.

---

## 📊 Flujo Propuesto: Interpretación Híbrida

### Paso 1: Agente AI Interpreta la Respuesta

El agente recibe la respuesta del paciente y la convierte en un formato estructurado:

```javascript
// El agente llama obtenerEtapa() con:
{
  respuestaPaciente: "H",  // o "veo una H", "Hache", etc.
  interpretacion: {
    tipo: "letra_correcta" | "letra_incorrecta" | "no_ve" | "borroso" | "no_se",
    letraIdentificada: "H" | null,
    letraEsperada: "H",  // La letra que se mostró
    esCorrecta: true | false
  }
}
```

**Pero espera...** El agente actual es "ultra-optimizado" y no debería razonar.

### Alternativa: Backend Recibe Texto Crudo

El backend recibe el texto crudo del paciente y **el backend mismo interpreta** usando reglas simples o un pequeño modelo de clasificación.

**Problema:** El backend no tiene acceso a GPT para interpretar lenguaje natural complejo.

### Solución Final: **Agente Interpreta, Backend Decide**

1. **Agente AI:** Recibe respuesta del paciente → Interpreta → Envía formato estructurado
2. **Backend:** Recibe formato estructurado → Decide lógica (subir/bajar logMAR) → Genera pasos

**Formato estructurado que el agente envía:**
```javascript
{
  respuestaPaciente: "H",  // Texto original
  interpretacionAgudeza: {
    resultado: "correcta" | "incorrecta" | "no_ve" | "borroso" | "no_se",
    letraIdentificada: "H" | null,
    confianza: "alta" | "media" | "baja"  // Opcional
  }
}
```

**El backend procesa:**
- `resultado: "correcta"` → Bajar logMAR
- `resultado: "incorrecta"` → Subir logMAR o volver al último correcto
- `resultado: "no_ve" | "borroso" | "no_se"` → Tratar como fallo

---

## 🔄 Flujo Completo de Agudeza Visual

### Estado Inicial (Etapa 3 → Etapa 4)

Cuando se completa Etapa 3:
- `testActual = { tipo: 'agudeza_inicial', ojo: 'R' }`
- `agudezaEstado.ojo = 'R'`
- `agudezaEstado.logmarActual = null`
- `agudezaEstado.letraActual = null`
- `agudezaEstado.mejorLogmar = null`
- `agudezaEstado.ultimoLogmarCorrecto = null`
- `agudezaEstado.letrasUsadas = []`
- `agudezaEstado.intentos = 0`
- `agudezaEstado.confirmaciones = 0`

### Paso 1: Primera Letra

**Backend genera pasos:**
```javascript
{
  pasos: [
    {
      tipo: 'tv',           // ✅ Backend decide mostrar TV
      orden: 1,
      letra: 'H',           // ✅ Backend decide la letra
      logmar: 0.4           // ✅ Backend decide el logMAR
    },
    {
      tipo: 'hablar',
      orden: 2,
      mensaje: 'Mirá la pantalla. Decime qué letra ves.'
    }
  ],
  contexto: {
    etapa: 'ETAPA_4',
    testActual: { tipo: 'agudeza_inicial', ojo: 'R' },
    agudezaEstado: {
      logmarActual: 0.4,
      letraActual: 'H',
      mejorLogmar: null,
      ultimoLogmarCorrecto: null
    }
  }
}
```

**Agente ejecuta (sin decidir nada):**
1. Ve paso `tipo: 'tv'` → Llama `comandoTV('H', 0.4)` (valores del paso)
2. Ve paso `tipo: 'hablar'` → Habla: "Mirá la pantalla. Decime qué letra ves."

**Backend actualiza estado:**
- `agudezaEstado.logmarActual = 0.4`
- `agudezaEstado.letraActual = 'H'`
- `agudezaEstado.letrasUsadas.push('H')`

### Paso 2: Paciente Responde

**Paciente dice:** "H" (o "veo una H", "Hache", etc.)

**Agente interpreta:**
- Detecta que es la letra correcta
- Llama `obtenerEtapa()` con:
```javascript
{
  respuestaPaciente: "H",
  interpretacionAgudeza: {
    resultado: "correcta",
    letraIdentificada: "H"
  }
}
```

**Backend procesa:**
1. Recibe `interpretacionAgudeza.resultado = "correcta"`
2. Actualiza estado:
   - `agudezaEstado.ultimoLogmarCorrecto = 0.4`
   - `agudezaEstado.mejorLogmar = 0.4`
   - `agudezaEstado.confirmaciones = 0` (reset porque cambió de tamaño)
3. **Backend decide:** Bajar logMAR (0.4 → 0.3)
4. **Backend genera:** Nueva letra (diferente a 'H') usando `generarLetraSloan()`
5. **Backend genera pasos:**
```javascript
{
  pasos: [
    {
      tipo: 'tv',           // ✅ Backend genera paso de TV
      orden: 1,
      letra: 'K',           // ✅ Backend decidió esta letra
      logmar: 0.3           // ✅ Backend decidió este logMAR
    },
    {
      tipo: 'hablar',
      orden: 2,
      mensaje: 'Perfecto, seguimos con otra.'
    }
  ]
}
```

**Agente ejecuta (sin decidir):**
1. Ve paso `tipo: 'tv'` → Llama `comandoTV('K', 0.3)` (valores del paso)
2. Ve paso `tipo: 'hablar'` → Habla: "Perfecto, seguimos con otra."

### Paso 3: Paciente Responde Correctamente de Nuevo

**Paciente dice:** "K"

**Agente interpreta:**
```javascript
{
  respuestaPaciente: "K",
  interpretacionAgudeza: {
    resultado: "correcta",
    letraIdentificada: "K"
  }
}
```

**Backend procesa:**
1. `resultado = "correcta"` → Baja logMAR (0.3 → 0.2)
2. Genera nueva letra
3. Continúa...

### Paso 4: Paciente Falla

**Paciente dice:** "No veo nada" o "Está borroso" o "M" (incorrecta)

**Agente interpreta:**
```javascript
{
  respuestaPaciente: "No veo nada",
  interpretacionAgudeza: {
    resultado: "no_ve",  // o "borroso" o "incorrecta"
    letraIdentificada: null
  }
}
```

**Backend procesa:**
1. `resultado = "no_ve"` → Trata como fallo
2. **Backend aplica lógica de recuperación:**
   - Si `ultimoLogmarCorrecto !== null`:
     - Volver a `ultimoLogmarCorrecto`
     - Generar nueva letra (diferente) usando `generarLetraSloan()`
     - Resetear `confirmaciones = 0`
   - Si `ultimoLogmarCorrecto === null`:
     - Subir logMAR (0.2 → 0.3 o más) usando `subirLogMAR()`
3. **Backend genera pasos:**
```javascript
{
  pasos: [
    {
      tipo: 'tv',           // ✅ Backend genera paso de TV
      orden: 1,
      letra: 'D',           // ✅ Backend decidió esta letra
      logmar: 0.2           // ✅ Backend decidió volver a este logMAR
    },
    {
      tipo: 'hablar',
      orden: 2,
      mensaje: 'No hay problema, vamos con una nueva.'
    }
  ]
}
```

**Agente ejecuta (sin decidir):**
1. Ve paso `tipo: 'tv'` → Llama `comandoTV('D', 0.2)` (valores del paso)
2. Ve paso `tipo: 'hablar'` → Habla: "No hay problema, vamos con una nueva."

### Paso 5: Confirmación

**Paciente dice:** "D" (correcta en el mismo logMAR)

**Backend procesa:**
1. `resultado = "correcta"` en el mismo logMAR (0.2)
2. Incrementa `confirmaciones = 1`
3. **Si `confirmaciones === 1`:**
   - Aún no confirmado, necesita una confirmación más
   - Genera otra letra nueva en el mismo logMAR
4. **Si `confirmaciones === 2`:**
   - ✅ **Resultado confirmado**
   - Guarda: `agudezaVisual.R.logmar = 0.2`
   - Guarda: `agudezaVisual.R.letra = 'D'` (última letra correcta)
   - Guarda: `agudezaVisual.R.confirmado = true`
   - Avanza al siguiente test: `avanzarTest()`

---

## 📝 Estructura de Datos para Guardar Estado

### En `agudezaEstado` (estado temporal durante el test):

```javascript
agudezaEstado: {
  ojo: 'R' | 'L',                    // Ojo actual
  logmarActual: 0.4,                 // logMAR de la letra mostrada actualmente
  letraActual: 'H',                  // Letra mostrada actualmente
  mejorLogmar: 0.2,                  // Mejor logMAR alcanzado (más pequeño)
  ultimoLogmarCorrecto: 0.2,          // Último logMAR donde respondió correctamente
  letrasUsadas: ['H', 'K', 'N', 'D'], // Historial de letras usadas (para no repetir)
  intentos: 5,                        // Contador de intentos totales
  confirmaciones: 2,                 // Confirmaciones en el logMAR actual
  estado: 'buscando' | 'confirmando' | 'completado'
}
```

### En `agudezaVisual` (resultado final por ojo):

```javascript
agudezaVisual: {
  R: {
    logmar: 0.2,        // Resultado final confirmado
    letra: 'D',         // Última letra correcta
    confirmado: true     // Flag de confirmación
  },
  L: {
    logmar: null,
    letra: null,
    confirmado: false
  }
}
```

### En `secuenciaExamen.resultados` (para referencia):

```javascript
secuenciaExamen: {
  resultados: {
    R: {
      agudezaInicial: 0.2,  // Se guarda cuando se completa el test
      // ... otros resultados
    }
  }
}
```

---

## 🔄 Lógica de Navegación logMAR

### Valores logMAR Posibles:
- 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0

### Reglas de Navegación:

1. **Inicio:** Siempre comenzar con logMAR 0.4, letra "H"

2. **Respuesta Correcta:**
   - Bajar logMAR (0.4 → 0.3 → 0.2 → 0.1 → 0.0)
   - Generar nueva letra (diferente a la anterior)
   - Resetear `confirmaciones = 0`

3. **Respuesta Incorrecta/Borroso/No Ve:**
   - Si `ultimoLogmarCorrecto !== null`:
     - Volver a `ultimoLogmarCorrecto`
     - Generar nueva letra
     - Resetear `confirmaciones = 0`
   - Si `ultimoLogmarCorrecto === null` (primera respuesta):
     - Subir logMAR (0.4 → 0.5 → 0.6 → ...)

4. **Confirmación:**
   - Si respuesta correcta en el mismo logMAR:
     - Incrementar `confirmaciones`
     - Si `confirmaciones === 2` → Resultado confirmado
     - Si `confirmaciones < 2` → Mostrar otra letra en el mismo logMAR

5. **Límites:**
   - No bajar más allá de 0.0
   - No subir más allá de 2.0 (o límite clínico)

---

## 🎯 Función Backend: `procesarRespuestaAgudeza()`

```javascript
function procesarRespuestaAgudeza(respuestaPaciente, interpretacionAgudeza) {
  const estado = estadoExamen.agudezaEstado;
  const ojo = estado.ojo;
  
  // Validar que estamos en test de agudeza
  if (estadoExamen.secuenciaExamen.testActual?.tipo !== 'agudeza_inicial') {
    return { ok: false, error: 'No estamos en test de agudeza' };
  }
  
  // Procesar según interpretación
  if (interpretacionAgudeza.resultado === 'correcta') {
    // Letra correcta
    estado.ultimoLogmarCorrecto = estado.logmarActual;
    estado.mejorLogmar = Math.min(estado.mejorLogmar || Infinity, estado.logmarActual);
    
    // Si es el mismo logMAR que antes, incrementar confirmaciones
    if (estado.confirmaciones > 0 && estado.logmarActual === estado.ultimoLogmarCorrecto) {
      estado.confirmaciones += 1;
      
      // Si hay 2 confirmaciones, resultado confirmado
      if (estado.confirmaciones >= 2) {
        // Guardar resultado
        estadoExamen.agudezaVisual[ojo] = {
          logmar: estado.logmarActual,
          letra: interpretacionAgudeza.letraIdentificada,
          confirmado: true
        };
        
        // Guardar en secuencia
        estadoExamen.secuenciaExamen.resultados[ojo].agudezaInicial = estado.logmarActual;
        
        // Avanzar al siguiente test
        avanzarTest();
        
        return { ok: true, resultadoConfirmado: true };
      }
    } else {
      // Nuevo logMAR, resetear confirmaciones
      estado.confirmaciones = 0;
    }
    
    // Bajar logMAR (si no está en 0.0)
    if (estado.logmarActual > 0.0) {
      estado.logmarActual = bajarLogMAR(estado.logmarActual);
    }
    
    // Generar nueva letra
    const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
    estado.letraActual = nuevaLetra;
    estado.letrasUsadas.push(nuevaLetra);
    
  } else {
    // Respuesta incorrecta, borroso, no ve, etc.
    
    if (estado.ultimoLogmarCorrecto !== null) {
      // Volver al último correcto
      estado.logmarActual = estado.ultimoLogmarCorrecto;
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
```

---

## 🔧 Funciones Auxiliares

### `bajarLogMAR(logmarActual)`
```javascript
function bajarLogMAR(logmar) {
  const secuencia = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0];
  const indice = secuencia.indexOf(logmar);
  if (indice > 0) {
    return secuencia[indice - 1];
  }
  return logmar; // Ya está en el mínimo
}
```

### `subirLogMAR(logmarActual)`
```javascript
function subirLogMAR(logmar) {
  const secuencia = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0];
  const indice = secuencia.indexOf(logmar);
  if (indice < secuencia.length - 1) {
    return secuencia[indice + 1];
  }
  return logmar; // Ya está en el máximo
}
```

### `generarLetraSloan(letrasUsadas)`
```javascript
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
```

---

## 📋 Resumen del Flujo

1. **Backend genera pasos** (incluye paso `tipo: 'tv'` con letra y logMAR) → Agente ejecuta
2. **Paciente responde** → Agente interpreta → Envía formato estructurado a backend
3. **Backend procesa** → Decide lógica (subir/bajar logMAR, nueva letra) → Actualiza estado
4. **Backend genera nuevos pasos** (incluye nuevo paso `tipo: 'tv'`) → Repite desde paso 1
5. **Cuando hay 2 confirmaciones** → Backend guarda resultado → Backend avanza test

### Puntos Clave:
- ✅ **Backend decide TODO:** qué letra mostrar, qué logMAR, cuándo subir/bajar
- ✅ **Backend genera pasos:** incluye paso `tipo: 'tv'` con valores específicos
- ✅ **Agente solo ejecuta:** ve paso `tipo: 'tv'` → llama `comandoTV(letra, logmar)` con valores del paso
- ✅ **Agente NO decide:** no elige letras, no elige logMAR, solo ejecuta lo que el backend le dice

---

## ✅ Ventajas de este Enfoque

1. **Agente interpreta lenguaje natural** → Flexible con respuestas diversas
2. **Backend decide lógica** → Consistente y controlado
3. **Estado claro** → Fácil de debuggear y mantener
4. **Separación de responsabilidades** → Agente = interfaz, Backend = lógica

---

**Fecha:** 2025-01-27  
**Estado:** 📋 Análisis completo, pendiente de implementación

