/**
 * FRIGG — motor de orquestração (o "grafo executável", puro e testável).
 *
 * Dado um grafo (nós-agente + arestas) e o estado real de cada sessão
 * (turn-state), decide QUAIS nós estão prontos para rodar agora. Respeita:
 *  - um nó só roda quando TODOS os seus upstreams concluíram (turn.completed);
 *  - upstream que falhou/ficou unknown/cancelado BLOQUEIA o downstream
 *    (não inventa sucesso — D06/G4);
 *  - ciclos são detectados e rejeitados (sem loop infinito de agentes).
 *
 * Sem IO: o executor do renderer usa isto para disparar sessões via adaptador.
 */
import type { AgentSessionState } from './turn-state.js';

export interface OrchestratorGraph {
  readonly nodes: readonly { readonly id: string }[];
  readonly edges: readonly { readonly source: string; readonly target: string }[];
}

export type NodeRunStatus = 'blocked' | 'ready' | 'running' | 'done' | 'failed';

function statusOf(state: AgentSessionState | undefined): 'idle' | 'running' | 'done' | 'failed' {
  if (!state) return 'idle';
  switch (state.turn) {
    case 'completed':
      return 'done';
    case 'running':
    case 'awaiting_approval':
    case 'cancelling':
      return 'running';
    case 'failed':
    case 'unknown':
    case 'cancelled':
      return 'failed';
    case 'idle':
      return 'idle';
    default: {
      const _e: never = state.turn;
      return _e;
    }
  }
}

export function upstreamsOf(g: OrchestratorGraph, id: string): string[] {
  return g.edges.filter((e) => e.target === id).map((e) => e.source);
}

/** Detecta ciclo (DFS com cores). */
export function hasCycle(g: OrchestratorGraph): boolean {
  const color = new Map<string, 0 | 1 | 2>(); // 0=branco 1=cinza 2=preto
  for (const n of g.nodes) color.set(n.id, 0);
  const adj = new Map<string, string[]>();
  for (const n of g.nodes) adj.set(n.id, []);
  for (const e of g.edges) adj.get(e.source)?.push(e.target);

  const visit = (u: string): boolean => {
    color.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? 0;
      if (c === 1) return true;
      if (c === 0 && visit(v)) return true;
    }
    color.set(u, 2);
    return false;
  };
  for (const n of g.nodes) if ((color.get(n.id) ?? 0) === 0 && visit(n.id)) return true;
  return false;
}

export function nodeRunStatus(
  g: OrchestratorGraph,
  states: Readonly<Record<string, AgentSessionState>>,
  id: string,
): NodeRunStatus {
  const self = statusOf(states[id]);
  if (self === 'done') return 'done';
  if (self === 'failed') return 'failed';
  if (self === 'running') return 'running';
  // idle: depende dos upstreams
  const ups = upstreamsOf(g, id);
  if (ups.some((u) => statusOf(states[u]) === 'failed')) return 'blocked';
  if (ups.every((u) => statusOf(states[u]) === 'done')) return 'ready';
  return 'blocked';
}

/** Nós prontos para disparar agora (idle com todos os upstreams concluídos). */
export function readyNodes(
  g: OrchestratorGraph,
  states: Readonly<Record<string, AgentSessionState>>,
): string[] {
  return g.nodes.map((n) => n.id).filter((id) => nodeRunStatus(g, states, id) === 'ready');
}

export function isComplete(g: OrchestratorGraph, states: Readonly<Record<string, AgentSessionState>>): boolean {
  return g.nodes.length > 0 && g.nodes.every((n) => nodeRunStatus(g, states, n.id) === 'done');
}

/** Travado: nada rodando, nada pronto, e não completou (bloqueado por falha). */
export function isStalled(g: OrchestratorGraph, states: Readonly<Record<string, AgentSessionState>>): boolean {
  if (g.nodes.length === 0) return false;
  const anyRunning = g.nodes.some((n) => nodeRunStatus(g, states, n.id) === 'running');
  const anyReady = readyNodes(g, states).length > 0;
  return !anyRunning && !anyReady && !isComplete(g, states);
}
