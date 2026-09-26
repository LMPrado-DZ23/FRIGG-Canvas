/**
 * FRIGG — atualização automática via GitHub Releases (electron-updater).
 *
 * Só roda na versão INSTALADA (NSIS): o instalador grava `app-update.yml` em
 * resources/. O pacote portátil e o modo dev não têm esse arquivo e nunca
 * carregam o electron-updater. Falha de rede/feed é registrada e ignorada —
 * nunca impede o app de abrir.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface UpdaterEnv {
  readonly isPackaged: boolean;
  readonly resourcesPath: string;
  readonly disabled: boolean;
  readonly exists?: (path: string) => boolean;
}

/** true quando esta instalação tem feed de atualização e ele não foi desligado. */
export function shouldCheckForUpdates(env: UpdaterEnv): boolean {
  if (!env.isPackaged || env.disabled) return false;
  return (env.exists ?? existsSync)(join(env.resourcesPath, 'app-update.yml'));
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

export async function startAutoUpdates(env: UpdaterEnv, log: (msg: string) => void): Promise<void> {
  if (!shouldCheckForUpdates(env)) return;
  try {
    const { autoUpdater } = await import('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (e) => log(`updater erro: ${e instanceof Error ? e.message : String(e)}`));
    autoUpdater.on('update-downloaded', (info) => log(`updater: versão ${info.version} baixada; instala ao sair`));
    let inFlight = false;
    const check = (): void => {
      if (inFlight) return; // não sobrepõe verificações/downloads lentos
      inFlight = true;
      // Mostra a notificação nativa do Windows quando uma versão é baixada.
      void autoUpdater.checkForUpdatesAndNotify()
        .catch((e: unknown) => log(`updater check falhou: ${String(e)}`))
        .finally(() => { inFlight = false; });
    };
    check();
    setInterval(check, SIX_HOURS).unref();
  } catch (e) {
    log(`updater indisponível: ${String(e)}`);
  }
}
