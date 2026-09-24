import { useEffect, useRef, useState } from 'react';
import { useFrigg } from './store.js';
import type { NodeKind } from '../core/workspace.js';
import { TEAM_TEMPLATES } from './templates.js';

interface CommandPaletteProps { open: boolean; onClose: () => void; onNewTerminal: () => void; onOrchestrate: () => void; }
interface Command { id: string; label: string; hint: string; icon: string; action: () => void; }

export function CommandPalette({ open, onClose, onNewTerminal, onOrchestrate }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setView = useFrigg((s) => s.setView);
  const addNode = useFrigg((s) => s.addNode);
  const addTemplate = useFrigg((s) => s.addTemplate);
  const setObjective = useFrigg((s) => s.setObjective);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', onKeyDown); };
  }, [open, onClose]);

  if (!open) return null;
  const closeAfter = (action: () => void): (() => void) => () => { action(); onClose(); };
  const add = (kind: NodeKind): void => { addNode(kind); setView('2d'); };
  const commands: Command[] = [
    { id: 'canvas', label: 'Abrir canvas', hint: 'Navegar', icon: '⌘', action: () => setView('2d') },
    { id: 'operation', label: 'Abrir operação', hint: 'Navegar', icon: '◈', action: () => setView('op') },
    { id: 'office', label: 'Abrir escritório 3D', hint: 'Navegar', icon: '✧', action: () => setView('3d') },
    { id: 'agent', label: 'Adicionar agente', hint: 'Canvas', icon: '✦', action: () => add('agent') },
    { id: 'terminal', label: 'Adicionar terminal', hint: 'Canvas', icon: '⌁', action: onNewTerminal },
    { id: 'browser', label: 'Adicionar navegador', hint: 'Canvas', icon: '◎', action: () => add('browser') },
    { id: 'note', label: 'Criar nota', hint: 'Canvas', icon: '□', action: () => add('note') },
    { id: 'run', label: 'Orquestrar objetivo', hint: 'Workflow', icon: '▶', action: onOrchestrate },
    ...TEAM_TEMPLATES.map((template) => ({ id: `template-${template.id}`, label: `Usar playbook: ${template.label.replace(/^[^ ]+ /, '')}`, hint: 'Playbooks', icon: '▦', action: () => { addTemplate(template.nodes, template.chain); setView('2d'); } })),
    { id: 'objective', label: 'Definir objetivo do projeto', hint: 'Workspace', icon: '✎', action: () => { setView('2d'); setObjective(''); } },
  ];
  const filtered = commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(query.toLowerCase()));
  const runActive = (): void => { const command = filtered[activeIndex]; if (command) closeAfter(command.action)(); };
  return <div className="palette-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="palette-title"><div className="palette-search"><span aria-hidden="true">⌕</span><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => filtered.length ? (index + 1) % filtered.length : 0); } else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => filtered.length ? (index - 1 + filtered.length) % filtered.length : 0); } else if (event.key === 'Enter') { event.preventDefault(); runActive(); } }} placeholder="O que você quer fazer?" aria-label="Buscar comandos" /><kbd>ESC</kbd></div><div className="palette-list" role="listbox" aria-label="Comandos">{filtered.length ? filtered.map((command, index) => <button className={`palette-command ${index === activeIndex ? 'active' : ''}`} key={command.id} onMouseEnter={() => setActiveIndex(index)} onClick={closeAfter(command.action)} role="option" aria-selected={index === activeIndex}><span className="palette-icon">{command.icon}</span><span className="palette-command-copy"><strong>{command.label}</strong><small>{command.hint}</small></span><span className="palette-enter">↵</span></button>) : <div className="palette-empty">Nenhum comando encontrado.</div>}</div><footer className="palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> executar</span><span><kbd>esc</kbd> fechar</span></footer></section><h2 id="palette-title" className="visually-hidden">Command palette</h2></div>;
}
