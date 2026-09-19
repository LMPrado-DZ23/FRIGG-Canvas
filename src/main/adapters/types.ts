import type { SessionEvent } from '../../core/turn-state.js';

/** Sessão de harness gerenciada (Claude, Codex, ...). */
export interface ManagedSession {
  cancel(): void;
  /** Resolve uma aprovação pendente (só harnesses que suportam, ex.: Codex). */
  approve?(requestId: string, decision: 'approved' | 'denied'): void;
}

export interface AgentCallbacks {
  onEvent: (e: SessionEvent) => void;
  onCost?: (usd: number) => void;
  /** Texto final do agente (para encadear a saída de A na entrada de B). */
  onOutput?: (text: string) => void;
}
