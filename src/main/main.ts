/**
 * FRIGG — processo main do Electron.
 * Segurança: contextIsolation on, sandbox on, sem nodeIntegration, sem webview
 * privilegiada. O renderer só toca em node-pty/fs/omniroute via IPC validado aqui.
 * OmniRoute ausente = INDISPONÍVEL (nunca simula saúde). PTY/persistência degradam
 * com honestidade.
 */
import { app, BrowserWindow, ipcMain, Menu, dialog, shell, session, type WebContents, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, isAbsolute, join } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { createFileLogger } from './logger.js';

// Testes E2E isolam o workspace/perfil numa pasta temporária (só caminho absoluto).
// Definido antes de qualquer log, que também vive em userData.
const USER_DATA_OVERRIDE = process.env['FRIGG_USER_DATA'];
if (USER_DATA_OVERRIDE && isAbsolute(USER_DATA_OVERRIDE)) app.setPath('userData', USER_DATA_OVERRIDE);
// Log único e rotativo em <userData>/logs/main.log.
const log = createFileLogger(join(app.getPath('userData'), 'logs'));
process.on('uncaughtException', (e) => log(`uncaughtException: ${e instanceof Error ? e.stack ?? e.message : String(e)}`));
process.on('unhandledRejection', (e) => log(`unhandledRejection: ${String(e)}`));
import { OmniRouteClient } from '../core/omniroute-client.js';
import { parseLibraryForSave, type WorkspaceLibrary } from '../core/workspace.js';
import { JsonFileStore } from './storage.js';
import { PtyHost, isPtyAvailable, ptyLoadError, ensurePtyLoaded } from './pty-host.js';
import { startClaudeSession } from './adapters/claude-adapter.js';
import { startCodexSession } from './adapters/codex-adapter.js';
import type { ManagedSession } from './adapters/types.js';
import { isExecutablePath, isSafeBrowserUrl, isSafeOmniRouteUrl, isTrustedRendererUrl, isValidTerminalSize } from '../core/security.js';
import { isCliAvailable } from './cli-availability.js';
import { startAutoUpdates } from './updater.js';
import { parseRoutingMode, resolveRouting, type RoutingDecision } from '../core/agent-policy.js';
import { AgentRegistry } from './agent-registry.js';
import { boundedString, validAgentParams, validId } from './ipc-validation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configuredOmniRoute = process.env['FRIGG_OMNIROUTE_URL'] ?? 'http://localhost:20128';
const OMNIROUTE_BASE_URL = isSafeOmniRouteUrl(configuredOmniRoute) ? configuredOmniRoute : 'http://localhost:20128';
if (configuredOmniRoute !== OMNIROUTE_BASE_URL) log('FRIGG_OMNIROUTE_URL inválida; usando endpoint local padrão');
const DEV_URL = process.env['FRIGG_DEV_URL'];
const PACKAGED_RENDERER_URL = pathToFileURL(join(__dirname, '../renderer/index.html')).href;

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
const agents = new AgentRegistry();

function send(channel: string, payload: unknown): void {
  const wc: WebContents | undefined = mainWindow?.webContents;
  if (wc && !wc.isDestroyed()) wc.send(channel, payload);
}

function assertTrustedIpc(event: IpcMainEvent | IpcMainInvokeEvent): void {
  const source = event.senderFrame?.url ?? event.sender.getURL();
  if (!isTrustedRendererUrl(source, DEV_URL, PACKAGED_RENDERER_URL)) {
    log(`ipc bloqueado source=${source}`);
    throw new Error('origem IPC não autorizada');
  }
}

