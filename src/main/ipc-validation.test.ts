import { describe, expect, it } from 'vitest';
import { boundedString, validAgentParams, validId, validModelName } from './ipc-validation.js';

describe('IPC runtime validation', () => {
  it('limita strings e ids', () => {
    expect(validId('agent-1')).toBe(true);
    expect(validId('')).toBe(false);
    expect(validId('x'.repeat(129))).toBe(false);
    expect(boundedString(42, 10)).toBe(false);
  });

  it('valida parâmetros de agente sem confiar no TypeScript do renderer', () => {
    expect(validAgentParams({ prompt: 'faça', harness: 'claude', cwd: '/tmp' })).toBe(true);
    expect(validAgentParams({ prompt: '' })).toBe(false);
    expect(validAgentParams({ prompt: 'x', cwd: 123 })).toBe(false);
    expect(validAgentParams({ prompt: 'x'.repeat(100_001) })).toBe(false);
  });

  it('aceita só nomes de modelo que não podem injetar argumentos de shell', () => {
    for (const ok of ['sonnet', 'claude-sonnet-4-5', 'openai/gpt-5', 'sonnet[1m]', 'kr/claude:latest']) {
      expect(validModelName(ok)).toBe(true);
    }
    for (const bad of ['', 'a b', 'x&calc', 'x|y', '%PATH%', 'a"b', '--model=x y', 'm'.repeat(257)]) {
      expect(validModelName(bad)).toBe(false);
    }
    expect(validAgentParams({ prompt: 'x', model: 'sonnet' })).toBe(true);
    expect(validAgentParams({ prompt: 'x', model: '' })).toBe(true);
    expect(validAgentParams({ prompt: 'x', model: 'sonnet & calc' })).toBe(false);
  });
});
