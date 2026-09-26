import { useEffect, useState, lazy, Suspense, type JSX } from 'react';
import { spentUsd, useFrigg } from './store.js';
import { bridge } from './bridge.js';
import { Canvas2D } from './canvas/Canvas2D.js';
import { SidePanel } from './SidePanel.js';
import { Sidebar } from './Sidebar.js';
import { OperationView } from './OperationView.js';
import { healthLabel } from '../core/omniroute-client.js';
import { formatUsd } from '../core/agent-policy.js';
import { startWorkflow, pumpWorkflow } from './orchestrate.js';
import { NewTerminalModal } from './NewTerminalModal.js';
import { Dashboard } from './Dashboard.js';
import { CommandPalette } from './CommandPalette.js';

// D04: o módulo 3D (Three.js) carrega sob demanda — não pesa no canvas 2D.
const Office3D = lazy(() => import('./office/Office3D.js').then((m) => ({ default: m.Office3D })));

export function App(): JSX.Element {
  const view = useFrigg((s) => s.view);
  const setView = useFrigg((s) => s.setView);
  const health = useFrigg((s) => s.health);
  const setHealth = useFrigg((s) => s.setHealth);
  const setPty = useFrigg((s) => s.setPty);
  const loadLibrary = useFrigg((s) => s.loadLibrary);
  const toLibrary = useFrigg((s) => s.toLibrary);
  const nodes = useFrigg((s) => s.nodes);
  const edges = useFrigg((s) => s.edges);
  const workspaces = useFrigg((s) => s.workspaces);
  const activeWorkspaceId = useFrigg((s) => s.activeWorkspaceId);

  const applyEvent = useFrigg((s) => s.applyEvent);
  const setOutput = useFrigg((s) => s.setOutput);
  const addCost = useFrigg((s) => s.addCost);
  const workflowRunning = useFrigg((s) => s.workflowRunning);
  const setWorkflowRunning = useFrigg((s) => s.setWorkflowRunning);
  const [wfMsg, setWfMsg] = useState<string | null>(null);
  const workflowNotice = useFrigg((s) => s.workflowNotice);
  const spent = useFrigg(spentUsd);
  const [showNewTerminal, setShowNewTerminal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [hydrated, setHydrated] = useState(false);
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setShowPalette(true); }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  // Bootstrap: carrega workspace, sonda saúde/PTY e escuta eventos de agente.
  useEffect(() => {
    setBootState('loading');
    setBootError(null);
    void bridge.workspace.load()
      .then((r) => {
        loadLibrary(r.library, r.recovered);
        setHydrated(true);
        setBootState('ready');
      })
      .catch((error: unknown) => {
        setBootState('error');
        setBootError(`Não foi possível carregar o workspace: ${String(error)}`);
      });
    void bridge.pty.available().then(setPty).catch(() => setPty({ available: false, detail: 'IPC indisponível' }));
    const tick = (): void => void bridge.omniroute.health().then(setHealth).catch(() => undefined);
    tick();
    const t = setInterval(tick, 5000);
    const offEvent = bridge.agent.onEvent(({ id, event }) => {
      applyEvent(id, event);
      void pumpWorkflow(); // reavalia o fluxo a cada transição real
    });
    const offOutput = bridge.agent.onOutput(({ id, text }) => setOutput(id, text));
    const offCost = bridge.agent.onCost(({ id, usd }) => {
      addCost(id, usd);
      void pumpWorkflow(); // reavalia o orçamento do fluxo
    });
    // Guarda a conversa no nó (persistida no workspace) para poder continuar depois.
    const offSession = bridge.agent.onSession(({ id, ref }) => useFrigg.getState().patchNodeData(id, { sessionRef: ref }));
    return () => {
      clearInterval(t);
      offEvent();
      offOutput();
      offCost();
      offSession();
    };
  }, [bootAttempt, loadLibrary, setHealth, setPty, applyEvent, setOutput, addCost]);

  const onOrchestrate = (): void => {
    if (workflowRunning) {
      setWorkflowRunning(false);
      useFrigg.getState().setWorkflowNotice(null);
      setWfMsg('Fluxo pausado.');
      return;
    }
    const err = startWorkflow();
    setWfMsg(err ?? 'Fluxo iniciado.');
  };

  // Autosave (debounce simples) quando os nós mudam.
  useEffect(() => {
    if (!hydrated) return undefined;
    setSaveState('saving');
    const t = setTimeout(() => {
      void bridge.workspace.save(toLibrary())
        .then(() => setSaveState('saved'))
        .catch((error: unknown) => {
          setSaveState('error');
          setAppError(`Falha ao salvar: ${String(error)}`);
        });
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, edges, workspaces, activeWorkspaceId, toLibrary, hydrated]);

  const hp = health?.status ?? 'unknown';
  const healthClass = hp === 'reachable' ? 'ok' : hp === 'unavailable' ? 'down' : 'unknown';

  if (bootState !== 'ready') {
    return (
      <div className="app" role="status" aria-live="polite">
        <div className="modal-overlay">
          <div className="modal" role="alertdialog" aria-labelledby="boot-title" aria-describedby="boot-detail">
            <h3 id="boot-title">{bootState === 'loading' ? 'Carregando workspace…' : 'Não foi possível carregar o workspace'}</h3>
            <p id="boot-detail" className="muted">{bootError ?? 'Aguarde enquanto o FRIGG recupera seus projetos.'}</p>
            {bootState === 'error' ? <button className="btn active" onClick={() => setBootAttempt((n) => n + 1)}>Tentar novamente</button> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand-lockup" aria-label="Ir para início" onClick={() => setView('home')}><span className="brand-mark">F</span><span className="brand-copy"><strong>FRIGG</strong><small>COMMAND CENTER</small></span></button>
        <span className="topbar-divider" aria-hidden="true" />
        <nav className="main-nav" aria-label="Navegação principal">
          <button className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>Início</button>
          <button className={`nav-item ${view === '2d' ? 'active' : ''}`} onClick={() => setView('2d')}>Canvas</button>
          <button className={`nav-item ${view === 'op' ? 'active' : ''}`} onClick={() => setView('op')}>Operação</button>
        </nav>
        <div className="topbar-spacer" />
        <button className="command-trigger" onClick={() => setShowPalette(true)} aria-label="Abrir command palette"><span>⌕</span> Buscar ações… <kbd>⌘K</kbd></button>
        <span className={`save-state ${saveState}`} aria-live="polite"><i />{saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Não salvo' : 'Salvo'}</span>
        <span className={`status-pill topbar-status ${healthClass}`}><i />{healthLabel(hp)}</span>
        <span className="status-pill topbar-cost" title="Gasto informado pelos agentes desde que o FRIGG foi aberto">{formatUsd(spent)}</span>
        <button className={`btn run-button ${workflowRunning ? 'active' : ''}`} onClick={onOrchestrate}>{workflowRunning ? '■ Parar' : '▶ Executar'}</button>
        {workflowNotice ?? wfMsg ? <span className="workflow-toast" aria-live="polite">{workflowNotice ?? wfMsg}</span> : null}
      </header>
      {appError ? (
        <div className="app-alert" role="alert">
          <span>{appError}</span>
          <button className="btn mini" onClick={() => setAppError(null)}>Fechar</button>
        </div>
      ) : null}
      {view === 'home' ? <Dashboard /> : <div className="main"><Sidebar /><div className="stage">{view === '2d' ? <Canvas2D /> : view === 'op' ? <OperationView /> : <Suspense fallback={<div style={{ padding: 16 }} className="muted">Carregando escritório 3D…</div>}><Office3D /></Suspense>}</div><SidePanel /></div>}
      <NewTerminalModal open={showNewTerminal} onClose={() => setShowNewTerminal(false)} />
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} onNewTerminal={() => setShowNewTerminal(true)} onOrchestrate={onOrchestrate} />
    </div>
  );
}
