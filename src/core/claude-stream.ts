/**
 * FRIGG — mapeia o stream-json do Claude Code headless para SessionEvent (G2/G4).
 *
 * Baseado na doc oficial de `claude -p --output-format stream-json --verbose`:
 * cada linha é um objeto JSON com `type`:
 *  - system (subtype: init | api_retry | ...)  → início/telemetria
 *  - assistant | user | stream_event           → atividade em curso
 *  - result (subtype: success|error, is_error)  → fim de turno (o sinal confiável)
 *
 * PURO e testável (sem IO). O adaptador (main) faz o spawn e chama isto por linha.
 * Aprovações interativas NÃO vêm pelo CLI -p (só pelo Agent SDK canUseTool);
 * por isso o adaptador Claude-CLI declara approvals=false.
 */
import type { SessionEvent } from './turn-state.js';

export interface ClaudeMsg {
  readonly type: string;
  readonly subtype?: string;
  readonly is_error?: boolean;
  readonly session_id?: string;
  readonly result?: string;
  readonly total_cost_usd?: number;
  readonly [k: string]: unknown;
}

/** Faz parse de uma linha NDJSON. Retorna null em linha vazia/inválida (tolerante). */
export function parseStreamLine(line: string): ClaudeMsg | null {
  const t = line.trim();
  if (t.length === 0) return null;
  try {
    const v = JSON.parse(t) as unknown;
    if (typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string') {
      return v as ClaudeMsg;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Mapeia UMA mensagem do Claude para eventos normalizados. Só `result` conclui
 * o turno (nunca heurística de texto). `system/init` abre o turno.
 */
export function claudeMsgToEvents(msg: ClaudeMsg): SessionEvent[] {
  const turnId = msg.session_id ?? 'claude-turn';
  if (msg.type === 'system' && msg.subtype === 'init') {
    return [{ type: 'turn.started', turnId }];
  }
  if (msg.type === 'result') {
    if (msg.is_error === true || msg.subtype === 'error') {
      return [{ type: 'turn.failed', turnId, error: msg.result ?? msg.subtype ?? 'erro' }];
    }
    return [{ type: 'turn.completed', turnId }];
  }
  // assistant | user | stream_event | outros system: atividade, sem transição.
  return [];
}

/** Custo estimado do turno, quando o `result` traz. */
export function costFromResult(msg: ClaudeMsg): number | null {
  return typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : null;
}
