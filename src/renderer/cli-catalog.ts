/**
 * FRIGG — catálogo de CLIs de IA, ESPELHANDO o OmniRoute (fonte de verdade).
 * Duas famílias: "Code" (CLIs de código) e "Agent" (agentes de terminal).
 * Cada terminal roda a CLI escolhida SE estiver instalada no PATH; se não, o
 * shell mostra "command not found" (honesto). `managed` = tem adaptador
 * estruturado no FRIGG (turnos/estado no 2D e 3D): hoje Claude Code e Codex.
 *
 * Comandos são o melhor palpite de invocação; o ideal é sincronizar
 * dinamicamente com o OmniRoute (próximo passo). Ajuste livre por linha.
 */
export type CliCategory = 'Code' | 'Agent' | 'Externas (compatíveis)' | 'Dev / Cloud' | 'Shell';

/** Endpoint local padrão do OmniRoute (compat. OpenAI). */
export const OMNIROUTE_LOCAL_ENDPOINT = 'http://localhost:20128/v1';

export interface CliEntry {
  readonly label: string;
  readonly command: string;
  readonly category: CliCategory;
  readonly managed?: boolean;
  /** false = existe no OmniRoute mas não aparece habilitada no painel. */
  readonly enabled?: boolean;
}

export const CLI_CATALOG: readonly CliEntry[] = [
  { label: 'Shell', command: '', category: 'Shell' },

  // === Code (OmniRoute) — habilitadas no painel ===
  { label: 'Aider', command: 'aider', category: 'Code' },
  { label: 'Claude Code', command: 'claude', category: 'Code', managed: true },
  { label: 'Cline', command: 'cline', category: 'Code' },
  { label: 'CodeWhale', command: 'codewhale', category: 'Code' },
  { label: 'Continue', command: 'cn', category: 'Code' },
  { label: 'Crush', command: 'crush', category: 'Code' },
  { label: 'Cursor Agent CLI', command: 'cursor-agent', category: 'Code' },
  { label: 'Custom CLI', command: '', category: 'Code' },
  { label: 'DeepSeek TUI', command: 'deepseek', category: 'Code' },
  { label: 'Factory Droid', command: 'droid', category: 'Code' },
  { label: 'ForgeCode', command: 'forge', category: 'Code' },
  { label: 'GitHub Copilot', command: 'gh copilot', category: 'Code' },
  { label: 'Grok Build', command: 'grok', category: 'Code' },
  { label: 'jcode', command: 'jcode', category: 'Code' },
  { label: 'Kilo Code', command: 'kilo', category: 'Code' },
  { label: 'OpenAI Codex CLI', command: 'codex', category: 'Code', managed: true },
  { label: 'OpenCode', command: 'opencode', category: 'Code' },
  { label: 'Pi', command: 'pi', category: 'Code' },
  { label: 'Qwen Code', command: 'qwen', category: 'Code' },
  { label: 'Roo Code', command: 'roo', category: 'Code' },
  { label: 'Smelt', command: 'smelt', category: 'Code' },
  // === Code (OmniRoute) — existem mas fora do painel ===
  { label: 'Antigravity', command: 'antigravity', category: 'Code', enabled: false },
  { label: 'Cursor', command: 'cursor', category: 'Code', enabled: false },
  { label: 'Hermes', command: 'hermes', category: 'Code', enabled: false },
  { label: 'Kiro AI', command: 'kiro', category: 'Code', enabled: false },
  { label: 'ZCode', command: 'zcode', category: 'Code', enabled: false },

  // === Agent (OmniRoute) ===
  { label: '5dive', command: '5dive', category: 'Agent' },
  { label: 'Agent Deck', command: 'agent-deck', category: 'Agent' },
  { label: 'Goose', command: 'goose', category: 'Agent' },
  { label: 'Hermes Agent', command: 'hermes-agent', category: 'Agent' },
  { label: 'Letta CLI', command: 'letta', category: 'Agent' },
  { label: 'Oh My Pi', command: 'ohmypi', category: 'Agent' },
  { label: 'Open Claw', command: 'openclaw', category: 'Agent' },
  { label: 'Open Interpreter', command: 'interpreter', category: 'Agent' },
  { label: 'Prime Agent', command: 'prime', category: 'Agent' },
  { label: 'Warp AI', command: 'warp', category: 'Agent' },

  // === Externas compatíveis (via OPENAI_BASE_URL=http://localhost:20128/v1) ===
  { label: 'Amazon Q', command: 'q chat', category: 'Externas (compatíveis)' },
  { label: 'Sourcegraph Amp', command: 'amp', category: 'Externas (compatíveis)' },
  { label: 'OpenHands', command: 'openhands', category: 'Externas (compatíveis)' },
  { label: 'Plandex', command: 'plandex', category: 'Externas (compatíveis)' },
  { label: 'Windsurf / Codeium', command: 'windsurf', category: 'Externas (compatíveis)' },
  { label: 'aichat', command: 'aichat', category: 'Externas (compatíveis)' },
  { label: 'shell-gpt', command: 'sgpt', category: 'Externas (compatíveis)' },
  { label: 'mods', command: 'mods', category: 'Externas (compatíveis)' },
  { label: 'llm', command: 'llm', category: 'Externas (compatíveis)' },
  { label: 'fabric', command: 'fabric', category: 'Externas (compatíveis)' },

  // === Dev / Cloud (para um projeto sair pronto: git, deploy, backend) ===
  { label: 'GitHub CLI', command: 'gh', category: 'Dev / Cloud' },
  { label: 'Supabase CLI', command: 'supabase', category: 'Dev / Cloud' },
  { label: 'Vercel CLI', command: 'vercel', category: 'Dev / Cloud' },
  { label: 'Cloudflare Wrangler', command: 'wrangler', category: 'Dev / Cloud' },
  { label: 'Netlify CLI', command: 'netlify', category: 'Dev / Cloud' },
  { label: 'SSH (servidor)', command: 'ssh', category: 'Dev / Cloud' },
  { label: 'Docker', command: 'docker', category: 'Dev / Cloud' },
];

export const CLI_CATEGORIES: readonly CliCategory[] = ['Code', 'Agent', 'Externas (compatíveis)', 'Dev / Cloud'];

/** CLIs que podem virar nó Agente gerenciado (adaptador estruturado existente). */
export const MANAGED_HARNESSES: readonly string[] = CLI_CATALOG.filter((c) => c.managed).map((c) => c.command);

// Instalação automática: fonte única no core (usada por terminal e agentes).
export { INSTALL_COMMANDS, autoInstallCommand } from '../core/cli-install.js';
