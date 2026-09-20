/**
 * FRIGG — processo main do Electron.
 * Segurança: contextIsolation on, sandbox on, sem nodeIntegration, sem webview
 * privilegiada. O renderer só toca em node-pty/fs/omniroute via IPC validado aqui.
 * OmniRoute ausente = INDISPONÍVEL (nunca simula saúde). PTY/persistência degradam
 * com honestidade.
 */
import { app, BrowserWindow, ipcMain, Menu, type WebContents } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const LOG = join(tmpdir(), 'frigg-main.log');
function log(msg: string): void {
  try {
    appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* ignore */
  }
}
process.on('uncaughtException', (e) => log(`uncaughtException: ${e instanceof Error ? e.stack ?? e.message : String(e)}`));
process.on('unhandledRejection', (e) => log(`unhandledRejection: ${String(e)}`));
import { OmniRouteClient } from '../core/omniroute-client.js';
import { parseWorkspace, type WorkspaceDoc } from '../core/workspace.js';
import { JsonFileStore } from './storage.js';
import { PtyHost, isPtyAvailable, ptyLoadError, ensurePtyLoaded } from './pty-host.js';
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
      sandbox: false, // preload bundlado precisa de require('electron'); segurança mantida por contextIsolation
      webviewTag: true, // habilita o nó Navegador (<webview>)
    },
  });
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) =>
    log(`did-fail-load code=${code} desc=${desc} url=${url}`),
  );
  win.webContents.on('render-process-gone', (_e, d) => log(`render-process-gone: ${JSON.stringify(d)}`));
  win.once('ready-to-show', () => log('ready-to-show'));
  const indexPath = join(__dirname, '../renderer/index.html');
  if (DEV_URL) {
    log(`loadURL ${DEV_URL}`);
    void win.loadURL(DEV_URL);
  } else {
    log(`loadFile ${indexPath}`);
    void win.loadFile(indexPath).catch((e) => log(`loadFile erro: ${String(e)}`));
  }
}

function registerIpc(): void {
  ipcMain.handle('omniroute:health', async () => {
    log('ipc omniroute:health (bridge OK)');
    return omni.probeHealth();
  });
  ipcMain.handle('workspace:load', async () => store.loadOrEmpty());
  ipcMain.handle('workspace:save', async (_e, doc: unknown) => {
    const valid: WorkspaceDoc = parseWorkspace(doc);
    store.save(valid);
    return { ok: true };
  });
  ipcMain.handle('pty:available', async () => {
    await ensurePtyLoaded();
    const ok = isPtyAvailable();
    log(`pty:available -> ${ok} (${ptyLoadError() ?? 'ok'})`);
    return { available: ok, detail: ok ? 'ok' : (ptyLoadError() ?? 'binário não carregado') };
  });
  ipcMain.handle('pty:start', async (_e, id: string, cols: number, rows: number, command?: string) => {
    log(`pty:start id=${id} cmd=${command ?? 'shell'}`);
    return pty.start(String(id), Number(cols), Number(rows), app.getPath('home'), command);
  });
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
  log('whenReady');
  Menu.setApplicationMenu(null); // remove o menu padrão em inglês (visual limpo, estilo Maestri)
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
