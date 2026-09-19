import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { deriveVisual, activityLabel } from '../../../core/session-model.js';
import { initialSessionState } from '../../../core/turn-state.js';

export function AgentNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const slot = useFrigg((s) => s.sessions[nodeId]);
  const title = typeof node?.data['title'] === 'string' ? (node.data['title'] as string) : 'Agente';
  const harness = typeof node?.data['harness'] === 'string' ? (node.data['harness'] as string) : '—';

  const visual = deriveVisual(slot?.state ?? initialSessionState(), {
    lastEventAt: slot?.lastEventAt ?? null,
  });
  const hasSession = slot !== undefined;

  return (
    <div className="node agent">
      <div className="head">
        <span className={`dot ${visual.activity}`} /> {title}
      </div>
      <div className="body">
        <div className="muted">harness: {harness}</div>
        {hasSession ? (
          <div>
            {activityLabel(visual.activity)}
            {visual.validated ? ' · validado' : ''} · {visual.connectivity}
          </div>
        ) : (
          <div className="muted">sem sessão (adaptador gerenciado: Marco 2)</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
