import type { RealtimeSession } from '@openai/agents/realtime';

/** Señal interna (cliente → agente). No se muestra en transcript. */
export const POST_COMPARACION_CONTINUAR_NUDGE = '__POST_COMPARACION_CONTINUAR__';

/** Acomodo clínico post-C11: pausa tras TTS antes del nudge auto_chain (PLAN_ACOMODO_POST_C11). */
export const POST_COMPARACION_CLIENT_PAUSE_MS = 6000;

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
 * Tras postComparacionContinuar el agente debe encadenar obtenerEtapa({}) al terminar TTS de C11.
 * Si el modelo no lo hace solo, el cliente envía una señal interna al detectar audio_stopped.
 */
export function attachPostComparacionContinuarHandlers(
  session: RealtimeSession,
  logClientEvent: (obj: Record<string, unknown>, suffix?: string) => void,
): () => void {
  let pending = false;
  let nudgeScheduled = false;
  let nudgeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearNudgeTimeout = () => {
    if (nudgeTimeoutId !== null) {
      clearTimeout(nudgeTimeoutId);
      nudgeTimeoutId = null;
    }
    nudgeScheduled = false;
  };

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
    if (tool?.name !== 'obtenerEtapa') return;
    if (pending) {
      pending = false;
    }
    if (nudgeScheduled) {
      clearNudgeTimeout();
    }
  };

  const onAudioStopped = () => {
    if (!pending) return;
    pending = false;
    clearNudgeTimeout();
    nudgeScheduled = true;
    nudgeTimeoutId = setTimeout(() => {
      nudgeTimeoutId = null;
      nudgeScheduled = false;
      logClientEvent({ type: 'post_comparacion_continuar_nudge' }, 'auto_chain');
      session.sendMessage(POST_COMPARACION_CONTINUAR_NUDGE);
    }, POST_COMPARACION_CLIENT_PAUSE_MS);
  };

  session.on('agent_tool_end', onToolEnd);
  session.on('agent_tool_start', onToolStart);
  session.on('audio_stopped', onAudioStopped);

  return () => {
    clearNudgeTimeout();
    session.removeListener('agent_tool_end', onToolEnd);
    session.removeListener('agent_tool_start', onToolStart);
    session.removeListener('audio_stopped', onAudioStopped);
  };
}
