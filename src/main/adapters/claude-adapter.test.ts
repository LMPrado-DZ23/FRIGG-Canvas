import { describe, expect, it } from 'vitest';
import { buildClaudeArgs } from './claude-adapter.js';

describe('buildClaudeArgs', () => {
  it('usa um permission mode suportado e não pula aprovações', () => {
    const args = buildClaudeArgs({ prompt: 'implemente' });
    expect(args).toContain('default');
    expect(args).not.toContain('auto');
    expect(args).not.toContain('--dangerously-skip-permissions');
  });

  it('preserva prompt e modelo como argumentos separados', () => {
    expect(buildClaudeArgs({ prompt: 'texto; sem shell', model: 'sonnet' }))
      .toEqual(['-p', 'texto; sem shell', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'default', '--model', 'sonnet']);
  });
});
