import { useMemo, useState } from 'react';
import { useFrigg } from './store.js';
import { bridge } from './bridge.js';
import { deriveVisual, activityLabel } from '../core/session-model.js';
import { initialSessionState } from '../core/turn-state.js';
import { nodeTitle } from './node-label.js';
import { formatUsd } from '../core/agent-policy.js';

const FILTERS: readonly { id: 'all' | 'active' | 'attention'; label: string }[] = [
  { id: 'all', label: 'Todos' }, { id: 'active', label: 'Ativos' }, { id: 'attention', label: 'Atenção' },
];

export function OperationView(): JSX.Element {
  const allNodes = useFrigg((s) => s.nodes);
  const nodes = allNodes.filter((n) => n.kind === 'agent' || n.kind === 'terminal');
  const sessions = useFrigg((s) => s.sessions);
  const select = useFrigg((s) => s.select);
  const setView = useFrigg((s) => s.setView);
  const [filter, setFilter] = useState<'all' | 'active' | 'attention'>('all');
  const rows = useMemo(() => nodes.map((node) => { const slot = sessions[node.id]; const visual = deriveVisual(slot?.state ?? initialSessionState(), { lastEventAt: slot?.lastEventAt ?? null }); return { node, slot, visual }; }).filter(({ visual }) => filter === 'all' || (filter === 'active' ? ['working', 'awaiting_approval', 'cancelling'].includes(visual.activity) : visual.needsAttention)), [nodes, sessions, filter]);
  const active = rows.filter((row) => ['working', 'awaiting_approval', 'cancelling'].includes(row.visual.activity)).length;
  const attention = rows.filter((row) => row.visual.needsAttention).length;
  const done = rows.filter((row) => row.visual.activity === 'done').length;

  return <div className="operation-page" aria-labelledby="operation-title">
    <div className="operation-head"><div><p className="eyebrow">Command Center <span className="eyebrow-dot">•</span> Live</p><h1 id="operation-title">Operação</h1><p className="operation-subtitle">Acompanhe agentes, aprovações e resultados do workspace em tempo real.</p></div><button className="btn secondary-action" onClick={() => setView('2d')}>← Voltar ao canvas</button></div>
    <div className="operation-stats"><Stat label="Sessões" value={nodes.length} icon="◈" /><Stat label="Em execução" value={active} icon="◉" tone="teal" /><Stat label="Concluídos" value={done} icon="✓" tone="green" /><Stat label="Atenção" value={attention} icon="!" tone={attention ? 'amber' : 'slate'} /></div>
    <div className="operation-toolbar"><div className="filter-tabs" role="tablist" aria-label="Filtrar sessões">{FILTERS.map((item) => <button key={item.id} role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}{item.id === 'attention' && attention ? <span className="tab-count">{attention}</span> : null}</button>)}</div><span className="operation-live"><i /> Atualização automática</span></div>
    {rows.length === 0 ? <div className="operation-empty"><div className="empty-icon">◌</div><h2>{nodes.length ? 'Nada neste filtro' : 'Nenhuma sessão ainda'}</h2><p>{nodes.length ? 'Troque o filtro para visualizar outras sessões.' : 'Crie um agente ou terminal no canvas para acompanhar a execução aqui.'}</p><button className="btn primary" onClick={() => setView('2d')}>Abrir canvas →</button></div> : <div className="session-grid">{rows.map(({ node, slot, visual }) => <SessionCard key={node.id} id={node.id} title={nodeTitle(node)} kind={node.kind} visual={visual} output={slot?.output} cost={slot?.costUsd} onSelect={() => { select(node.id); setView('2d'); }} onCancel={() => void bridge.agent.cancel(node.id)} />)}</div>}
  </div>;
}

function Stat({ label, value, icon, tone = 'slate' }: { label: string; value: number; icon: string; tone?: string }): JSX.Element { return <div className="operation-stat"><span className={`operation-stat-icon ${tone}`}>{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>; }
function SessionCard({ id, title, kind, visual, output, cost, onSelect, onCancel }: { id: string; title: string; kind: string; visual: ReturnType<typeof deriveVisual>; output?: string | undefined; cost?: number | undefined; onSelect: () => void; onCancel: () => void }): JSX.Element { const active = ['working', 'awaiting_approval', 'cancelling'].includes(visual.activity); return <article className={`session-card ${visual.needsAttention ? 'attention' : ''}`}><button className="session-card-main" onClick={onSelect}><span className={`session-icon ${kind}`}>{kind === 'agent' ? '✦' : '⌁'}</span><span className="session-copy"><strong>{title}</strong><small>{kind === 'agent' ? 'Agente de workflow' : 'Terminal local'}</small></span><span className={`status-pill session-status ${visual.activity}`}><i />{activityLabel(visual.activity)}</span></button><div className="session-detail"><span className={`connection-dot ${visual.connectivity}`} />{visual.validated ? 'Resultado validado' : visual.connectivity === 'connected' ? 'Conectado' : 'Aguardando telemetria'}{cost ? <span className="session-cost">{formatUsd(cost)}</span> : null}</div>{output ? <p className="session-output">{output.slice(-180)}</p> : null}<div className="session-actions"><button className="text-button" onClick={onSelect}>Abrir detalhes →</button>{active && kind === 'agent' ? <button className="btn danger-button" onClick={onCancel}>Cancelar</button> : null}</div><span className="visually-hidden">ID da sessão {id}</span></article>; }
