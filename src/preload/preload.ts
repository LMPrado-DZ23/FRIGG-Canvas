/**
 * FRIGG — preload mínimo tipado (vira CJS no build). Expõe SÓ o necessário via
 * contextBridge; o renderer nunca toca ipcRenderer cru, Node, fs ou node-pty.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { HealthResult } from '../core/omniroute-client.js';
import type { WorkspaceDoc } from '../core/workspace.js';
import type { SessionEvent } from '../core/turn-state.js';

export interface AgentEvent {
  readonly id: string;
  readonly event: SessionEvent;
}
export interface AgentCost {
  readonly id: string;
  readonly usd: number;
}
export interface AgentOutput {
  readonly id: string;
  readonly text: string;
}
export interface AgentStartParams {
  readonly prompt: string;
  readonly harness?: string;
  readonly model?: string;
  readonly cwd?: string;
}

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
  dialog: { pickFolder(): Promise<string | null> };
  workspace: {
    load(): Promise<{ doc: WorkspaceDoc; recovered: boolean }>;
    save(doc: WorkspaceDoc): Promise<{ ok: boolean }>;
  };
  pty: {
    available(): Promise<{ available: boolean; detail: string }>;
    start(id: string, cols: number, rows: number, command?: string, cwd?: string): Promise<{ ok: boolean; detail: string }>;
    write(id: string, data: string): void;
    resize(id: string, cols: number, rows: number): void;
    kill(id: string): void;
    onData(cb: (e: PtyDataEvent) => void): () => void;
    onExit(cb: (e: PtyExitEvent) => void): () => void;
  };
  agent: {
    start(id: string, params: AgentStartParams): Promise<{ ok: boolean; detail: string }>;
    cancel(id: string): Promise<{ ok: boolean }>;
    approve(id: string, requestId: string, decision: 'approved' | 'denied'): Promise<{ ok: boolean }>;
    onEvent(cb: (e: AgentEvent) => void): () => void;
    // (impl de approve adicionada abaixo)
    onCost(cb: (e: AgentCost) => void): () => void;
    onOutput(cb: (e: AgentOutput) => void): () => void;
  };
}

const api: FriggApi = {
  omniroute: {
    health: () => ipcRenderer.invoke('omniroute:health') as Promise<HealthResult>,
  },
  dialog: {
    pickFolder: () => ipcRenderer.invoke('dialog:pickFolder') as Promise<string | null>,
  },
  workspace: {
    load: () => ipcRenderer.invoke('workspace:load') as Promise<{ doc: WorkspaceDoc; recovered: boolean }>,
    save: (doc) => ipcRenderer.invoke('workspace:save', doc) as Promise<{ ok: boolean }>,
  },
  pty: {
    available: () => ipcRenderer.invoke('pty:available') as Promise<{ available: boolean; detail: string }>,
    start: (id, cols, rows, command, cwd) =>
      ipcRenderer.invoke('pty:start', id, cols, rows, command, cwd) as Promise<{ ok: boolean; detail: string }>,
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
  agent: {
    start: (id, params) =>
      ipcRenderer.invoke('agent:start', id, params) as Promise<{ ok: boolean; detail: string }>,
    cancel: (id) => ipcRenderer.invoke('agent:cancel', id) as Promise<{ ok: boolean }>,
    approve: (id, requestId, decision) =>
      ipcRenderer.invoke('agent:approve', id, requestId, decision) as Promise<{ ok: boolean }>,
    onEvent: (cb) => {
      const h = (_e: IpcRendererEvent, e: AgentEvent): void => cb(e);
      ipcRenderer.on('agent:event', h);
      return () => ipcRenderer.removeListener('agent:event', h);
    },
    onCost: (cb) => {
      const h = (_e: IpcRendererEvent, e: AgentCost): void => cb(e);
      ipcRenderer.on('agent:cost', h);
      return () => ipcRenderer.removeListener('agent:cost', h);
    },
    onOutput: (cb) => {
      const h = (_e: IpcRendererEvent, e: AgentOutput): void => cb(e);
      ipcRenderer.on('agent:output', h);
      return () => ipcRenderer.removeListener('agent:output', h);
    },
  },
};

contextBridge.exposeInMainWorld('frigg', api);

declare global {
  interface Window {
    readonly frigg: FriggApi;
  }
}
