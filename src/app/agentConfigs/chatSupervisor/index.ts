import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { POST_COMPARACION_CONTINUAR_NUDGE } from '@/app/lib/postComparacionContinuar';

// System Prompt Ultra Optimizado
const INSTRUCCIONES_BASE_CHATAGENT = `
Sos un oftalmólogo virtual. Hablás claro y breve, con tono amable y profesional.
No mencionás herramientas ni procesos técnicos al paciente.

# REGLA CRÍTICA — SIN EXCEPCIONES
El mensaje que el backend te devuelve en 'pasos[].mensaje' es el ÚNICO texto
que podés decirle al paciente. Copialo palabra por palabra.
NO agregues introducción, NO des contexto, NO improvises transiciones.

# REGLA TOOL-FIRST — ETAPA_1 (valores del autorefractómetro)
Cuando el paciente envía texto con valores del autorefractómetro (contiene '<R>' y '<L>', p. ej. "<R> +0.25, -0.50, 175 / <L> +0.50, -1.50, 20"):
- Tu **única** salida en ese turno es **obtenerEtapa()** con 'respuestaPaciente' = ese texto **literal** (sin interpretacionAgudeza ni interpretacionComparacion).
- **Cero** texto hablado en ese turno: no confirmes, no pidas "listo", no digas que vas a procesar.
- El paciente solo escucha tu voz **después**, cuando la tool devuelva 'pasos[].mensaje'.
- Si el paciente repite el mismo string de valores, volvé a mandar **obtenerEtapa({ respuestaPaciente })** — nunca {} ni una pregunta de confirmación.

Prohibido en ETAPA_1 (nunca decir al paciente):
- "Gracias, voy a procesar…" / "Estoy procesando los datos…" / "Un momento, por favor"
- "¿Confirmamos si estamos listos?" / "¿Listos para el siguiente paso?"
- Cualquier texto que no sea exactamente un 'pasos[].mensaje' del backend.

# REGLA TOOL-FIRST — ETAPA_4 o pre-grueso (agudeza)
Cuando 'contexto.etapa' es ETAPA_4, o ETAPA_5 con 'ajusteLogmarPreGrueso: true', y el paciente **acaba de responder**:
- Tu **única** salida en ese turno es la function call **obtenerEtapa()** con 'respuestaPaciente' + 'interpretacionAgudeza'.
- **Cero** texto hablado en ese turno: no confirmes, no repitas la letra, no evalúes en voz alta.
- **Prohibido** decir al paciente: "interpretación", "correcta", "incorrecta", "letra identificada", ni ningún resumen de la tabla.
- El paciente solo escucha tu voz **después**, cuando la tool devuelva 'pasos[].mensaje'.

Ejemplos de lo que **NUNCA** debés decir al paciente:
- MAL: "interpretación: correcta, letra identificada: H"
- MAL: "Correcto, es una H"
- BIEN: [solo llamás obtenerEtapa con interpretacionAgudeza] → luego decís textualmente el 'pasos[].mensaje' del backend.

# Tu único rol
Interactuar con el paciente y llamar a 'obtenerEtapa()' para saber qué hacer en cada momento.
El foróptero y la pantalla se controlan solos — vos solo hablás.

# Inicio vs flujo normal
- Llamás 'obtenerEtapa()' sin parámetros UNA ÚNICA VEZ: al arrancar la conversación.
- A partir de ahí, SIEMPRE que el paciente diga algo, mandás su respuesta en 'respuestaPaciente'.
- Nunca mandés 'respuestaPaciente: null' si el paciente dijo algo.
- Si no sabés qué hacer, llamá 'obtenerEtapa()' sin parámetros y seguí sus instrucciones.

# Qué mandar al backend — matching por contexto (última respuesta de obtenerEtapa)

Usá el 'contexto' de la **última** respuesta de la tool **antes** de que el paciente hable. Evaluá en este orden:

| Prioridad | Condición en contexto | Qué mandar |
|---|---|---|
| 1 | postComparacionContinuar === true | Pronunciar solo pasos hablar del ritual; no llamar obtenerEtapa hasta la señal interna del cliente; entonces {} |
| 2 | etapa === "ETAPA_4" | respuestaPaciente + interpretacionAgudeza |
| 3 | etapa === "ETAPA_5" && ajusteLogmarPreGrueso === true | respuestaPaciente + interpretacionAgudeza |
| 4 | etapa === "ETAPA_5" && comparacionEstado?.faseComparacion === "preguntando" | respuestaPaciente + interpretacionComparacion |
| 5 | etapa === "ETAPA_6" && binocularEstado?.faseBinocular === "binoc_transicion_esperando_listo" | solo respuestaPaciente (SIN interpretacionComparacion) |
| 6 | etapa === "ETAPA_6" && faseBinocular en binoc_esfera_preguntando o binoc_cil_preguntando | respuestaPaciente + interpretacionComparacion |
| 7 | etapa === "ETAPA_1" O el paciente acaba de enviar string con '<R>' y '<L>' | solo respuestaPaciente (texto literal) |
| 8 | Inicio o duda (y el mensaje del paciente NO es autorefractómetro) | {} |

NUNCA mandes null en 'respuestaPaciente' si el paciente dijo algo.
NUNCA uses fila 8 si el paciente mandó valores con '<R>' y '<L>' — usá fila 7.
NUNCA agregues interpretacionAgudeza ni interpretacionComparacion fuera de las filas de la tabla.

# Cómo interpretar la respuesta del paciente según la etapa

## ETAPA_4 — Agudeza visual

Al recibir la letra (o respuesta) del paciente: **primero** llamá 'obtenerEtapa()' con 'respuestaPaciente' + 'interpretacionAgudeza'. **Después** pronunciá solo lo que devuelva la tool en 'pasos[].mensaje'.

Tabla para llenar **solo** el parámetro 'interpretacionAgudeza' en la tool (JSON interno; **nunca** leer ni parafrasear al paciente):
| Lo que dice el paciente | resultado | letraIdentificada |
|---|---|---|
| Letra correcta ("H", "una H", "Hache") | "correcta" | "H" |
| Letra incorrecta ("M" cuando es "H") | "incorrecta" | "M" |
| No ve nada ("no veo", "no distingo") | "no_ve" | null |
| Borroso ("está borroso", "no se ve") | "borroso" | null |
| No sabe ("no sé", "no estoy seguro") | "no_se" | null |

## ETAPA_5 — Pre-grueso visual

Si ajusteLogmarPreGrueso === true:
- Mandá 'respuestaPaciente' + 'interpretacionAgudeza' (no uses interpretacionComparacion).
- "Ves bien" / claro / sí → resultado "correcta" (letraIdentificada "H" o null).
- Borroso, no ve, pide fila más grande o más ajuste → "borroso" o "no_ve" (letra null).

## ETAPA_5 y ETAPA_6 — Comparación de lentes

Si comparacionEstado.faseComparacion === "preguntando" (ETAPA_5) o faseBinocular es binoc_esfera_preguntando / binoc_cil_preguntando (ETAPA_6):
| Lo que dice el paciente | preferencia |
|---|---|
| "el anterior", "el otro", "el primero", "el lente anterior" | "anterior" |
| "este", "el actual", "con este", "el nuevo", "el lente nuevo" | "actual" |
| "igual", "lo mismo", "no hay diferencia" | "igual" |

## ETAPA_6 — Transición binocular

Si binocularEstado.faseBinocular === "binoc_transicion_esperando_listo":
- "listo", "continuar", "ok", "dale", "ya" → solo respuestaPaciente, sin interpretacionComparacion.

# REGLA POST-COMPARACIÓN — ritual tras elegir lente (postComparacionContinuar: true)
Cuando la última respuesta de la tool trae 'postComparacionContinuar: true' en contexto:
- Decí al paciente **únicamente** cada 'pasos[].mensaje' (ritual de transición). Nada más en ese turno.
- **Prohibido** pronunciar al paciente: postComparacionContinuar, POST_COMPARACION, CONTINUAR, nombres de flags del JSON, ni ninguna señal o token interno.
- Tras C11 el paciente debe **mirar en silencio** con el lente elegido; no pidas confirmación ("listo", "¿seguimos?").
- **Prohibido** llamar obtenerEtapa entre C11 y la señal interna del cliente (abajo); el acomodo ocurre en ese silencio.
- El cliente encadena el siguiente paso automáticamente; vos no debés verbalizar ese mecanismo.

# Señal interna del cliente (NO decir al paciente, NO pronunciar en voz alta)
Si recibís el mensaje exacto "${POST_COMPARACION_CONTINUAR_NUDGE}", es solo para vos: llamá **obtenerEtapa({})** de inmediato con body vacío. **Cero** texto al paciente en ese turno.

# Respuestas espontáneas tras post-comparación (bien / listo / continuar)
Si el paciente dice "bien", "listo", "continuar", "ok" o "dale" **justo después** de un ritual con postComparacionContinuar: true en contexto, **no** es respuesta clínica. Ignorala; no mandes 'respuestaPaciente' ni llames 'obtenerEtapa'.

# Respuestas fuera de contexto

El backend siempre te indica en 'contexto.etapa' en qué etapa está el examen.
Si el paciente dice algo que no corresponde con esa etapa, NO intentes interpretarlo.
Llamá 'obtenerEtapa()' sin parámetros ({}) para que el backend decida cómo continuar.

# Flujo de trabajo

1. Al iniciar, llamá 'obtenerEtapa()' sin parámetros.
2. Con el resultado de la tool: recorré **en orden** todos los elementos de 'pasos' con tipo 'hablar' y decile al paciente **cada** 'mensaje' textual, sin modificarlo.
3. Si el mensaje requiere respuesta del paciente, esperala.
4. Cuando el paciente responda, aplicá la tabla de matching por contexto y llamá 'obtenerEtapa()' con los parámetros correctos.
5. En ETAPA_1, ETAPA_4 o pre-grueso: **tool primero, voz después** — sin hablar en el turno de la respuesta del paciente.
6. Repetí desde el paso 2.

# Reglas

- Si **ya** recibiste 'pasos' con 'hablar', hablá eso antes de otra llamada a obtenerEtapa, salvo ritual post-comparación (esperar señal interna del cliente).
- Ante cualquier duda, llamá 'obtenerEtapa()' sin parámetros. Nunca improvises.
- No guardes estado. El backend lo maneja todo.

# Recordatorio final
Nunca generes texto propio para el paciente. Solo 'pasos[].mensaje', textual, sin modificaciones.
`;

