/**
 * FRIGG — executor de fluxo (renderer). Usa o motor puro `orchestrator` para
 * decidir quais nós-agente disparar e compõe o prompt de cada um com:
 *  papel (system-prompt) + objetivo do fluxo + saídas dos agentes anteriores.
 * Dispara via o adaptador (bridge.agent). O motor garante a ordem e as falhas.
 */
import { useFrigg } from './store.js';
import { bridge } from './bridge.js';
import { roleById } from '../core/roles.js';
import { readyNodes, upstreamsOf, hasCycle, isComplete, isStalled, type OrchestratorGraph } from '../core/orchestrator.js';

const dispatched = new Set<string>();

export function resetWorkflow(): void {
  dispatched.clear();
}

function buildGraph(): OrchestratorGraph {
  const s = useFrigg.getState();
  const agentIds = new Set(s.nodes.filter((n) => n.kind === 'agent').map((n) => n.id));
  return {
    nodes: [...agentIds].map((id) => ({ id })),
    edges: s.edges.filter((e) => agentIds.has(e.source) && agentIds.has(e.target)),
  };
}

function composePrompt(nodeId: string, g: OrchestratorGraph): string {
  const s = useFrigg.getState();
  const node = s.nodes.find((n) => n.id === nodeId);
  const role = roleById(typeof node?.data['role'] === 'string' ? (node.data['role'] as string) : 'developer');
  const parts: string[] = [];
  if (role) parts.push(role.systemPrompt);
  if (s.objective.trim()) parts.push(`OBJETIVO DO PROJETO:\n${s.objective.trim()}`);
  const ups = upstreamsOf(g, nodeId);
  for (const up of ups) {
    const out = s.sessions[up]?.output;
    const upNode = s.nodes.find((n) => n.id === up);
    const upRole = roleById(typeof upNode?.data['role'] === 'string' ? (upNode.data['role'] as string) : '');
    if (out && out.trim()) parts.push(`RESULTADO DE ${upRole?.label ?? up}:\n${out.trim()}`);
  }
  parts.push('Trabalhe no diretório do projeto. Ao terminar, resuma o que fez e como validar.');
  return parts.join('\n\n---\n\n');
}

/** Dispara os nós prontos. Chamar ao iniciar e a cada evento de agente. */
export async function pumpWorkflow(): Promise<void> {
  const s = useFrigg.getState();
  if (!s.workflowRunning) return;
  const g = buildGraph();
  if (g.nodes.length === 0) {
    s.setWorkflowRunning(false);
    return;
  }
  if (isComplete(g, sessionStates()) || isStalled(g, sessionStates())) {
    s.setWorkflowRunning(false);
    return;
  }
  for (const id of readyNodes(g, sessionStates())) {
    if (dispatched.has(id)) continue;
    dispatched.add(id);
    const node = s.nodes.find((n) => n.id === id);
    const role = roleById(typeof node?.data['role'] === 'string' ? (node.data['role'] as string) : 'developer');
    const r = await bridge.agent.start(id, { prompt: composePrompt(id, g), harness: role?.harness ?? 'claude' });
    if (!r.ok) {
      // não conseguiu iniciar: registra falha para não travar o fluxo
      useFrigg.getState().applyEvent(id, { type: 'turn.failed', turnId: 'start', error: r.detail });
    }
  }
}

function sessionStates(): Record<string, import('../core/turn-state.js').AgentSessionState> {
  const s = useFrigg.getState();
  const out: Record<string, import('../core/turn-state.js').AgentSessionState> = {};
  for (const [id, slot] of Object.entries(s.sessions)) out[id] = slot.state;
  return out;
}

/** Valida e inicia o fluxo. Retorna erro legível se houver ciclo. */
export function startWorkflow(): string | null {
  const g = buildGraph();
  if (g.nodes.length === 0) return 'Adicione ao menos um agente.';
  if (hasCycle(g)) return 'Há um ciclo entre os agentes — remova a conexão que fecha o loop.';
  resetWorkflow();
  useFrigg.getState().setWorkflowRunning(true);
  void pumpWorkflow();
  return null;
}
