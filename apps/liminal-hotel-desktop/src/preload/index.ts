import { contextBridge, ipcRenderer } from 'electron';

type ServerReadyPayload = {
  wsUrl: string;
  port: number;
  lanAddresses: string[];
};

contextBridge.exposeInMainWorld('liminalHost', {
  async startServer(): Promise<ServerReadyPayload> {
    return ipcRenderer.invoke('liminalHost:start');
  },
  async stopServer(): Promise<void> {
    await ipcRenderer.invoke('liminalHost:stop');
  },
  subscribe(callback: (status: string) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, status: string) => callback(status);
    ipcRenderer.on('liminalHost:status', listener);
    return () => ipcRenderer.removeListener('liminalHost:status', listener);
  },
});
