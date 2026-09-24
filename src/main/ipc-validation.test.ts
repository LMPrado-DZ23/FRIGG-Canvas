import { describe, expect, it } from 'vitest';
import { boundedString, validAgentParams, validId } from './ipc-validation.js';

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
});
