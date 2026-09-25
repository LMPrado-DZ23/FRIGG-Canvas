import { useEffect, useRef, useState, type JSX } from 'react';
import { useFrigg } from './store.js';
import { bridge } from './bridge.js';

const QUICK: { label: string; cmd: string }[] = [
  { label: 'Claude Code', cmd: 'claude' },
  { label: 'Codex', cmd: 'codex' },
  { label: 'Gemini', cmd: 'gemini' },
  { label: 'OpenCode', cmd: 'opencode' },
  { label: 'Shell', cmd: '' },
];

export function NewTerminalModal({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const addNode = useFrigg((s) => s.addNode);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [install, setInstall] = useState('');
  const modalRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = modalRef.current?.querySelector<HTMLElement>('input, button, select, textarea');
    first?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll<HTMLElement>('input, button, select, textarea')]
        .filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const current = document.activeElement;
      const index = focusable.indexOf(current as HTMLElement);
      const next = event.shiftKey
        ? focusable[(index <= 0 ? focusable.length : index) - 1]
        : focusable[(index + 1) % focusable.length];
      if (index === -1 || (event.shiftKey && index === 0) || (!event.shiftKey && index === focusable.length - 1)) {
        event.preventDefault();
        next?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;

  const create = (): void => {
    addNode('terminal', undefined, { title: name || 'Terminal', command, cwd, install });
    setName(''); setCommand(''); setCwd(''); setInstall('');
    onClose();
  };
  const pick = async (): Promise<void> => {
    const d = await bridge.dialog.pickFolder();
    if (d) setCwd(d);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="new-terminal-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <b id="new-terminal-title">Novo terminal</b>
          <button className="btn active" onClick={create}>Criar</button>
        </div>
        <div className="modal-section">INÍCIO RÁPIDO</div>
        <div className="quick-row">
          {QUICK.map((q) => (
            <button
              key={q.label}
              className={`quick ${command === q.cmd && (name === q.label || (q.cmd === '' && name === '')) ? 'sel' : ''}`}
              onClick={() => { setCommand(q.cmd); setName(q.label === 'Shell' ? '' : q.label); }}
            >
              {q.label}
            </button>
          ))}
        </div>
        <label htmlFor="new-terminal-name">Nome do terminal</label>
        <input id="new-terminal-name" className="fld" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do terminal" />
        <label htmlFor="new-terminal-command">Comando</label>
        <input id="new-terminal-command" className="fld" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="ex.: claude, codex, minha-cli --flag, ou vazio para shell" />
        <label htmlFor="new-terminal-install">Instalar (opcional) — para CLI que não está na lista</label>
        <input id="new-terminal-install" className="fld" value={install} onChange={(e) => setInstall(e.target.value)} placeholder="ex.: npm i -g minha-cli  (se faltar, o FRIGG instala antes de rodar)" />
        <label htmlFor="new-terminal-cwd">Diretório de trabalho</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <input id="new-terminal-cwd" className="fld" style={{ flex: 1 }} value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="padrão (home)" />
          <button className="btn" onClick={() => void pick()}>📁 Procurar…</button>
        </div>
      </div>
    </div>
  );
}
