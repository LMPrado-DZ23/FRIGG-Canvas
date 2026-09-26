import { createElement, useEffect, useRef, useState, type JSX } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { DeleteBtn } from './DeleteBtn.js';
import { isSafeBrowserUrl, normalizeBrowserInput } from '../../../core/security.js';

/** Elemento <webview> do Electron (não tipado no JSX do React). */
interface WebviewEl extends HTMLElement {
  src: string;
  reload(): void;
  goBack(): void;
  goForward(): void;
  loadURL(url: string): Promise<void>;
}

export function BrowserNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const storedUrl = typeof node?.data['url'] === 'string' ? (node.data['url'] as string) : '';
  const url = isSafeBrowserUrl(storedUrl) ? storedUrl : 'https://www.google.com/';
  const [addr, setAddr] = useState(url);
  // src fixo na URL inicial: trocar o src E chamar loadURL carregava a página duas vezes.
  const [initialUrl] = useState(url);
  const ref = useRef<WebviewEl | null>(null);

  // A barra de endereço acompanha a navegação feita dentro da página (links).
  useEffect(() => {
    const wv = ref.current;
    if (!wv) return undefined;
    const onNavigate = (e: Event): void => {
      const next = (e as Event & { url?: string }).url;
      if (typeof next === 'string' && isSafeBrowserUrl(next)) {
        setAddr(next);
        patch(nodeId, { url: next });
      }
    };
    wv.addEventListener('did-navigate', onNavigate);
    wv.addEventListener('did-navigate-in-page', onNavigate);
    return () => {
      wv.removeEventListener('did-navigate', onNavigate);
      wv.removeEventListener('did-navigate-in-page', onNavigate);
    };
  }, [nodeId, patch]);

  const go = (raw: string): void => {
    const u = normalizeBrowserInput(raw);
    setAddr(u);
    patch(nodeId, { url: u });
    void ref.current?.loadURL(u).catch(() => undefined);
  };

  return (
    <div className="node browser">
      <div className="head">
        <span className="dot" /> 🌐 {String(node?.data['title'] ?? 'Navegador')}
        <DeleteBtn id={nodeId} />
      </div>
      <div className="browser-bar nodrag">
        <button className="btn mini" onClick={() => ref.current?.goBack()} title="Voltar" aria-label="Voltar">←</button>
        <button className="btn mini" onClick={() => ref.current?.reload()} title="Recarregar" aria-label="Recarregar">⟳</button>
        <input
          className="addr"
          aria-label="Endereço ou busca"
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
          src: initialUrl,
          className: 'nodrag nowheel',
          style: { width: 560, height: 380, display: 'inline-flex', background: '#fff' },
          // Sessão efêmera: não persistir cookies/tokens de páginas visitadas.
          // Persistência deliberada deve ser uma opção explícita no futuro.
          partition: 'frigg-browser',
        })}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
