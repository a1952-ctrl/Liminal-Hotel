import { isMicMessage } from '../net/messages';
import { HostAI } from './HostAI';
import { Player } from './Player';

export class GameRoom {
  private players = new Map<string, Player>();
  private host = new HostAI();
  private lastTick = Date.now();

  public addPlayer(id: string): Player {
    const player = new Player(id);
    this.players.set(id, player);
    return player;
  }

  public removePlayer(id: string): void {
    this.players.delete(id);
  }

  public processMessage(playerId: string, raw: unknown): void {
    if (!isMicMessage(raw)) {
      return;
    }
    if (!this.players.has(playerId)) {
      this.addPlayer(playerId);
    }

    const { level } = raw;
    if (!Number.isFinite(level)) {
      return;
    }

    const player = this.players.get(playerId)!;
    player.applyMicLevel(level, Date.now());
  }

  public tick(): void {
    const now = Date.now();
    const delta = (now - this.lastTick) / 1000;
    this.lastTick = now;

    for (const player of this.players.values()) {
      player.updateDecay(delta);
    }

    this.host.update(Array.from(this.players.values()));
  }

  public getHost(): HostAI {
    return this.host;
  }

  public getPlayers(): Player[] {
    return Array.from(this.players.values());
  }
}
