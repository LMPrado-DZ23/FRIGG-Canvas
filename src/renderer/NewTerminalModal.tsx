import { useEffect, useState } from 'react';
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
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-terminal-title" onClick={(e) => e.stopPropagation()}>
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
        <label>Nome do terminal</label>
        <input className="fld" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do terminal" />
        <label>Comando</label>
        <input className="fld" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="ex.: claude, codex, minha-cli --flag, ou vazio para shell" />
        <label>Instalar (opcional) — para CLI que não está na lista</label>
        <input className="fld" value={install} onChange={(e) => setInstall(e.target.value)} placeholder="ex.: npm i -g minha-cli  (se faltar, o FRIGG instala antes de rodar)" />
        <label>Diretório de trabalho</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <input className="fld" style={{ flex: 1 }} value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="padrão (home)" />
          <button className="btn" onClick={() => void pick()}>📁 Procurar…</button>
        </div>
      </div>
    </div>
  );
}
