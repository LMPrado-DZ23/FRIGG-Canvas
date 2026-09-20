import { useFrigg } from './store.js';
import { bridge } from './bridge.js';
import { ROLES, roleById } from '../core/roles.js';
import { nodeTitle } from './node-label.js';

function WorkDirField({ nodeId }: { nodeId: string }): JSX.Element {
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const cwd = typeof node?.data['cwd'] === 'string' ? (node.data['cwd'] as string) : '';
  const pick = async (): Promise<void> => {
    const dir = await bridge.dialog.pickFolder();
    if (dir) patch(nodeId, { cwd: dir });
  };
  return (
    <>
      <label>Pasta de trabalho</label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="fld" style={{ flex: 1 }} value={cwd} placeholder="padrão (home)" onChange={(e) => patch(nodeId, { cwd: e.target.value })} />
        <button className="btn" onClick={() => void pick()} title="Escolher pasta">📁</button>
        {cwd ? <button className="btn mini" onClick={() => patch(nodeId, { cwd: '' })} title="Limpar">✕</button> : null}
      </div>
    </>
  );
}

function AgentEditor({ nodeId }: { nodeId: string }): JSX.Element {
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  if (!node) return <></>;
  const roleId = typeof node.data['role'] === 'string' ? (node.data['role'] as string) : 'developer';
  const role = roleById(roleId);
  const name = typeof node.data['name'] === 'string' ? (node.data['name'] as string) : '';
  const custom = typeof node.data['systemPrompt'] === 'string' ? (node.data['systemPrompt'] as string) : '';
  const harness = typeof node.data['harness'] === 'string' ? (node.data['harness'] as string) : (role?.harness ?? 'claude');
  const model = typeof node.data['model'] === 'string' ? (node.data['model'] as string) : '';
  const effectivePrompt = custom || role?.systemPrompt || '';

  return (
    <div className="agent-editor">
      <label>Nome</label>
      <input className="fld" value={name} placeholder={role?.label ?? 'Agente'} onChange={(e) => patch(nodeId, { name: e.target.value })} />

      <label>Papel (modelo de instrução)</label>
      <select className="fld" value={roleId} onChange={(e) => patch(nodeId, { role: e.target.value })}>
        {ROLES.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
      </select>

      <label>Instruções (o que este agente faz)</label>
      <textarea
        className="fld"
        style={{ height: 160 }}
        value={effectivePrompt}
        onChange={(e) => patch(nodeId, { systemPrompt: e.target.value })}
        placeholder="Descreva a função do agente…"
      />
      {custom ? (
        <button className="btn mini" onClick={() => patch(nodeId, { systemPrompt: '' })}>↺ Restaurar padrão do papel</button>
      ) : (
        <div className="muted" style={{ fontSize: 12 }}>Usando o texto padrão do papel. Edite acima para personalizar.</div>
      )}

      <label style={{ marginTop: 8 }}>Harness</label>
      <select className="fld" value={harness} onChange={(e) => patch(nodeId, { harness: e.target.value })}>
        <option value="claude">Claude Code</option>
        <option value="codex">Codex</option>
      </select>

      <label>Modelo (opcional)</label>
      <input className="fld" value={model} placeholder="ex.: sonnet, gpt-5.6…" onChange={(e) => patch(nodeId, { model: e.target.value })} />

      <WorkDirField nodeId={nodeId} />
    </div>
  );
}

export function SidePanel(): JSX.Element {
  const selectedId = useFrigg((s) => s.selectedId);
  const node = useFrigg((s) => s.nodes.find((n) => n.id === s.selectedId));
  const remove = useFrigg((s) => s.removeNode);
  const recovered = useFrigg((s) => s.recovered);

  if (!node) {
    return (
      <div className="side">
        <h3>FRIGG</h3>
        <p className="muted">Canvas + orquestração de agentes sobre OmniRoute. Selecione um nó para configurar.</p>
        <p className="muted">Workspace: {recovered ? 'carregado do disco' : 'novo/vazio'}.</p>
      </div>
    );
  }

  return (
    <div className="side">
      <h3>{nodeTitle(node)}</h3>
      <div className="muted">tipo: {node.kind} · id: {node.id}</div>
      {node.kind === 'agent' ? <AgentEditor nodeId={node.id} /> : null}
      {node.kind === 'terminal' ? (
        <div className="agent-editor">
          <p className="muted" style={{ margin: 0 }}>CLI: {String(node.data['command'] || 'shell')}</p>
          <WorkDirField nodeId={node.id} />
        </div>
      ) : null}
      {node.kind === 'browser' ? <p className="muted">URL: {String(node.data['url'] || '')}</p> : null}
      <button className="btn" style={{ marginTop: 10 }} onClick={() => selectedId && remove(selectedId)}>Remover nó</button>
    </div>
  );
}
