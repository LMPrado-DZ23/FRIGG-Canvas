/**
 * FRIGG — processo main do Electron.
 * Segurança: contextIsolation on, sandbox on, sem nodeIntegration, sem webview
 * privilegiada. O renderer só toca em node-pty/fs/omniroute via IPC validado aqui.
 * OmniRoute ausente = INDISPONÍVEL (nunca simula saúde). PTY/persistência degradam
 * com honestidade.
 */
import { app, BrowserWindow, ipcMain, type WebContents } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OmniRouteClient } from '../core/omniroute-client.js';
import { parseWorkspace, type WorkspaceDoc } from '../core/workspace.js';
import { JsonFileStore } from './storage.js';
import { PtyHost, isPtyAvailable, ptyLoadError } from './pty-host.js';
import { startClaudeSession } from './adapters/claude-adapter.js';
import { startCodexSession } from './adapters/codex-adapter.js';
import type { ManagedSession } from './adapters/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OMNIROUTE_BASE_URL = process.env['FRIGG_OMNIROUTE_URL'] ?? 'http://localhost:20128';
const DEV_URL = process.env['FRIGG_DEV_URL'];

const omni = new OmniRouteClient({
  baseUrl: OMNIROUTE_BASE_URL,
  fetchImpl: async (url, init) => {
    const res = await fetch(url, init as RequestInit);
    return { ok: res.ok, status: res.status };
  },
});

let store: JsonFileStore;
let pty: PtyHost;
let mainWindow: BrowserWindow | null = null;
const agents = new Map<string, ManagedSession>();

function send(channel: string, payload: unknown): void {
  const wc: WebContents | undefined = mainWindow?.webContents;
  if (wc && !wc.isDestroyed()) wc.send(channel, payload);
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
}

function registerIpc(): void {
  ipcMain.handle('omniroute:health', async () => omni.probeHealth());
  ipcMain.handle('workspace:load', async () => store.loadOrEmpty());
  ipcMain.handle('workspace:save', async (_e, doc: unknown) => {
    const valid: WorkspaceDoc = parseWorkspace(doc);
    store.save(valid);
    return { ok: true };
  });
  ipcMain.handle('pty:available', async () => ({ available: isPtyAvailable(), detail: ptyLoadError() ?? 'ok' }));
  ipcMain.handle('pty:start', async (_e, id: string, cols: number, rows: number, command?: string) =>
    pty.start(String(id), Number(cols), Number(rows), app.getPath('home'), command),
  );
  ipcMain.on('pty:write', (_e, id: string, data: string) => pty.write(String(id), String(data)));
  ipcMain.on('pty:resize', (_e, id: string, cols: number, rows: number) =>
    pty.resize(String(id), Number(cols), Number(rows)),
  );
  ipcMain.on('pty:kill', (_e, id: string) => pty.kill(String(id)));

  // Agente gerenciado (harness real). Só Claude por ora; Codex é o próximo.
  ipcMain.handle('agent:start', async (_e, id: string, params: { prompt: string; harness?: string; model?: string }) => {
    if (agents.has(id)) return { ok: false, detail: 'sessão já ativa' };
    const harness = params.harness ?? 'claude';
    const cwd = app.getPath('home');
    const cb = {
      onEvent: (event: import('../core/turn-state.js').SessionEvent) => send('agent:event', { id, event }),
      onCost: (usd: number) => send('agent:cost', { id, usd }),
      onOutput: (text: string) => send('agent:output', { id, text }),
    };
    let handle: ManagedSession;
    if (harness === 'claude') {
      handle = startClaudeSession({ cwd, prompt: params.prompt, ...(params.model ? { model: params.model } : {}), baseUrl: OMNIROUTE_BASE_URL }, cb);
    } else if (harness === 'codex') {
      handle = startCodexSession({ cwd, prompt: params.prompt, ...(params.model ? { model: params.model } : {}) }, cb);
    } else {
      return { ok: false, detail: `adaptador '${harness}' não implementado` };
    }
    agents.set(id, handle);
    return { ok: true, detail: `iniciado (${harness})` };
  });
  ipcMain.handle('agent:cancel', async (_e, id: string) => {
    agents.get(id)?.cancel();
    agents.delete(id);
    return { ok: true };
  });
  ipcMain.handle('agent:approve', async (_e, id: string, requestId: string, decision: 'approved' | 'denied') => {
    agents.get(id)?.approve?.(String(requestId), decision);
    return { ok: true };
  });
}

app.whenReady().then(() => {
  store = new JsonFileStore(join(app.getPath('userData'), 'workspace.json'));
  pty = new PtyHost({
    onData: (id, data) => send('pty:data', { id, data }),
    onExit: (id, exitCode) => send('pty:exit', { id, exitCode }),
  });
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  pty?.killAll();
  for (const h of agents.values()) h.cancel();
  agents.clear();
  if (process.platform !== 'darwin') app.quit();
});
