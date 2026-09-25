import { describe, expect, it } from 'vitest';
import { buildClaudeArgs } from './claude-adapter.js';

describe('buildClaudeArgs', () => {
  it('usa um permission mode suportado e não pula aprovações', () => {
    const args = buildClaudeArgs({});
    expect(args).toContain('default');
    expect(args).not.toContain('auto');
    expect(args).not.toContain('--dangerously-skip-permissions');
  });

  it('nunca coloca o prompt no argv (vai por stdin) e mantém o modelo separado', () => {
    expect(buildClaudeArgs({ model: 'sonnet' }))
      .toEqual(['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'default', '--model', 'sonnet']);
  });

  it('continua a conversa e aplica o teto de gasto como argumentos separados', () => {
    expect(buildClaudeArgs({ resumeSessionId: '3f1c2d9e-1b2a-4c3d-9e8f-0a1b2c3d4e5f', maxBudgetUsd: 1.5 }))
      .toEqual(['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'default',
        '--resume', '3f1c2d9e-1b2a-4c3d-9e8f-0a1b2c3d4e5f', '--max-budget-usd', '1.5']);
  });
});
