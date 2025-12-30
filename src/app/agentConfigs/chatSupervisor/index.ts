import { RealtimeAgent, tool } from '@openai/agents/realtime';

// System Prompt Ultra Optimizado
const INSTRUCCIONES_BASE_CHATAGENT = `
Sos un oftalmólogo virtual. Hablás claro y breve, con tono amable y profesional. No mencionás herramientas ni procesos técnicos.

Tu único rol es interactuar con el paciente y pedir al backend las instrucciones usando la tool \`obtenerEtapa()\`.

# IMPORTANTE: El backend ejecuta automáticamente todos los comandos
El backend maneja TODO automáticamente:
- Ajustes del foróptero (se ejecutan automáticamente)
- Mostrar letras en la TV (se ejecuta automáticamente)
- Tiempos de espera (se manejan automáticamente)
- Toda la lógica del examen

**NO necesitas llamar herramientas para foróptero o TV. El backend lo hace automáticamente.**

Seguí exactamente las instrucciones que el backend te devuelva.

No inventes pasos ni guardes estado; pedí al backend el estado cuando lo necesites.

Siempre hablá de manera natural y clínica: "Mirá la pantalla", "Decime qué letra ves", "Seguimos con otra".

# Flujo de Trabajo

1. **Al iniciar, llama \`obtenerEtapa()\` para obtener la primera instrucción**
2. El backend ejecuta automáticamente todos los comandos necesarios (foróptero, TV, esperar)
3. El backend te devuelve solo pasos de tipo "hablar" con los mensajes que debes decir
4. Habla al paciente usando el mensaje exacto que el backend te da
5. Después de hablar, espera la respuesta del paciente
6. Cuando el paciente responda:
   - **Si estás en test de agudeza visual (ETAPA_4):** Interpreta la respuesta y llama \`obtenerEtapa(respuestaPaciente, interpretacionAgudeza)\` con la interpretación estructurada
   - **Si estás en test de comparación de lentes (ETAPA_5) o test binocular (ETAPA_6):** Interpreta la preferencia y llama \`obtenerEtapa(respuestaPaciente, null, interpretacionComparacion)\` con la interpretación estructurada
   - **Si no estás en agudeza ni comparación:** Llama \`obtenerEtapa(respuestaPaciente)\` con su respuesta
7. El backend procesará la respuesta, ejecutará comandos automáticamente, y te dará nuevos pasos de "hablar"
8. Repite desde el paso 4

# Interpretación de Respuestas de Agudeza Visual

Cuando estás en un test de agudeza visual (el backend te indica que estás en ETAPA_4), debes interpretar la respuesta del paciente y enviar un formato estructurado:

Formato de interpretación:
- Si el paciente dice una letra correcta (ej: "H", "veo una H", "Hache", "Es una H") → resultado: "correcta", letraIdentificada: "H"
- Si el paciente dice una letra incorrecta (ej: "M" cuando se mostró "H") → resultado: "incorrecta", letraIdentificada: "M"
- Si el paciente dice que no ve (ej: "No veo nada", "No la distingo", "No la puedo leer") → resultado: "no_ve", letraIdentificada: null
- Si el paciente dice que está borroso (ej: "Está borroso", "No se ve bien") → resultado: "borroso", letraIdentificada: null
- Si el paciente no está seguro (ej: "No sé", "No estoy seguro") → resultado: "no_se", letraIdentificada: null

Ejemplo de llamada:
obtenerEtapa con respuestaPaciente: "H" e interpretacionAgudeza: { resultado: "correcta", letraIdentificada: "H" }

# Interpretación de Respuestas de Comparación de Lentes

Cuando estás en un test de comparación de lentes (el backend te indica que estás en ETAPA_5) o en test binocular (ETAPA_6), debes interpretar la preferencia del paciente y enviar un formato estructurado:

Formato de interpretación:
- Si el paciente prefiere el lente anterior (ej: "Con el anterior", "El otro", "El primero") → preferencia: "anterior"
- Si el paciente prefiere el lente actual (ej: "Con este", "Este", "El actual") → preferencia: "actual"
- Si el paciente dice que son iguales (ej: "Iguales", "No hay diferencia", "Lo mismo") → preferencia: "igual"

Ejemplo de llamada:
obtenerEtapa con respuestaPaciente: "Con el anterior" e interpretacionComparacion: { preferencia: "anterior" }

# Reglas Absolutas

- **NUNCA decidas qué hacer** - siempre consulta \`obtenerEtapa()\` primero
- **NUNCA llames herramientas para foróptero o TV** - el backend lo hace automáticamente
- **Solo ejecuta pasos de tipo "hablar"** - todos los demás pasos los ejecuta el backend
- **Usa el mensaje exacto** que el backend te da
- **No expliques procesos** - solo habla de forma natural
- **No guardes estado** - el backend maneja todo

`;

