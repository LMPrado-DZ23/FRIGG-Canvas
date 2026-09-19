/**
 * FRIGG — contrato de adaptador de harness (Decisão G2).
 *
 * O nó gerenciado é uma SESSÃO DE HARNESS existente (Codex App Server,
 * Claude Agent SDK/headless), não uma chamada de modelo. O adaptador
 * converte eventos nativos do harness para os `SessionEvent` normalizados
 * de FRIGG. Ele NÃO reimplementa ferramentas, planejamento ou raciocínio
 * do harness — só normaliza e transporta.
 *
 * Capacidades são declaradas, não presumidas: não assumir paridade entre
 * adaptadores (CLI interativa ≠ SDK; assinatura de chat ≠ API). O scheduler
 * (v2) só aceita nós cujas capacidades satisfazem a aresta.
 */

import type { SessionEvent } from './turn-state.js';

export type HarnessKind = 'codex-app-server' | 'claude-agent-sdk' | 'pty-terminal';

export interface HarnessCapabilities {
  /** Emite turn.completed estruturado (não heurística de texto)? */
  readonly structuredCompletion: boolean;
  /** Suporta pedidos de aprovação correlacionados por requestId? */
  readonly approvals: boolean;
  /** Suporta cancelamento com confirmação? */
  readonly confirmedCancel: boolean;
  /** Suporta retomar sessão após a UI mudar? */
  readonly resume: boolean;
  /** Roteamento de inferência via OmniRoute foi VERIFICADO para este adaptador? */
  readonly omniRouteRouting: 'verified' | 'unverified' | 'unsupported';
}

export interface StartSessionParams {
  readonly workspaceDir: string;
  readonly harness: HarnessKind;
  /** Provider/model desejados; só efetivados se a rota do gateway estiver validada. */
  readonly provider?: string;
  readonly model?: string;
}

export interface HarnessSession {
  readonly id: string;
  readonly capabilities: HarnessCapabilities;
  sendInput(text: string): Promise<void>;
  /** Pede cancelamento. NÃO confirma — a confirmação chega por evento. */
  requestCancel(): Promise<void>;
  /** Resolve uma aprovação específica pelo requestId. */
  resolveApproval(requestId: string, decision: 'approved' | 'denied'): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * Um adaptador é a fábrica de sessões para um harness. `onEvent` recebe os
 * eventos já normalizados; a máquina `reduce()` decide o estado.
 */
export interface HarnessAdapter {
  readonly kind: HarnessKind;
  describeCapabilities(): HarnessCapabilities;
  startSession(params: StartSessionParams, onEvent: (e: SessionEvent) => void): Promise<HarnessSession>;
}

/**
 * Capacidades de um terminal PTY puro (G1): NÃO tem conclusão estruturada.
 * Serve de guarda — um nó só-PTY nunca recebe aresta automática de sucesso.
 */
export const PTY_TERMINAL_CAPABILITIES: HarnessCapabilities = {
  structuredCompletion: false,
  approvals: false,
  confirmedCancel: false,
  resume: false,
  omniRouteRouting: 'unsupported',
};

/** Um nó pode ser executor gerenciado no grafo (v2) apenas com conclusão estruturada. */
export function canBeManagedGraphNode(caps: HarnessCapabilities): boolean {
  return caps.structuredCompletion && caps.confirmedCancel;
}