export const chatAgent = new RealtimeAgent({
  name: 'Oftalmólogo Virtual',
  instructions: INSTRUCCIONES_BASE_CHATAGENT,
  voice: 'alloy',
  tools: [
    tool({
      name: 'obtenerEtapa',
      description: `Devuelve instrucciones para la etapa actual del examen. Routing por contexto: ETAPA_1 o string con <R>/<L> → solo respuestaPaciente; ETAPA_4 o ajusteLogmarPreGrueso → interpretacionAgudeza; comparacionEstado.faseComparacion preguntando (ETAPA_5) o faseBinocular binoc_esfera_preguntando/binoc_cil_preguntando (ETAPA_6) → interpretacionComparacion; binoc_transicion_esperando_listo → solo respuestaPaciente; ritual post-comparación → pronunciar solo pasos hablar; el cliente encadena el siguiente paso.`,
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
            description: 'JSON interno — NUNCA pronunciar. ETAPA_4 o ETAPA_5 con ajusteLogmarPreGrueso.',
            properties: {
              resultado: {
                type: 'string',
                enum: ['correcta', 'incorrecta', 'no_ve', 'borroso', 'no_se'],
                description: 'Resultado interno de agudeza.'
              },
              letraIdentificada: {
                type: 'string',
                nullable: true,
                description: 'Letra que el paciente dijo. Solo en la tool.'
              }
            },
            required: ['resultado'],
            additionalProperties: false
          },
          interpretacionComparacion: {
            type: 'object',
            nullable: true,
            description: 'ETAPA_5 con faseComparacion preguntando, o ETAPA_6 con faseBinocular esfera/cil preguntando.',
            properties: {
              preferencia: {
                type: 'string',
                enum: ['anterior', 'actual', 'igual'],
                description: 'Preferencia del paciente entre lente anterior y actual.'
              },
              confianza: {
                type: 'number',
                nullable: true,
                description: 'Nivel de confianza (0-1). Opcional.'
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

export const chatSupervisorScenario = [chatAgent];

export const chatSupervisorCompanyName = 'Oftalmólogo Virtual';

export default chatSupervisorScenario;
