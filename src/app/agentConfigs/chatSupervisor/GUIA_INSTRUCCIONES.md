# 📋 Guía: Dónde están las Instrucciones y Cómo Funcionan

## 🗂️ Archivos con Instrucciones (Prompts)

### 1. **`index.ts`** - Agente Chat Principal
**Ubicación:** `src/app/agentConfigs/chatSupervisor/index.ts`

**Líneas 10-35:** Instrucciones del agente "Viejo" (chat principal)
```typescript
export const chatAgent = new RealtimeAgent({
  name: 'Viejo',
  instructions: `
    Eres un profesional oftalmólogo...
    // ~25 líneas de instrucciones
  `,
  voice: 'alloy',
  handoffs: [supervisorAgent] // ← Se conecta con el supervisor
});
```

**¿Qué hace?**
- Es el agente que habla directamente con el paciente
- Tiene instrucciones básicas sobre cómo comunicarse
- Cuando necesita hacer algo complejo, transfiere al supervisor

---

### 2. **`supervisorAgent.ts`** - Versión Original (NO se usa actualmente)
**Ubicación:** `src/app/agentConfigs/chatSupervisor/supervisorAgent.ts`

**Líneas 6-136:** Instrucciones completas del supervisor (ORIGINAL)
```typescript
const supervisorAgent = new RealtimeAgent({
  name: 'Oftalmólogo Virtual',
  instructions: `
    Domain-Specific Agent Instructions
    // ~130 líneas con TODAS las etapas del examen
    // ETAPA 1, ETAPA 2, ETAPA 3, ETAPA 4...
  `,
  tools: [...], // Herramientas del foróptero y TV
});
```

**Estado:** ⚠️ **NO se está usando** (se reemplazó por la versión optimizada)

**Problema:** 
- Tiene ~1500 tokens de instrucciones
- Se envían TODAS cada vez que se crea una sesión
- Muy costoso en tokens

---

### 3. **`supervisorAgentOptimized.ts`** - Versión Optimizada (ACTUAL) ✅
**Ubicación:** `src/app/agentConfigs/chatSupervisor/supervisorAgentOptimized.ts`

**Líneas 31-35:** Instrucciones base reducidas
```typescript
const supervisorAgentOptimized = new RealtimeAgent({
  name: 'Oftalmólogo Virtual Optimizado',
  instructions: `${INSTRUCCIONES_BASE}

IMPORTANTE: Cuando necesites instrucciones específicas para una etapa del examen, 
usa la herramienta 'obtenerInstruccionesEtapa' para acceder a las instrucciones detalladas.
Esto te ayudará a seguir el protocolo correcto en cada fase del examen.`,
```

**¿Qué hace?**
- Tiene solo ~200 tokens de instrucciones base
- Usa la herramienta `obtenerInstruccionesEtapa` para obtener instrucciones específicas cuando las necesita
- **Esta es la versión que se está usando actualmente**

---

### 4. **`instructionsModular.ts`** - Instrucciones por Etapa
**Ubicación:** `src/app/agentConfigs/chatSupervisor/instructionsModular.ts`

**Contiene:**
- `INSTRUCCIONES_BASE` (líneas ~7-30): Reglas generales
- `ETAPA_1_RECOLECCION` (líneas ~32-50): Instrucciones etapa 1
- `ETAPA_2_CALCULO` (líneas ~52-70): Instrucciones etapa 2
- `ETAPA_3_SECUENCIA` (líneas ~72-90): Instrucciones etapa 3
- `ETAPA_4_AGUDEZA_VISUAL` (líneas ~92-150): Instrucciones etapa 4

**Funciones:**
- `obtenerInstruccionesEtapa(etapa)`: Devuelve instrucciones de una etapa específica
- `construirInstruccionesCompletas(etapas)`: Construye instrucciones combinando etapas

**¿Cómo se usa?**
- La herramienta `obtenerInstruccionesEtapa` en el agente optimizado llama a estas funciones
- El modelo solo carga las instrucciones que necesita, cuando las necesita

---

## 🔄 Cómo Funciona el Flujo

### Flujo Actual (Versión Optimizada)

```
1. Usuario abre la app
   ↓
2. App.tsx carga chatSupervisorScenario desde index.ts
   ↓
3. index.ts exporta:
   - chatAgent (con instrucciones básicas)
   - supervisorAgentOptimized (con instrucciones base reducidas)
   ↓
4. useRealtimeSession.ts crea RealtimeSession
   ↓
5. RealtimeSession envía las instrucciones al API de OpenAI
   - chatAgent: ~300 tokens
   - supervisorAgentOptimized: ~200 tokens (solo base)
   ↓
6. Durante la conversación:
   - El modelo llama a obtenerInstruccionesEtapa('1') cuando necesita etapa 1
   - La herramienta devuelve solo las instrucciones de esa etapa (~300 tokens)
   - El modelo continúa con el contexto necesario
```

### Comparación: Original vs Optimizado

