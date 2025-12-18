# Documentación Completa - Sistema de Examen Visual con Agente AI

## 📋 Resumen Ejecutivo

Este proyecto implementa un sistema de examen visual oftalmológico automatizado mediante un agente de inteligencia artificial que conversa con el paciente y un backend que orquesta la lógica del examen, controlando dispositivos físicos (foróptero digital y pantalla/TV) mediante HTTP POST y MQTT.

**Objetivo:** Realizar un examen visual completo mediante conversación natural entre un agente AI y el paciente, donde el backend maneja toda la lógica del examen y ejecuta automáticamente los comandos de dispositivos.

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                       │
│  - Interfaz web con OpenAI Realtime API                     │
│  - Agente AI conversacional                                 │
│  - Componentes de UI (transcript, eventos)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP POST
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              BACKEND (Express + MQTT)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  motorExamen.js - State Machine del Examen           │  │
│  │  - Maneja toda la lógica del examen                  │  │
│  │  - Genera pasos atómicos                              │  │
│  │  - Ejecuta comandos automáticamente                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  server.js - Servidor HTTP + MQTT                    │  │
│  │  - Endpoints HTTP para control web                   │  │
│  │  - Funciones internas para ejecución automática      │  │
│  │  - Comunicación MQTT con dispositivos                │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ MQTT
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌─────────▼────────┐
│  Foróptero     │          │  Pantalla/TV    │
│  Digital       │          │  (Letras Sloan) │
│  (ESP32)       │          │                 │
└────────────────┘          └─────────────────┘
```

### Flujo de Comunicación

1. **Agente AI → Backend:**
   - El agente llama `obtenerEtapa()` para obtener instrucciones
   - Envía respuestas del paciente y interpretaciones estructuradas

2. **Backend → Dispositivos:**
   - El backend ejecuta automáticamente comandos de foróptero y TV
   - Usa MQTT para comunicación con dispositivos físicos

3. **Backend → Agente AI:**
   - Retorna solo pasos de tipo "hablar" para que el agente ejecute
   - Proporciona contexto del estado del examen

---

## 📁 Estructura del Proyecto

### Backend (`reference/foroptero-server/`)

#### `server.js`
Servidor Express que orquesta la comunicación MQTT y expone endpoints HTTP.

**Funcionalidades:**
- ✅ Endpoints HTTP para control web manual (mantenidos intactos)
- ✅ Funciones internas para ejecución automática desde motorExamen.js
- ✅ Comunicación MQTT con foróptero y pantalla
- ✅ Detección de estado offline (timeout de 90 segundos)
- ✅ Endpoints del examen visual

**Endpoints HTTP (Control Web):**
- `POST /api/movimiento` - Control manual del foróptero
- `GET /api/estado` - Estado del foróptero
- `POST /api/pantalla` - Control manual de la TV
- `GET /api/pantalla` - Estado de la pantalla

**Endpoints del Examen:**
- `POST /api/examen/nuevo` - Inicializar examen
- `POST /api/examen/instrucciones` - Obtener pasos (ejecuta automáticamente)
- `GET /api/examen/estado` - Estado actual del examen
- `GET /api/examen/detalle` - Detalle completo del examen
- `POST /api/examen/reiniciar` - Reiniciar examen

**Funciones Internas:**
- `ejecutarComandoForopteroInterno(config)` - Ejecuta comandos de foróptero internamente
- `ejecutarComandoTVInterno(config)` - Ejecuta comandos de TV internamente

#### `motorExamen.js`
Motor de examen visual implementado como state machine.

**Estado del Examen:**
```javascript
{
  etapa: 'INICIO' | 'ETAPA_1' | 'ETAPA_2' | 'ETAPA_3' | 'ETAPA_4' | 'ETAPA_5' | 'FINALIZADO',
  valoresIniciales: { R: {...}, L: {...} },
  valoresRecalculados: { R: {...}, L: {...} },
  secuenciaExamen: {
    testsActivos: [...],
    indiceActual: 0,
    testActual: {...},
    resultados: { R: {...}, L: {...} }
  },
  agudezaEstado: {...},
  comparacionActual: {...}
}
```

**Funciones Principales:**
- `inicializarExamen()` - Resetea todo el estado
- `obtenerInstrucciones(respuestaPaciente, interpretacionAgudeza)` - Genera pasos y ejecuta comandos automáticamente
- `generarPasos()` - Genera pasos según la etapa actual
- `procesarRespuesta(respuestaPaciente)` - Procesa respuestas del paciente
- `obtenerEstado()` - Estado actual del examen
- `obtenerDetalleExamen()` - Detalle completo con todos los tests

### Frontend (`src/app/`)

#### `agentConfigs/chatSupervisor/index.ts`
Configuración del agente AI conversacional.

**Tools del Agente:**
1. `obtenerEtapa(respuestaPaciente?, interpretacionAgudeza?)` - Tool principal para obtener instrucciones
2. `estadoExamen()` - Consultar estado (opcional, debugging)
3. `reiniciarExamen()` - Reiniciar examen cuando el paciente lo solicite

**Instrucciones del Agente:**
- Solo conversa con el paciente
- Interpreta respuestas de agudeza visual
- NO ejecuta comandos de dispositivos (el backend lo hace automáticamente)
- Usa mensajes exactos que el backend proporciona

---

## 🔄 Flujo del Examen Visual

### Etapas del Examen

#### **ETAPA_1: Recolección de Valores Iniciales**
**Estado:** ✅ Implementado

- El agente pide los valores del autorefractómetro
- Formato esperado: `<R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0`
- Validación de formato y rangos
- Guarda valores en `estadoExamen.valoresIniciales`

#### **ETAPA_2: Recálculo Cilíndrico**
**Estado:** ✅ Implementado (silencioso)

- Aplica reglas de recálculo cilíndrico según protocolo clínico
- Reglas:
  - Cilindro entre -0.50 y -2.00 → sumar +0.50
  - Cilindro entre -2.25 y -4.00 → sumar +0.75
  - Cilindro entre -4.25 y -6.00 → sumar +1.50
  - Cilindro = 0 o -0.25 → mantener igual
- Guarda valores recalculados en `estadoExamen.valoresRecalculados`
- No genera pasos visibles (etapa silenciosa)

#### **ETAPA_3: Preparación y Secuencia**
**Estado:** ✅ Implementado

- Genera secuencia completa del examen basada en valores recalculados
- Determina qué tests incluir según el valor del cilindro:
  - Cilindro = 0 o -0.25 → No incluir tests de cilindro
  - Cilindro entre -0.50 y -1.75 → Incluir test de cilindro, NO de ángulo
  - Cilindro entre -2.00 y -6.00 → Incluir ambos tests (cilindro y ángulo)
- Configura foróptero inicial (R abierto, L cerrado)
- Inicializa `testActual` con el primer test (agudeza_inicial R)
- Transición a ETAPA_4

#### **ETAPA_4: Test de Agudeza Visual**
**Estado:** ✅ Implementado parcialmente

**Implementado:**
- Test de agudeza visual inicial para cada ojo
- Navegación logMAR con algoritmo de confirmación
- Generación de letras Sloan diferentes
- Procesamiento de respuestas del paciente
- Confirmación con 2 respuestas correctas en el mismo logMAR

**Algoritmo de Agudeza:**
1. Inicia con logMAR 0.4 y letra 'H'
2. Si respuesta correcta:
   - Si es el mismo logMAR que el último correcto → incrementar confirmaciones
   - Si hay 2 confirmaciones → resultado confirmado
   - Si es nuevo logMAR → bajar logMAR y resetear confirmaciones
3. Si respuesta incorrecta:
   - Volver al último logMAR correcto
   - Si no hay último correcto → subir logMAR
4. Generar nueva letra Sloan diferente

**Falta implementar:**
- Test de agudeza alcanzada (después de todos los tests de lentes)

#### **ETAPA_5: Tests de Lentes**
**Estado:** ✅ Implementado completamente

**Implementado:**
1. ✅ **Lente Esférico Grueso** (por ojo)
   - Usa valor esférico recalculado como punto de partida
   - Estrategia de 3 valores (base, +0.50, -0.50)
   - Sistema de confirmación con 2 confirmaciones
   - Espera del estado del foróptero antes de mostrar letras
   - Guardado de resultados en `resultados[ojo].esfericoGrueso`
   - Probado y funcionando correctamente

2. ✅ **Lente Esférico Fino** (por ojo)
   - Usa resultado de esférico grueso como punto de partida
   - Saltos de ±0.25 (más precisos)
   - Estrategia de 3 valores (base, +0.25, -0.25)
   - Sistema de confirmación con 2 confirmaciones (corregido: incrementa correctamente, no resetea)
   - Transición automática desde esférico grueso sin mencionar el test al paciente
   - Sin mensaje introductorio (parte del flujo continuo de comparación de lentes)
   - Guardado de resultados en `resultados[ojo].esfericoFino`
   - Probado y funcionando correctamente
   - **Bug corregido (2025-01-27):** Sistema de confirmación ahora incrementa correctamente las confirmaciones en lugar de resetearlas, evitando comparaciones duplicadas (ej: 0.75 vs 0.75)

3. ✅ **Lente Cilíndrico** (por ojo, opcional)
   - Solo si cilindro recalculado ≠ 0 y ≠ -0.25
   - Usa valor cilíndrico recalculado como punto de partida
   - Saltos de ±0.50
   - Estrategia de 3 valores (base, +0.50, -0.50)
   - Sistema de confirmación con 2 confirmaciones
   - Espera del estado del foróptero antes de mostrar letras
   - Guardado de resultados en `resultados[ojo].cilindrico`
   - Actualización automática del foróptero después de confirmar
   - Probado y funcionando correctamente
   - **Bug fix (2025-01-27):** Corregido bug en `determinarTestsActivos()` donde las comparaciones para rangos negativos estaban invertidas, impidiendo que el test se incluyera en la secuencia

4. ✅ **Lente Cilíndrico Ángulo** (por ojo, opcional)
   - Solo si cilindro recalculado entre -2.00 y -6.00 (inclusive)
   - Usa valor de ángulo inicial (NO recalculado) como punto de partida
   - Saltos de ±15° (navegación por grados)
   - Estrategia de 3 valores (base, +15°, -15°)
   - Sistema de confirmación con 2 confirmaciones
   - Wraparound de ángulos (0-180 grados circular: 195° → 15°, -15° → 165°)
   - Espera del estado del foróptero antes de mostrar letras
   - Guardado de resultados en `resultados[ojo].cilindricoAngulo`
   - Actualización automática del foróptero después de confirmar (actualiza ángulo con esfera y cilindro finales)
   - Sin mensaje introductorio (parte del flujo continuo de comparación de lentes)
   - Probado y funcionando correctamente

**Algoritmo de Comparación (Esférico Grueso, Fino, Cilíndrico y Cilíndrico Ángulo):**
- **Esférico Grueso:**
  - Estrategia de 3 valores: compara valor base vs +0.50 y -0.50
  - Límite crítico: nunca más de ±0.50 para evitar mareo
  - Siempre vuelve al valor base a mitad de test para confirmar
  - Requiere 2 confirmaciones del mismo valor para confirmar resultado
  - Manejo de respuesta "igual": reintenta, luego usa valor más pequeño
- **Esférico Fino:**
  - Estrategia de 3 valores: compara valor base vs +0.25 y -0.25
  - Límite crítico: nunca más de ±0.25 para evitar mareo
  - Usa resultado de esférico grueso como valor base
  - Transición automática desde esférico grueso (sin mencionar el test)
  - Misma lógica de confirmación que esférico grueso
  - **Corrección:** Cuando el paciente confirma preferencia por un valor alternativo sobre el base, el sistema incrementa correctamente las confirmaciones y confirma el resultado cuando hay 2 confirmaciones (evita comparaciones duplicadas)
- **Cilíndrico:**
  - Estrategia de 3 valores: compara valor base vs +0.50 y -0.50
  - Límite crítico: nunca más de ±0.50 para evitar mareo
  - Usa valor recalculado de cilindro como valor base
  - Transición automática desde esférico fino (sin mencionar el test)
  - Sin mensaje introductorio (parte del flujo continuo de comparación de lentes)
  - Misma lógica de confirmación que esférico grueso y fino
  - Actualiza el foróptero con el nuevo valor de cilindro después de confirmar
- **Cilíndrico Ángulo:**
  - Estrategia de 3 valores: compara valor base vs +15° y -15°
  - Límite crítico: nunca más de ±15° para evitar mareo
  - Usa valor inicial de ángulo (NO recalculado) como valor base
  - Wraparound de ángulos: 0-180 grados circular (195° → 15°, -15° → 165°)
  - Transición automática desde cilíndrico (sin mencionar el test)
  - Sin mensaje introductorio (parte del flujo continuo de comparación de lentes)
  - Misma lógica de confirmación que otros tests de lentes
  - Actualiza el foróptero con el nuevo valor de ángulo (junto con esfera y cilindro finales) después de confirmar

#### **FINALIZADO: Examen Completado**
**Estado:** ⚠️ Parcialmente implementado

- Se marca cuando se completa la secuencia
- Falta implementar mensaje final y resumen de resultados

---

## 📊 Secuencia Completa del Examen

### Orden de Tests (si todos aplican)

**Ojo Derecho (R):**
1. ✅ Agudeza visual inicial
2. ✅ Lente esférico grueso
3. ✅ Lente esférico fino
4. ✅ Lente cilíndrico *(opcional)*
5. ✅ Lente cilíndrico ángulo *(opcional)*
6. ❌ Agudeza visual alcanzada

**Ojo Izquierdo (L):**
7. ✅ Agudeza visual inicial
8. ✅ Lente esférico grueso
9. ✅ Lente esférico fino
10. ✅ Lente cilíndrico *(opcional)*
11. ✅ Lente cilíndrico ángulo *(opcional)*
12. ❌ Agudeza visual alcanzada

**Binocular:**
13. ❌ Binocular *(opcional - no implementado)*

### Determinación de Tests Opcionales

Los tests de cilindro se incluyen según el valor del cilindro recalculado:

| Cilindro Recalculado | Test Cilíndrico | Test Cilíndrico Ángulo |
|----------------------|-----------------|------------------------|
| 0 o -0.25            | ❌ No           | ❌ No                  |
| -0.50 a -1.75        | ✅ Sí           | ❌ No                  |
| -2.00 a -6.00        | ✅ Sí           | ✅ Sí                  |

---

## 🔧 Ejecución Automática de Comandos

### Arquitectura Dual

El backend soporta dos formas de control:

1. **Endpoints HTTP** - Para control web manual (mantenidos intactos)
2. **Funciones Internas** - Para ejecución automática desde motorExamen.js

Ambas coexisten sin conflictos y usan la misma infraestructura MQTT.

### Flujo de Ejecución Automática

```
1. Agente: obtenerEtapa()
   ↓
