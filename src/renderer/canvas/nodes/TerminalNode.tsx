import type { JSX } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { TerminalView } from './TerminalView.js';
import { CLI_CATALOG, CLI_CATEGORIES } from '../../cli-catalog.js';
import { DeleteBtn } from './DeleteBtn.js';

export function TerminalNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const title = typeof node?.data['title'] === 'string' ? (node.data['title'] as string) : 'Terminal';
  const command = typeof node?.data['command'] === 'string' ? (node.data['command'] as string) : '';
  const cwd = typeof node?.data['cwd'] === 'string' ? (node.data['cwd'] as string) : '';
  const install = typeof node?.data['install'] === 'string' ? (node.data['install'] as string) : '';

  return (
    <div className="node terminal">
      <div className="head">
        <span className="dot working" /> {title}
        <select aria-label="CLI do terminal"
          className="nodrag"
          value={command}
          onChange={(e) => patch(nodeId, { command: e.target.value, title: e.target.selectedOptions[0]?.text ?? title })}
        >
          <option value="">Shell</option>
          {CLI_CATEGORIES.map((cat) => (
            <optgroup key={cat} label={cat}>
              {CLI_CATALOG.filter((c) => c.category === cat).map((c) => (
                <option key={c.label} value={c.command}>{c.label}{c.managed ? ' ★' : ''}{c.enabled === false ? ' (fora do painel)' : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <DeleteBtn id={nodeId} />
      </div>
      <div className="body">
        <TerminalView id={nodeId} command={command} cwd={cwd} install={install} />
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
