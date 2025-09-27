import { MicLevel } from '../audio/MicLevel';

export interface MicConfigState {
  enabled: boolean;
  sensitivityDb: number;
  pushToTalk: boolean;
  ambientLevel: number;
}

export interface MicHudCallbacks {
  onLevelChange(level: number): void;
  onVad(active: boolean): void;
  onMicActive(active: boolean): void;
  onPushToTalkChange?(enabled: boolean): void;
}

export interface NetworkTransport {
  send(data: unknown): void;
  isConnected(): boolean;
}

interface MicMessage {
  type: 'mic';
  level: number;
  flags: {
    pushToTalk: boolean;
    enabled: boolean;
  };
}

const MIC_UPDATE_INTERVAL_MS = 1000 / 12;

export class NetClient {
  private mic: MicLevel | null = null;
  private micTimer: number | null = null;
  private lastMicPayload = 0;
  private micConfig: MicConfigState = {
    enabled: false,
    sensitivityDb: -50,
    pushToTalk: false,
    ambientLevel: 0,
  };

  constructor(private transport: NetworkTransport, private hud: MicHudCallbacks) {}

  public get micEnabled(): boolean {
    return this.micConfig.enabled;
  }

  public async enableMic(): Promise<void> {
    if (this.micConfig.enabled) {
      return;
    }
    const mic = this.ensureMic();
    await mic.start();
    this.micConfig.enabled = true;
    this.hud.onMicActive(true);
    this.startMicLoop();
  }

  public disableMic(): void {
    this.micConfig.enabled = false;
    if (this.micTimer) {
      window.clearInterval(this.micTimer);
      this.micTimer = null;
    }
    this.mic?.stop();
    this.hud.onMicActive(false);
    this.sendMicLevel(0);
  }

  public setSensitivity(db: number): void {
    this.micConfig.sensitivityDb = db;
    if (this.mic) {
      this.mic.sensitivityDb = db;
    }
  }

  public setPushToTalk(enabled: boolean): void {
    this.micConfig.pushToTalk = enabled;
    if (this.mic) {
      this.mic.pushToTalk = enabled;
    }
    this.hud.onPushToTalkChange?.(enabled);
  }

  public setAmbientLevel(level: number): void {
    this.micConfig.ambientLevel = Math.max(0, Math.min(100, level));
    if (this.mic) {
      this.mic.ambientLevel = this.micConfig.ambientLevel;
    }
  }

  public getAmbientLevel(): number {
    return this.micConfig.ambientLevel;
  }

  public async calibrateMic(): Promise<void> {
    const mic = this.ensureMic();
    const wasEnabled = this.micConfig.enabled;
    const wasRunning = mic.isRunning;
    if (!wasRunning) {
      await mic.start();
      if (!wasEnabled) {
        this.hud.onMicActive(true);
      }
    }
    await mic.calibrate();
    this.setAmbientLevel(mic.ambientLevel);
    if (!wasEnabled) {
      mic.stop();
      this.hud.onMicActive(false);
    }
  }

  private startMicLoop(): void {
    if (this.micTimer) {
      window.clearInterval(this.micTimer);
    }
    this.micTimer = window.setInterval(() => {
      if (!this.transport.isConnected()) {
        return;
      }
      if (!this.micEnabled) {
        this.sendMicLevel(0);
      }
    }, MIC_UPDATE_INTERVAL_MS);
  }

  private handleMicLevel(level: number): void {
    this.hud.onLevelChange(level);
    if (this.micConfig.enabled) {
      this.sendMicLevel(level);
    }
  }

  private sendMicLevel(level: number): void {
    const clamped = Math.min(100, Math.max(0, Number.isFinite(level) ? level : 0));
    if (clamped === this.lastMicPayload) {
      return;
    }
    this.lastMicPayload = clamped;
    const message: MicMessage = {
      type: 'mic',
      level: clamped,
      flags: {
        pushToTalk: this.micConfig.pushToTalk,
        enabled: this.micConfig.enabled,
      },
    };
    this.transport.send(message);
  }

  private ensureMic(): MicLevel {
    if (!this.mic) {
      this.mic = new MicLevel(
        {
          onLevel: (level) => this.handleMicLevel(level),
          onVadChange: (active) => this.hud.onVad(active),
          onPermissionChange: (granted) => {
            this.hud.onMicActive(granted);
            if (!granted) {
              this.disableMic();
            }
          },
        },
        {
          sensitivityDb: this.micConfig.sensitivityDb,
          pushToTalk: this.micConfig.pushToTalk,
          ambientLevel: this.micConfig.ambientLevel,
        },
      );
    }
    return this.mic;
  }
}
