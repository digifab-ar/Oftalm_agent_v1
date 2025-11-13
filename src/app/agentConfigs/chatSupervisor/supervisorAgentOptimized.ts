/**
 * VERSIÓN OPTIMIZADA DEL SUPERVISOR
 * 
 * ESTRATEGIA 1: Instrucciones modulares con herramienta de contexto
 * 
 * En lugar de enviar todas las instrucciones en el prompt inicial,
 * mantenemos un prompt base corto y usamos una herramienta que devuelve
 * las instrucciones específicas de cada etapa cuando se necesitan.
 * 
 * VENTAJAS:
 * - Reduce tokens en el prompt inicial
 * - El modelo solo accede a las instrucciones cuando las necesita
 * - Más fácil de mantener y actualizar
 * 
 * DESVENTAJAS:
 * - Requiere que el modelo llame a la herramienta para obtener contexto
 * - Puede agregar una pequeña latencia adicional
 */

import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { 
  INSTRUCCIONES_SUPERVISOR, 
  obtenerInstruccionesEtapa,
  construirInstruccionesCompletas 
} from './instructionsModular';

const supervisorAgentOptimized = new RealtimeAgent({
  name: 'Oftalmólogo Virtual Optimizado',
  voice: 'alloy',
  // PROMPT ESPECÍFICO PARA SUPERVISOR - Enfocado en lógica técnica y herramientas
  instructions: INSTRUCCIONES_SUPERVISOR,
  
  tools: [
    // HERRAMIENTA DE CONTEXTO: Devuelve instrucciones específicas por etapa
    tool({
      name: 'obtenerInstruccionesEtapa',
      description: 'Obtiene las instrucciones detalladas para una etapa específica del examen visual. Úsala cuando necesites recordar el protocolo de una etapa particular.',
      parameters: {
        type: 'object',
        properties: {
          etapa: {
            type: 'string',
            enum: ['1', '2', '3', '4', 'recoleccion', 'calculo', 'secuencia', 'agudeza'],
            description: 'Identificador de la etapa: 1/recoleccion, 2/calculo, 3/secuencia, 4/agudeza'
          }
        },
        required: ['etapa'],
        additionalProperties: false
      },
      execute: async (input: any) => {
        const { etapa } = input as { etapa: string };
        const instrucciones = obtenerInstruccionesEtapa(etapa);
        
        return {
          ok: true,
          etapa,
          instrucciones: instrucciones || 'Etapa no encontrada'
        };
      }
    }),

    // HERRAMIENTA PARA OBTENER TODAS LAS INSTRUCCIONES (útil para referencia completa)
    tool({
      name: 'obtenerTodasLasInstrucciones',
      description: 'Obtiene todas las instrucciones del examen. Úsala solo si necesitas una referencia completa de todas las etapas.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      },
      execute: async () => {
        const todasLasEtapas = ['1', '2', '3', '4'];
        const instruccionesCompletas = construirInstruccionesCompletas(todasLasEtapas);
        
        return {
          ok: true,
          instrucciones: instruccionesCompletas
        };
      }
    }),

    // Herramientas existentes del foróptero y TV
    tool({
      name: 'enviarComandoForoptero',
      description: 'Envía un comando de ajuste completo al foróptero digital. Puede ajustar el ojo derecho (R), izquierdo (L) o ambos. Permite configurar esfera, cilindro, ángulo y oclusión para cada ojo. Retorna el estado actual del foróptero (busy mientras se mueve, ready cuando termina).',
      parameters: {
        type: 'object',
        properties: {
          R: {
            type: 'object',
            description: 'Configuración para ojo derecho',
            properties: {
              esfera: { type: 'number', description: 'Valor esférico' },
              cilindro: { type: 'number', description: 'Valor cilíndrico' },
              angulo: { type: 'number', description: 'Ángulo del cilindro (0-180)' },
              occlusion: { 
                type: 'string', 
                enum: ['open', 'close'],
                description: 'Estado de oclusión: "open" para abierto, "close" para cerrado'
              }
            },
            required: [],
            additionalProperties: false
          },
          L: {
            type: 'object',
            description: 'Configuración para ojo izquierdo',
            properties: {
              esfera: { type: 'number', description: 'Valor esférico' },
              cilindro: { type: 'number', description: 'Valor cilíndrico' },
              angulo: { type: 'number', description: 'Ángulo del cilindro (0-180)' },
              occlusion: { 
                type: 'string', 
                enum: ['open', 'close'],
                description: 'Estado de oclusión: "open" para abierto, "close" para cerrado'
              }
            },
            required: [],
            additionalProperties: false
          }
        },
        required: [],
        additionalProperties: false
      },
      execute: async (input: any) => {
        const { R, L } = input as { 
          R?: { esfera?: number; cilindro?: number; angulo?: number; occlusion?: 'open' | 'close' };
          L?: { esfera?: number; cilindro?: number; angulo?: number; occlusion?: 'open' | 'close' };
        };

        const payload: { 
          accion: string; 
          R?: { esfera?: number; cilindro?: number; angulo?: number; occlusion?: string };
          L?: { esfera?: number; cilindro?: number; angulo?: number; occlusion?: string };
        } = {
          accion: 'movimiento'
        };

        if (R !== undefined) {
          const rConfig: { esfera?: number; cilindro?: number; angulo?: number; occlusion?: string } = {};
          if (R.esfera !== undefined) rConfig.esfera = R.esfera;
          if (R.cilindro !== undefined) rConfig.cilindro = R.cilindro;
          if (R.angulo !== undefined) rConfig.angulo = R.angulo;
          if (R.occlusion !== undefined) rConfig.occlusion = R.occlusion;
          
          if (Object.keys(rConfig).length > 0) {
            payload.R = rConfig;
          }
        }

        if (L !== undefined) {
          const lConfig: { esfera?: number; cilindro?: number; angulo?: number; occlusion?: string } = {};
          if (L.esfera !== undefined) lConfig.esfera = L.esfera;
          if (L.cilindro !== undefined) lConfig.cilindro = L.cilindro;
          if (L.angulo !== undefined) lConfig.angulo = L.angulo;
          if (L.occlusion !== undefined) lConfig.occlusion = L.occlusion;
          
          if (Object.keys(lConfig).length > 0) {
            payload.L = lConfig;
          }
        }

        if (payload.R === undefined && payload.L === undefined) {
          return { 
            ok: false, 
            msg: 'Debe especificarse al menos un parámetro válido para R (ojo derecho) o L (ojo izquierdo)' 
          };
        }

        try {
          const response = await fetch('https://foroptero-production.up.railway.app/api/movimiento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error en respuesta del servidor:', errorText);
            return { ok: false, msg: `Error del servidor: ${errorText}` };
          }

          const data = await response.json();
          console.log('✅ Comando foróptero enviado:', data);
          
          return { 
            ok: true, 
            msg: `Comando enviado. Estado: ${data.status}`,
            status: data.status,
            timestamp: data.timestamp,
            R: data.R,
            L: data.L
          };

        } catch (error: any) {
          console.error('⚠️ Error enviando comando al foróptero:', error);
          return { ok: false, msg: `Error de conexión: ${error.message}` };
        }
      }
    }),
    
    tool({
      name: 'consultarEstadoForoptero',
      description: 'Consulta el estado actual del foróptero digital mediante GET. Retorna "busy" si está realizando un movimiento o "ready" si está listo para recibir un nuevo comando, junto con los valores actuales de las lentes.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      },
      execute: async () => {
        try {
          const response = await fetch('https://foroptero-production.up.railway.app/api/movimiento', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error consultando estado del foróptero:', errorText);
            return { ok: false, msg: `Error del servidor: ${errorText}` };
          }

          const data = await response.json();
          console.log('✅ Estado del foróptero consultado:', data);
          
          return { 
            ok: true, 
            msg: `Estado: ${data.status}`,
            status: data.status,
            timestamp: data.timestamp,
            R: data.R,
            L: data.L
          };

        } catch (error: any) {
          console.error('⚠️ Error consultando estado del foróptero:', error);
          return { ok: false, msg: `Error de conexión: ${error.message}` };
        }
      }
    }),
    
    tool({
      name: 'enviarComandoTV',
      description: 'Envía un comando HTTP POST al servidor para mostrar una letra en la TV de optotipos.',
      parameters: {
        type: 'object',
        properties: {
          letra: { type: 'string', description: 'Letra a mostrar en la pantalla' },
          logmar: { type: 'number', description: 'Valor logMAR correspondiente a la escala del test visual' }
        },
        required: ['letra', 'logmar'],
        additionalProperties: false
      },
      execute: async (input: any) => {
        const { letra, logmar } = input as { letra: string; logmar: number };
    
        const payload = {
          dispositivo: 'pantalla',
          accion: 'mostrar',
          letra,
          logmar,
          token: 'foropteroiñaki2022#'
        };
    
        try {
          const response = await fetch('https://foroptero-production.up.railway.app/api/pantalla', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
    
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error en respuesta del servidor:', errorText);
            return { ok: false, msg: `Error del servidor: ${errorText}` };
          }
    
          const data = await response.json();
          console.log('✅ Comando enviado correctamente:', data);
          return { ok: true, msg: `Letra ${letra} mostrada con logMAR ${logmar}`, response: data };
    
        } catch (error: any) {
          console.error('⚠️ Error enviando comando a la TV:', error);
          return { ok: false, msg: `Error de conexión: ${error.message}` };
        }
      }
    }),
  ],
  handoffs: []
});

export default supervisorAgentOptimized;

