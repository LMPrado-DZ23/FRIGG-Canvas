import { describe, expect, it } from 'vitest';
import { agentConfig, agentStartParams, composeTaskPrompt } from './agent-config.js';

describe('agentConfig', () => {
  it('aplica padrões do papel e descarta valores inválidos', () => {
    const cfg = agentConfig({ role: 'developer', routing: 'x', maxBudgetUsd: -1, sessionRef: 'a b' });
    expect(cfg.harness).toBe('codex'); // harness sugerido do papel Desenvolvedor
    expect(cfg.routing).toBe('auto');
    expect(cfg.maxBudgetUsd).toBeUndefined();
    expect(cfg.sessionRef).toBeUndefined();
    expect(cfg.systemPrompt.length).toBeGreaterThan(0);
  });

  it('respeita a configuração do nó', () => {
    const cfg = agentConfig({ harness: 'codex', model: 'gpt-5', cwd: 'C:\\proj', routing: 'direct', maxBudgetUsd: 2, sessionRef: 'abc-123', systemPrompt: 'custom' });
    expect(cfg).toMatchObject({ harness: 'codex', model: 'gpt-5', cwd: 'C:\\proj', routing: 'direct', maxBudgetUsd: 2, sessionRef: 'abc-123', systemPrompt: 'custom' });
  });
});

describe('agentStartParams', () => {
  const cfg = agentConfig({ model: 'sonnet', routing: 'omniroute', maxBudgetUsd: 1.5, sessionRef: 'sess-1' });

  it('só envia resume quando a continuação é pedida', () => {
    expect(agentStartParams(cfg, 'oi')).not.toHaveProperty('resume');
    expect(agentStartParams(cfg, 'oi', true)).toMatchObject({ resume: 'sess-1', routing: 'omniroute', maxBudgetUsd: 1.5, model: 'sonnet' });
  });

  it('omite campos vazios', () => {
    const p = agentStartParams(agentConfig({}), 'oi', true);
    expect(p).toEqual({ prompt: 'oi', harness: 'codex', routing: 'auto' });
  });

  it('compõe o prompt inicial com as instruções do papel', () => {
    const prompt = composeTaskPrompt(agentConfig({ systemPrompt: 'Você revisa.' }), 'revise o PR');
    expect(prompt).toContain('Você revisa.');
    expect(prompt).toContain('TAREFA:\nrevise o PR');
  });
});
