import { describe, it, expect } from 'vitest';
import { parseStreamLine, claudeMsgToEvents, costFromResult } from './claude-stream.js';
import { runEvents } from './turn-state.js';

describe('claude-stream parser', () => {
  it('ignora linhas vazias/inválidas', () => {
    expect(parseStreamLine('')).toBeNull();
    expect(parseStreamLine('não-json')).toBeNull();
    expect(parseStreamLine('{"no":"type"}')).toBeNull();
  });

  it('faz parse de linha válida', () => {
    const m = parseStreamLine('{"type":"system","subtype":"init","session_id":"s1"}');
    expect(m?.type).toBe('system');
    expect(m?.session_id).toBe('s1');
  });
});

describe('mapeamento claude -> SessionEvent', () => {
  it('system/init abre o turno', () => {
    const ev = claudeMsgToEvents({ type: 'system', subtype: 'init', session_id: 's1' });
    expect(ev).toEqual([{ type: 'turn.started', turnId: 's1' }]);
  });

  it('assistant/stream_event não transicionam o turno', () => {
    expect(claudeMsgToEvents({ type: 'assistant' })).toEqual([]);
    expect(claudeMsgToEvents({ type: 'stream_event' })).toEqual([]);
  });

  it('result success conclui; result error falha', () => {
    expect(claudeMsgToEvents({ type: 'result', subtype: 'success', session_id: 's1', is_error: false }))
      .toEqual([{ type: 'result.validated' }, { type: 'turn.completed', turnId: 's1' }]);
    const fail = claudeMsgToEvents({ type: 'result', subtype: 'error', is_error: true, result: 'boom' });
    expect(fail[0]!.type).toBe('turn.failed');
  });

  it('teto de gasto e outros error_* nunca contam como sucesso', () => {
    // Formato real observado no Claude Code 2.1: subtype error_max_budget_usd, is_error pode vir ausente.
    expect(claudeMsgToEvents({ type: 'result', subtype: 'error_max_budget_usd', session_id: 's1' }))
      .toEqual([{ type: 'turn.failed', turnId: 's1', error: 'limite de gasto (US$) atingido — execução interrompida' }]);
    expect(claudeMsgToEvents({ type: 'result', subtype: 'error_max_turns' })[0]!.type).toBe('turn.failed');
  });

  it('fluxo completo alimenta a máquina de estados até completed', () => {
    const msgs = [
      { type: 'system', subtype: 'init', session_id: 's1' },
      { type: 'assistant' },
      { type: 'result', subtype: 'success', session_id: 's1', is_error: false },
    ];
    const events = [
      { type: 'process.started' as const },
      ...msgs.flatMap(claudeMsgToEvents),
    ];
    const final = runEvents(events);
    expect(final.turn).toBe('completed');
  });

  it('costFromResult extrai custo quando presente', () => {
    expect(costFromResult({ type: 'result', total_cost_usd: 0.012 })).toBe(0.012);
    expect(costFromResult({ type: 'result' })).toBeNull();
  });
});
