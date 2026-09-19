import { useFrigg } from './store.js';
import { bridge } from './bridge.js';
import { deriveVisual, activityLabel } from '../core/session-model.js';
import { initialSessionState } from '../core/turn-state.js';

/**
 * View Operação (D01 4ª visão + D11 fallback acessível): lista DOM de todas as
 * sessões com execução/validação/conectividade distintas e controles por teclado.
 * Funciona sem WebGL — é o fallback quando o 3D não está disponível.
 */
export function OperationView(): JSX.Element {
  const nodes = useFrigg((s) => s.nodes.filter((n) => n.kind === 'agent' || n.kind === 'terminal'));
  const sessions = useFrigg((s) => s.sessions);
  const select = useFrigg((s) => s.select);

  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
      <h3>Operação</h3>
      {nodes.length === 0 ? <p className="muted">Nenhum agente/terminal. Adicione no topo.</p> : null}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
            <th>Nó</th><th>Execução</th><th>Validação</th><th>Conexão</th><th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => {
            const slot = sessions[n.id];
            const v = deriveVisual(slot?.state ?? initialSessionState(), { lastEventAt: slot?.lastEventAt ?? null });
            const active = v.activity === 'working' || v.activity === 'awaiting_approval' || v.activity === 'cancelling';
            return (
              <tr key={n.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td>
                  <button className="btn" style={{ padding: '2px 8px' }} onClick={() => select(n.id)}>
                    {String(n.data['title'] ?? n.kind)}
                  </button>
                </td>
                <td><span className={`dot ${v.activity}`} style={{ display: 'inline-block', marginRight: 6 }} />{activityLabel(v.activity)}</td>
                <td>{v.validated ? '✓ validado' : '—'}</td>
                <td className={v.connectivity === 'connected' ? '' : 'muted'}>{v.connectivity}</td>
                <td>
                  {n.kind === 'agent' && active ? (
                    <button className="btn" onClick={() => void bridge.agent.cancel(n.id)}>Cancelar</button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 10 }}>
        Esta visão não usa WebGL: é o fallback quando o escritório 3D não está disponível.
      </p>
    </div>
  );
}
