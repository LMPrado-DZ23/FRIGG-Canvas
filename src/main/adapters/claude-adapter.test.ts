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
});