function configureWebSecurity(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on('web-contents-created', (_event, contents) => {
    contents.session.setPermissionRequestHandler((_requestingContents, _permission, callback) => callback(false));
    contents.session.setPermissionCheckHandler(() => false);
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      if (typeof params.src !== 'string' || !isSafeBrowserUrl(params.src)) {
        event.preventDefault();
        return;
      }
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
    });
    if (contents.getType() === 'webview') {
      contents.on('will-navigate', (event, url) => {
        if (!isSafeBrowserUrl(url)) event.preventDefault();
      });
    }
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
  ipcMain.handle('omniroute:health', async (event) => {
    assertTrustedIpc(event);
    log('ipc omniroute:health (bridge OK)');
    return omni.probeHealth();
  });
  ipcMain.handle('workspace:load', async (event) => {
    assertTrustedIpc(event);
    return store.loadOrEmpty();
  });
  ipcMain.handle('workspace:save', async (event, library: unknown) => {
    assertTrustedIpc(event);
    const valid: WorkspaceLibrary = parseLibraryForSave(library);
    store.save(valid);
    return { ok: true };
  });
  ipcMain.handle('pty:available', async (event) => {
    assertTrustedIpc(event);
    await ensurePtyLoaded();
    const ok = isPtyAvailable();
    log(`pty:available -> ${ok} (${ptyLoadError() ?? 'ok'})`);
    return { available: ok, detail: ok ? 'ok' : (ptyLoadError() ?? 'binário não carregado') };
  });
  ipcMain.handle('pty:start', async (event, id: string, cols: number, rows: number, command?: string, cwd?: string) => {
    assertTrustedIpc(event);
    if (!validId(id)) return { ok: false, detail: 'id inválido' };
    if (command !== undefined && !boundedString(command, 4_096)) return { ok: false, detail: 'comando inválido ou excede o limite' };
    if (cwd !== undefined && !boundedString(cwd, 32_768)) return { ok: false, detail: 'diretório inválido ou excede o limite' };
    if (!isValidTerminalSize(cols, rows)) return { ok: false, detail: 'dimensões do terminal inválidas' };
    const dir = cwd && cwd.length > 0 ? cwd : app.getPath('home');
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return { ok: false, detail: 'diretório de trabalho inválido' };
    log(`pty:start id=${id} cmd=${command ?? 'shell'} cwd=${dir}`);
    return pty.start(String(id), Number(cols), Number(rows), dir, command);
  });
  ipcMain.handle('dialog:pickFolder', async (event) => {
    assertTrustedIpc(event);
    const win = mainWindow;
    const res = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });
  ipcMain.handle('dialog:pickFile', async (event) => {
    assertTrustedIpc(event);
    const win = mainWindow;
    const res = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile'] })
      : await dialog.showOpenDialog({ properties: ['openFile'] });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });
  ipcMain.handle('file:open', async (event, p: string) => {
    assertTrustedIpc(event);
    if (typeof p !== 'string' || p.length === 0 || p.length > 32_768 || !existsSync(p))
      return { ok: false, detail: 'arquivo inexistente ou caminho inválido' };
    if (isExecutablePath(p)) return { ok: false, detail: 'por segurança, executáveis e scripts não são abertos pelo FRIGG' };
    const detail = await shell.openPath(p);
    return detail ? { ok: false, detail } : { ok: true };
  });
  ipcMain.on('pty:write', (event, id: string, data: string) => {
    assertTrustedIpc(event);
    if (validId(id) && boundedString(data, 64_000)) pty.write(id, data);
  });
  ipcMain.on('pty:resize', (event, id: string, cols: number, rows: number) => {
    assertTrustedIpc(event);
    if (validId(id) && isValidTerminalSize(cols, rows)) pty.resize(id, cols, rows);
  });
  ipcMain.on('pty:kill', (event, id: string) => {
    assertTrustedIpc(event);
    if (validId(id)) pty.kill(id);
  });

  // Agentes gerenciados (harness real): Claude Code e Codex.
  ipcMain.handle('agent:start', async (event, id: string, params: unknown) => {
    assertTrustedIpc(event);
    if (!validId(id)) return { ok: false, detail: 'id inválido' };
    if (!validAgentParams(params))
      return { ok: false, detail: 'prompt inválido' };
    const ticket = agents.reserve(id);
    if (!ticket) return { ok: false, detail: 'sessão já ativa ou iniciando' };
    try {
    const harness = params.harness ?? 'claude';
    if (harness !== 'claude' && harness !== 'codex') return { ok: false, detail: `adaptador '${harness}' não implementado` };
    if (!(await isCliAvailable(harness)))
      return { ok: false, detail: `CLI '${harness}' não encontrada. Instale-a em um terminal antes de iniciar o agente.` };
    const cwd = params.cwd && params.cwd.length > 0 ? params.cwd : app.getPath('home');
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) return { ok: false, detail: 'diretório de trabalho inválido' };
    const cb = {
      onEvent: (agentEvent: import('../core/turn-state.js').SessionEvent) => {
        send('agent:event', { id, event: agentEvent });
        if (['turn.completed', 'turn.failed', 'cancel.confirmed', 'process.exited'].includes(agentEvent.type)) ticket.onTerminal();
      },
      onCost: (usd: number) => send('agent:cost', { id, usd }),
      onOutput: (text: string) => send('agent:output', { id, text }),
      onSession: (ref: string) => send('agent:session', { id, ref }),
    };
    let route = '';
    let decision: RoutingDecision | null = null;
    if (harness === 'claude') {
      const mode = parseRoutingMode(params.routing);
      decision = resolveRouting(mode, mode === 'auto' ? (await omni.probeHealth()).status : 'unknown');
      route = ` · ${decision.label}`;
    }
    // Cancelado enquanto checávamos CLI/rota: não inicia nada.
    if (agents.cancelPending(id)) return { ok: false, detail: 'cancelado antes de iniciar' };
    let handle: ManagedSession;
    if (harness === 'claude' && decision) {
      handle = startClaudeSession({
        cwd,
        prompt: params.prompt,
        ...(params.model ? { model: params.model } : {}),
        ...(decision.useOmniRoute ? { baseUrl: OMNIROUTE_BASE_URL } : {}),
        ...(params.resume ? { resumeSessionId: params.resume } : {}),
        ...(params.maxBudgetUsd !== undefined ? { maxBudgetUsd: params.maxBudgetUsd } : {}),
      }, cb);
    } else {
      handle = startCodexSession({
        cwd,
        prompt: params.prompt,
        ...(params.model ? { model: params.model } : {}),
        ...(params.resume ? { resumeThreadId: params.resume } : {}),
      }, cb);
    }
    return !ticket.attach(handle)
      ? { ok: false, detail: `não foi possível iniciar (${harness})` }
      : { ok: true, detail: `${params.resume ? 'continuando' : 'iniciado'} (${harness}${route})` };
    } catch (error) {
      log(`agent:start falhou id=${id}: ${String(error)}`);
      return { ok: false, detail: `falha ao iniciar agente: ${String(error)}` };
    } finally {
      ticket.release();
    }
  });
  ipcMain.handle('agent:cancel', async (event, id: string) => {
    assertTrustedIpc(event);
    if (!validId(id)) return { ok: false };
    agents.cancel(id);
    return { ok: true };
  });
  ipcMain.handle('agent:approve', async (event, id: string, requestId: string, decision: 'approved' | 'denied') => {
    assertTrustedIpc(event);
    if (!validId(id) || !boundedString(requestId, 256, true)) return { ok: false };
    if (decision !== 'approved' && decision !== 'denied') return { ok: false };
    agents.get(id)?.approve?.(requestId, decision);
    return { ok: true };
  });
}

app.whenReady().then(() => {
  log('whenReady');
  Menu.setApplicationMenu(null); // remove o menu padrão em inglês (visual limpo, estilo Maestri)
  configureWebSecurity();
  store = new JsonFileStore(join(app.getPath('userData'), 'workspace.json'));
  pty = new PtyHost({
    onData: (id, data) => send('pty:data', { id, data }),
    onExit: (id, exitCode) => send('pty:exit', { id, exitCode }),
  });
  registerIpc();
  createWindow();
  void startAutoUpdates({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    disabled: process.env['FRIGG_DISABLE_UPDATES'] === '1',
  }, log);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  pty?.killAll();
  agents.cancelAll();
  if (process.platform !== 'darwin') app.quit();
});