| Aspecto | Original | Optimizado |
|---------|----------|------------|
| **Archivo** | `supervisorAgent.ts` | `supervisorAgentOptimized.ts` |
| **Tokens iniciales** | ~1500 | ~200 |
| **Instrucciones completas** | Siempre en contexto | Solo cuando se necesitan |
| **Costo** | Alto | Bajo |
| **Mantenibilidad** | Media | Alta |

---

## 📍 Dónde se Envían las Instrucciones

### Punto de Envío: `useRealtimeSession.ts`

**Línea 128:** Se crea la sesión con los agentes
```typescript
sessionRef.current = new RealtimeSession(rootAgent, {
  // ...configuración
});
```

**¿Qué pasa aquí?**
1. `RealtimeSession` toma el `rootAgent` (primer agente del array)
2. Envía las instrucciones del agente al API de OpenAI
3. Las instrucciones se incluyen en el contexto del modelo
4. El modelo las usa para generar respuestas

**¿Cuándo se envían?**
- ✅ Al crear la sesión (una vez)
- ❌ NO en cada `session.update` (solo actualiza `turn_detection`)
- ✅ Si usas `session.update` con `instructions`, se actualizan dinámicamente

---

## 🛠️ Cómo Modificar las Instrucciones

### Opción 1: Modificar Instrucciones Base (Optimizado)
**Archivo:** `instructionsModular.ts`

```typescript
export const INSTRUCCIONES_BASE = `
  // Modifica aquí las reglas generales
  Eres un profesional oftalmólogo...
`;
```

### Opción 2: Modificar Instrucciones de una Etapa
**Archivo:** `instructionsModular.ts`

```typescript
export const ETAPA_1_RECOLECCION = `
  // Modifica aquí las instrucciones de la etapa 1
  ## ETAPA 1 — Recolección de datos iniciales
  ...
`;
```

### Opción 3: Modificar Instrucciones del Chat Agent
**Archivo:** `index.ts`

```typescript
export const chatAgent = new RealtimeAgent({
  instructions: `
    // Modifica aquí cómo habla el agente principal
  `,
});
```

---

## 🔍 Cómo Verificar Qué Versión se Está Usando

**Archivo:** `index.ts` (líneas 2-6)

```typescript
// Versión ACTUAL (Optimizada)
import supervisorAgentOptimized from './supervisorAgentOptimized';
const supervisorAgent = supervisorAgentOptimized;

// Versión ORIGINAL (comentada)
// import supervisorAgent from './supervisorAgent';
```

---

## 📊 Resumen Visual

```
┌─────────────────────────────────────────┐
│         index.ts                        │
│  ┌──────────────────────────────────┐  │
│  │ chatAgent                        │  │
│  │ instructions: ~300 tokens        │  │
│  └──────────────┬───────────────────┘  │
│                 │ handoffs              │
│  ┌──────────────▼───────────────────┐  │
│  │ supervisorAgentOptimized         │  │
│  │ instructions: ~200 tokens (base)  │  │
│  │ + herramienta obtenerInstrucciones│ │
│  └──────────────┬───────────────────┘  │
└─────────────────┼──────────────────────┘
                  │
                  │ usa
                  ▼
┌─────────────────────────────────────────┐
│    instructionsModular.ts              │
│  ┌──────────────────────────────────┐  │
│  │ INSTRUCCIONES_BASE                │  │
│  │ ETAPA_1_RECOLECCION               │  │
│  │ ETAPA_2_CALCULO                   │  │
│  │ ETAPA_3_SECUENCIA                 │  │
│  │ ETAPA_4_AGUDEZA_VISUAL            │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  │
                  │ se envía a
                  ▼
┌─────────────────────────────────────────┐
│    useRealtimeSession.ts                │
│  ┌──────────────────────────────────┐  │
│  │ RealtimeSession(rootAgent)       │  │
│  │ → Envía instrucciones a API     │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## ❓ Preguntas Frecuentes

### ¿Dónde están TODAS las instrucciones ahora?
En `instructionsModular.ts`, divididas por etapa.

### ¿Se envían todas al inicio?
No. Solo se envían las instrucciones base (~200 tokens). Las específicas se cargan cuando se necesitan.

### ¿Cómo sé qué versión está activa?
Revisa `index.ts` línea 2. Si dice `supervisorAgentOptimized`, estás usando la versión optimizada.

### ¿Puedo volver a la versión original?
Sí, cambia el import en `index.ts`:
```typescript
import supervisorAgent from './supervisorAgent';
// Comenta: import supervisorAgentOptimized from './supervisorAgentOptimized';
```

---

## 📝 Notas Importantes

1. **Las instrucciones se envían al crear la sesión**, no en cada mensaje
2. **`session.update` NO envía todo el prompt**, solo actualiza los campos que especifiques
3. **La versión optimizada es más eficiente** pero funciona igual que la original
4. **Puedes modificar las instrucciones** en `instructionsModular.ts` sin tocar el código del agente

