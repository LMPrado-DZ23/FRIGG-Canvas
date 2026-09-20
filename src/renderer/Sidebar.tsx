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
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState(false);

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
    </div>
  );
}