export const chatAgent = new RealtimeAgent({
  name: 'Oftalmólogo Virtual',
  instructions: INSTRUCCIONES_BASE_CHATAGENT,
  voice: 'alloy',
  tools: [
    // Tool 1: Obtener instrucciones de la etapa actual (ÚNICA tool principal)
    // El backend ejecuta automáticamente todos los comandos (foróptero, TV)
    // y solo retorna pasos de tipo "hablar" para que el agente ejecute
    tool({
      name: 'obtenerEtapa',
      description: 'Devuelve instrucciones para la etapa actual del examen. Si el paciente acaba de responder, incluye la respuesta en respuestaPaciente. Si estás en test de agudeza visual (ETAPA_4), también incluye interpretacionAgudeza. Si estás en test de comparación de lentes (ETAPA_5) o test binocular (ETAPA_6), también incluye interpretacionComparacion con la interpretación estructurada de la preferencia.',
      parameters: {
        type: 'object',
        properties: {
          respuestaPaciente: {
            type: 'string',
            nullable: true,
            description: 'Respuesta del paciente (letra, valores, preferencia de lente). Solo incluir si el paciente acaba de responder.'
          },
          interpretacionAgudeza: {
            type: 'object',
            nullable: true,
            description: 'Interpretación estructurada de la respuesta del paciente en test de agudeza visual. Solo incluir si estás en ETAPA_4 y el paciente acaba de responder.',
            properties: {
              resultado: {
                type: 'string',
                enum: ['correcta', 'incorrecta', 'no_ve', 'borroso', 'no_se'],
                description: 'Resultado de la interpretación: "correcta" si identificó la letra correcta, "incorrecta" si dijo otra letra, "no_ve" si no ve nada, "borroso" si está borroso, "no_se" si no está seguro.'
              },
              letraIdentificada: {
                type: 'string',
                nullable: true,
                description: 'Letra que el paciente identificó (ej: "H", "K"). Null si no identificó ninguna letra.'
              }
            },
            required: ['resultado'],
            additionalProperties: false
          },
          interpretacionComparacion: {
            type: 'object',
            nullable: true,
            description: 'Interpretación estructurada de la respuesta del paciente en test de comparación de lentes o test binocular. Solo incluir si estás en ETAPA_5 o ETAPA_6 y el paciente acaba de responder sobre su preferencia de lentes.',
            properties: {
              preferencia: {
                type: 'string',
                enum: ['anterior', 'actual', 'igual'],
                description: 'Preferencia del paciente: "anterior" si prefiere el lente anterior, "actual" si prefiere el lente actual mostrado, "igual" si ambos son iguales.'
              },
              confianza: {
                type: 'number',
                nullable: true,
                description: 'Nivel de confianza en la interpretación (0-1). Opcional.'
              }
            },
            required: ['preferencia'],
            additionalProperties: false
          }
        },
        required: [],
        additionalProperties: false
      },
      execute: async (input: any) => {
        const { respuestaPaciente, interpretacionAgudeza, interpretacionComparacion } = input as { 
          respuestaPaciente?: string | null;
          interpretacionAgudeza?: {
            resultado: 'correcta' | 'incorrecta' | 'no_ve' | 'borroso' | 'no_se';
            letraIdentificada?: string | null;
          } | null;
          interpretacionComparacion?: {
            preferencia: 'anterior' | 'actual' | 'igual';
            confianza?: number | null;
          } | null;
        };
        
        const body: any = {};
        if (respuestaPaciente) {
          body.respuestaPaciente = respuestaPaciente;
        }
        if (interpretacionAgudeza) {
          body.interpretacionAgudeza = interpretacionAgudeza;
        }
        if (interpretacionComparacion) {
          body.interpretacionComparacion = interpretacionComparacion;
        }
        
        try {
          const response = await fetch('https://foroptero-production.up.railway.app/api/examen/instrucciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          
          if (!response.ok) {
            return { ok: false, msg: `Error del servidor: ${response.statusText}` };
          }
          
          return await response.json();
        } catch (error: any) {
          return { ok: false, msg: `Error de conexión: ${error.message}` };
        }
      }
    }),

    // Tool 2: Consultar estado del examen (opcional, para debugging)
    tool({
      name: 'estadoExamen',
      description: 'Devuelve el estado clínico actual del examen. Úsala solo si necesitas información adicional sobre el progreso.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      },
      execute: async () => {
        try {
          const response = await fetch('https://foroptero-production.up.railway.app/api/examen/estado', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) {
            return { ok: false, msg: `Error del servidor: ${response.statusText}` };
          }
          
          return await response.json();
        } catch (error: any) {
          return { ok: false, msg: `Error de conexión: ${error.message}` };
        }
      }
    }),


  ],
  handoffs: []
});

// Solo chatAgent en el escenario - NO hay supervisorAgent
export const chatSupervisorScenario = [chatAgent];

// Name of the company represented by this agent set. Used by guardrails
export const chatSupervisorCompanyName = 'Oftalmólogo Virtual';

export default chatSupervisorScenario;
