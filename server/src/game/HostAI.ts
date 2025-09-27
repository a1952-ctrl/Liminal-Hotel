import { Player, Vec3 } from './Player';

export type HostState = 'patrol' | 'search' | 'investigate' | 'chase';

function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export class HostAI {
  public state: HostState = 'patrol';
  public heardAt: Vec3 | null = null;
  public chaseAggression = 0;

  constructor(public position: Vec3 = { x: 0, y: 0, z: 0 }) {}

  public update(players: Player[]): void {
    let loudest: { player: Player; radius: number } | null = null;
    for (const player of players) {
      if (player.noiseRadius <= 0) {
        continue;
      }
      const dist = distance(player.position, this.position);
      if (dist <= player.noiseRadius) {
        if (!loudest || player.noiseRadius > loudest.radius) {
          loudest = { player, radius: player.noiseRadius };
        }
      }
    }

    if (loudest) {
      this.heardAt = { ...loudest.player.position };
      this.chaseAggression = Math.min(1, loudest.radius / 18);
      if (this.state === 'patrol' || this.state === 'search') {
        this.state = 'investigate';
      } else if (this.state === 'investigate') {
        this.state = 'chase';
      }
    } else if (this.state === 'chase') {
      this.state = 'investigate';
      this.chaseAggression = 0;
    } else if (this.state === 'investigate') {
      this.state = 'search';
      this.chaseAggression = 0;
    }
  }
}
