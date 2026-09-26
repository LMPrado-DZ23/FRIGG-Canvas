import { describe, expect, it } from 'vitest';
import { autoInstallCommand, autoInstallCommandWith, binOf, installForCommand } from './cli-install.js';

describe('cli-install', () => {
  it('extrai o binário e acha o instalador do catálogo', () => {
    expect(binOf('  claude --model sonnet ')).toBe('claude');
    expect(installForCommand('claude --model sonnet')).toBe('npm i -g @anthropic-ai/claude-code');
    expect(installForCommand('minha-cli')).toBeNull();
    expect(installForCommand('   ')).toBeNull();
  });

  it('PowerShell (Windows): instala se faltar e depois executa', () => {
    expect(autoInstallCommand('codex')).toBe(
      "if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { Write-Host 'FRIGG: instalando codex...' -ForegroundColor Cyan; npm i -g @openai/codex }; codex",
    );
  });

  it('POSIX (Linux/macOS): sintaxe de bash/zsh, não PowerShell', () => {
    const line = autoInstallCommand('claude', 'posix');
    expect(line).toBe("if ! command -v claude >/dev/null 2>&1; then echo 'FRIGG: instalando claude...'; npm i -g @anthropic-ai/claude-code; fi; claude");
    expect(line).not.toContain('Get-Command');
  });

  it('CLI fora do catálogo roda crua; instalador custom tem precedência', () => {
    expect(autoInstallCommand('minha-cli --x')).toBe('minha-cli --x');
    expect(autoInstallCommandWith('minha-cli', 'pip install minha-cli', 'posix')).toContain('pip install minha-cli; fi; minha-cli');
    expect(autoInstallCommandWith('claude', '  ')).toBe(autoInstallCommand('claude'));
    expect(autoInstallCommandWith('  ')).toBe('');
  });
});
