import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeUpdater extends EventEmitter {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  checks = 0;
  pending: (() => void) | null = null;
  checkForUpdatesAndNotify(): Promise<void> {
    this.checks++;
    this.emit('checking-for-update');
    return new Promise((resolve) => { this.pending = resolve; });
  }
}
const fake = vi.hoisted(() => ({ updater: null as unknown }));
// Forma do bundle CJS: autoUpdater só existe dentro de `default`.
vi.mock('electron-updater', () => ({ autoUpdater: undefined, default: { get autoUpdater() { return fake.updater; } } }));

const { startAutoUpdates } = await import('./updater.js');
const env = { isPackaged: true, resourcesPath: '/res', disabled: false, exists: () => true };

describe('startAutoUpdates', () => {
  afterEach(() => vi.useRealTimers());

  it('configura o updater, verifica na partida e a cada 6 h sem sobrepor verificações', async () => {
    vi.useFakeTimers();
    const updater = new FakeUpdater();
    fake.updater = updater;
    const logs: string[] = [];
    await startAutoUpdates(env, (m) => logs.push(m));
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    expect(updater.checks).toBe(1);
    expect(logs).toContain('updater: verificando atualizações');

    vi.advanceTimersByTime(6 * 60 * 60 * 1000); // 1ª verificação ainda em andamento
    expect(updater.checks).toBe(1);
    updater.pending?.();
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(updater.checks).toBe(2);
  });

  it('registra erros do feed sem derrubar nada', async () => {
    const updater = new FakeUpdater();
    fake.updater = updater;
    const logs: string[] = [];
    await startAutoUpdates(env, (m) => logs.push(m));
    updater.emit('error', new Error('No published versions on GitHub\nstack…'));
    expect(logs).toContain('updater erro: No published versions on GitHub');
  });

  it('não carrega nada sem feed (portátil/dev)', async () => {
    const updater = new FakeUpdater();
    fake.updater = updater;
    await startAutoUpdates({ ...env, exists: () => false }, () => {});
    expect(updater.checks).toBe(0);
  });
});
