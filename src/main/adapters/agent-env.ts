const SAFE_ENV_KEYS = [
  'PATH', 'Path', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP',
  'SystemRoot', 'SYSTEMROOT', 'windir', 'ComSpec', 'PATHEXT', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CONFIG_DIR',
  'OPENAI_API_KEY', 'OPENAI_ORG_ID', 'OPENAI_BASE_URL', 'CODEX_HOME',
];

/**
 * Copia apenas ambiente necessário para localizar CLIs, manter diretórios do
 * usuário e autenticar explicitamente os provedores suportados. Segredos
 * arbitrários do processo Electron nunca são herdados por padrão.
 */
export function buildAgentEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of SAFE_ENV_KEYS) {
    const value = source[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

export { SAFE_ENV_KEYS };
