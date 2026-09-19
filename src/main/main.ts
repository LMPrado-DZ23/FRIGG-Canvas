/**
 * FRIGG — processo main do Electron.
 *
 * NÃO-BUILDADO NESTA SESSÃO: requer `electron` instalado (ver DEPS-DESKTOP.md).
 * O código é real; ainda não foi empacotado/executado aqui.
 *
 * Segurança (parecer ChatGPT / Electron security):
 *  - contextIsolation: true, nodeIntegration: false, sandbox: true
 *  - sem webview privilegiada por conveniência
 *  - renderer nunca recebe privilégios de Node; tudo passa pelo preload tipado
 *
 * Supervisão do OmniRoute headless: se o serviço não estiver de pé, a UI
 * mostra INDISPONÍVEL. Nunca simular saúde. Não matar instância preexistente.
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OmniRouteClient } from '../core/omniroute-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OMNIROUTE_BASE_URL = process.env.FRIGG_OMNIROUTE_URL ?? 'http://127.0.0.1:8787';

const omni = new OmniRouteClient({
  baseUrl: OMNIROUTE_BASE_URL,
  // fetch nativo do Node/Electron; adapta o retorno ao FetchLike.
  fetchImpl: async (url, init) => {
    const res = await fetch(url, init as RequestInit);
    return { ok: res.ok, status: res.status };
  },
});

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
  void win.loadFile(join(__dirname, '../renderer/index.html'));
}

ipcMain.handle('omniroute:health', async () => omni.probeHealth());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
