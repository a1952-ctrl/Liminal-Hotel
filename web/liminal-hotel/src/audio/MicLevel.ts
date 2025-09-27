/*
 * Microphone level capture with privacy-preserving voice activity detection.
 */

export interface MicLevelCallbacks {
  onLevel?: (level: number) => void;
  onVadChange?: (active: boolean) => void;
  onPermissionChange?: (granted: boolean) => void;
}

export interface MicLevelOptions {
  sensitivityDb?: number; // Threshold in dBFS for voice detection.
  smoothing?: number; // Exponential smoothing factor for the RMS level.
  vadHoldMs?: number; // Time that voice must stay above threshold before reporting.
  vadReleaseMs?: number; // Time before we consider voice ended.
  fftSize?: number;
  frameRate?: number; // Updates per second.
  pushToTalk?: boolean;
  ambientLevel?: number; // Calibration offset for ambient noise (0-100).
}

const DEFAULT_OPTIONS: Required<Pick<MicLevelOptions,
  'sensitivityDb' | 'smoothing' | 'vadHoldMs' | 'vadReleaseMs' | 'fftSize' | 'frameRate' | 'pushToTalk' | 'ambientLevel'
>> = {
  sensitivityDb: -50,
  smoothing: 0.2,
  vadHoldMs: 200,
  vadReleaseMs: 350,
  fftSize: 512,
  frameRate: 12,
  pushToTalk: false,
  ambientLevel: 0,
};

const LEVEL_MIN_DB = -100;
const LEVEL_MAX_DB = 0;

export class MicLevel {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Float32Array = new Float32Array(0);
  private rafId: number | null = null;
  private intervalId: number | null = null;
  private running = false;
  private levelEma = 0;
  private vadActive = false;
  private aboveThresholdFrames = 0;
  private belowThresholdFrames = 0;
  private pushToTalkHeld = false;
  private lastLevelSent = 0;

  private options: Required<typeof DEFAULT_OPTIONS>;

  constructor(private callbacks: MicLevelCallbacks = {}, options: MicLevelOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public get isRunning(): boolean {
    return this.running;
  }

  public get pushToTalk(): boolean {
    return this.options.pushToTalk;
  }

  public set pushToTalk(enabled: boolean) {
    this.options.pushToTalk = enabled;
  }

  public get sensitivityDb(): number {
    return this.options.sensitivityDb;
  }

  public set sensitivityDb(value: number) {
    this.options.sensitivityDb = value;
  }

  public set ambientLevel(value: number) {
    this.options.ambientLevel = Math.max(0, Math.min(100, value));
  }

  public get ambientLevel(): number {
    return this.options.ambientLevel;
  }

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.callbacks.onPermissionChange?.(true);
    } catch (error) {
      console.warn('[MicLevel] Failed to obtain microphone access', error);
      this.callbacks.onPermissionChange?.(false);
      throw error;
    }

    this.context = new AudioContext();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.options.fftSize;
    this.analyser.smoothingTimeConstant = 0.0;

    this.source.connect(this.analyser);

    const bufferLength = this.analyser.fftSize;
    this.dataArray = new Float32Array(bufferLength);
    this.running = true;
    this.levelEma = 0;
    this.aboveThresholdFrames = 0;
    this.belowThresholdFrames = 0;

    const updateInterval = 1000 / this.options.frameRate;
    this.intervalId = window.setInterval(() => this.sample(), updateInterval);
  }

  public stop(): void {
    if (!this.running) {
      return;
    }

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.running = false;
    this.levelEma = 0;
    this.setVad(false);

    this.analyser?.disconnect();
    this.source?.disconnect();

    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;

    this.context?.close();
    this.context = null;
  }

  public destroy(): void {
    this.stop();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  public async calibrate(durationMs = 2000): Promise<void> {
    if (!this.running) {
      await this.start();
    }

    const samples: number[] = [];
    const start = performance.now();

    return new Promise((resolve) => {
      const collect = () => {
        const now = performance.now();
        if (now - start >= durationMs) {
          const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
          this.options.ambientLevel = Math.min(100, Math.max(0, avg));
          if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
          }
          resolve();
          return;
        }
        const db = this.sampleInstantDb();
        samples.push(this.mapDbToScalar(db));
        this.rafId = window.requestAnimationFrame(collect);
      };
      collect();
    });
  }

  private sample(): void {
    const db = this.sampleInstantDb();
    const clampedDb = Math.max(LEVEL_MIN_DB, Math.min(LEVEL_MAX_DB, db));

    const normalized = this.mapDbToScalar(clampedDb);
    const compensated = Math.max(0, normalized - this.options.ambientLevel);
    this.levelEma = this.options.smoothing * compensated + (1 - this.options.smoothing) * this.levelEma;
    const levelToSend = Math.round(this.levelEma);

    this.updateVad(clampedDb);

    const shouldEmit = !this.options.pushToTalk || this.pushToTalkHeld;
    if (shouldEmit) {
      this.callbacks.onLevel?.(levelToSend);
      this.lastLevelSent = levelToSend;
    } else if (this.lastLevelSent !== 0) {
      this.lastLevelSent = 0;
      this.callbacks.onLevel?.(0);
    }
  }

  private sampleInstantDb(): number {
    if (!this.analyser) {
      return LEVEL_MIN_DB;
    }
    this.analyser.getFloatTimeDomainData(this.dataArray);

    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i += 1) {
      const value = this.dataArray[i];
      sumSquares += value * value;
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length) || 0;
    const db = 20 * Math.log10(rms || 1e-8);
    return Math.max(LEVEL_MIN_DB, Math.min(LEVEL_MAX_DB, db));
  }

  private updateVad(db: number): void {
    const isAbove = db >= this.options.sensitivityDb;
    if (isAbove) {
      this.aboveThresholdFrames += 1;
      this.belowThresholdFrames = 0;
      const holdFrames = Math.max(1, Math.round((this.options.vadHoldMs / 1000) * this.options.frameRate));
      if (!this.vadActive && this.aboveThresholdFrames >= holdFrames) {
        this.setVad(true);
      }
    } else {
      this.belowThresholdFrames += 1;
      this.aboveThresholdFrames = 0;
      const releaseFrames = Math.max(1, Math.round((this.options.vadReleaseMs / 1000) * this.options.frameRate));
      if (this.vadActive && this.belowThresholdFrames >= releaseFrames) {
        this.setVad(false);
      }
    }
  }

  private setVad(active: boolean): void {
    if (this.vadActive === active) {
      return;
    }
    this.vadActive = active;
    this.callbacks.onVadChange?.(active);
  }

  private mapDbToScalar(db: number): number {
    const normalized = (db - LEVEL_MIN_DB) / (LEVEL_MAX_DB - LEVEL_MIN_DB);
    const curved = Math.pow(Math.max(0, Math.min(1, normalized)), 0.5);
    return Math.round(curved * 100);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.options.pushToTalk) {
      return;
    }
    if (event.key.toLowerCase() === 'v') {
      this.pushToTalkHeld = true;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.options.pushToTalk) {
      return;
    }
    if (event.key.toLowerCase() === 'v') {
      this.pushToTalkHeld = false;
    }
  }
}
