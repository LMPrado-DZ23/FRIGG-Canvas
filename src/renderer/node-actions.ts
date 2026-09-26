/**
 * FRIGG — ações destrutivas do usuário com as regras de segurança do fluxo num
 * lugar só: remover nó e trocar/excluir workspace sempre cancelam os agentes
 * ativos afetados e param o fluxo em execução (em vez de deixar um agente
 * órfão rodando ou disparar os agentes seguintes sem a entrada de que dependem).
 */
import { useFrigg } from './store.js';
import { bridge } from './bridge.js';
import { resetWorkflow } from './orchestrate.js';
import type { TurnPhase } from '../core/turn-state.js';

export function isActiveTurn(turn: TurnPhase | undefined): boolean {
  return turn === 'running' || turn === 'awaiting_approval' || turn === 'cancelling';
}

function cancelIfActive(id: string): void {
  if (isActiveTurn(useFrigg.getState().sessions[id]?.state.turn)) void bridge.agent.cancel(id);
}

/** Para o fluxo em execução (se houver) e explica o motivo na barra superior. */
export function stopWorkflow(reason: string): void {
  const s = useFrigg.getState();
  if (!s.workflowRunning) return;
  s.setWorkflowRunning(false);
  resetWorkflow();
  s.setWorkflowNotice(reason);
}

export function removeNodeSafely(id: string): void {
  const s = useFrigg.getState();
  const node = s.nodes.find((n) => n.id === id);
  if (!node) return;
  cancelIfActive(id);
  if (node.kind === 'agent') stopWorkflow('Fluxo parado: um agente do fluxo foi removido.');
  s.removeNode(id);
}

function leaveActiveWorkspace(reason: string): void {
  const s = useFrigg.getState();
  for (const node of s.nodes) if (node.kind === 'agent') cancelIfActive(node.id);
  stopWorkflow(reason);
}

export function switchWorkspaceSafely(id: string): void {
  const s = useFrigg.getState();
  if (id === s.activeWorkspaceId || !s.workspaces.some((w) => w.id === id)) return;
  leaveActiveWorkspace('Fluxo parado: você trocou de projeto.');
  useFrigg.getState().switchWorkspace(id);
}

export function deleteActiveWorkspaceSafely(): void {
  const s = useFrigg.getState();
  if (s.workspaces.length <= 1) return;
  leaveActiveWorkspace('Fluxo parado: o projeto foi excluído.');
  useFrigg.getState().deleteWorkspace(s.activeWorkspaceId);
}
