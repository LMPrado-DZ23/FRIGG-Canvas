import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { bridge } from '../../bridge.js';
import { deriveVisual, activityLabel } from '../../../core/session-model.js';
import { initialSessionState } from '../../../core/turn-state.js';
import { ROLES, roleById } from '../../../core/roles.js';
import { DeleteBtn } from './DeleteBtn.js';

export function AgentNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const slot = useFrigg((s) => s.sessions[nodeId]);
  const patch = useFrigg((s) => s.patchNodeData);
  const [prompt, setPrompt] = useState('');
  const [detail, setDetail] = useState<string | null>(null);

  const roleId = typeof node?.data['role'] === 'string' ? (node.data['role'] as string) : 'developer';
  const role = roleById(roleId);
  const customName = typeof node?.data['name'] === 'string' ? (node.data['name'] as string) : '';
  const title = customName ? `${role?.emoji ?? '🤖'} ${customName}` : role ? `${role.emoji} ${role.label}` : 'Agente';
  const harness = (typeof node?.data['harness'] === 'string' && node.data['harness']) ? (node.data['harness'] as string) : (role?.harness ?? 'claude');
  const systemPrompt = (typeof node?.data['systemPrompt'] === 'string' && node.data['systemPrompt']) ? (node.data['systemPrompt'] as string) : (role?.systemPrompt ?? '');
  const model = typeof node?.data['model'] === 'string' ? (node.data['model'] as string) : '';

  const visual = deriveVisual(slot?.state ?? initialSessionState(), { lastEventAt: slot?.lastEventAt ?? null });
  const active = visual.activity === 'working' || visual.activity === 'awaiting_approval' || visual.activity === 'cancelling';
  const pending = slot?.state.pendingApprovals ?? [];

  const start = async (): Promise<void> => {
    if (prompt.trim().length === 0) {
      setDetail('escreva um prompt');
      return;
    }
    const composed = `${systemPrompt}\n\n---\n\nTAREFA:\n${prompt}\n\nTrabalhe no diretório do projeto. Ao terminar, resuma o que fez.`;
    const r = await bridge.agent.start(nodeId, { prompt: composed, harness, ...(model ? { model } : {}) });
    setDetail(r.detail);
  };
  const cancel = async (): Promise<void> => {
    await bridge.agent.cancel(nodeId);
  };

  return (
    <div className="node agent">
      <div className="head">
        <span className={`dot ${visual.activity}`} /> {title}
        <select
          className="nodrag"
          value={roleId}
          onChange={(e) => patch(nodeId, { role: e.target.value })}
          disabled={active}
          title="Papel do agente"
        >
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
        </select>
        <DeleteBtn id={nodeId} />
      </div>
      <div className="body">
        <div className="muted">
          {slot ? `${activityLabel(visual.activity)}${visual.validated ? ' · validado' : ''} · ${visual.connectivity}` : 'sem sessão'}
        </div>
        {pending.length > 0 ? (
          <div style={{ marginTop: 4 }}>
            {pending.map((rid) => (
              <div key={rid} className="nodrag" style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                <span className="muted">aprovação {rid}:</span>
                <button className="btn" onClick={() => void bridge.agent.approve(nodeId, rid, 'approved')}>Aprovar</button>
                <button className="btn" onClick={() => void bridge.agent.approve(nodeId, rid, 'denied')}>Negar</button>
              </div>
            ))}
          </div>
        ) : null}
        {!active ? (
          <>
            <textarea
              className="nodrag"
              style={{ width: 220, height: 54 }}
              placeholder="Tarefa para o agente…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button className="btn nodrag" onClick={() => void start()}>▶ Iniciar</button>
          </>
        ) : (
          <button className="btn nodrag" onClick={() => void cancel()}>■ Cancelar</button>
        )}
        {detail ? <div className="muted" style={{ marginTop: 4 }}>{detail}</div> : null}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