2. Backend: generarPasos()
   ↓
3. Backend: ejecutarPasosAutomaticamente()
   - Ejecuta pasos de tipo "foroptero" → MQTT
   - Ejecuta pasos de tipo "tv" → MQTT
   - Ejecuta pasos de tipo "esperar" → delay
   ↓
4. Backend: Filtrar pasos
   - Solo retorna pasos de tipo "hablar"
   ↓
5. Agente: Habla al paciente
```

### Tipos de Pasos

- **`foroptero`** - Comando de foróptero (ejecutado automáticamente)
- **`tv`** - Comando de TV/pantalla (ejecutado automáticamente)
- **`esperar`** - Delay en segundos (ejecutado automáticamente)
- **`esperar_foroptero`** - Espera a que el foróptero esté "ready" (ejecutado automáticamente)
- **`hablar`** - Mensaje para el agente (único tipo retornado al agente)

---

## 🤖 Agente AI

### Responsabilidades

1. **Conversación Natural:**
   - Habla con el paciente de forma clara y profesional
   - Usa mensajes exactos que el backend proporciona
   - No menciona procesos técnicos

2. **Interpretación de Respuestas:**
   - En test de agudeza: interpreta si la letra es correcta, incorrecta, no ve, borroso, o no está seguro
   - En test de comparación de lentes: interpreta preferencia (anterior, actual, igual)
   - Envía interpretación estructurada al backend

3. **NO Ejecuta Comandos:**
   - El backend ejecuta automáticamente todos los comandos de dispositivos
   - El agente solo ejecuta pasos de tipo "hablar"

### Tools del Agente

#### `obtenerEtapa(respuestaPaciente?, interpretacionAgudeza?, interpretacionComparacion?)`
**Tool principal** - Obtiene instrucciones del backend.

**Parámetros:**
- `respuestaPaciente` (opcional): Respuesta del paciente
- `interpretacionAgudeza` (opcional): Interpretación estructurada en test de agudeza
  ```typescript
  {
    resultado: 'correcta' | 'incorrecta' | 'no_ve' | 'borroso' | 'no_se',
    letraIdentificada?: string | null
  }
  ```
- `interpretacionComparacion` (opcional): Interpretación estructurada en test de comparación de lentes
  ```typescript
  {
    preferencia: 'anterior' | 'actual' | 'igual',
    confianza?: number
  }
  ```

**Retorna:**
```json
{
  "ok": true,
  "pasos": [
    {
      "tipo": "hablar",
      "orden": 1,
      "mensaje": "..."
    }
  ],
  "contexto": {
    "etapa": "ETAPA_4",
    "testActual": {...}
  }
}
```

#### `estadoExamen()`
**Tool opcional** - Consulta el estado del examen (para debugging).

#### `reiniciarExamen()`
**Tool especial** - Reinicia el examen cuando el paciente lo solicita.

---

## 📡 Comunicación MQTT

### Configuración

- **Broker:** `mqtt://broker.hivemq.com`
- **Tópicos:**
  - `foroptero01/cmd` - Comandos al ESP32 (foróptero)
  - `foroptero01/state` - Estado publicado por el ESP32
  - `foroptero01/pantalla` - Comandos a la pantalla/TV

