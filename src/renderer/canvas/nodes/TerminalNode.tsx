import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { TerminalView } from './TerminalView.js';

/** Presets de CLIs de IA — o terminal abre a CLI escolhida (ou o shell). */
const CLI_PRESETS: Record<string, string> = {
  Shell: '',
  'Claude Code': 'claude',
  Codex: 'codex',
  Gemini: 'gemini',
};

export function TerminalNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const title = typeof node?.data['title'] === 'string' ? (node.data['title'] as string) : 'Terminal';
  const command = typeof node?.data['command'] === 'string' ? (node.data['command'] as string) : '';

  return (
    <div className="node terminal">
      <div className="head">
        <span className="dot working" /> {title}
        <select
          className="nodrag"
          value={command}
          onChange={(e) => patch(nodeId, { command: e.target.value, title: e.target.selectedOptions[0]?.text ?? title })}
        >
          {Object.entries(CLI_PRESETS).map(([label, cmd]) => (
            <option key={label} value={cmd}>{label}</option>
          ))}
        </select>
      </div>
      <div className="body">
        <TerminalView id={nodeId} command={command} />
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
