/**
 * FRIGG — instalação automática de CLIs (compartilhado main + renderer).
 * Se a CLI não estiver no PATH, o FRIGG instala antes de usar. Só instaladores
 * confiáveis (npm/pip/cargo/winget). Chave = binário; valor = comando de install.
 */
export const INSTALL_COMMANDS: Record<string, string> = {
  // Provedores / code
  claude: 'npm i -g @anthropic-ai/claude-code',
  codex: 'npm i -g @openai/codex',
  gemini: 'npm i -g @google/gemini-cli',
  aider: 'python -m pip install --user aider-chat',
  opencode: 'npm i -g opencode-ai',
  qwen: 'npm i -g @qwen-code/qwen-code',
  crush: 'npm i -g @charmland/crush',
  continue: 'npm i -g @continuedev/cli',
  cn: 'npm i -g @continuedev/cli',
  // Agentes
  goose: 'npm i -g @block/goose-cli',
  interpreter: 'python -m pip install --user open-interpreter',
  letta: 'python -m pip install --user letta',
  // Utilitários / shell
  llm: 'python -m pip install --user llm',
  sgpt: 'python -m pip install --user shell-gpt',
  aichat: 'cargo install aichat',
  plandex: 'npm i -g plandex',
  // Dev / cloud
  gh: 'winget install --silent --accept-source-agreements --accept-package-agreements --id GitHub.cli',
  supabase: 'npm i -g supabase',
  vercel: 'npm i -g vercel',
  wrangler: 'npm i -g wrangler',
  netlify: 'npm i -g netlify-cli',
};

/** Primeiro token do comando (o binário). */
export function binOf(command: string): string {
  const c = command.trim();
  return c.split(/\s+/)[0] ?? c;
}

export function installForCommand(command: string): string | null {
  const c = command.trim();
  if (!c) return null;
  return INSTALL_COMMANDS[c] ?? INSTALL_COMMANDS[binOf(c)] ?? null;
}

/**
 * Sintaxe do shell do terminal: PowerShell no Windows, POSIX (bash/zsh) no
 * Linux/macOS. Antes o wrapper era sempre PowerShell e, fora do Windows, o bash
 * dava erro de sintaxe e a CLI nunca rodava.
 */
export type ShellFlavor = 'powershell' | 'posix';

/** Monta o wrapper "instala-se-faltar; executa" para um bin/install/cmd dados. */
function wrap(bin: string, install: string, cmd: string, shell: ShellFlavor): string {
  if (shell === 'posix') {
    return `if ! command -v ${bin} >/dev/null 2>&1; then echo 'FRIGG: instalando ${bin}...'; ${install}; fi; ${cmd}`;
  }
  return `if (-not (Get-Command ${bin} -ErrorAction SilentlyContinue)) { Write-Host 'FRIGG: instalando ${bin}...' -ForegroundColor Cyan; ${install} }; ${cmd}`;
}

/**
 * Comando PowerShell que instala a CLI se faltar e então a executa.
 * Sem instalador conhecido, retorna o comando cru.
 */
export function autoInstallCommand(command: string, shell: ShellFlavor = 'powershell'): string {
  const cmd = command.trim();
  if (!cmd) return '';
  const install = installForCommand(cmd);
  if (!install) return cmd;
  return wrap(binOf(cmd), install, cmd, shell);
}

/**
 * Igual ao autoInstallCommand, mas aceita um instalador CUSTOM informado pelo
 * usuário (CLI que não está no catálogo). Precedência: install custom > catálogo
 * > comando cru. Vazio/whitespace no custom é ignorado.
 */
export function autoInstallCommandWith(command: string, customInstall?: string, shell: ShellFlavor = 'powershell'): string {
  const cmd = command.trim();
  if (!cmd) return '';
  const custom = (customInstall ?? '').trim();
  if (custom) return wrap(binOf(cmd), custom, cmd, shell);
  return autoInstallCommand(cmd, shell);
}
