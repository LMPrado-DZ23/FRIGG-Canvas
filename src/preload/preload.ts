/**
 * FRIGG — preload mínimo tipado.
 *
 * NÃO-BUILDADO NESTA SESSÃO (requer electron). Expõe SÓ o necessário via
 * contextBridge; o renderer nunca toca em ipcRenderer cru nem em Node.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { HealthResult } from '../core/omniroute-client.js';

export interface FriggApi {
  omniroute: {
    health(): Promise<HealthResult>;
  };
}

const api: FriggApi = {
  omniroute: {
    health: () => ipcRenderer.invoke('omniroute:health') as Promise<HealthResult>,
  },
};

contextBridge.exposeInMainWorld('frigg', api);

declare global {
  interface Window {
    readonly frigg: FriggApi;
  }
}
