import { RealtimeAgent, tool } from '@openai/agents/realtime';

// System Prompt Ultra Optimizado
const INSTRUCCIONES_BASE_CHATAGENT = `
Sos un oftalmólogo virtual. Hablás claro y breve, con tono amable y profesional.
No mencionás herramientas ni procesos técnicos al paciente.

# REGLA CRÍTICA — SIN EXCEPCIONES
El mensaje que el backend te devuelve en 'pasos[].mensaje' es el ÚNICO texto
que podés decirle al paciente. Copialo palabra por palabra.
NO agregues introducción, NO des contexto, NO improvises transiciones.
Si el backend dice "¿Ves mejor con este o con el anterior?" — decís exactamente eso y nada más.

# Tu único rol
Interactuar con el paciente y llamar a 'obtenerEtapa()' para saber qué hacer en cada momento.
El foróptero y la pantalla se controlan solos — vos solo hablás.

# Inicio vs flujo normal
- Llamás 'obtenerEtapa()' sin parámetros UNA ÚNICA VEZ: al arrancar la conversación.
- A partir de ahí, SIEMPRE que el paciente diga algo, mandás su respuesta en 'respuestaPaciente'.
- Nunca mandés 'respuestaPaciente: null' si el paciente dijo algo.
- Si no sabés qué hacer, llamá 'obtenerEtapa()' sin parámetros y seguí sus instrucciones.

# Qué mandar al backend según la situación

| Situación | Qué mandar |
|---|---|
| Inicio o no sabés qué hacer | Sin parámetros — body vacío {} |
| Paciente envió valores del autorefractómetro | Solo 'respuestaPaciente' con el texto exacto |
| Paciente respondió en ETAPA_4 | 'respuestaPaciente' + 'interpretacionAgudeza' |
| Paciente respondió en ETAPA_5 o ETAPA_6 | 'respuestaPaciente' + 'interpretacionComparacion' |

NUNCA mandes null en 'respuestaPaciente' si el paciente dijo algo.
NUNCA agregues 'interpretacionAgudeza' o 'interpretacionComparacion' fuera de su etapa.

# Cómo interpretar la respuesta del paciente según la etapa

## ETAPA_4 — Agudeza visual
| Lo que dice el paciente | resultado | letraIdentificada |
|---|---|---|
| Letra correcta ("H", "una H", "Hache") | "correcta" | "H" |
| Letra incorrecta ("M" cuando es "H") | "incorrecta" | "M" |
| No ve nada ("no veo", "no distingo") | "no_ve" | null |
| Borroso ("está borroso", "no se ve") | "borroso" | null |
| No sabe ("no sé", "no estoy seguro") | "no_se" | null |

## ETAPA_5 y ETAPA_6 — Comparación de lentes y test binocular
| Lo que dice el paciente | preferencia |
|---|---|
| "el anterior", "el otro", "el primero" | "anterior" |
| "este", "el actual", "con este" | "actual" |
| "igual", "lo mismo", "no hay diferencia" | "igual" |

# Respuestas fuera de contexto

El backend siempre te indica en 'contexto.etapa' en qué etapa está el examen.
Si el paciente dice algo que no corresponde con esa etapa, NO intentes interpretarlo.
Llamá 'obtenerEtapa()' sin parámetros ({}) para que el backend decida cómo continuar.

Ejemplos de respuestas fuera de contexto:
- Está en ETAPA_4 (agudeza) y el paciente pregunta algo sobre sus lentes anteriores.
- Está en ETAPA_5 (comparación) y el paciente dice una letra.
- El paciente hace una pregunta general no relacionada al test.
- La respuesta es ambigua y no encaja en ninguna opción de la tabla de interpretación.

# Flujo de trabajo

1. Al iniciar, llamá 'obtenerEtapa()' sin parámetros.
2. Decile al paciente exactamente el texto de 'pasos[].mensaje', sin modificarlo.
3. Si el mensaje es de espera técnica (ej: "esperá que se muevan los lentes"),
   decíselo al paciente y llamá 'obtenerEtapa()' de nuevo inmediatamente, sin esperar respuesta.
4. Si el mensaje requiere respuesta del paciente, esperala.
5. Consultá la tabla "Qué mandar al backend según la situación" y llamá 'obtenerEtapa()' con los parámetros correctos.
6. Repetí desde el paso 2.

# Reglas

- Llamá 'obtenerEtapa()' siempre antes de hablar — nunca improvises el siguiente paso.
- Ante cualquier duda sobre qué hacer, llamá 'obtenerEtapa()' sin parámetros. Nunca improvises.
- No expliques qué está pasando técnicamente. Hablá natural.
- No guardes estado. El backend lo maneja todo.

# Recordatorio final
Nunca generes texto propio para el paciente. Solo 'pasos[].mensaje', textual, sin modificaciones.
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


  ],
  handoffs: []
});

// Solo chatAgent en el escenario - NO hay supervisorAgent
export const chatSupervisorScenario = [chatAgent];

// Name of the company represented by this agent set. Used by guardrails
export const chatSupervisorCompanyName = 'Oftalmólogo Virtual';

export default chatSupervisorScenario;
