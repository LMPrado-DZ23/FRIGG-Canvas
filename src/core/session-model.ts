/**
 * FRIGG — projeção visual da sessão (D05/D06).
 *
 * 2D (canvas) e 3D (escritório) consomem ESTE mesmo modelo normalizado.
 * A projeção visual é derivada de estado confirmado (turn-state), nunca o
 * contrário. Execução, validação e conectividade são eixos SEPARADOS.
 */
import type { AgentSessionState } from './turn-state.js';

/** Eixo de execução — o que o agente está fazendo agora. */
export type Activity =
  | 'idle'
  | 'working'
  | 'awaiting_approval'
  | 'cancelling'
  | 'done'
  | 'failed'
  | 'unknown';

/** Eixo de conectividade — telemetria/adaptador ligado? */
export type Connectivity = 'connected' | 'stale' | 'disconnected';

export interface VisualState {
  readonly activity: Activity;
  readonly validated: boolean;
  readonly connectivity: Connectivity;
  /** true quando o motivo exige atenção humana (unknown/failed/awaiting). */
  readonly needsAttention: boolean;
  /** ms desde a última telemetria; usado para 'stale'. */
  readonly lastSeenAgeMs: number | null;
}

export interface DeriveOptions {
  readonly now?: number;
  readonly lastEventAt?: number | null;
  readonly staleAfterMs?: number;
}

function activityFrom(s: AgentSessionState): Activity {
  switch (s.turn) {
    case 'idle':
      return 'idle';
    case 'running':
      return 'working';
    case 'awaiting_approval':
      return 'awaiting_approval';
    case 'cancelling':
      return 'cancelling';
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'idle';
    case 'unknown':
      return 'unknown';
    default: {
      const _e: never = s.turn;
      return _e;
    }
  }
}

function connectivityFrom(lastSeenAgeMs: number | null, staleAfterMs: number, exited: boolean): Connectivity {
  if (exited) return 'disconnected';
  if (lastSeenAgeMs === null) return 'disconnected';
  return lastSeenAgeMs > staleAfterMs ? 'stale' : 'connected';
}

/** Deriva a projeção visual. Pura. */
export function deriveVisual(state: AgentSessionState, opts: DeriveOptions = {}): VisualState {
  const now = opts.now ?? Date.now();
  const lastEventAt = opts.lastEventAt ?? null;
  const staleAfterMs = opts.staleAfterMs ?? 15000;
  const lastSeenAgeMs = lastEventAt === null ? null : Math.max(0, now - lastEventAt);
  const activity = activityFrom(state);
  const validated = state.validation === 'validated';
  const connectivity = connectivityFrom(lastSeenAgeMs, staleAfterMs, state.process === 'exited');
  const needsAttention =
    activity === 'awaiting_approval' || activity === 'failed' || activity === 'unknown';
  return { activity, validated, connectivity, needsAttention, lastSeenAgeMs };
}

/** Cor/rótulo canônico por atividade (usado igual no 2D e no 3D). */
export function activityLabel(a: Activity): string {
  const map: Record<Activity, string> = {
    idle: 'Ocioso',
    working: 'Trabalhando',
    awaiting_approval: 'Aguardando aprovação',
    cancelling: 'Cancelando…',
    done: 'Concluído',
    failed: 'Falhou',
    unknown: 'Desconhecido',
  };
  return map[a];
}
