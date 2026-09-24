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
        <label htmlFor={`${nodeId}-cwd`}>Pasta de trabalho</label>
        <div style={{ display: 'flex', gap: 4 }}>
        <input id={`${nodeId}-cwd`} className="fld" style={{ flex: 1 }} value={cwd} placeholder="padrão (home)" onChange={(e) => patch(nodeId, { cwd: e.target.value })} />
        <button className="btn" onClick={() => void pick()} title="Escolher pasta">📁</button>
        {cwd ? <button className="btn mini" onClick={() => patch(nodeId, { cwd: '' })} title="Limpar">✕</button> : null}
      </div>
    </>
  );
}

function TerminalEditor({ nodeId }: { nodeId: string }): JSX.Element {
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  if (!node) return <></>;
  const command = typeof node.data['command'] === 'string' ? (node.data['command'] as string) : '';
  const install = typeof node.data['install'] === 'string' ? (node.data['install'] as string) : '';
  return (
    <div className="agent-editor">
      <label htmlFor={`${nodeId}-command`}>Comando (CLI) — vazio = shell</label>
      <input id={`${nodeId}-command`} className="fld" value={command} placeholder="ex.: claude, codex, minha-cli --flag" onChange={(e) => patch(nodeId, { command: e.target.value })} />
      <label htmlFor={`${nodeId}-install`}>Instalar (opcional) — CLI fora da lista</label>
      <input id={`${nodeId}-install`} className="fld" value={install} placeholder="ex.: npm i -g minha-cli (roda se faltar)" onChange={(e) => patch(nodeId, { install: e.target.value })} />
      <div className="muted" style={{ fontSize: 12 }}>Se preencher, o FRIGG instala antes de rodar quando o CLI não existir. Reabra o terminal para reexecutar.</div>
      <WorkDirField nodeId={nodeId} />
    </div>
  );
}

function AgentEditor({ nodeId }: { nodeId: string }): JSX.Element {
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const saveTpl = useFrigg((s) => s.saveAgentTemplate);
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
      <label htmlFor={`${nodeId}-name`}>Nome</label>
      <input id={`${nodeId}-name`} className="fld" value={name} placeholder={role?.label ?? 'Agente'} onChange={(e) => patch(nodeId, { name: e.target.value })} />

      <label htmlFor={`${nodeId}-role`}>Papel (modelo de instrução)</label>
      <select id={`${nodeId}-role`} className="fld" value={roleId} onChange={(e) => patch(nodeId, { role: e.target.value })}>
        {ROLES.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
      </select>

      <label htmlFor={`${nodeId}-prompt`}>Instruções (o que este agente faz)</label>
      <textarea
        id={`${nodeId}-prompt`}
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

      <label htmlFor={`${nodeId}-harness`} style={{ marginTop: 8 }}>Harness</label>
      <select id={`${nodeId}-harness`} className="fld" value={harness} onChange={(e) => patch(nodeId, { harness: e.target.value })}>
        <option value="claude">Claude Code</option>
        <option value="codex">Codex</option>
      </select>
      {harness === 'claude' ? (
        <div className="muted" style={{ fontSize: 12 }}>
          O Claude gerenciado usa permissões seguras padrão; ações que exigem confirmação podem ser recusadas no modo não interativo. Para controle interativo completo, use um nó Terminal.
        </div>
      ) : null}

      <label htmlFor={`${nodeId}-model`}>Modelo (opcional)</label>
      <input id={`${nodeId}-model`} className="fld" value={model} placeholder="ex.: sonnet, gpt-5.6…" onChange={(e) => patch(nodeId, { model: e.target.value })} />

      <WorkDirField nodeId={nodeId} />

      <button className="btn" style={{ marginTop: 8 }} onClick={() => saveTpl(nodeId)}>💾 Salvar como meu agente</button>
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
      {node.kind === 'terminal' ? <TerminalEditor nodeId={node.id} /> : null}
      {node.kind === 'browser' ? <p className="muted">URL: {String(node.data['url'] || '')}</p> : null}
      <button className="btn" style={{ marginTop: 10 }} onClick={() => selectedId && remove(selectedId)}>Remover nó</button>
    </div>
  );
}
