/**
 * FRIGG — máquina de estados de sessão de agente (Decisão G4).
 *
 * Princípio inegociável: são FATOS DISTINTOS e nunca colapsados —
 *   1. o processo está vivo?            (ProcessPhase)
 *   2. o turno do harness encerrou?     (TurnPhase)
 *   3. o resultado foi validado?        (Validation)
 *
 * Regras que este módulo garante e que os testes provam:
 *  - Um pedido de cancelamento NÃO é uma confirmação. `cancel.requested`
 *    leva a `cancelling`, nunca a `cancelled`. Só `cancel.confirmed`
 *    (ou saída de processo durante o cancelamento) confirma.
 *  - Fim inesperado do stream durante um turno em andamento vira `unknown`
 *    (precisa reconciliação) — NUNCA `completed`.
 *  - Conclusão exige `turn.completed` explícito do harness. Saída de
 *    processo, silêncio do PTY ou prompt reaparecer não concluem um turno.
 *  - Uma aprovação só se resolve pelo `requestId` exato. Timeout ou outro
 *    evento não aprovam nada.
 *  - `completed` com aprovação pendente é inconsistente → `unknown`.
 *
 * O módulo é puro (sem IO, sem Electron, sem node-pty) para ser testável.
 */

export type ProcessPhase = 'starting' | 'alive' | 'exited';
export type TurnPhase =
  | 'idle'
  | 'running'
  | 'awaiting_approval'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'unknown';
export type Validation = 'unvalidated' | 'validated' | 'rejected';

export interface AgentSessionState {
  readonly process: ProcessPhase;
  readonly exitCode: number | null;
  readonly turn: TurnPhase;
  readonly turnId: string | null;
  /** requestIds de aprovações ainda não resolvidas. */
  readonly pendingApprovals: readonly string[];
  readonly cancelRequested: boolean;
  readonly validation: Validation;
  /** Anexado quando algo força reconciliação (turn === 'unknown' ou 'failed'). */
  readonly reason: string | null;
}

export type SessionEvent =
  | { type: 'process.started' }
  | { type: 'process.exited'; code: number }
  | { type: 'turn.started'; turnId: string }
  | { type: 'turn.approval_requested'; requestId: string }
  | { type: 'turn.approval_resolved'; requestId: string; decision: 'approved' | 'denied' }
  | { type: 'turn.completed'; turnId: string }
  | { type: 'turn.failed'; turnId: string; error: string }
  | { type: 'stream.ended'; expected: boolean }
  | { type: 'cancel.requested' }
  | { type: 'cancel.confirmed' }
  | { type: 'result.validated' }
  | { type: 'result.rejected'; error: string };

export function initialSessionState(): AgentSessionState {
  return {
    process: 'starting',
    exitCode: null,
    turn: 'idle',
    turnId: null,
    pendingApprovals: [],
    cancelRequested: false,
    validation: 'unvalidated',
    reason: null,
  };
}

const TERMINAL_TURNS: readonly TurnPhase[] = ['completed', 'failed', 'cancelled', 'unknown'];

function isTerminal(t: TurnPhase): boolean {
  return TERMINAL_TURNS.includes(t);
}

/** Reducer puro. Não lança; entradas impossíveis viram `unknown` com motivo. */
export function reduce(state: AgentSessionState, event: SessionEvent): AgentSessionState {
  switch (event.type) {
    case 'process.started':
      return { ...state, process: 'alive' };

    case 'process.exited': {
      const next: AgentSessionState = { ...state, process: 'exited', exitCode: event.code };
      // Processo morreu com turno ainda ativo.
      if (state.turn === 'cancelling') {
        return { ...next, turn: 'cancelled', reason: 'processo saiu durante o cancelamento' };
      }
      if (state.turn === 'running' || state.turn === 'awaiting_approval') {
        // Saída de processo NÃO conclui um turno. Fica desconhecido.
        return { ...next, turn: 'unknown', reason: `processo saiu (code ${event.code}) com turno ativo` };
      }
      return next;
    }

    case 'turn.started': {
      if (isTerminal(state.turn) || state.turn === 'idle') {
        // Cada turno precisa da própria validação: a do turno anterior não vale.
        return { ...state, turn: 'running', turnId: event.turnId, cancelRequested: false, reason: null, pendingApprovals: [], validation: 'unvalidated' };
      }
      // Novo turno começou sem o anterior encerrar.
      return { ...state, turn: 'unknown', reason: 'turn.started sobre turno não encerrado' };
    }

    case 'turn.approval_requested': {
      if (state.turn !== 'running' && state.turn !== 'awaiting_approval') {
        return { ...state, turn: 'unknown', reason: 'aprovação pedida fora de turno ativo' };
      }
      if (state.pendingApprovals.includes(event.requestId)) return state;
      return {
        ...state,
        turn: 'awaiting_approval',
        pendingApprovals: [...state.pendingApprovals, event.requestId],
      };
    }

    case 'turn.approval_resolved': {
      if (!state.pendingApprovals.includes(event.requestId)) {
        // Resolver algo que não está pendente é inconsistente.
        return { ...state, turn: 'unknown', reason: `aprovação ${event.requestId} resolvida sem estar pendente` };
      }
      const pending = state.pendingApprovals.filter((id) => id !== event.requestId);
      return {
        ...state,
        pendingApprovals: pending,
        // Só volta a running quando NÃO há mais aprovações pendentes.
        turn: pending.length === 0 ? 'running' : 'awaiting_approval',
      };
    }

    case 'turn.completed': {
      if (state.cancelRequested) {
        // Concluiu apesar do cancelamento em curso: precisa reconciliar.
        return { ...state, turn: 'unknown', reason: 'turn.completed durante cancelamento pedido' };
      }
      if (state.pendingApprovals.length > 0) {
        return { ...state, turn: 'unknown', reason: 'turn.completed com aprovação pendente' };
      }
      if (state.turn !== 'running') {
        return { ...state, turn: 'unknown', reason: `turn.completed fora de running (estava ${state.turn})` };
      }
      return { ...state, turn: 'completed' };
    }

    case 'turn.failed':
      return { ...state, turn: 'failed', reason: event.error };

    case 'stream.ended': {
      if (event.expected) return state;
      if (state.turn === 'running' || state.turn === 'awaiting_approval' || state.turn === 'cancelling') {
        return { ...state, turn: 'unknown', reason: 'stream terminou inesperadamente com turno ativo' };
      }
      return state;
    }

    case 'cancel.requested': {
      if (state.turn === 'running' || state.turn === 'awaiting_approval') {
        return { ...state, cancelRequested: true, turn: 'cancelling' };
      }
      // Pedir cancelamento fora de turno ativo é inócuo, mas registrado.
      return { ...state, cancelRequested: true };
    }

    case 'cancel.confirmed': {
      if (!state.cancelRequested) {
        return { ...state, turn: 'unknown', reason: 'cancel.confirmed sem pedido de cancelamento' };
      }
      return { ...state, turn: 'cancelled' };
    }

    case 'result.validated':
      return { ...state, validation: 'validated' };

    case 'result.rejected':
      return { ...state, validation: 'rejected', reason: event.error };

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function runEvents(events: readonly SessionEvent[], start = initialSessionState()): AgentSessionState {
  return events.reduce(reduce, start);
}

/**
 * Um turno só pode receber aresta automática de sucesso no grafo (v2) quando
 * está `completed` E o resultado foi `validated`. Nada menos que isso.
 */
export function isEligibleForSuccessEdge(state: AgentSessionState): boolean {
  return state.turn === 'completed' && state.validation === 'validated';
}
