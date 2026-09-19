import { useFrigg } from './store.js';

export function SidePanel(): JSX.Element {
  const selectedId = useFrigg((s) => s.selectedId);
  const node = useFrigg((s) => s.nodes.find((n) => n.id === s.selectedId));
  const remove = useFrigg((s) => s.removeNode);
  const recovered = useFrigg((s) => s.recovered);

  if (!node) {
    return (
      <div className="side">
        <h3>FRIGG</h3>
        <p className="muted">
          Canvas + orquestração de agentes sobre OmniRoute. Selecione um nó para ver detalhes.
        </p>
        <p className="muted">Workspace: {recovered ? 'carregado do disco' : 'novo/vazio'}.</p>
      </div>
    );
  }

  return (
    <div className="side">
      <h3>{String(node.data['title'] ?? node.kind)}</h3>
      <div className="muted">tipo: {node.kind}</div>
      <div className="muted">id: {node.id}</div>
      {node.kind === 'terminal' ? (
        <p className="muted">CLI: {String(node.data['command'] || 'shell')}</p>
      ) : null}
      {node.kind === 'agent' ? (
        <p className="muted">
          Nó gerenciado real chega no Marco 2 (adaptador Codex App Server / Claude Agent SDK).
        </p>
      ) : null}
      <button className="btn" onClick={() => selectedId && remove(selectedId)}>Remover nó</button>
    </div>
  );
}