### Formato de Comandos

**Foróptero:**
```json
{
  "accion": "movimiento",
  "R": {
    "esfera": 0.75,
    "cilindro": -1.75,
    "angulo": 60,
    "occlusion": "open"
  },
  "L": {
    "occlusion": "close"
  },
  "token": "foropteroiñaki2022#",
  "timestamp": 1234567890
}
```

**Pantalla/TV:**
```json
{
  "dispositivo": "pantalla",
  "accion": "mostrar",
  "letra": "H",
  "logmar": 0.4,
  "token": "foropteroiñaki2022#",
  "timestamp": 1234567890
}
```

### Estados del Foróptero

- `"ready"` - Foróptero listo
- `"busy"` - Foróptero en movimiento
- `"offline"` - Foróptero desconectado (sin heartbeat por más de 90 segundos)

---

## 📝 Estado Actual de Implementación

### ✅ Implementado

1. **Backend:**
   - ✅ State machine del examen (motorExamen.js)
   - ✅ Endpoints HTTP para control web
   - ✅ Funciones internas para ejecución automática
   - ✅ Comunicación MQTT con dispositivos
   - ✅ ETAPA_1: Recolección de valores iniciales
   - ✅ ETAPA_2: Recálculo cilíndrico
   - ✅ ETAPA_3: Generación de secuencia y preparación
   - ✅ ETAPA_4: Test de agudeza visual inicial (parcial - falta agudeza alcanzada)
   - ✅ ETAPA_5: Test de lente esférico grueso (completo y probado)
   - ✅ ETAPA_5: Test de lente esférico fino (completo y probado)
   - ✅ ETAPA_5: Test de lente cilíndrico (completo y probado)
   - ✅ ETAPA_5: Test de lente cilíndrico ángulo (completo y probado)

