import { useState, type JSX } from 'react';
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
      aria-label="Texto do nó"
      autoFocus
      value={text}
      onChange={(e) => patch(nodeId, { text: e.target.value })}
      onBlur={() => setEditing(false)}
    />
  ) : (
    <div
      className="text-node"
      role="button"
      tabIndex={0}
      aria-label={`Texto: ${text || 'vazio'}. Enter para editar`}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(true); } }}
      title="Duplo clique (ou Enter) para editar"
    >
      {text || 'Texto (duplo clique)'}
    </div>
  );
}
