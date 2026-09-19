import { describe, it, expect } from 'vitest';
import { deriveVisual, activityLabel } from './session-model.js';
import { runEvents, initialSessionState, type SessionEvent } from './turn-state.js';

const withEvents = (events: SessionEvent[]) =>
  runEvents([{ type: 'process.started' }, { type: 'turn.started', turnId: 't1' }, ...events]);

describe('deriveVisual (D05/D06 — eixos separados)', () => {
  it('turno concluído + validado: done + validated', () => {
    const s = withEvents([{ type: 'turn.completed', turnId: 't1' }, { type: 'result.validated' }]);
    const v = deriveVisual(s, { now: 1000, lastEventAt: 1000 });
    expect(v.activity).toBe('done');
    expect(v.validated).toBe(true);
    expect(v.needsAttention).toBe(false);
  });

  it('concluído mas NÃO validado: done + validated=false (eixos separados)', () => {
    const s = withEvents([{ type: 'turn.completed', turnId: 't1' }]);
    const v = deriveVisual(s, { now: 1000, lastEventAt: 1000 });
    expect(v.activity).toBe('done');
    expect(v.validated).toBe(false);
  });

  it('aguardando aprovação exige atenção', () => {
    const s = withEvents([{ type: 'turn.approval_requested', requestId: 'a1' }]);
    const v = deriveVisual(s, { now: 1000, lastEventAt: 1000 });
    expect(v.activity).toBe('awaiting_approval');
    expect(v.needsAttention).toBe(true);
  });

  it('telemetria antiga vira stale; sem telemetria vira disconnected', () => {
    const s = withEvents([]);
    expect(deriveVisual(s, { now: 100000, lastEventAt: 1000, staleAfterMs: 15000 }).connectivity).toBe('stale');
    expect(deriveVisual(s, { now: 100000, lastEventAt: null }).connectivity).toBe('disconnected');
  });

  it('processo saído: disconnected e activity unknown (não conclui)', () => {
    const s = withEvents([{ type: 'process.exited', code: 1 }]);
    const v = deriveVisual(s, { now: 1000, lastEventAt: 1000 });
    expect(v.connectivity).toBe('disconnected');
    expect(v.activity).toBe('unknown');
    expect(v.needsAttention).toBe(true);
  });

  it('estado inicial é ocioso', () => {
    const v = deriveVisual(initialSessionState(), { now: 1, lastEventAt: 1 });
    expect(v.activity).toBe('idle');
    expect(activityLabel(v.activity)).toBe('Ocioso');
  });
});
