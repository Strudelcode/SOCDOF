// Synthetic Web Audio feedback, ported from `SOCDOF - TS/src/lib/sound.ts`.
// The restaurant uses the click, notification, success and cash-register sounds.
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = true;
  private volume = 0.8;

  constructor() {
    try {
      const saved = localStorage.getItem("odoo_sound_muted");
      this.muted = saved === null ? true : saved === "true";
      const savedVolume = localStorage.getItem("socdof_sound_volume");
      const parsed = savedVolume === null ? Number.NaN : Number.parseFloat(savedVolume);
      if (!Number.isNaN(parsed)) {
        this.volume = Math.max(0, Math.min(1, parsed));
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
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx?.state === "suspended") void this.ctx.resume();
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

  private destination(ctx: AudioContext): AudioNode {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem("odoo_sound_muted", String(muted));
    } catch {
      // localStorage can be unavailable in restricted webviews.
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) this.playClick();
    return this.muted;
  }

  playClick(): void {
    const ctx = this.initContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1050, now);
      oscillator.frequency.exponentialRampToValueAtTime(700, now + 0.045);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      oscillator.connect(gain);
      gain.connect(this.destination(ctx));
      oscillator.start(now);
      oscillator.stop(now + 0.05);
    } catch {
      // Audio is best effort.
    }
  }

  playSuccess(): void {
    const ctx = this.initContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const noteLength = 0.06;
      notes.forEach((frequency, index) => {
        const noteTime = now + index * noteLength;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, noteTime);
        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + noteLength + 0.08);
        oscillator.connect(gain);
        gain.connect(this.destination(ctx));
        oscillator.start(noteTime);
        oscillator.stop(noteTime + noteLength + 0.09);
      });
    } catch {
      // Audio is best effort.
    }
  }

  playKaching(): void {
    const ctx = this.initContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let index = 0; index < bufferSize; index += 1) {
        output[index] = (Math.random() * 2 - 1) * Math.exp(-index / (bufferSize * 0.25));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(3200, now);
      filter.Q.setValueAtTime(6, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.destination(ctx));
      noise.start(now);

      const chimes = [987.77, 1318.51, 1661.22, 2093.0];
      chimes.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now + 0.04);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.01, now + 0.5);
        chimeGain.gain.setValueAtTime(0, now + 0.04);
        chimeGain.gain.linearRampToValueAtTime(0.1 / (index + 1), now + 0.07);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + index * 0.05);
        oscillator.connect(chimeGain);
        chimeGain.connect(this.destination(ctx));
        oscillator.start(now + 0.04);
        oscillator.stop(now + 0.65);
      });
    } catch {
      // Audio is best effort.
    }
  }

  playNotification(): void {
    const ctx = this.initContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [659.25, 880];
      notes.forEach((frequency, index) => {
        const start = now + index * 0.09;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        oscillator.connect(gain);
        gain.connect(this.destination(ctx));
        oscillator.start(start);
        oscillator.stop(start + 0.35);
      });
    } catch {
      // Audio is best effort.
    }
  }
}

export const sounds = new SoundEngine();