2. **Agente AI:**
   - ✅ Conversación natural con el paciente
   - ✅ Interpretación de respuestas de agudeza
   - ✅ Interpretación de respuestas de comparación de lentes
   - ✅ Tools simplificadas (solo obtenerEtapa, estadoExamen, reiniciarExamen)
   - ✅ Ejecución automática de comandos (backend)

3. **Infraestructura:**
   - ✅ Servidor Express con endpoints HTTP
   - ✅ Cliente MQTT para comunicación con dispositivos
   - ✅ Detección de estado offline
   - ✅ Endpoint de detalle del examen (`/api/examen/detalle`)

### ❌ Falta Implementar

1. **ETAPA_5: Tests de Lentes**
   - ✅ Lente esférico grueso (completo y probado)
   - ✅ Lente esférico fino (completo y probado)
   - ✅ Lente cilíndrico (completo y probado)
   - ✅ Lente cilíndrico ángulo (completo y probado)

2. **Agudeza Alcanzada**
   - ❌ Test de agudeza después de todos los tests de lentes (por ojo)

3. **Finalización**
   - ❌ Mensaje final del examen
   - ❌ Resumen de resultados

4. **Binocular**
   - ❌ Test binocular (opcional, no priorizado)

---

## 🧪 Testing

### Endpoints del Examen

