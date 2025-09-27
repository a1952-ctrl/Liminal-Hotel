export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export class Player {
  public noiseRadius = 0;
  private lastMicTimestamp = 0;

  constructor(public readonly id: string, public position: Vec3 = { x: 0, y: 0, z: 0 }) {}

  public applyMicLevel(level: number, timestamp: number, maxRadius = 18): void {
    if (timestamp - this.lastMicTimestamp < 50) {
      return;
    }
    this.lastMicTimestamp = timestamp;
    const clamped = Math.max(0, Math.min(100, Number.isFinite(level) ? level : 0));
    const radius = (clamped / 100) * maxRadius;
    this.noiseRadius = radius;
  }

  public updateDecay(deltaSeconds: number): void {
    if (this.noiseRadius <= 0) {
      return;
    }
    const decayFactor = Math.pow(0.8, deltaSeconds); // ~20% per second
    this.noiseRadius *= decayFactor;
    if (this.noiseRadius < 0.01) {
      this.noiseRadius = 0;
    }
  }
}
