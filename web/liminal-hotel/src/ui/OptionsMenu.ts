import { NetClient } from '../net/NetClient';

interface OptionsMenuState {
  micEnabled: boolean;
  pushToTalk: boolean;
  sensitivityDb: number;
  ambientLevel: number;
}

const SESSION_KEY = 'liminal-hotel-options';

export class OptionsMenu {
  private root: HTMLElement;
  private toggle: HTMLInputElement;
  private pttToggle: HTMLInputElement;
  private sensitivity: HTMLInputElement;
  private calibrateButton: HTMLButtonElement;
  private micWarning: HTMLElement;
  private state: OptionsMenuState;

  constructor(private netClient: NetClient) {
    this.root = document.createElement('div');
    this.root.className = 'options-menu';

    this.state = this.loadState();

    const micSection = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = 'Privacy';
    micSection.appendChild(heading);

    const toggleLabel = document.createElement('label');
    toggleLabel.textContent = 'Microphone';
    this.toggle = document.createElement('input');
    this.toggle.type = 'checkbox';
    this.toggle.checked = this.state.micEnabled;
    toggleLabel.appendChild(this.toggle);

    const pttLabel = document.createElement('label');
    pttLabel.textContent = 'Push-to-Talk (V)';
    this.pttToggle = document.createElement('input');
    this.pttToggle.type = 'checkbox';
    this.pttToggle.checked = this.state.pushToTalk;
    pttLabel.appendChild(this.pttToggle);

    const sensitivityLabel = document.createElement('label');
    sensitivityLabel.textContent = 'Sensitivity (dB)';
    this.sensitivity = document.createElement('input');
    this.sensitivity.type = 'range';
    this.sensitivity.min = '-90';
    this.sensitivity.max = '-10';
    this.sensitivity.step = '1';
    this.sensitivity.value = String(this.state.sensitivityDb);
    sensitivityLabel.appendChild(this.sensitivity);

    this.calibrateButton = document.createElement('button');
    this.calibrateButton.textContent = 'Calibrate';

    this.micWarning = document.createElement('p');
    this.micWarning.className = 'mic-warning';
    this.micWarning.textContent = 'Microphone OFF';

    micSection.appendChild(toggleLabel);
    micSection.appendChild(pttLabel);
    micSection.appendChild(sensitivityLabel);
    micSection.appendChild(this.calibrateButton);
    micSection.appendChild(this.micWarning);

    this.root.appendChild(micSection);

    this.bindEvents();
    this.applyState();
  }

  public mount(container: HTMLElement): void {
    container.appendChild(this.root);
  }

  private bindEvents(): void {
    this.toggle.addEventListener('change', () => {
      this.state.micEnabled = this.toggle.checked;
      this.persist();
      if (this.state.micEnabled) {
        void this.netClient.enableMic();
      } else {
        this.netClient.disableMic();
      }
      this.updateWarning();
    });

    this.pttToggle.addEventListener('change', () => {
      this.state.pushToTalk = this.pttToggle.checked;
      this.netClient.setPushToTalk(this.state.pushToTalk);
      this.persist();
      this.updateWarning();
    });

    this.sensitivity.addEventListener('input', () => {
      const db = Number(this.sensitivity.value);
      this.state.sensitivityDb = db;
      this.netClient.setSensitivity(db);
      this.persist();
    });

    this.calibrateButton.addEventListener('click', () => {
      void this.netClient.calibrateMic().then(() => {
        this.state.ambientLevel = this.netClient.getAmbientLevel();
        this.persist();
        this.micWarning.textContent = 'Calibration complete';
        window.setTimeout(() => this.updateWarning(), 2000);
      });
    });
  }

  private applyState(): void {
    this.toggle.checked = this.state.micEnabled;
    this.pttToggle.checked = this.state.pushToTalk;
    this.sensitivity.value = String(this.state.sensitivityDb);

    this.netClient.setPushToTalk(this.state.pushToTalk);
    this.netClient.setSensitivity(this.state.sensitivityDb);
    this.netClient.setAmbientLevel(this.state.ambientLevel);

    if (this.state.micEnabled) {
      void this.netClient.enableMic();
    } else {
      this.netClient.disableMic();
    }
    this.updateWarning();
  }

  private updateWarning(): void {
    if (this.state.micEnabled) {
      this.micWarning.textContent = this.state.pushToTalk
        ? 'Microphone active (Push-to-Talk) – only loudness is shared'
        : 'Microphone active – only loudness is shared';
      this.micWarning.classList.add('active');
    } else {
      this.micWarning.textContent = 'Microphone OFF';
      this.micWarning.classList.remove('active');
    }
  }

  private loadState(): OptionsMenuState {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<OptionsMenuState>;
        return {
          micEnabled: parsed.micEnabled ?? false,
          pushToTalk: parsed.pushToTalk ?? false,
          sensitivityDb: parsed.sensitivityDb ?? -50,
          ambientLevel: parsed.ambientLevel ?? 0,
        };
      }
    } catch (error) {
      console.warn('Failed to load options state', error);
    }
    return {
      micEnabled: false,
      pushToTalk: false,
      sensitivityDb: -50,
      ambientLevel: 0,
    };
  }

  private persist(): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn('Failed to persist options', error);
    }
  }
}