```bash
# Inicializar examen
curl -X POST https://foroptero-production.up.railway.app/api/examen/nuevo

# Obtener instrucciones
curl -X POST https://foroptero-production.up.railway.app/api/examen/instrucciones \
  -H "Content-Type: application/json" \
  -d '{}'

# Consultar estado
curl https://foroptero-production.up.railway.app/api/examen/estado

# Consultar detalle completo
curl https://foroptero-production.up.railway.app/api/examen/detalle

# Reiniciar examen
curl -X POST https://foroptero-production.up.railway.app/api/examen/reiniciar
```

### Endpoints de Control Web

```bash
# Control foróptero
curl -X POST https://foroptero-production.up.railway.app/api/movimiento \
  -H "Content-Type: application/json" \
  -d '{"accion":"movimiento","R":{"esfera":0.75,"cilindro":-1.75,"angulo":60}}'

# Estado foróptero
curl https://foroptero-production.up.railway.app/api/estado

# Control pantalla
curl -X POST https://foroptero-production.up.railway.app/api/pantalla \
  -H "Content-Type: application/json" \
  -d '{"dispositivo":"pantalla","accion":"mostrar","letra":"H","logmar":0.4}'

# Estado pantalla
curl https://foroptero-production.up.railway.app/api/pantalla
```

