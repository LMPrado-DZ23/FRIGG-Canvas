/**
 * FRIGG — políticas puras de execução de agentes: roteamento (OmniRoute ou
 * direto), limites de gasto e formatação de custo. Sem IO, testável.
 */
import type { GatewayStatus } from './omniroute-client.js';

export type RoutingMode = 'auto' | 'omniroute' | 'direct';

export const ROUTING_MODES: readonly { id: RoutingMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Automático', hint: 'Usa o OmniRoute quando estiver online; senão, fala direto com o provedor.' },
  { id: 'omniroute', label: 'Sempre OmniRoute', hint: 'Falha se o OmniRoute estiver fora do ar.' },
  { id: 'direct', label: 'Direto no provedor', hint: 'Ignora o OmniRoute (usa a autenticação da própria CLI).' },
];

export function parseRoutingMode(value: unknown): RoutingMode {
  return value === 'omniroute' || value === 'direct' ? value : 'auto';
}

export interface RoutingDecision {
  readonly useOmniRoute: boolean;
  /** Texto curto para a UI explicar a rota escolhida. */
  readonly label: string;
}

/** `health` só é consultado no modo automático. */
export function resolveRouting(mode: RoutingMode, health: GatewayStatus): RoutingDecision {
  if (mode === 'direct') return { useOmniRoute: false, label: 'direto no provedor' };
  if (mode === 'omniroute') return { useOmniRoute: true, label: 'via OmniRoute' };
  return health === 'reachable'
    ? { useOmniRoute: true, label: 'via OmniRoute' }
    : { useOmniRoute: false, label: 'direto no provedor (OmniRoute indisponível)' };
}

export const MAX_BUDGET_USD = 1_000;

/** Orçamento válido: número finito, > 0 e até MAX_BUDGET_USD. */
export function validBudgetUsd(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_BUDGET_USD;
}

/** Converte o texto digitado ("1,50", "2.5", "") em orçamento; vazio/inválido = sem limite. */
export function parseBudgetInput(text: string): number | undefined {
  const normalized = text.trim().replace(',', '.');
  if (!normalized) return undefined;
  const n = Number(normalized);
  return validBudgetUsd(n) ? Math.round(n * 100) / 100 : undefined;
}

/** true quando o gasto acumulado atingiu o teto (sem teto = nunca). */
export function budgetReached(spentUsd: number, limitUsd: number | undefined): boolean {
  return limitUsd !== undefined && spentUsd >= limitUsd;
}

export function totalCost(costs: readonly (number | undefined)[]): number {
  return costs.reduce<number>((sum, c) => sum + (typeof c === 'number' && Number.isFinite(c) ? c : 0), 0);
}

export function formatUsd(value: number): string {
  const digits = value > 0 && value < 0.01 ? 4 : 2;
  return `US$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Referência de sessão (UUID do Claude / threadId do Codex): token simples. */
export function validSessionRef(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}
