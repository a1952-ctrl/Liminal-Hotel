import { MicHudCallbacks } from '../net/NetClient';

export class HudMicIndicator implements MicHudCallbacks {
  private root: HTMLElement;
  private barFill: HTMLElement;
  private status: HTMLElement;
  private active = false;
  private pttEnabled = false;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'hud-mic-indicator';

    const bar = document.createElement('div');
    bar.className = 'hud-mic-bar';

    this.barFill = document.createElement('div');
    this.barFill.className = 'hud-mic-bar-fill';
    bar.appendChild(this.barFill);

    this.status = document.createElement('span');
    this.status.className = 'hud-mic-status';
    this.status.textContent = 'MIC OFF';

    this.root.appendChild(bar);
    this.root.appendChild(this.status);
  }

  public mount(container: HTMLElement): void {
    container.appendChild(this.root);
  }

  public onLevelChange(level: number): void {
    this.barFill.style.width = `${level}%`;
  }

  public onVad(active: boolean): void {
    this.active = active;
    this.status.textContent = active ? 'VOICE' : this.pttEnabled ? 'MIC PTT' : 'MIC ON';
    this.root.classList.toggle('speaking', active);
  }

  public onMicActive(active: boolean): void {
    this.status.textContent = active ? (this.pttEnabled ? 'MIC PTT' : 'MIC ON') : 'MIC OFF';
    this.root.classList.toggle('enabled', active);
    if (!active) {
      this.onLevelChange(0);
    }
  }

  public onPushToTalkChange(enabled: boolean): void {
    this.pttEnabled = enabled;
    this.status.textContent = this.pttEnabled ? 'MIC PTT' : this.active ? 'VOICE' : 'MIC ON';
    this.root.classList.toggle('ptt', enabled);
  }
}
