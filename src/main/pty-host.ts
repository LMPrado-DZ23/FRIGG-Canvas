/**
 * FRIGG — host de PTY (terminais de CLI reais) no processo main.
 *
 * Usa @homebridge/node-pty-prebuilt-multiarch (binário pré-compilado, sem
 * compilador C++). Se o binário não casar com o ABI do Electron, o módulo
 * não carrega e a UI mostra "terminal indisponível" — NUNCA finge.
 *
 * Segurança (D10/G): o renderer nunca fala com node-pty direto; só via IPC.
 * O PTY herda as permissões do processo pai — não é sandbox.
 */

// Módulo nativo externo sem tipos próprios; encapsulado só aqui. (any justificado)
type PtyModule = {
  spawn: (
    file: string,
    args: string[],
    opts: { name: string; cols: number; rows: number; cwd: string; env: NodeJS.ProcessEnv },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any;
};

let mod: PtyModule | null = null;
let loadError: string | null = null;
let attempted = false;

export async function ensurePtyLoaded(): Promise<void> {
  if (attempted) return;
  attempted = true;
  try {
    // @lydell/node-pty usa prebuilds N-API (ABI-estável Node/Electron, sem compilador).
    mod = (await import('@lydell/node-pty')) as unknown as PtyModule;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    mod = null;
  }
}

export function isPtyAvailable(): boolean {
  return mod !== null;
}
export function ptyLoadError(): string | null {
  return loadError;
}

const defaultShell = process.platform === 'win32' ? 'powershell.exe' : (process.env['SHELL'] ?? 'bash');

export interface PtyHostCallbacks {
  onData: (id: string, data: string) => void;
  onExit: (id: string, exitCode: number) => void;
}

export class PtyHost {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly procs = new Map<string, any>();
  constructor(private readonly cb: PtyHostCallbacks) {}

  async start(id: string, cols: number, rows: number, cwd: string, command?: string): Promise<{ ok: boolean; detail: string }> {
    await ensurePtyLoaded();
    if (!mod) return { ok: false, detail: `PTY indisponível: ${loadError ?? 'módulo não carregado'}` };
    if (this.procs.has(id)) return { ok: false, detail: 'id de terminal já em uso' };
    const shell = command && command.length > 0 ? command : defaultShell;
    const p = mod.spawn(shell, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: process.env,
    });
    p.onData((d: string) => this.cb.onData(id, d));
    p.onExit((e: { exitCode: number }) => {
      this.procs.delete(id);
      this.cb.onExit(id, e.exitCode);
    });
    this.procs.set(id, p);
    return { ok: true, detail: shell };
  }

  write(id: string, data: string): void {
    this.procs.get(id)?.write(data);
  }
  resize(id: string, cols: number, rows: number): void {
    try {
      this.procs.get(id)?.resize(cols || 80, rows || 24);
    } catch {
      /* processo pode ter saído */
    }
  }
  kill(id: string): void {
    try {
      this.procs.get(id)?.kill();
    } catch {
      /* ignore */
    }
    this.procs.delete(id);
  }
  killAll(): void {
    for (const id of [...this.procs.keys()]) this.kill(id);
  }
}
