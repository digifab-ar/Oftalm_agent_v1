import type { RealtimeSession } from '@openai/agents/realtime';

/** Señal interna (cliente → agente). No se muestra en transcript. */
export const POST_COMPARACION_CONTINUAR_NUDGE = '__POST_COMPARACION_CONTINUAR__';

export function isPostComparacionContinuarNudge(text: string): boolean {
  return text.trim() === POST_COMPARACION_CONTINUAR_NUDGE;
}

function parseToolResult(result: unknown): Record<string, unknown> | null {
  if (typeof result === 'string') {
    try {
      return JSON.parse(result) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (result && typeof result === 'object') {
    return result as Record<string, unknown>;
  }
  return null;
}

/**
 * Tras postComparacionContinuar el agente debe encadenar obtenerEtapa({}) al terminar TTS de Sigamos.
 * Si el modelo no lo hace solo, el cliente envía una señal interna al detectar audio_stopped.
 */
export function attachPostComparacionContinuarHandlers(
  session: RealtimeSession,
  logClientEvent: (obj: Record<string, unknown>, suffix?: string) => void,
): () => void {
  let pending = false;

  const onToolEnd = (_ctx: unknown, _agent: unknown, tool: { name?: string }, result: unknown) => {
    if (tool?.name !== 'obtenerEtapa') return;
    const parsed = parseToolResult(result);
    const contexto = parsed?.contexto as Record<string, unknown> | undefined;
    if (contexto?.postComparacionContinuar === true) {
      pending = true;
    }
  };

  const onToolStart = (
    _ctx: unknown,
    _agent: unknown,
    tool: { name?: string },
    _details?: unknown,
  ) => {
    if (tool?.name === 'obtenerEtapa' && pending) {
      pending = false;
    }
  };

  const onAudioStopped = () => {
    if (!pending) return;
    pending = false;
    logClientEvent({ type: 'post_comparacion_continuar_nudge' }, 'auto_chain');
    session.sendMessage(POST_COMPARACION_CONTINUAR_NUDGE);
  };

  session.on('agent_tool_end', onToolEnd);
  session.on('agent_tool_start', onToolStart);
  session.on('audio_stopped', onAudioStopped);

  return () => {
    session.removeListener('agent_tool_end', onToolEnd);
    session.removeListener('agent_tool_start', onToolStart);
    session.removeListener('audio_stopped', onAudioStopped);
  };
}
