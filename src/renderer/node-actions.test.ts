import { beforeEach, describe, expect, it, vi } from 'vitest';

const cancel = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock('./bridge.js', () => ({ bridge: { agent: { cancel, start: vi.fn(async () => ({ ok: true, detail: '' })) } } }));

const { useFrigg, spentUsd } = await import('./store.js');
const { removeNodeSafely, switchWorkspaceSafely, deleteActiveWorkspaceSafely } = await import('./node-actions.js');
const { startWorkflow } = await import('./orchestrate.js');
const { emptyLibrary } = await import('../core/workspace.js');

function freshStore(): void {
  useFrigg.setState({ sessions: {}, retiredCostUsd: 0, workflowRunning: false, workflowNotice: null, workflowBudgetUsd: undefined });
  useFrigg.getState().loadLibrary(emptyLibrary(), false);
}

function running(id: string): void {
  const s = useFrigg.getState();
  s.applyEvent(id, { type: 'process.started' });
  s.applyEvent(id, { type: 'turn.started', turnId: 't' });
}

describe('ações destrutivas seguras', () => {
  beforeEach(() => {
    cancel.mockClear();
    freshStore();
  });

  it('remover um agente ativo cancela a sessão e para o fluxo', () => {
    const id = useFrigg.getState().addNode('agent');
    running(id);
    useFrigg.getState().setWorkflowRunning(true);
    removeNodeSafely(id);
    expect(cancel).toHaveBeenCalledWith(id);
    expect(useFrigg.getState().workflowRunning).toBe(false);
    expect(useFrigg.getState().workflowNotice).toContain('removido');
    expect(useFrigg.getState().nodes).toHaveLength(0);
  });

  it('remover um nó não devolve o gasto (orçamento não é burlado)', () => {
    const id = useFrigg.getState().addNode('agent');
    useFrigg.getState().addCost(id, 1.25);
    removeNodeSafely(id);
    expect(spentUsd(useFrigg.getState())).toBe(1.25);
    // Custo informado depois do cancelamento (result tardio) também conta.
    useFrigg.getState().addCost(id, 0.5);
    expect(spentUsd(useFrigg.getState())).toBe(1.75);
    // Id desconhecido continua sendo ignorado.
    useFrigg.getState().addCost('fantasma', 9);
    expect(spentUsd(useFrigg.getState())).toBe(1.75);
  });

  it('trocar de projeto cancela agentes ativos, para o fluxo e ainda recebe os eventos deles', () => {
    const s = useFrigg.getState();
    const id = s.addNode('agent');
    running(id);
    s.setWorkflowRunning(true);
    s.addWorkspace('B');
    const b = useFrigg.getState().activeWorkspaceId;
    s.switchWorkspace(useFrigg.getState().workspaces[0]!.id);
    switchWorkspaceSafely(b);
    expect(cancel).toHaveBeenCalledWith(id);
    expect(useFrigg.getState().workflowRunning).toBe(false);
    // Cancelamento confirmado chega com o projeto A inativo e não pode ser descartado.
    useFrigg.getState().applyEvent(id, { type: 'cancel.requested' });
    useFrigg.getState().applyEvent(id, { type: 'cancel.confirmed' });
    useFrigg.getState().addCost(id, 0.5);
    expect(useFrigg.getState().sessions[id]?.state.turn).toBe('cancelled');
    expect(spentUsd(useFrigg.getState())).toBe(0.5);
  });

  it('excluir o projeto ativo cancela os agentes e preserva o gasto', () => {
    const s = useFrigg.getState();
    s.addWorkspace('B');
    const id = useFrigg.getState().addNode('agent');
    running(id);
    useFrigg.getState().addCost(id, 2);
    deleteActiveWorkspaceSafely();
    expect(cancel).toHaveBeenCalledWith(id);
    expect(useFrigg.getState().workspaces).toHaveLength(1);
    expect(spentUsd(useFrigg.getState())).toBe(2);
  });
});

describe('orçamento do fluxo', () => {
  beforeEach(() => {
    cancel.mockClear();
    freshStore();
  });

  it('só conta os agentes do próprio fluxo, não os de outro projeto em segundo plano', async () => {
    const { pumpWorkflow } = await import('./orchestrate.js');
    const s = useFrigg.getState();
    const other = s.addNode('agent'); // agente de outro projeto
    running(other);
    s.addWorkspace('B');
    const mine = useFrigg.getState().addNode('agent');
    useFrigg.getState().setWorkflowBudget(1);
    expect(startWorkflow()).toBeNull();
    useFrigg.getState().addCost(other, 5); // outro projeto gasta muito
    await pumpWorkflow();
    expect(useFrigg.getState().workflowNotice).toBeNull();
    useFrigg.getState().addCost(mine, 1.2); // este fluxo passa do limite
    await pumpWorkflow();
    expect(useFrigg.getState().workflowRunning).toBe(false);
    expect(useFrigg.getState().workflowNotice).toContain('limite');
  });
});

describe('re-executar um fluxo', () => {
  beforeEach(() => {
    cancel.mockClear();
    freshStore();
  });

  it('um fluxo já concluído volta ao início e roda de novo', () => {
    const id = useFrigg.getState().addNode('agent');
    running(id);
    useFrigg.getState().applyEvent(id, { type: 'result.validated' });
    useFrigg.getState().applyEvent(id, { type: 'turn.completed', turnId: 't' });
    useFrigg.getState().addCost(id, 0.3);
    expect(startWorkflow()).toBeNull();
    const slot = useFrigg.getState().sessions[id];
    expect(slot?.state.turn).toBe('idle');
    expect(slot?.costUsd).toBe(0.3);
    expect(useFrigg.getState().workflowRunning).toBe(true);
  });
});
