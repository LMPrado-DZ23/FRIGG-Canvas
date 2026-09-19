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

const __dirname = dirname(fileURLToPath(import.meta.url));
const OMNIROUTE_BASE_URL = process.env['FRIGG_OMNIROUTE_URL'] ?? 'http://127.0.0.1:8787';
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
  if (process.platform !== 'darwin') app.quit();
});
