/**
 * FRIGG — registro das sessões de agente ativas por id de nó.
 *
 * Invariantes (testados):
 *  - um id só tem uma sessão ativa ou iniciando por vez;
 *  - um evento terminal tardio de uma sessão antiga nunca desregistra a sessão
 *    nova com o mesmo id (comparação por identidade);
 *  - uma sessão que termina antes de ser registrada (ex.: spawn falhou) não é
 *    registrada;
 *  - cancelar durante a partida (checagem de CLI/rota ainda em andamento) é
 *    respeitado: a sessão é cancelada assim que existir.
 */
import type { ManagedSession } from './adapters/types.js';

export interface StartTicket {
  /** Chamar em todo evento terminal da sessão (turn.completed/failed, cancel.confirmed, process.exited). */
  onTerminal(): void;
  /** Liga a sessão criada ao id. Retorna false se ela já terminou antes disso. */
  attach(session: ManagedSession): boolean;
  /** Libera a reserva de partida (sempre, em finally). */
  release(): void;
}

export class AgentRegistry {
  private readonly active = new Map<string, ManagedSession>();
  private readonly starting = new Set<string>();
  private readonly cancelRequested = new Set<string>();

  busy(id: string): boolean {
    return this.active.has(id) || this.starting.has(id);
  }

  get(id: string): ManagedSession | undefined {
    return this.active.get(id);
  }

  /** Reserva o id para uma nova sessão; null se já houver uma ativa ou iniciando. */
  reserve(id: string): StartTicket | null {
    if (this.busy(id)) return null;
    this.starting.add(id);
    this.cancelRequested.delete(id);
    let session: ManagedSession | undefined;
    let endedEarly = false;
    return {
      onTerminal: () => {
        if (session === undefined) endedEarly = true;
        else if (this.active.get(id) === session) this.active.delete(id);
      },
      attach: (created) => {
        session = created;
        if (endedEarly) return false;
        this.active.set(id, created);
        if (this.cancelRequested.delete(id)) {
          created.cancel();
          this.active.delete(id);
        }
        return true;
      },
      release: () => {
        this.starting.delete(id);
        this.cancelRequested.delete(id);
      },
    };
  }

  /** Cancela a sessão ativa, ou marca para cancelar a que ainda está iniciando. */
  cancel(id: string): void {
    const session = this.active.get(id);
    if (session) {
      session.cancel();
      this.active.delete(id);
    } else if (this.starting.has(id)) {
      this.cancelRequested.add(id);
    }
  }

  /** true se o cancelamento foi pedido enquanto a sessão iniciava. */
  cancelPending(id: string): boolean {
    return this.cancelRequested.has(id);
  }

  cancelAll(): void {
    for (const session of this.active.values()) session.cancel();
    this.active.clear();
    for (const id of this.starting) this.cancelRequested.add(id);
  }
}
