import { describe, it, expect } from 'vitest';
import {
  initialSessionState,
  reduce,
  runEvents,
  isEligibleForSuccessEdge,
  type SessionEvent,
} from './turn-state.js';

const start = (events: SessionEvent[]) =>
  runEvents([{ type: 'process.started' }, { type: 'turn.started', turnId: 't1' }, ...events]);

describe('turn-state (G4)', () => {
  it('turno normal: running -> completed, validado é elegível a aresta de sucesso', () => {
    const s = start([{ type: 'turn.completed', turnId: 't1' }, { type: 'result.validated' }]);
    expect(s.turn).toBe('completed');
    expect(s.validation).toBe('validated');
    expect(isEligibleForSuccessEdge(s)).toBe(true);
  });

  it('completed sem validação NÃO é elegível a aresta de sucesso', () => {
    const s = start([{ type: 'turn.completed', turnId: 't1' }]);
    expect(isEligibleForSuccessEdge(s)).toBe(false);
  });

  it('cancel.requested não confirma cancelamento (vai para cancelling)', () => {
    const s = start([{ type: 'cancel.requested' }]);
    expect(s.turn).toBe('cancelling');
    expect(s.cancelRequested).toBe(true);
  });

  it('só cancel.confirmed confirma o cancelamento', () => {
    const s = start([{ type: 'cancel.requested' }, { type: 'cancel.confirmed' }]);
    expect(s.turn).toBe('cancelled');
  });

  it('cancel.confirmed sem pedido é inconsistente -> unknown', () => {
    const s = start([{ type: 'cancel.confirmed' }]);
    expect(s.turn).toBe('unknown');
  });

  it('fim inesperado do stream com turno ativo -> unknown, nunca completed', () => {
    const s = start([{ type: 'stream.ended', expected: false }]);
    expect(s.turn).toBe('unknown');
    expect(s.reason).toMatch(/inesperad/);
  });

  it('fim esperado do stream não altera o turno', () => {
    const s = start([{ type: 'stream.ended', expected: true }]);
    expect(s.turn).toBe('running');
  });

  it('saída de processo com turno ativo -> unknown (não conclui turno)', () => {
    const s = start([{ type: 'process.exited', code: 0 }]);
    expect(s.turn).toBe('unknown');
    expect(s.process).toBe('exited');
  });

  it('saída de processo durante cancelamento -> cancelled', () => {
    const s = start([{ type: 'cancel.requested' }, { type: 'process.exited', code: 130 }]);
    expect(s.turn).toBe('cancelled');
  });

  it('aprovação só se resolve pelo requestId exato', () => {
    const s = start([
      { type: 'turn.approval_requested', requestId: 'a1' },
      { type: 'turn.approval_resolved', requestId: 'OUTRO', decision: 'approved' },
    ]);
    expect(s.turn).toBe('unknown'); // resolveu id inexistente
  });

  it('duas aprovações pendentes: turno só volta a running quando ambas resolvem', () => {
    let s = start([
      { type: 'turn.approval_requested', requestId: 'a1' },
      { type: 'turn.approval_requested', requestId: 'a2' },
      { type: 'turn.approval_resolved', requestId: 'a1', decision: 'approved' },
    ]);
    expect(s.turn).toBe('awaiting_approval');
    s = reduce(s, { type: 'turn.approval_resolved', requestId: 'a2', decision: 'denied' });
    expect(s.turn).toBe('running');
    expect(s.pendingApprovals).toHaveLength(0);
  });

  it('completed com aprovação pendente é inconsistente -> unknown', () => {
    const s = start([
      { type: 'turn.approval_requested', requestId: 'a1' },
      { type: 'turn.completed', turnId: 't1' },
    ]);
    expect(s.turn).toBe('unknown');
  });

  it('completed durante cancelamento pedido -> unknown (reconciliar)', () => {
    const s = start([{ type: 'cancel.requested' }, { type: 'turn.completed', turnId: 't1' }]);
    expect(s.turn).toBe('unknown');
  });

  it('turn.started sobre turno não encerrado -> unknown', () => {
    const s = start([{ type: 'turn.started', turnId: 't2' }]);
    expect(s.turn).toBe('unknown');
  });

  it('estado inicial: processo starting, turno idle, não validado', () => {
    const s = initialSessionState();
    expect(s.process).toBe('starting');
    expect(s.turn).toBe('idle');
    expect(s.validation).toBe('unvalidated');
  });

  it('validação não passa de um turno para o outro', () => {
    const first = runEvents([
      { type: 'process.started' },
      { type: 'turn.started', turnId: 't1' },
      { type: 'result.validated' },
      { type: 'turn.completed', turnId: 't1' },
    ]);
    expect(isEligibleForSuccessEdge(first)).toBe(true);
    const second = runEvents([{ type: 'turn.started', turnId: 't2' }, { type: 'turn.completed', turnId: 't2' }], first);
    expect(second.validation).toBe('unvalidated');
    expect(isEligibleForSuccessEdge(second)).toBe(false);
  });
});
