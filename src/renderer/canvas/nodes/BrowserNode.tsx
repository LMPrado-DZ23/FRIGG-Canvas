import { createElement, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { DeleteBtn } from './DeleteBtn.js';

/** Elemento <webview> do Electron (não tipado no JSX do React). */
interface WebviewEl extends HTMLElement {
  src: string;
  reload(): void;
  goBack(): void;
  goForward(): void;
  loadURL(url: string): void;
}

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return 'about:blank';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+/.test(t)) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

export function BrowserNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const url = typeof node?.data['url'] === 'string' ? (node.data['url'] as string) : 'https://www.google.com/';
  const [addr, setAddr] = useState(url);
  const ref = useRef<WebviewEl | null>(null);

  const go = (raw: string): void => {
    const u = normalizeUrl(raw);
    setAddr(u);
    patch(nodeId, { url: u });
    ref.current?.loadURL(u);
  };

  return (
    <div className="node browser">
      <div className="head">
        <span className="dot" /> 🌐 {String(node?.data['title'] ?? 'Navegador')}
        <DeleteBtn id={nodeId} />
      </div>
      <div className="browser-bar nodrag">
        <button className="btn mini" onClick={() => ref.current?.goBack()} title="Voltar">←</button>
        <button className="btn mini" onClick={() => ref.current?.reload()} title="Recarregar">⟳</button>
        <input
          className="addr"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go(addr); }}
          placeholder="Digite uma URL ou busca…"
        />
        <button className="btn mini" onClick={() => go(addr)}>Ir</button>
      </div>
      <div className="body" style={{ padding: 0 }}>
        {createElement('webview', {
          ref: (el: WebviewEl | null): void => { ref.current = el; },
          src: url,
          className: 'nodrag nowheel',
          style: { width: 560, height: 380, display: 'inline-flex', background: '#fff' },
          partition: 'persist:frigg-browser',
          allowpopups: 'true',
        })}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
