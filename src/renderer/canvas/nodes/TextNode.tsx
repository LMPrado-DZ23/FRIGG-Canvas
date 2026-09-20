import { useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';

/** Nó de Texto livre no canvas (título/legenda), editável no duplo clique. */
export function TextNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const text = typeof node?.data['text'] === 'string' ? (node.data['text'] as string) : '';
  const [editing, setEditing] = useState(false);

  return editing ? (
    <textarea
      className="nodrag text-node-edit"
      autoFocus
      value={text}
      onChange={(e) => patch(nodeId, { text: e.target.value })}
      onBlur={() => setEditing(false)}
    />
  ) : (
    <div className="text-node" onDoubleClick={() => setEditing(true)} title="Duplo clique para editar">
      {text || 'Texto (duplo clique)'}
    </div>
  );
}
