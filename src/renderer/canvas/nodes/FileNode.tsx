import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { bridge } from '../../bridge.js';
import { DeleteBtn } from './DeleteBtn.js';

/** Nó de Arquivo: referência a um arquivo do disco (escolher + abrir). */
export function FileNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const path = typeof node?.data['path'] === 'string' ? (node.data['path'] as string) : '';
  const name = path ? path.split(/[\\/]/).pop() : '';

  const pick = async (): Promise<void> => {
    const p = await bridge.dialog.pickFile();
    if (p) patch(nodeId, { path: p, title: p.split(/[\\/]/).pop() ?? 'Arquivo' });
  };

  return (
    <div className="node file">
      <div className="head"><span className="dot" /> 📄 {name || 'Arquivo'}<DeleteBtn id={nodeId} /></div>
      <div className="body" style={{ width: 260 }}>
        <div className="muted" style={{ wordBreak: 'break-all', fontSize: 12 }}>{path || 'Nenhum arquivo escolhido'}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button className="btn nodrag" onClick={() => void pick()}>📁 Escolher</button>
          {path ? <button className="btn nodrag" onClick={() => void bridge.file.open(path)}>Abrir</button> : null}
        </div>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
