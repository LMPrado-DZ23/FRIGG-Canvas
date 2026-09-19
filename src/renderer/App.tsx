import { useEffect, useCallback } from 'react';
import { useFrigg } from './store.js';
import { bridge } from './bridge.js';
import { Canvas2D } from './canvas/Canvas2D.js';
import { Office3D } from './office/Office3D.js';
import { SidePanel } from './SidePanel.js';
import { healthLabel } from '../core/omniroute-client.js';

export function App(): JSX.Element {
  const view = useFrigg((s) => s.view);
  const setView = useFrigg((s) => s.setView);
  const health = useFrigg((s) => s.health);
  const setHealth = useFrigg((s) => s.setHealth);
  const setPty = useFrigg((s) => s.setPty);
  const loadDoc = useFrigg((s) => s.loadDoc);
  const addNode = useFrigg((s) => s.addNode);
  const toDoc = useFrigg((s) => s.toDoc);
  const nodes = useFrigg((s) => s.nodes);

  // Bootstrap: carrega workspace, sonda saúde e disponibilidade de PTY.
  useEffect(() => {
    void bridge.workspace.load().then((r) => loadDoc(r.doc, r.recovered));
    void bridge.pty.available().then(setPty);
    const tick = (): void => void bridge.omniroute.health().then(setHealth);
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [loadDoc, setHealth, setPty]);

  // Autosave (debounce simples) quando os nós mudam.
  useEffect(() => {
    const t = setTimeout(() => void bridge.workspace.save(toDoc()), 600);
    return () => clearTimeout(t);
  }, [nodes, toDoc]);

  const hp = health?.status ?? 'unknown';
  const healthClass = hp === 'reachable' ? 'ok' : hp === 'unavailable' ? 'down' : 'unknown';

  const add = useCallback((k: 'terminal' | 'note' | 'agent') => () => addNode(k), [addNode]);

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">FRIGG</span>
        <button className="btn" onClick={add('terminal')}>+ Terminal</button>
        <button className="btn" onClick={add('agent')}>+ Agente</button>
        <button className="btn" onClick={add('note')}>+ Nota</button>
        <div className="spacer" />
        <span className={`badge ${healthClass}`}>{healthLabel(hp)}</span>
        <button className={`btn ${view === '2d' ? 'active' : ''}`} onClick={() => setView('2d')}>Canvas 2D</button>
        <button className={`btn ${view === '3d' ? 'active' : ''}`} onClick={() => setView('3d')}>Escritório 3D</button>
      </div>
      <div className="main">
        <div className="stage">{view === '2d' ? <Canvas2D /> : <Office3D />}</div>
        <SidePanel />
      </div>
    </div>
  );
}
