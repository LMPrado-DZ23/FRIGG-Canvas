import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';

export function NoteNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const text = typeof node?.data['text'] === 'string' ? (node.data['text'] as string) : '';
  return (
    <div className="node note">
      <div className="head"><span className="dot" /> Nota</div>
      <div className="body">
        <textarea
          value={text}
          onChange={(e) => patch(nodeId, { text: e.target.value })}
          className="nodrag"
          placeholder="Markdown / anotações…"
        />
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
