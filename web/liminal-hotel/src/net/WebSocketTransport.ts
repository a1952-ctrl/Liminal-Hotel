import { NetworkTransport } from './NetClient';

export interface TransportEvents {
  onClose?: () => void;
  onError?: (error: Event | Error) => void;
}

export class WebSocketTransport implements NetworkTransport {
  private socket: WebSocket | null = null;
  private currentUrl: string | null = null;
  private manualClose = false;

  constructor(private readonly events: TransportEvents = {}) {}

  public async connect(url: string): Promise<void> {
    await this.disconnect();
    this.manualClose = false;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.socket = ws;
      this.currentUrl = url;
      let opened = false;

      const handleOpen = (): void => {
        opened = true;
        ws.removeEventListener('open', handleOpen);
        resolve();
      };

      const handleError = (event: Event): void => {
        ws.removeEventListener('open', handleOpen);
        this.events.onError?.(event);
        if (!opened) {
          cleanup();
          reject(new Error('Failed to connect.'));
        }
      };

      const handleClose = (): void => {
        if (this.socket === ws) {
          this.socket = null;
          this.currentUrl = null;
        }
        if (!this.manualClose) {
          if (!opened) {
            reject(new Error('Connection closed before ready.'));
          }
          this.events.onClose?.();
        }
      };

      const cleanup = (): void => {
        ws.removeEventListener('error', handleError);
        ws.removeEventListener('close', handleClose);
      };

      ws.addEventListener('open', handleOpen);
      ws.addEventListener('error', handleError);
      ws.addEventListener('close', handleClose, { once: false });
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }
    const ws = this.socket;
    this.manualClose = true;
    this.socket = null;
    this.currentUrl = null;

    await new Promise<void>((resolve) => {
      ws.addEventListener('close', () => resolve(), { once: true });
      ws.close();
    });
  }

  public send(data: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(data));
  }

  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN ?? false;
  }

  public get url(): string | null {
    return this.currentUrl;
  }
}
