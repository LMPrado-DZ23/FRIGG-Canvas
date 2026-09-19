/**
 * FRIGG — catálogo COMPLETO de CLIs de IA para os terminais.
 * Cada terminal roda a CLI escolhida SE estiver instalada no PATH; se não, o
 * shell mostra "command not found" (honesto — não fingimos disponibilidade).
 *
 * `managed: true` = também roda como nó Agente gerenciado (turnos estruturados);
 * hoje Claude e Codex têm adaptador. Os demais funcionam como terminal.
 *
 * Espelha o universo de CLIs que o OmniRoute roteia (e cresce). Extensível:
 * basta acrescentar uma linha. Sincronização dinâmica com o OmniRoute é o
 * próximo passo.
 */
export type CliCategory =
  | 'Provedores oficiais'
  | 'Agentes de código'
  | 'Motores locais'
  | 'Shell / pipelines'
  | 'Automação de SO'
  | 'Roteadores / gateways'
  | 'Shell';

export interface CliEntry {
  readonly label: string;
  readonly command: string;
  readonly category: CliCategory;
  readonly managed?: boolean;
}

export const CLI_CATALOG: readonly CliEntry[] = [
  { label: 'Shell', command: '', category: 'Shell' },

  // 1. Provedores oficiais (vendor-native)
  { label: 'Claude Code', command: 'claude', category: 'Provedores oficiais', managed: true },
  { label: 'Codex CLI', command: 'codex', category: 'Provedores oficiais', managed: true },
  { label: 'Gemini CLI', command: 'gemini', category: 'Provedores oficiais' },
  { label: 'Antigravity CLI', command: 'antigravity', category: 'Provedores oficiais' },
  { label: 'GitHub Copilot CLI', command: 'gh copilot', category: 'Provedores oficiais' },
  { label: 'Amazon Q', command: 'q chat', category: 'Provedores oficiais' },
  { label: 'Grok CLI', command: 'grok', category: 'Provedores oficiais' },
  { label: 'Qwen Code', command: 'qwen', category: 'Provedores oficiais' },

  // 2. Agentes de código de terminal
  { label: 'Aider', command: 'aider', category: 'Agentes de código' },
  { label: 'OpenCode', command: 'opencode', category: 'Agentes de código' },
  { label: 'Kilo CLI', command: 'kilo', category: 'Agentes de código' },
  { label: 'Kiro CLI', command: 'kiro', category: 'Agentes de código' },
  { label: 'Cline CLI', command: 'cline', category: 'Agentes de código' },
  { label: 'Roo Code CLI', command: 'roo', category: 'Agentes de código' },
  { label: 'Qodo Command', command: 'qodo', category: 'Agentes de código' },
  { label: 'Continue CLI', command: 'cn', category: 'Agentes de código' },
  { label: 'Cursor CLI', command: 'cursor-agent', category: 'Agentes de código' },
  { label: 'ForgeCode', command: 'forge', category: 'Agentes de código' },
  { label: 'jcode', command: 'jcode', category: 'Agentes de código' },
  { label: 'CodeWhale', command: 'codewhale', category: 'Agentes de código' },
  { label: 'Smelt', command: 'smelt', category: 'Agentes de código' },
  { label: 'Pi', command: 'pi', category: 'Agentes de código' },
  { label: 'Crush', command: 'crush', category: 'Agentes de código' },
  { label: 'Factory Droid', command: 'droid', category: 'Agentes de código' },
  { label: 'Tabby CLI', command: 'tabby', category: 'Agentes de código' },

  // 3. Motores locais (offline / self-hosted)
  { label: 'Ollama', command: 'ollama run llama3', category: 'Motores locais' },
  { label: 'llama.cpp', command: 'llama-cli', category: 'Motores locais' },
  { label: 'LocalAI', command: 'local-ai', category: 'Motores locais' },
  { label: 'vLLM', command: 'vllm', category: 'Motores locais' },
  { label: 'ExLlamaV2', command: 'exllamav2', category: 'Motores locais' },
  { label: 'Aphrodite Engine', command: 'aphrodite', category: 'Motores locais' },

  // 4. Shell / pipelines / chat rápido
  { label: 'Mods', command: 'mods', category: 'Shell / pipelines' },
  { label: 'Shell-GPT', command: 'sgpt', category: 'Shell / pipelines' },
  { label: 'Fabric CLI', command: 'fabric', category: 'Shell / pipelines' },
  { label: 'LLM (Datasette)', command: 'llm', category: 'Shell / pipelines' },
  { label: 'AIChat', command: 'aichat', category: 'Shell / pipelines' },
  { label: 'Terminal-GPT', command: 'tgpt', category: 'Shell / pipelines' },
  { label: 'Chatblade', command: 'chatblade', category: 'Shell / pipelines' },
  { label: 'gptcli', command: 'gptcli', category: 'Shell / pipelines' },

  // 5. Automação de sistema/SO
  { label: 'Open Interpreter', command: 'interpreter', category: 'Automação de SO' },
  { label: 'Goose', command: 'goose', category: 'Automação de SO' },
  { label: 'Letta (MemGPT)', command: 'letta', category: 'Automação de SO' },
  { label: 'Warp AI', command: 'warp', category: 'Automação de SO' },

  // 6. Roteadores / gateways
  { label: 'OmniRoute CLI', command: 'omniroute', category: 'Roteadores / gateways' },
  { label: 'LiteLLM', command: 'litellm', category: 'Roteadores / gateways' },
];

export const CLI_CATEGORIES: readonly CliCategory[] = [
  'Provedores oficiais',
  'Agentes de código',
  'Motores locais',
  'Shell / pipelines',
  'Automação de SO',
  'Roteadores / gateways',
];

/** CLIs que podem virar nó Agente gerenciado (adaptador estruturado existente). */
export const MANAGED_HARNESSES: readonly string[] = CLI_CATALOG.filter((c) => c.managed).map((c) => c.command);
