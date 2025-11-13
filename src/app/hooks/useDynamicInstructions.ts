/**
 * Hook para gestionar actualización dinámica de instrucciones
 * 
 * Este hook detecta cuando el agente cambia de etapa y actualiza
 * las instrucciones usando session.update
 */

import { useCallback, useEffect, useRef } from 'react';
import { construirInstruccionesCompletas } from '../agentConfigs/chatSupervisor/instructionsModular';

interface UseDynamicInstructionsOptions {
  sendEvent: (event: any) => void;
  sessionStatus: string;
  // Función para detectar cambios de etapa desde el transcript o eventos
  detectCurrentStage?: () => string | null;
}

export function useDynamicInstructions({
  sendEvent,
  sessionStatus,
  detectCurrentStage
}: UseDynamicInstructionsOptions) {
  const currentStageRef = useRef<string | null>(null);

  const updateInstructionsForStage = useCallback((stage: string) => {
    if (currentStageRef.current === stage) {
      return; // Ya está en esta etapa
    }

    const instrucciones = construirInstruccionesCompletas([stage]);
    
    sendEvent({
      type: 'session.update',
      session: {
        instructions: instrucciones
      }
    });

    currentStageRef.current = stage;
    console.log(`📝 Instrucciones actualizadas para etapa: ${stage}`);
  }, [sendEvent]);

  // Detectar cambios de etapa automáticamente si se proporciona la función
  useEffect(() => {
    if (sessionStatus !== 'CONNECTED' || !detectCurrentStage) {
      return;
    }

    const interval = setInterval(() => {
      const detectedStage = detectCurrentStage();
      if (detectedStage && detectedStage !== currentStageRef.current) {
        updateInstructionsForStage(detectedStage);
      }
    }, 2000); // Verificar cada 2 segundos

    return () => clearInterval(interval);
  }, [sessionStatus, detectCurrentStage, updateInstructionsForStage]);

  return {
    updateInstructionsForStage,
    currentStage: currentStageRef.current
  };
}

