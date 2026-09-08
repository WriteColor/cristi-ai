/**
 * Cristi AI - Sound FX Service (Web Audio Procedural Synthesizer)
 * 
 * Responsibilities:
 * - Real-time procedural audio effects generator using Web Audio API.
 * - Zero external mp3/wav assets required (zero latency, zero memory leaks, instant startup).
 * - Implements requested sound effects: click, alert, open, confirm, plus tactile UI sounds.
 * - Independent master volume control & enable/disable state.
 * - Automatically disposes oscillators and gain nodes on sound completion.
 */

import type { SoundFxConfig, SoundFxName } from '@/types';

export class SoundFxService {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private enabled = true;
  private volume = 0.5; // Default 50%
  private maxGain = 0.3; // Calibrated ceiling to prevent clipping

  constructor(config?: SoundFxConfig) {
    if (typeof config?.enabled === 'boolean') {
      this.enabled = config.enabled;
    }
    if (typeof config?.volume === 'number') {
      this.setVolume(config.volume);
    }
  }

  /**
   * Toggle sound effects enabled state.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = Boolean(enabled);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set independent volume (0.0 to 1.0).
   */
  public setVolume(volume0to1: number): void {
    const clamped = Math.max(0, Math.min(1, Number(volume0to1) || 0));
    this.volume = clamped;

    if (this.masterGainNode && this.audioContext) {
      try {
        const now = this.audioContext.currentTime;
        this.masterGainNode.gain.cancelScheduledValues(now);
        this.masterGainNode.gain.setValueAtTime(this.volume * this.maxGain, now);
      } catch (_) {}
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Generic dispatcher to play any registered sound effect by name.
   */
  public play(name: SoundFxName, options?: { volume?: number }): void {
    if (!this.enabled) return;

    switch (name) {
      case 'click':
        this.playClick(options);
        break;
      case 'alert':
        this.playAlert(options);
        break;
      case 'open':
      case 'menu_open':
        this.playOpen(options);
        break;
      case 'confirm':
        this.playConfirm(options);
        break;
      case 'connect':
        this.playConnect(options);
        break;
      case 'disconnect':
        this.playDisconnect(options);
        break;
      case 'snapshot':
        this.playSnapshot(options);
        break;
      case 'notification':
        this.playNotification(options);
        break;
      case 'error':
        this.playError(options);
        break;
      case 'mute':
        this.playMuteToggle(true, options);
        break;
      default:
        this.playClick(options);
        break;
    }
  }

  /**
   * Subtle crisp UI click blip (8-20ms sine pitch sweep).
   */
  public playClick(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.02);

      gain.gain.setValueAtTime(0.12 * volMultiplier, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.masterGainNode!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(now);
      osc.stop(now + 0.03);
    } catch (_) {}
  }

  /**
   * Attention-grabbing cybernetic alert (pulsed two-tone warble).
   */
  public playAlert(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      osc.type = 'sawtooth';
      // Fast two-tone alternation (880Hz <-> 1174Hz)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174, now + 0.07);
      osc.frequency.setValueAtTime(880, now + 0.14);
      osc.frequency.setValueAtTime(1174, now + 0.21);

      gain.gain.setValueAtTime(0.15 * volMultiplier, now);
      gain.gain.setValueAtTime(0.12 * volMultiplier, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(this.masterGainNode!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (_) {}
  }

  /**
   * Menu or panel opening chime (harmonic triple chord C5-E5-G5).
   */
  public playOpen(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5 triad
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.02);

        gain.gain.setValueAtTime(0.08 * volMultiplier, now + idx * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.02 + 0.14);

        osc.connect(gain);
        gain.connect(this.masterGainNode!);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (_) {}
        };

        osc.start(now + idx * 0.02);
        osc.stop(now + idx * 0.02 + 0.16);
      });
    } catch (_) {}
  }

  /**
   * Affirmative success confirmation chime (bright two-note ascending major interval).
   */
  public playConfirm(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, start: 0.00, dur: 0.10 }, // C5
        { freq: 659.25, start: 0.07, dur: 0.18 }  // E5
      ];
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.12 * volMultiplier, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(this.masterGainNode!);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (_) {}
        };

        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      });
    } catch (_) {}
  }

  /**
   * Menu open chime.
   */
  public playMenuOpen(options?: { volume?: number }): void {
    this.playOpen(options);
  }

  /**
   * Connection established chime (ascending cyber glide).
   */
  public playConnect(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

      gain.gain.setValueAtTime(0.15 * volMultiplier, now);
      gain.gain.linearRampToValueAtTime(0.2 * volMultiplier, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGainNode!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  }

  /**
   * Alias for connected sound.
   */
  public playConnectedBleep(options?: { volume?: number }): void {
    this.playConnect(options);
  }

  /**
   * Disconnection chime (descending tone).
   */
  public playDisconnect(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);

      gain.gain.setValueAtTime(0.12 * volMultiplier, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

      osc.connect(gain);
      gain.connect(this.masterGainNode!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_) {}
  }

  /**
   * Mute toggle audio feedback.
   */
  public playMuteToggle(isMuted: boolean, options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      osc.type = 'sine';
      if (isMuted) {
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.setValueAtTime(320, now + 0.06);
      } else {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(480, now + 0.06);
      }

      gain.gain.setValueAtTime(0.1 * volMultiplier, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGainNode!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_) {}
  }

  /**
   * Vision snapshot shutter chirp.
   */
  public playSnapshot(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.08);

      gain.gain.setValueAtTime(0.15 * volMultiplier, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGainNode!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(now);
      osc.stop(now + 0.14);
    } catch (_) {}
  }

  /**
   * Glass bell reminder/notification chime.
   */
  public playNotification(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [880, 1318.5]; // A5 + E6 crystal interval
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.1 * volMultiplier, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGainNode!);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (_) {}
        };

        osc.start(now);
        osc.stop(now + 0.30);
      });
    } catch (_) {}
  }

  /**
   * Low-frequency error thud.
   */
  public playError(options?: { volume?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volMultiplier = typeof options?.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(75, now + 0.18);

      gain.gain.setValueAtTime(0.18 * volMultiplier, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGainNode!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  }

  /**
   * Lazy context and master gain initialization.
   */
  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;

    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;

      try {
        this.audioContext = new AudioContextClass();
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.gain.setValueAtTime(this.volume * this.maxGain, this.audioContext.currentTime);
        this.masterGainNode.connect(this.audioContext.destination);
      } catch (err) {
        console.warn('[SoundFxService] Failed to create AudioContext:', err);
        return null;
      }
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    return this.audioContext;
  }

  /**
   * Get status for telemetry.
   */
  public getStatus(): {
    enabled: boolean;
    volume: number;
    contextState: string | null;
  } {
    return {
      enabled: this.enabled,
      volume: this.volume,
      contextState: this.audioContext?.state || null
    };
  }

  /**
   * Clean up all audio nodes and context.
   */
  public destroy(): void {
    if (this.masterGainNode) {
      try {
        this.masterGainNode.disconnect();
      } catch (_) {}
      this.masterGainNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
  }
}

export const soundFxService = new SoundFxService();
export default soundFxService;
