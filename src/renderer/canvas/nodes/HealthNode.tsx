import { type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { healthLabel } from '../../../core/omniroute-client.js';

export function HealthNode(_props: NodeProps): JSX.Element {
  const health = useFrigg((s) => s.health);
  const status = health?.status ?? 'unknown';
  return (
    <div className="node health">
      <div className="head"><span className={`dot ${status === 'reachable' ? 'done' : 'failed'}`} /> OmniRoute</div>
      <div className="body">
        <div>{healthLabel(status)}</div>
        {health ? <div className="muted">{health.detail}</div> : null}
      </div>
    </div>
  );
}
