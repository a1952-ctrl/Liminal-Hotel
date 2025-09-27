export interface ServerReadyPayload {
  wsUrl: string;
  port: number;
  lanAddresses: string[];
}

export interface HostBridge {
  readonly isElectron: boolean;
  startLocalServer(): Promise<ServerReadyPayload>;
  stopLocalServer(): Promise<void>;
  onStatus(callback: (status: string) => void): () => void;
}

declare global {
  interface Window {
    liminalHost?: {
      startServer(): Promise<ServerReadyPayload>;
      stopServer(): Promise<void>;
      subscribe(callback: (status: string) => void): () => void;
    };
  }
}

class BrowserHostBridge implements HostBridge {
  public readonly isElectron = false;

  public async startLocalServer(): Promise<ServerReadyPayload> {
    throw new Error('Local hosting is only available in the desktop app.');
  }

  public async stopLocalServer(): Promise<void> {
    // No-op.
  }

  public onStatus(): () => void {
    return () => {};
  }
}

class ElectronHostBridge implements HostBridge {
  public readonly isElectron = true;

  public startLocalServer(): Promise<ServerReadyPayload> {
    return window.liminalHost!.startServer();
  }

  public stopLocalServer(): Promise<void> {
    return window.liminalHost!.stopServer();
  }

  public onStatus(callback: (status: string) => void): () => void {
    return window.liminalHost!.subscribe(callback);
  }
}

export const hostBridge: HostBridge = window.liminalHost
  ? new ElectronHostBridge()
  : new BrowserHostBridge();
