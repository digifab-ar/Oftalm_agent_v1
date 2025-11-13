/**
 * VERSIÓN CON ACTUALIZACIÓN DINÁMICA DE INSTRUCCIONES
 * 
 * ESTRATEGIA 2: Actualizar instrucciones con session.update
 * 
 * Mantenemos un prompt base mínimo y actualizamos las instrucciones
 * dinámicamente usando session.update cuando cambiamos de etapa.
 * 
 * VENTAJAS:
 * - Instrucciones siempre actualizadas en el contexto
 * - No requiere que el modelo llame herramientas para obtener contexto
 * - Control total sobre qué instrucciones están activas
 * 
 * DESVENTAJAS:
 * - Requiere gestión de estado de la etapa actual
 * - session.update puede tener costo de tokens (aunque menor que enviar todo)
 * - Necesita lógica en el cliente para detectar cambios de etapa
 */

import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { 
  INSTRUCCIONES_BASE, 
  obtenerInstruccionesEtapa
} from './instructionsModular';

const supervisorAgentDynamic = new RealtimeAgent({
  name: 'Oftalmólogo Virtual Dinámico',
  voice: 'alloy',
  // PROMPT BASE MÍNIMO - Solo lo esencial para iniciar
  instructions: `${INSTRUCCIONES_BASE}

Estás en la ETAPA 1 - Recolección de datos iniciales.
Las instrucciones se actualizarán automáticamente cuando avances a nuevas etapas.`,
  
  tools: [
    // HERRAMIENTA PARA NOTIFICAR CAMBIO DE ETAPA
    // El cliente puede usar esto para actualizar las instrucciones vía session.update
    tool({
      name: 'cambiarEtapa',
      description: 'Notifica que estás cambiando a una nueva etapa del examen. Esto actualizará las instrucciones disponibles.',
      parameters: {
        type: 'object',
        properties: {
          etapa: {
            type: 'string',
            enum: ['1', '2', '3', '4', 'recoleccion', 'calculo', 'secuencia', 'agudeza'],
            description: 'Identificador de la etapa a la que estás cambiando'
          }
        },
        required: ['etapa'],
        additionalProperties: false
      },
      execute: async (input: any) => {
        const { etapa } = input as { etapa: string };
        const instruccionesEtapa = obtenerInstruccionesEtapa(etapa);
        
        // Esta herramienta devuelve las instrucciones que deberían actualizarse
        // El cliente debe usar session.update para aplicar estos cambios
        return {
          ok: true,
          etapa,
          instruccionesParaActualizar: instruccionesEtapa,
          mensaje: `Cambiando a etapa ${etapa}. Las instrucciones deben actualizarse en el cliente usando session.update.`
        };
      }
    }),

    // Herramientas existentes del foróptero y TV (igual que la versión original)
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

export default supervisorAgentDynamic;