---

## 📚 Referencias

### Archivos de Documentación

- `reference/ARQUITECTURA_ENDPOINTS.md` - Arquitectura de endpoints y ejecución automática
- `reference/FASE1_IMPLEMENTACION_COMPLETA.md` - Implementación de ejecución automática
- `reference/FASE2_IMPLEMENTACION_COMPLETA.md` - Simplificación del agente
- `reference/PLAN_ETAPA_3_COMPLETA.md` - Plan de implementación de ETAPA_3
- `reference/ANALISIS_ELIMINAR_FUNCTION_CALLS.md` - Análisis de eliminación de function calls
- `reference/ANALISIS_ETAPA_4_AGUDEZA.md` - Análisis de implementación de agudeza visual

### Código Fuente

- `reference/foroptero-server/server.js` - Servidor Express + MQTT
- `reference/foroptero-server/motorExamen.js` - Motor de examen visual
- `src/app/agentConfigs/chatSupervisor/index.ts` - Configuración del agente AI

---

## 🚀 Despliegue

### Backend

- **Plataforma:** Railway
- **URL:** `https://foroptero-production.up.railway.app`
- **Puerto:** Configurado por Railway (variable de entorno `PORT`)

### Frontend

- **Plataforma:** Next.js (desarrollo local o Vercel)
- **Puerto:** 3000 (desarrollo)

---

## 📅 Historial de Implementación

- **FASE 1 (2025-01-27):** Backend ejecuta comandos automáticamente
- **FASE 2 (2025-01-27):** Agente simplificado (eliminación de tools de dispositivos)
- **ETAPA_3 (2025-01-27):** Generación de secuencia del examen
- **ETAPA_4 (2025-01-27):** Test de agudeza visual inicial (parcial - falta agudeza alcanzada)
- **FASE 4 (2025-11-19):** Test de lente esférico grueso (completo y probado)
- **FASE 5 (2025-01-27):** Test de lente esférico fino (completo y probado)
- **FASE 5 (2025-01-27):** Test de lente cilíndrico (completo y probado)
- **FASE 5 (2025-01-27):** Test de lente cilíndrico ángulo (completo y probado)
- **Bug Fix (2025-01-27):** Corrección del sistema de confirmación en esférico fino - ahora incrementa correctamente las confirmaciones en lugar de resetearlas, evitando comparaciones duplicadas
- **Bug Fix (2025-01-27):** Corrección en `determinarTestsActivos()` - las comparaciones para rangos negativos estaban invertidas, impidiendo que el test cilíndrico se incluyera en la secuencia cuando correspondía

---

**Última actualización:** 2025-01-27  
**Estado:** Implementación parcial - Todos los tests de lentes completados (esférico grueso, fino, cilíndrico y cilíndrico ángulo). Pendiente: agudeza alcanzada y finalización
