/**
 * Ponte para a API do preload. Em dev no navegador (sem Electron) `window.frigg`
 * não existe: caímos para fallbacks HONESTOS (OmniRoute/PTY indisponíveis),
 * nunca simulando saúde ou terminal.
 */
import type { FriggApi } from '../preload/preload.js';
import type { HealthResult } from '../core/omniroute-client.js';
import { emptyWorkspace, type WorkspaceDoc } from '../core/workspace.js';

const real: FriggApi | undefined = (globalThis as { frigg?: FriggApi }).frigg;

export const hasBridge = real !== undefined;

export const bridge: FriggApi = real ?? {
  omniroute: {
    async health(): Promise<HealthResult> {
      return { status: 'unavailable', detail: 'sem bridge (dev no navegador)', checkedAt: Date.now() };
    },
  },
  dialog: {
    async pickFolder(): Promise<string | null> {
      return null;
    },
  },
  workspace: {
    async load(): Promise<{ doc: WorkspaceDoc; recovered: boolean }> {
      try {
        const raw = localStorage.getItem('frigg:workspace');
        if (raw) return { doc: JSON.parse(raw) as WorkspaceDoc, recovered: true };
      } catch {
        /* ignore */
      }
      return { doc: emptyWorkspace('FRIGG'), recovered: false };
    },
    async save(doc: WorkspaceDoc): Promise<{ ok: boolean }> {
      try {
        localStorage.setItem('frigg:workspace', JSON.stringify(doc));
      } catch {
        /* ignore */
      }
      return { ok: true };
    },
  },
  pty: {
    async available() {
      return { available: false, detail: 'sem bridge (dev no navegador)' };
    },
    async start() {
      return { ok: false, detail: 'PTY indisponível (sem bridge)' };
    },
    write() {},
    resize() {},
    kill() {},
    onData() {
      return () => {};
    },
    onExit() {
      return () => {};
    },
  },
  agent: {
    async start() {
      return { ok: false, detail: 'agente indisponível (sem bridge / dev no navegador)' };
    },
    async cancel() {
      return { ok: true };
    },
    async approve() {
      return { ok: true };
    },
    onEvent() {
      return () => {};
    },
    onCost() {
      return () => {};
    },
    onOutput() {
      return () => {};
    },
  },
};
