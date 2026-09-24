import { useEffect, useState, lazy, Suspense } from 'react';
import { useFrigg } from './store.js';
import { bridge } from './bridge.js';
import { Canvas2D } from './canvas/Canvas2D.js';
import { SidePanel } from './SidePanel.js';
import { Sidebar } from './Sidebar.js';
import { OperationView } from './OperationView.js';
import { healthLabel } from '../core/omniroute-client.js';
import { startWorkflow, pumpWorkflow } from './orchestrate.js';
import { TEAM_TEMPLATES } from './templates.js';
import { NewTerminalModal } from './NewTerminalModal.js';

// D04: o módulo 3D (Three.js) carrega sob demanda — não pesa no canvas 2D.
const Office3D = lazy(() => import('./office/Office3D.js').then((m) => ({ default: m.Office3D })));

export function App(): JSX.Element {
  const view = useFrigg((s) => s.view);
  const setView = useFrigg((s) => s.setView);
  const health = useFrigg((s) => s.health);
  const setHealth = useFrigg((s) => s.setHealth);
  const setPty = useFrigg((s) => s.setPty);
  const loadLibrary = useFrigg((s) => s.loadLibrary);
  const addNode = useFrigg((s) => s.addNode);
  const toLibrary = useFrigg((s) => s.toLibrary);
  const nodes = useFrigg((s) => s.nodes);
  const edges = useFrigg((s) => s.edges);
  const workspaces = useFrigg((s) => s.workspaces);
  const activeWorkspaceId = useFrigg((s) => s.activeWorkspaceId);

  const applyEvent = useFrigg((s) => s.applyEvent);
  const setOutput = useFrigg((s) => s.setOutput);
  const addCost = useFrigg((s) => s.addCost);
  const objective = useFrigg((s) => s.objective);
  const setObjective = useFrigg((s) => s.setObjective);
  const workflowRunning = useFrigg((s) => s.workflowRunning);
  const setWorkflowRunning = useFrigg((s) => s.setWorkflowRunning);
  const addTemplate = useFrigg((s) => s.addTemplate);
  const [wfMsg, setWfMsg] = useState<string | null>(null);
  const [showNewTerminal, setShowNewTerminal] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [hydrated, setHydrated] = useState(false);
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

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
    const offCost = bridge.agent.onCost(({ id, usd }) => addCost(id, usd));
    return () => {
      clearInterval(t);
      offEvent();
      offOutput();
      offCost();
    };
  }, [bootAttempt, loadLibrary, setHealth, setPty, applyEvent, setOutput, addCost]);

  const onOrchestrate = (): void => {
    if (workflowRunning) {
      setWorkflowRunning(false);
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
        <span className="brand">FRIGG</span>
        <div className="toolbar">
          <button className="btn tool" aria-label="Adicionar terminal" title="Terminal" onClick={() => addNode('terminal')}>⌨️</button>
          <button className="btn tool" aria-label="Adicionar agente" title="Agente" onClick={() => addNode('agent')}>🤖</button>
          <button className="btn tool" aria-label="Adicionar navegador" title="Navegador" onClick={() => addNode('browser')}>🌐</button>
          <button className="btn tool" aria-label="Adicionar nota" title="Nota" onClick={() => addNode('note')}>📝</button>
          <button className="btn tool" aria-label="Adicionar texto" title="Texto" onClick={() => addNode('text')}>🔤</button>
          <button className="btn tool" aria-label="Adicionar imagem" title="Imagem" onClick={() => addNode('image')}>🖼️</button>
          <button className="btn tool" aria-label="Adicionar arquivo" title="Arquivo" onClick={() => addNode('file')}>📄</button>
          <button className="btn tool" aria-label="Adicionar desenho" title="Desenho" onClick={() => addNode('draw')}>✏️</button>
        </div>
        <button className="btn" title="Novo terminal (assistente)" onClick={() => setShowNewTerminal(true)}>Novo terminal…</button>
        <select
          className="btn"
          value=""
          onChange={(e) => {
            const tpl = TEAM_TEMPLATES.find((t) => t.id === e.target.value);
            if (tpl) addTemplate(tpl.nodes, tpl.chain);
          }}
          title="Equipe pronta"
        >
          <option value="">+ Equipe…</option>
          {TEAM_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <input
          className="btn"
          style={{ width: 260 }}
          placeholder="Objetivo do projeto (para a equipe)…"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
        <button className={`btn ${workflowRunning ? 'active' : ''}`} onClick={onOrchestrate}>
          {workflowRunning ? '■ Parar' : '▶ Orquestrar'}
        </button>
        {wfMsg ? <span className="muted" aria-live="polite">{wfMsg}</span> : null}
        <div className="spacer" />
        <span className={`save-state ${saveState}`} aria-live="polite">
          {saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Não salvo' : 'Salvo'}
        </span>
        <span className={`badge ${healthClass}`}>{healthLabel(hp)}</span>
        <button className={`btn ${view === '2d' ? 'active' : ''}`} onClick={() => setView('2d')}>Canvas 2D</button>
        <button className={`btn ${view === '3d' ? 'active' : ''}`} onClick={() => setView('3d')}>Escritório 3D</button>
        <button className={`btn ${view === 'op' ? 'active' : ''}`} onClick={() => setView('op')}>Operação</button>
      </header>
      {appError ? (
        <div className="app-alert" role="alert">
          <span>{appError}</span>
          <button className="btn mini" onClick={() => setAppError(null)}>Fechar</button>
        </div>
      ) : null}
      <div className="main">
        <Sidebar />
        <div className="stage">
          {view === '2d' ? (
            <Canvas2D />
          ) : view === 'op' ? (
            <OperationView />
          ) : (
            <Suspense fallback={<div style={{ padding: 16 }} className="muted">Carregando escritório 3D…</div>}>
              <Office3D />
            </Suspense>
          )}
        </div>
        <SidePanel />
      </div>
      <NewTerminalModal open={showNewTerminal} onClose={() => setShowNewTerminal(false)} />
    </div>
  );
}
