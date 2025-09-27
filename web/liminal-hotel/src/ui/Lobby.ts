import { HostBridge, ServerReadyPayload, hostBridge } from '../platform/hostBridge';

export interface LobbyCallbacks {
  onConnect(url: string): void;
  onDisconnect(): void;
}

type LobbyState =
  | { kind: 'idle' }
  | { kind: 'connecting'; target: string }
  | { kind: 'connected'; target: string }
  | { kind: 'error'; message: string };

export class Lobby {
  private readonly root: HTMLElement;
  private readonly status: HTMLElement;
  private readonly joinInput: HTMLInputElement;
  private readonly connectButton: HTMLButtonElement;
  private readonly hostButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly hostDetails: HTMLElement;
  private state: LobbyState = { kind: 'idle' };
  private unsubscribeStatus: (() => void) | null = null;

  constructor(private readonly callbacks: LobbyCallbacks, private readonly bridge: HostBridge = hostBridge) {
    this.root = document.createElement('div');
    this.root.className = 'lobby-panel';

    const connectionFieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Multiplayer Lobby';
    connectionFieldset.appendChild(legend);

    this.status = document.createElement('div');
    this.status.className = 'status-pill';
    this.status.textContent = 'Disconnected';

    this.joinInput = document.createElement('input');
    this.joinInput.type = 'text';
    this.joinInput.placeholder = 'ws://localhost:8787';

    this.connectButton = document.createElement('button');
    this.connectButton.textContent = 'Connect';

    this.hostButton = document.createElement('button');
    this.hostButton.textContent = this.bridge.isElectron ? 'Host local (desktop)' : 'Host local';

    this.stopButton = document.createElement('button');
    this.stopButton.textContent = 'Stop host';
    this.stopButton.disabled = true;

    this.hostDetails = document.createElement('p');
    this.hostDetails.className = 'host-details';

    const joinRow = document.createElement('div');
    joinRow.appendChild(this.joinInput);
    joinRow.appendChild(this.connectButton);

    const hostRow = document.createElement('div');
    hostRow.appendChild(this.hostButton);
    hostRow.appendChild(this.stopButton);

    connectionFieldset.appendChild(this.status);
    connectionFieldset.appendChild(joinRow);
    connectionFieldset.appendChild(hostRow);
    connectionFieldset.appendChild(this.hostDetails);

    const instructions = document.createElement('p');
    instructions.innerHTML = this.bridge.isElectron
      ? 'La app de escritorio puede arrancar el servidor en un puerto libre y compartir la IP en LAN.'
      : 'Para anfitrionar desde navegador, ejecuta <code>npm run server</code> y deja el campo apuntar a ws://localhost:3000.';

    this.root.appendChild(connectionFieldset);
    this.root.appendChild(instructions);

    this.connectButton.addEventListener('click', () => this.handleConnect());
    this.hostButton.addEventListener('click', () => this.handleHost());
    this.stopButton.addEventListener('click', () => this.handleStopHost());

    if (this.bridge.isElectron) {
      this.unsubscribeStatus = this.bridge.onStatus((status) => {
        this.hostDetails.textContent = status;
      });
    }
  }

  public mount(container: HTMLElement): void {
    container.appendChild(this.root);
  }

  public updateConnected(url: string): void {
    this.state = { kind: 'connected', target: url };
    this.status.textContent = `Connected to ${url}`;
    this.status.classList.remove('error');
    this.status.classList.add('ready');
    this.connectButton.disabled = true;
    this.joinInput.disabled = true;
    this.hostButton.disabled = true;
    this.stopButton.disabled = false;
  }

  public updateDisconnected(): void {
    this.state = { kind: 'idle' };
    this.status.textContent = 'Disconnected';
    this.status.classList.remove('ready', 'error');
    this.connectButton.disabled = false;
    this.joinInput.disabled = false;
    this.hostButton.disabled = false;
    this.stopButton.disabled = true;
    this.hostDetails.textContent = '';
  }

  public showError(message: string): void {
    this.state = { kind: 'error', message };
    this.status.textContent = message;
    this.status.classList.remove('ready');
    this.status.classList.add('error');
  }

  private handleConnect(): void {
    const target = this.joinInput.value.trim();
    if (!target) {
      this.showError('Introduce una URL de WebSocket.');
      return;
    }
    this.state = { kind: 'connecting', target };
    this.status.textContent = `Connecting to ${target}...`;
    this.status.classList.remove('ready', 'error');
    this.connectButton.disabled = true;
    this.joinInput.disabled = true;
    this.callbacks.onConnect(target);
  }

  private async handleHost(): Promise<void> {
    if (!this.bridge.isElectron) {
      this.showError('Inicia el servidor manualmente con npm run server.');
      return;
    }

    try {
      const info = await this.bridge.startLocalServer();
      this.applyHostInfo(info);
      this.callbacks.onConnect(info.wsUrl);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'No se pudo arrancar el servidor.');
    }
  }

  private applyHostInfo(info: ServerReadyPayload): void {
    const lanLabel = info.lanAddresses.length > 0 ? info.lanAddresses.join(', ') : 'localhost';
    this.hostDetails.textContent = `Servidor listo en puerto ${info.port} (${lanLabel})`;
    this.joinInput.value = info.wsUrl;
  }

  private async handleStopHost(): Promise<void> {
    if (this.bridge.isElectron) {
      await this.bridge.stopLocalServer();
    }
    this.callbacks.onDisconnect();
    this.updateDisconnected();
  }
}
