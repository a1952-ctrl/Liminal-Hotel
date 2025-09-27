import { NetClient } from '../net/NetClient';
import { WebSocketTransport } from '../net/WebSocketTransport';
import { HudMicIndicator } from '../ui/HudMicIndicator';
import { Lobby } from '../ui/Lobby';
import { OptionsMenu } from '../ui/OptionsMenu';

export class GameClient {
  private readonly hud: HudMicIndicator;
  private readonly transport: WebSocketTransport;
  private readonly net: NetClient;
  private readonly options: OptionsMenu;
  private readonly lobby: Lobby;

  constructor(hudContainer: HTMLElement, menuContainer: HTMLElement, lobbyContainer: HTMLElement) {
    this.hud = new HudMicIndicator();
    this.hud.mount(hudContainer);

    this.lobby = new Lobby({
      onConnect: (url) => void this.connect(url),
      onDisconnect: () => void this.disconnect(),
    });
    this.lobby.mount(lobbyContainer);

    this.transport = new WebSocketTransport({
      onClose: () => this.lobby.updateDisconnected(),
      onError: () => this.lobby.showError('Error de conexión'),
    });
    this.net = new NetClient(this.transport, this.hud);

    this.options = new OptionsMenu(this.net);
    this.options.mount(menuContainer);
  }

  private async connect(url: string): Promise<void> {
    try {
      await this.transport.connect(url);
      this.lobby.updateConnected(url);
    } catch (error) {
      await this.transport.disconnect();
      this.lobby.updateDisconnected();
      this.lobby.showError(error instanceof Error ? error.message : 'No se pudo conectar.');
    }
  }

  private async disconnect(): Promise<void> {
    await this.transport.disconnect();
    this.lobby.updateDisconnected();
  }
}

export function bootstrap(): void {
  const hudContainer = document.getElementById('hud') ?? document.body;
  const menuContainer = document.getElementById('options') ?? document.body;
  const lobbyContainer = document.getElementById('lobby') ?? document.body;
  new GameClient(hudContainer, menuContainer, lobbyContainer);
}

declare global {
  interface Window {
    bootstrapGame?: () => void;
  }
}

window.bootstrapGame = bootstrap;
