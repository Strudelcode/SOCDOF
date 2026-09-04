/**
 * Web Audio API SoundEngine
 * Generates purely synthetic audio without external audio files.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = true;
  private volume: number = 0.8;

  constructor() {
    // Read mute preference and master volume from localStorage
    try {
      const saved = localStorage.getItem('odoo_sound_muted');
      if (saved !== null) {
        this.muted = saved === 'true';
      } else {
        this.muted = true;
      }
      const savedVol = localStorage.getItem('socdof_sound_volume');
      if (savedVol !== null) {
        const v = parseFloat(savedVol);
        if (!isNaN(v)) {
          this.volume = Math.max(0, Math.min(1, v));
        }
      }
    } catch {
      this.muted = true;
      this.volume = 0.8;
    }
  }

  private initContext(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.ctx && !this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private getDestination(ctx: AudioContext): AudioNode {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    try {
      localStorage.setItem('odoo_sound_muted', String(mute));
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    try {
      localStorage.setItem('socdof_sound_volume', String(clamped));
    } catch {
      // ignore
    }
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
      } catch {
        // ignore
      }
    }
  }

  /**
   * 1. Click-Sound: Clean short sine wave (1000Hz -> 800Hz, ~0.05s)
   */
  public playClick() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1050, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.045);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // ignore audio errors
    }
  }

  /**
   * 1b. Pop / Snap Sound for desktop icon drop (warm soft wooden pop)
   */
  public playPop() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // ignore
    }
  }

  /**
   * 2. Success/Save-Sound: Ascending 3-tone arpeggio (C5 -> E5 -> G5/C6)
   */
  public playSuccess() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const noteLength = 0.06;

      notes.forEach((freq, index) => {
        const noteTime = now + index * noteLength;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + noteLength + 0.08);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(noteTime);
        osc.stop(noteTime + noteLength + 0.09);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 3. Kaching-Sound (Invoice Paid): Metallic coin resonance + chime chord
   */
  public playKaching() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Synthetic coin metallic noise burst (filtered buffer)
      const bufferSize = ctx.sampleRate * 0.12;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.Q.setValueAtTime(6, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.getDestination(ctx));

      whiteNoise.start(now);

      // 2. High metallic chime chord (B5, E6, G#6)
      const chimes = [987.77, 1318.51, 1661.22, 2093.0];
      chimes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const chimeGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.01, now + 0.5);

        chimeGain.gain.setValueAtTime(0, now + 0.04);
        chimeGain.gain.linearRampToValueAtTime(0.1 / (idx + 1), now + 0.07);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + idx * 0.05);

        osc.connect(chimeGain);
        chimeGain.connect(this.getDestination(ctx));

        osc.start(now + 0.04);
        osc.stop(now + 0.65);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 4. Error-Sound: Deep descending sawtooth wave
   */
  public playError() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.28);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(200, now + 0.28);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.32);
    } catch {
      // ignore
    }
  }

  /**
   * 5. Mail Sent Sound: Soft pleasant swoosh
   */
  public playSend() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // ignore
    }
  }

  /**
   * 6. Barcode Scanner Beep
   */
  public playBarcodeBeep() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // ignore
    }
  }

  /**
   * 7. Odoo Startup Chime
   */
  public playStartup() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.55);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 8. Window Open Sound (Windows OS swoop)
   */
  public playWindowOpen() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore
    }
  }

  /**
   * 8b. Notification Chime (Kitchen order, alert)
   */
  public playNotification() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [659.25, 880]; // E5 -> A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.09;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.35);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 9. Window Close / Minimize Sound
   */
  public playWindowClose() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.1);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // ignore
    }
  }

  /**
   * 10. Warning / Alert Sound (Dual tone chime)
   */
  public playWarning() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [800, 600].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.1;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 11. Delete / Trash Sound (Filtered downward sweep)
   */
  public playDelete() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // ignore
    }
  }

  /**
   * 12. Photo Upload / Shutter Click
   */
  public playPhotoUpload() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.05);

      // Second shutter click
      setTimeout(() => {
        if (!this.ctx || this.muted) return;
        const now2 = this.ctx.currentTime;
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1800, now2);
        gain2.gain.setValueAtTime(0.07, now2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.05);
        osc2.connect(gain2);
        gain2.connect(this.getDestination(this.ctx));
        osc2.start(now2);
        osc2.stop(now2 + 0.06);
      }, 70);
    } catch {
      // ignore
    }
  }

  /**
   * 13. Import Success Sound (Blip & high ping)
   */
  public playImport() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [659.25, 880, 1318.51]; // E5, A5, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.05;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.13);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 14. Windows Shutdown Sound: Warm descending harmony (G#5 -> E5 -> C#5 -> A4)
   */
  public playShutdown() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [830.61, 659.25, 554.37, 440.0];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.98, start + 0.6);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.7);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 15. App Store Install / Activate Sound
   */
  public playInstall() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880, 1108.73];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.04;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 16. Payment Success (Cash Register & Chime Fanfare):
   * Sparkling metallic coin impact followed by an ascending pentatonic arpeggio (C5, E5, G5, C6, E6)
   */
  public playPaymentSuccess() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Initial metallic coin burst
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3600, now);
      filter.Q.setValueAtTime(8, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.getDestination(ctx));
      noise.start(now);

      // 2. Ascending bright chord arpeggio (C5, E5, G5, C6, E6)
      const arpeggio = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      arpeggio.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + 0.03 + idx * 0.055;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.linearRampToValueAtTime(0.14 / (1 + idx * 0.15), noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.45 + idx * 0.04);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(noteStart);
        osc.stop(noteStart + 0.55);
      });

      // 3. Sustained soft shimmer tone (G6)
      const shimmerOsc = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      const shimmerStart = now + 0.25;
      shimmerOsc.type = 'triangle';
      shimmerOsc.frequency.setValueAtTime(1567.98, shimmerStart);
      shimmerGain.gain.setValueAtTime(0.001, shimmerStart);
      shimmerGain.gain.linearRampToValueAtTime(0.05, shimmerStart + 0.05);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, shimmerStart + 0.55);
      shimmerOsc.connect(shimmerGain);
      shimmerGain.connect(this.getDestination(ctx));
      shimmerOsc.start(shimmerStart);
      shimmerOsc.stop(shimmerStart + 0.6);
    } catch {
      // ignore
    }
  }

  /**
   * 17. Contactless / NFC Tap: Crisp double beep with slight haptic resonance
   */
  public playNfcTap() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [1800, 2400].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.065;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.05);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 18. Cash Drawer Kick / Slide: Mechanical bass slide and spring latch
   */
  public playCashDrawer() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Bass mechanical thud
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(120, now);
      bassOsc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      bassGain.gain.setValueAtTime(0.2, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      bassOsc.connect(bassGain);
      bassGain.connect(this.getDestination(ctx));
      bassOsc.start(now);
      bassOsc.stop(now + 0.15);

      // Roller sweep noise
      const bufferSize = ctx.sampleRate * 0.14;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.linearRampToValueAtTime(400, now + 0.14);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.getDestination(ctx));
      noise.start(now);

      // Final latch snap
      setTimeout(() => {
        if (!this.ctx || this.muted) return;
        const now2 = this.ctx.currentTime;
        const snap = this.ctx.createOscillator();
        const snapGain = this.ctx.createGain();
        snap.type = 'square';
        snap.frequency.setValueAtTime(950, now2);
        snap.frequency.exponentialRampToValueAtTime(250, now2 + 0.03);
        snapGain.gain.setValueAtTime(0.12, now2);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now2 + 0.04);
        snap.connect(snapGain);
        snapGain.connect(this.getDestination(this.ctx));
        snap.start(now2);
        snap.stop(now2 + 0.05);
      }, 90);
    } catch {
      // ignore
    }
  }

  /**
   * 19. Pure Coin Clink: Dual bright silver coin ringing
   */
  public playCoinClink() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const coins = [3950, 4400];
      coins.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.035;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 20. Service / Counter Bell: Solid brass desk bell with harmonic ringdown
   */
  public playBell() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Fundamental + overtones
      const freqs = [2093, 3136, 4186];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const initialVol = idx === 0 ? 0.16 : 0.06 / idx;
        gain.gain.setValueAtTime(initialVol, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.85);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(now);
        osc.stop(now + 0.9);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 21. Cloud / Calendar Sync Completed: Calm spatial confirmation
   */
  public playSyncComplete() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [587.33, 880]; // D5 -> A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 22. Celebration Fanfare: Daily goal / milestone achieved
   */
  public playCelebration() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const fanfare = [349.23, 440.0, 523.25, 698.46]; // F4, A4, C5, F5
      fanfare.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.13, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.6);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 23. Lock Workstation / Secure Vault Sound
   */
  public playLock() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [850, 600].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.045;

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(200, start + 0.035);

        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.05);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 24. Unlock Workstation Sound
   */
  public playUnlock() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [500, 950].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.045;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(start);
        osc.stop(start + 0.06);
      });
    } catch {
      // ignore
    }
  }

  /**
   * 25. Trash Empty / Document Shred Sound
   */
  public playTrashEmpty() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.18;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.18);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.14, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.getDestination(ctx));

      noise.start(now);
    } catch {
      // ignore
    }
  }

  // Convenience Aliases
  public playNfcBeep() {
    this.playNfcTap();
  }

  public playKaChing() {
    this.playKaching();
  }

  public playCalendarSync() {
    this.playSyncComplete();
  }

  public playFanfare() {
    this.playCelebration();
  }

  public playSendInvoice() {
    this.playSend();
  }
}

export const sounds = new SoundEngine();

