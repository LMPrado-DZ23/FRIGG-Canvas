/**
 * FRIGG — preload mínimo tipado (vira CJS no build). Expõe SÓ o necessário via
 * contextBridge; o renderer nunca toca ipcRenderer cru, Node, fs ou node-pty.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { HealthResult } from '../core/omniroute-client.js';
import type { WorkspaceDoc } from '../core/workspace.js';

export interface PtyDataEvent {
  readonly id: string;
  readonly data: string;
}
export interface PtyExitEvent {
  readonly id: string;
  readonly exitCode: number;
}

export interface FriggApi {
  omniroute: { health(): Promise<HealthResult> };
  workspace: {
    load(): Promise<{ doc: WorkspaceDoc; recovered: boolean }>;
    save(doc: WorkspaceDoc): Promise<{ ok: boolean }>;
  };
  pty: {
    available(): Promise<{ available: boolean; detail: string }>;
    start(id: string, cols: number, rows: number, command?: string): Promise<{ ok: boolean; detail: string }>;
    write(id: string, data: string): void;
    resize(id: string, cols: number, rows: number): void;
    kill(id: string): void;
    onData(cb: (e: PtyDataEvent) => void): () => void;
    onExit(cb: (e: PtyExitEvent) => void): () => void;
  };
}

const api: FriggApi = {
  omniroute: {
    health: () => ipcRenderer.invoke('omniroute:health') as Promise<HealthResult>,
  },
  workspace: {
    load: () => ipcRenderer.invoke('workspace:load') as Promise<{ doc: WorkspaceDoc; recovered: boolean }>,
    save: (doc) => ipcRenderer.invoke('workspace:save', doc) as Promise<{ ok: boolean }>,
  },
  pty: {
    available: () => ipcRenderer.invoke('pty:available') as Promise<{ available: boolean; detail: string }>,
    start: (id, cols, rows, command) =>
      ipcRenderer.invoke('pty:start', id, cols, rows, command) as Promise<{ ok: boolean; detail: string }>,
    write: (id, data) => ipcRenderer.send('pty:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
    kill: (id) => ipcRenderer.send('pty:kill', id),
    onData: (cb) => {
      const h = (_e: IpcRendererEvent, e: PtyDataEvent): void => cb(e);
      ipcRenderer.on('pty:data', h);
      return () => ipcRenderer.removeListener('pty:data', h);
    },
    onExit: (cb) => {
      const h = (_e: IpcRendererEvent, e: PtyExitEvent): void => cb(e);
      ipcRenderer.on('pty:exit', h);
      return () => ipcRenderer.removeListener('pty:exit', h);
    },
  },
};

contextBridge.exposeInMainWorld('frigg', api);

declare global {
  interface Window {
    readonly frigg: FriggApi;
  }
}
