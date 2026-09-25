import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { bridge } from '../../bridge.js';
import { deriveVisual, activityLabel } from '../../../core/session-model.js';
import { initialSessionState } from '../../../core/turn-state.js';
import { ROLES, roleById } from '../../../core/roles.js';
import { formatUsd } from '../../../core/agent-policy.js';
import { agentConfig, agentStartParams, composeTaskPrompt } from '../../agent-config.js';
import { DeleteBtn } from './DeleteBtn.js';

export function AgentNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const slot = useFrigg((s) => s.sessions[nodeId]);
  const patch = useFrigg((s) => s.patchNodeData);
  const [prompt, setPrompt] = useState('');
  const [detail, setDetail] = useState<string | null>(null);

  const cfg = agentConfig(node?.data);
  const role = roleById(cfg.roleId);
  const customName = typeof node?.data['name'] === 'string' ? (node.data['name'] as string) : '';
  const title = customName ? `${role?.emoji ?? '🤖'} ${customName}` : role ? `${role.emoji} ${role.label}` : 'Agente';

  const visual = deriveVisual(slot?.state ?? initialSessionState(), { lastEventAt: slot?.lastEventAt ?? null });
  const active = visual.activity === 'working' || visual.activity === 'awaiting_approval' || visual.activity === 'cancelling';
  const pending = slot?.state.pendingApprovals ?? [];
  const canContinue = cfg.sessionRef !== undefined;

  const run = async (resume: boolean): Promise<void> => {
    const task = prompt.trim();
    if (task.length === 0) {
      setDetail('escreva uma mensagem');
      return;
    }
    // Continuação: a conversa já tem as instruções do papel; manda só a mensagem.
    const text = resume ? task : composeTaskPrompt(cfg, task);
    const r = await bridge.agent.start(nodeId, agentStartParams(cfg, text, resume));
    setDetail(r.detail);
    if (r.ok) setPrompt('');
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
          value={cfg.roleId}
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
          {slot?.costUsd ? <span className="agent-cost" title="Gasto deste agente nesta sessão do app"> · {formatUsd(slot.costUsd)}</span> : null}
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
              aria-label={canContinue ? 'Mensagem para continuar a conversa' : 'Tarefa para o agente'}
              style={{ width: 220, height: 54 }}
              placeholder={canContinue ? 'Continue a conversa (ex.: agora corrija o teste que falhou)…' : 'Tarefa para o agente…'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {canContinue ? (
                <>
                  <button className="btn nodrag" onClick={() => void run(true)} title="Envia para a mesma conversa (o agente lembra do que já fez)">↩ Continuar</button>
                  <button className="btn nodrag" onClick={() => void run(false)} title="Começa uma conversa nova do zero">▶ Nova tarefa</button>
                  <button className="btn mini nodrag" onClick={() => patch(nodeId, { sessionRef: '' })} title="Esquece a conversa anterior">Limpar conversa</button>
                </>
              ) : (
                <button className="btn nodrag" onClick={() => void run(false)}>▶ Iniciar</button>
              )}
            </div>
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
