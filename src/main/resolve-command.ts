/**
 * FRIGG — resolução de executáveis de CLI sem shell arbitrário.
 *
 * No Windows, CLIs instaladas via npm (claude, codex, ...) são wrappers `.cmd`.
 * `spawn('claude', ..., { shell: false })` falha com ENOENT porque o Node não
 * aplica PATHEXT, e desde o CVE-2024-27980 também recusa `.cmd` sem shell.
 * Aqui resolvemos o caminho real via PATH/PATHEXT e só permitimos `shell: true`
 * (necessário para `.cmd`/`.bat`) quando TODOS os argumentos são tokens seguros;
 * conteúdo livre (prompts) deve ir por stdin.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { posix, win32 } from 'node:path';

export interface SpawnPlan {
  readonly file: string;
  readonly args: string[];
  readonly shell: boolean;
}

export interface ResolveOptions {
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly isFile?: (path: string) => boolean;
}

const SAFE_ARG = /^[A-Za-z0-9._:/@=[\]-]+$/;
const SAFE_COMMAND = /^[A-Za-z0-9_.-]+$/;

/** Token que atravessa cmd.exe sem interpretação (sem espaços, aspas, %, ^, &, |, <, >, !). */
export function isSafeShellArg(value: string): boolean {
  return value.length > 0 && value.length <= 256 && SAFE_ARG.test(value);
}

function defaultIsFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function envValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const found = Object.keys(env).find((k) => k.toLowerCase() === key.toLowerCase());
  return found ? env[found] : undefined;
}

/** Caminho absoluto do executável no PATH, ou null. No Windows aplica PATHEXT. */
export function resolveExecutable(command: string, opts: ResolveOptions = {}): string | null {
  if (!SAFE_COMMAND.test(command)) return null;
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  const isFile = opts.isFile ?? defaultIsFile;
  const win = platform === 'win32';
  const paths = win ? win32 : posix;
  const delimiter = win ? ';' : ':';
  const dirs = (envValue(env, 'PATH') ?? '').split(delimiter).map((d) => d.replace(/^"(.*)"$/, '$1')).filter((d) => d.length > 0);
  const exts = win
    ? (envValue(env, 'PATHEXT') ?? '.COM;.EXE;.BAT;.CMD').split(';').filter((e) => e.length > 0).map((e) => e.toLowerCase())
    : [''];
  const hasExt = win && exts.some((e) => command.toLowerCase().endsWith(e));
  for (const dir of dirs) {
    if (!paths.isAbsolute(dir)) continue;
    const candidates = hasExt ? [command] : exts.map((e) => command + e);
    for (const name of candidates) {
      const full = paths.join(dir, name);
      if (isFile(full)) return full;
    }
  }
  return null;
}

/**
 * Plano de spawn para `command args`. Retorna null se a CLI não existe ou se
 * exigiria shell com argumentos inseguros.
 */
export function planSpawn(command: string, args: readonly string[], opts: ResolveOptions = {}): SpawnPlan | null {
  const file = resolveExecutable(command, opts);
  if (!file) return null;
  const platform = opts.platform ?? process.platform;
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
    // O caminho vem do PATH: aspas não impedem expansão de %VAR%/!VAR! nem
    // escapam `"`, então caminhos com metacaracteres do cmd.exe são recusados.
    if (/[%!^"`&|<>\r\n]/.test(file) || !args.every(isSafeShellArg)) return null;
    // Linha já montada (tokens validados; caminho entre aspas por causa de espaços):
    // passar args separados com shell:true é depreciado (DEP0190).
    return { file: [`"${file}"`, ...args].join(' '), args: [], shell: true };
  }
  return { file, args: [...args], shell: false };
}

/**
 * Encerra o processo e seus descendentes. No Windows, com `shell: true` o PID é
 * do cmd.exe e `child.kill()` deixaria a CLI (node) órfã; usa `taskkill /T`.
 */
export function killProcessTree(
  child: Pick<ChildProcess, 'pid' | 'kill' | 'exitCode' | 'signalCode'>,
  signal: NodeJS.Signals = 'SIGTERM',
  platform: NodeJS.Platform = process.platform,
): void {
  // Já encerrado: não sinaliza de novo (no Windows o PID pode ter sido reutilizado).
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (platform === 'win32' && typeof child.pid === 'number') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false });
      killer.once('error', () => {
        try { child.kill(signal); } catch { /* processo pode ter saído */ }
      });
      return;
    }
    child.kill(signal);
  } catch {
    /* processo pode ter saído */
  }
}
