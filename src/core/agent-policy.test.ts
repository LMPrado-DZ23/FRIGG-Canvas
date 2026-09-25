import { describe, expect, it } from 'vitest';
import {
  budgetReached, formatUsd, parseBudgetInput, parseRoutingMode, resolveRouting, totalCost, validBudgetUsd, validSessionRef,
} from './agent-policy.js';

describe('roteamento', () => {
  it('automático usa o OmniRoute só quando ele responde', () => {
    expect(resolveRouting('auto', 'reachable').useOmniRoute).toBe(true);
    expect(resolveRouting('auto', 'unavailable')).toEqual({ useOmniRoute: false, label: 'direto no provedor (OmniRoute indisponível)' });
    expect(resolveRouting('auto', 'unknown').useOmniRoute).toBe(false);
  });

  it('modos explícitos ignoram a saúde', () => {
    expect(resolveRouting('omniroute', 'unavailable').useOmniRoute).toBe(true);
    expect(resolveRouting('direct', 'reachable').useOmniRoute).toBe(false);
  });

  it('valores desconhecidos caem no automático', () => {
    expect(parseRoutingMode('direct')).toBe('direct');
    expect(parseRoutingMode('omniroute')).toBe('omniroute');
    expect(parseRoutingMode(undefined)).toBe('auto');
    expect(parseRoutingMode('x')).toBe('auto');
  });
});

describe('orçamento', () => {
  it('valida limites', () => {
    expect(validBudgetUsd(0.5)).toBe(true);
    expect(validBudgetUsd(1000)).toBe(true);
    for (const bad of [0, -1, 1000.01, Number.NaN, Number.POSITIVE_INFINITY, '1']) expect(validBudgetUsd(bad)).toBe(false);
  });

  it('interpreta o texto digitado com vírgula ou ponto', () => {
    expect(parseBudgetInput('1,50')).toBe(1.5);
    expect(parseBudgetInput(' 2.345 ')).toBe(2.35);
    expect(parseBudgetInput('')).toBeUndefined();
    expect(parseBudgetInput('abc')).toBeUndefined();
    expect(parseBudgetInput('0')).toBeUndefined();
  });

  it('detecta teto atingido e soma custos ignorando lixo', () => {
    expect(budgetReached(2, 2)).toBe(true);
    expect(budgetReached(1.99, 2)).toBe(false);
    expect(budgetReached(999, undefined)).toBe(false);
    expect(totalCost([0.5, undefined, 0.25, Number.NaN])).toBe(0.75);
  });

  it('formata em reais-estilo pt-BR com precisão para centavos pequenos', () => {
    expect(formatUsd(1.5)).toBe('US$ 1,50');
    expect(formatUsd(0.0042)).toBe('US$ 0,0042');
    expect(formatUsd(0)).toBe('US$ 0,00');
  });
});

describe('referência de sessão', () => {
  it('aceita UUID/threadId e rejeita metacaracteres', () => {
    expect(validSessionRef('3f1c2d9e-1b2a-4c3d-9e8f-0a1b2c3d4e5f')).toBe(true);
    expect(validSessionRef('01a0dac4-480a-7501-b92c-e0b088a9a142')).toBe(true);
    for (const bad of ['', 'a b', 'x&y', '%X%', 'a'.repeat(129), 42]) expect(validSessionRef(bad)).toBe(false);
  });
});
