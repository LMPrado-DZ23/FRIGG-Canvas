import type { JSX } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { DeleteBtn } from './DeleteBtn.js';
import { isSafeBrowserUrl } from '../../../core/security.js';

/** Só http(s) e data:image — nada de file://, UNC ou esquemas privilegiados. */
export function isSafeImageUrl(url: string): boolean {
  return isSafeBrowserUrl(url) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(url);
}

/** Nó de Imagem (por URL). */
export function ImageNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const url = typeof node?.data['url'] === 'string' ? (node.data['url'] as string) : '';

  return (
    <div className="node image">
      <div className="head"><span className="dot" /> 🖼️ Imagem<DeleteBtn id={nodeId} /></div>
      <div className="body">
        {url && isSafeImageUrl(url) ? (
          <img src={url} alt="Imagem do canvas" style={{ maxWidth: 320, maxHeight: 240, borderRadius: 6, display: 'block' }} />
        ) : (
          <div className="muted" style={{ width: 300 }}>{url ? 'Use uma URL http(s) de imagem' : 'Cole a URL da imagem abaixo'}</div>
        )}
        <input
          className="nodrag"
          style={{ width: 300, marginTop: 6 }}
          aria-label="URL da imagem"
          placeholder="https://…/imagem.png"
          value={url}
          onChange={(e) => patch(nodeId, { url: e.target.value })}
        />
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
