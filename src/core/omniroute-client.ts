/**
 * FRIGG — cliente do OmniRoute (serviço headless).
 *
 * Regra (parecer ChatGPT, Marco 1): serviço ausente aparece INDISPONÍVEL.
 * Nunca simular saúde. O status só é `reachable` após uma sonda HTTP OK real;
 * qualquer erro de rede/timeout/HTTP não-OK → `unavailable`. O default é
 * `unknown`, nunca `reachable`.
 *
 * Duas fronteiras (memória do projeto):
 *  - inferência `/v1/**`  → contrato OpenAI/Anthropic (fora daqui).
 *  - gerenciamento `/api/**` → é o que este cliente conversa.
 *
 * `fetch` é injetado para testabilidade sem rede.
 */

export type GatewayStatus = 'unknown' | 'reachable' | 'unavailable';

export interface HealthResult {
  readonly status: GatewayStatus;
  readonly detail: string;
  readonly checkedAt: number;
}

export type FetchLike = (
  url: string,
  init?: { method?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number }>;

export interface OmniRouteClientOptions {
  readonly baseUrl: string;
  readonly fetchImpl: FetchLike;
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

export class OmniRouteClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly timeoutMs: number;

  constructor(opts: OmniRouteClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl;
    this.now = opts.now ?? Date.now;
    this.timeoutMs = opts.timeoutMs ?? 3000;
  }

  /** Sonda /api/monitoring/health. Só retorna `reachable` em HTTP OK. */
  async probeHealth(): Promise<HealthResult> {
    const url = `${this.baseUrl}/api/monitoring/health`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await this.fetchImpl(url, { method: 'GET', signal: controller.signal });
      if (res.ok) {
        return { status: 'reachable', detail: `HTTP ${res.status}`, checkedAt: this.now() };
      }
      return { status: 'unavailable', detail: `HTTP ${res.status}`, checkedAt: this.now() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'unavailable', detail: msg, checkedAt: this.now() };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/** Rótulo para a UI. `unknown` nunca deve ser mostrado como saudável. */
export function healthLabel(status: GatewayStatus): string {
  switch (status) {
    case 'reachable':
      return 'OmniRoute: conectado';
    case 'unavailable':
      return 'OmniRoute: indisponível';
    case 'unknown':
      return 'OmniRoute: verificando…';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
