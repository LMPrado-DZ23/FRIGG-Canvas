import { describe, it, expect } from 'vitest';
import { readyNodes, hasCycle, nodeRunStatus, isComplete, isStalled, type OrchestratorGraph } from './orchestrator.js';
import { runEvents, initialSessionState, type AgentSessionState, type SessionEvent } from './turn-state.js';

const done = (): AgentSessionState =>
  runEvents([{ type: 'process.started' }, { type: 'turn.started', turnId: 't' }, { type: 'turn.completed', turnId: 't' }]);
const failed = (): AgentSessionState =>
  runEvents([{ type: 'process.started' }, { type: 'turn.started', turnId: 't' }, { type: 'turn.failed', turnId: 't', error: 'x' }]);
const running = (): AgentSessionState =>
  runEvents([{ type: 'process.started' }, { type: 'turn.started', turnId: 't' }]);

const g: OrchestratorGraph = {
  nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
  edges: [{ source: 'A', target: 'B' }, { source: 'B', target: 'C' }],
};

describe('orchestrator (grafo executável)', () => {
  it('no início só a raiz (A) está pronta', () => {
    expect(readyNodes(g, {})).toEqual(['A']);
  });

  it('B fica pronto só depois de A concluir; C depois de B', () => {
    expect(readyNodes(g, { A: done() })).toEqual(['B']);
    expect(readyNodes(g, { A: done(), B: done() })).toEqual(['C']);
  });

  it('nó em execução não é redisparado', () => {
    expect(readyNodes(g, { A: running() })).toEqual([]);
    expect(nodeRunStatus(g, { A: running() }, 'A')).toBe('running');
  });

  it('falha no upstream bloqueia o downstream', () => {
    expect(nodeRunStatus(g, { A: failed() }, 'B')).toBe('blocked');
    expect(readyNodes(g, { A: failed() })).toEqual([]);
    expect(isStalled(g, { A: failed() })).toBe(true);
  });

  it('fan-in: nó só roda quando TODOS os upstreams concluem', () => {
    const fan: OrchestratorGraph = {
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      edges: [{ source: 'A', target: 'C' }, { source: 'B', target: 'C' }],
    };
    expect(readyNodes(fan, { A: done() }).sort()).toEqual(['B']);
    expect(readyNodes(fan, { A: done(), B: done() })).toEqual(['C']);
  });

  it('detecta ciclo', () => {
    const cyc: OrchestratorGraph = { nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ source: 'A', target: 'B' }, { source: 'B', target: 'A' }] };
    expect(hasCycle(cyc)).toBe(true);
    expect(hasCycle(g)).toBe(false);
  });

  it('isComplete quando todos concluíram', () => {
    expect(isComplete(g, { A: done(), B: done(), C: done() })).toBe(true);
    expect(isComplete(g, { A: done(), B: done() })).toBe(false);
  });

  it('estado inicial de nó sem sessão é idle→ready só na raiz', () => {
    expect(nodeRunStatus(g, {}, 'A')).toBe('ready');
    expect(nodeRunStatus(g, {}, 'B')).toBe('blocked');
    expect(initialSessionState().turn).toBe('idle');
  });
});

// evita import não usado em ambientes estritos
const _ev: SessionEvent = { type: 'process.started' };
void _ev;
