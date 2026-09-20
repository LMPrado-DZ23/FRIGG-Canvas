import { useState } from 'react';
import { useFrigg } from './store.js';
import type { NodeKind } from '../core/workspace.js';
import { nodeTitle } from './node-label.js';

export const KIND_ICON: Record<NodeKind, string> = {
  terminal: '⌨️',
  agent: '🤖',
  browser: '🌐',
  note: '📝',
  text: '🔤',
  image: '🖼️',
  health: '📡',
};

export function Sidebar(): JSX.Element {
  const nodes = useFrigg((s) => s.nodes);
  const select = useFrigg((s) => s.select);
  const selectedId = useFrigg((s) => s.selectedId);
  const setView = useFrigg((s) => s.setView);
  const templates = useFrigg((s) => s.agentTemplates);
  const addFromTpl = useFrigg((s) => s.addAgentFromTemplate);
  const removeTpl = useFrigg((s) => s.removeAgentTemplate);
  const workspaces = useFrigg((s) => s.workspaces);
  const activeWorkspaceId = useFrigg((s) => s.activeWorkspaceId);
  const switchWorkspace = useFrigg((s) => s.switchWorkspace);
  const addWorkspace = useFrigg((s) => s.addWorkspace);
  const renameWorkspace = useFrigg((s) => s.renameWorkspace);
  const deleteWorkspace = useFrigg((s) => s.deleteWorkspace);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [editingWs, setEditingWs] = useState(false);
  const activeName = workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? '';

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="btn mini" onClick={() => setCollapsed(false)} title="Expandir">»</button>
      </div>
    );
  }

  const list = nodes.filter((n) => nodeTitle(n).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <span className="brand">FRIGG</span>
        <button className="btn mini" onClick={() => setCollapsed(true)} title="Recolher">«</button>
      </div>
      <div className="sidebar-section">PROJETO</div>
      {editingWs ? (
        <input
          className="fld"
          autoFocus
          value={activeName}
          onChange={(e) => renameWorkspace(activeWorkspaceId, e.target.value)}
          onBlur={() => setEditingWs(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') setEditingWs(false); }}
        />
      ) : (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <select className="fld" style={{ flex: 1 }} value={activeWorkspaceId} onChange={(e) => switchWorkspace(e.target.value)}>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button className="btn mini" title="Novo projeto" onClick={() => addWorkspace()}>＋</button>
          <button className="btn mini" title="Renomear" onClick={() => setEditingWs(true)}>✎</button>
          {workspaces.length > 1 ? (
            <button className="btn mini node-x" title="Excluir projeto" onClick={() => { if (confirm(`Excluir o projeto "${activeName}"? Os nós dele serão perdidos.`)) deleteWorkspace(activeWorkspaceId); }}>🗑</button>
          ) : null}
        </div>
      )}
      <input className="addr" placeholder="Filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="sidebar-section">WORKSPACE · {nodes.length} nós</div>
      <div className="sidebar-list">
        {list.map((n) => (
          <button
            key={n.id}
            className={`sidebar-item ${selectedId === n.id ? 'active' : ''}`}
            onClick={() => { select(n.id); setView('2d'); }}
          >
            <span>{KIND_ICON[n.kind]}</span>
            <span className="sidebar-item-label">{nodeTitle(n)}</span>
          </button>
        ))}
        {list.length === 0 ? <div className="muted" style={{ padding: 8 }}>Nenhum nó. Use “Adicionar”.</div> : null}
      </div>
      {templates.length > 0 ? (
        <>
          <div className="sidebar-section">MEUS AGENTES</div>
          <div className="sidebar-list">
            {templates.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button className="sidebar-item" style={{ flex: 1 }} onClick={() => { addFromTpl(t.id); setView('2d'); }} title="Adicionar ao canvas">
                  <span>🤖</span><span className="sidebar-item-label">{t.name}</span>
                </button>
                <button className="btn mini node-x" title="Remover da biblioteca" onClick={() => removeTpl(t.id)}>✕</button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
