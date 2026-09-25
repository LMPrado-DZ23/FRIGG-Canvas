import { useFrigg } from './store.js';
import { TEAM_TEMPLATES } from './templates.js';
import { deriveVisual, activityLabel } from '../core/session-model.js';
import { initialSessionState } from '../core/turn-state.js';
import { nodeTitle } from './node-label.js';
import type { NodeKind } from '../core/workspace.js';
import { formatUsd, totalCost } from '../core/agent-policy.js';
import { BudgetInput } from './BudgetInput.js';

const QUICK_ACTIONS: readonly { kind: NodeKind; icon: string; label: string; detail: string }[] = [
  { kind: 'agent', icon: '✦', label: 'Novo agente', detail: 'Delegue uma tarefa com contexto' },
  { kind: 'terminal', icon: '⌘', label: 'Novo terminal', detail: 'Abra uma sessão local' },
  { kind: 'browser', icon: '◎', label: 'Navegador', detail: 'Pesquise sem sair do fluxo' },
  { kind: 'note', icon: '□', label: 'Nota rápida', detail: 'Capture uma decisão ou ideia' },
];

export function Dashboard(): JSX.Element {
  const nodes = useFrigg((s) => s.nodes);
  const sessions = useFrigg((s) => s.sessions);
  const health = useFrigg((s) => s.health);
  const pty = useFrigg((s) => s.ptyAvailable);
  const objective = useFrigg((s) => s.objective);
  const setObjective = useFrigg((s) => s.setObjective);
  const addNode = useFrigg((s) => s.addNode);
  const addTemplate = useFrigg((s) => s.addTemplate);
  const setView = useFrigg((s) => s.setView);
  const activeWorkspaceId = useFrigg((s) => s.activeWorkspaceId);
  const workspaces = useFrigg((s) => s.workspaces);
  const workspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? 'Workspace';
  const workflowBudget = useFrigg((s) => s.workflowBudgetUsd);
  const setWorkflowBudget = useFrigg((s) => s.setWorkflowBudget);
  const spent = totalCost(Object.values(sessions).map((slot) => slot.costUsd));

  const agentNodes = nodes.filter((node) => node.kind === 'agent');
  const visuals = agentNodes.map((node) => deriveVisual(sessions[node.id]?.state ?? initialSessionState(), { lastEventAt: sessions[node.id]?.lastEventAt ?? null }));
  const activeCount = visuals.filter((v) => v.activity === 'working' || v.activity === 'awaiting_approval').length;
  const attentionCount = visuals.filter((v) => v.needsAttention).length;
  const completedCount = visuals.filter((v) => v.activity === 'done').length;

  return (
    <div className="dashboard" aria-labelledby="dashboard-title">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">{workspaceName} <span className="eyebrow-dot">•</span> Command Center</p>
          <h1 id="dashboard-title">O que vamos construir hoje?</h1>
          <p className="hero-subtitle">Monte um fluxo, delegue o trabalho e acompanhe cada decisão em um só lugar.</p>
          <div className="objective-composer">
            <span className="composer-icon">✦</span>
            <input
              aria-label="Objetivo do projeto"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Descreva o objetivo do seu próximo fluxo…"
            />
            <button className="btn primary" onClick={() => setView('2d')}>Abrir canvas <span aria-hidden="true">→</span></button>
          </div>
          <div className="budget-row">
            <label htmlFor="workflow-budget">Limite de gasto por execução do fluxo (US$)</label>
            <BudgetInput id="workflow-budget" value={workflowBudget} placeholder="sem limite" onChange={setWorkflowBudget} />
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true"><span className="orbit-core">F</span><span className="orbit-ring ring-one" /><span className="orbit-ring ring-two" /></div>
      </section>

      <section className="metric-grid" aria-label="Resumo do workspace">
        <Metric icon="◈" label="Agentes ativos" value={activeCount} tone="teal" hint={activeCount ? 'Em execução agora' : 'Prontos para começar'} />
        <Metric icon="✓" label="Concluídos" value={completedCount} tone="green" hint="Resultados validados" />
        <Metric icon="!" label="Precisam de atenção" value={attentionCount} tone={attentionCount ? 'amber' : 'slate'} hint={attentionCount ? 'Revise no modo Operação' : 'Tudo sob controle'} />
        <Metric icon="$" label="Gasto nesta sessão" value={formatUsd(spent)} tone={workflowBudget !== undefined && spent >= workflowBudget ? 'amber' : 'slate'} hint={workflowBudget !== undefined ? `Limite por fluxo: ${formatUsd(workflowBudget)}` : 'Sem limite de fluxo'} />
        <Metric icon="⌁" label="Conectividade" value={health?.status === 'reachable' ? 'Online' : 'Local'} tone={health?.status === 'reachable' ? 'green' : 'slate'} hint={health?.detail ?? 'OmniRoute e PTY'} />
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Comece rápido</p><h2>Adicione uma peça ao seu fluxo</h2></div><button className="text-button" onClick={() => setView('2d')}>Ver canvas <span aria-hidden="true">→</span></button></div>
        <div className="quick-grid">
          {QUICK_ACTIONS.map((item) => <button key={item.kind} className="quick-card" onClick={() => { addNode(item.kind); setView('2d'); }}><span className="quick-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><span className="quick-arrow" aria-hidden="true">↗</span></button>)}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Playbooks</p><h2>Fluxos que economizam tempo</h2></div><button className="text-button" onClick={() => setView('2d')}>Todos os templates <span aria-hidden="true">→</span></button></div>
        <div className="playbook-grid">
          {TEAM_TEMPLATES.map((template, index) => <button key={template.id} className="playbook-card" onClick={() => { addTemplate(template.nodes, template.chain); setView('2d'); }}><span className={`playbook-number n-${index + 1}`}>0{index + 1}</span><span className="playbook-title">{template.label.replace(/^[^ ]+ /, '')}</span><span className="playbook-meta">{template.nodes.length} {template.nodes.length === 1 ? 'agente' : 'agentes'} <span aria-hidden="true">·</span> {template.chain ? 'encadeado' : 'livre'}</span><span className="playbook-arrow" aria-hidden="true">↗</span></button>)}
        </div>
      </section>

      <section className="dashboard-bottom">
        <div className="activity-card">
          <div className="section-heading compact"><div><p className="eyebrow">Atividade recente</p><h2>Seu workspace</h2></div><button className="text-button" onClick={() => setView('op')}>Abrir operação</button></div>
          {nodes.length === 0 ? <EmptyActivity onAdd={() => addNode('agent')} /> : <div className="activity-list">{nodes.slice(-5).reverse().map((node) => { const v = deriveVisual(sessions[node.id]?.state ?? initialSessionState(), { lastEventAt: sessions[node.id]?.lastEventAt ?? null }); return <button className="activity-row" key={node.id} onClick={() => { useFrigg.getState().select(node.id); setView('2d'); }}><span className={`status-dot ${v.activity}`} /><span className="activity-name">{nodeTitle(node)}</span><span className="activity-status">{activityLabel(v.activity)}</span><span className="activity-chevron" aria-hidden="true">›</span></button>; })}</div>}
        </div>
        <div className="system-card"><div className="section-heading compact"><div><p className="eyebrow">Sistema</p><h2>Saúde do ambiente</h2></div><span className={`status-pill ${health?.status === 'reachable' ? 'success' : ''}`}><i />{health?.status === 'reachable' ? 'Operacional' : 'Modo local'}</span></div><div className="system-row"><span>OmniRoute</span><strong>{health?.status === 'reachable' ? 'Conectado' : 'Não configurado'}</strong></div><div className="system-row"><span>Terminal PTY</span><strong>{pty?.available ? 'Disponível' : 'Verificando'}</strong></div><div className="system-row"><span>Persistência</span><strong>Autosave ativo</strong></div><button className="system-link" onClick={() => setView('op')}>Ver detalhes do sistema <span aria-hidden="true">→</span></button></div>
      </section>
      <p className="dashboard-footer">FRIGG <span>•</span> Orquestre com clareza.</p>
    </div>
  );
}

function Metric({ icon, label, value, tone, hint }: { icon: string; label: string; value: string | number; tone: string; hint: string }): JSX.Element { return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><small>{hint}</small></div></article>; }
function EmptyActivity({ onAdd }: { onAdd: () => void }): JSX.Element { return <div className="empty-activity"><span>◌</span><p>Seu workspace está pronto para começar.</p><button className="text-button" onClick={onAdd}>Criar primeiro agente →</button></div>; }
