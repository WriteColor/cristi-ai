/**
 * Cristi AI - Adaptive Kinematic Ticker
 * 
 * Intelligent FPS regulator:
 * - 60 FPS during direct user interaction, cursor movement, or voice playback.
 * - Adaptive drop to 30 FPS after 4.5 seconds of user/voice inactivity (~65% GPU saving).
 * - 0 FPS (complete stop) when the window is hidden, minimized, or in boss-key mode.
 */

import * as PIXI from 'pixi.js';

export type FpsMode = 'active_60' | 'idle_30' | 'idle_8' | 'suspended_0';

export interface AdaptiveTickerOptions {
  /** Target FPS during active interactions (default: 60) */
  activeFps?: number;
  /** Target FPS during idle resting state (default: 30) */
  idleFps?: number;
  /** Inactivity duration before dropping from active to idle in ms (default: 4500) */
  inactivityThresholdMs?: number;
  /** Automatically hook DOM pointer/mouse events to detect activity (default: true) */
  autoListenDom?: boolean;
  /** DOM element to listen on (default: window) */
  targetElement?: HTMLElement | Window | null;
  /** Callback fired whenever the FPS regulation mode changes */
  onFpsModeChange?: (mode: FpsMode, targetFps: number) => void;
}

export class AdaptiveTicker {
  private activeFps: number;
  private idleFps: number;
  private inactivityThresholdMs: number;
  private autoListenDom: boolean;
  private targetElement: HTMLElement | Window | null;
  private onFpsModeChange?: (mode: FpsMode, targetFps: number) => void;

  private lastActivityTime: number = performance.now();
  private isInteracting: boolean = false;
  private isVoicePlaying: boolean = false;
  private isBossKey: boolean = false;
  private isWindowHidden: boolean = false;

  private currentMode: FpsMode = 'active_60';
  private currentFps: number = 60;
  private pixiTicker: PIXI.Ticker | null = null;
  private checkIntervalId: ReturnType<typeof setInterval> | null = null;
  private domCleanupFns: Array<() => void> = [];

  constructor(options: AdaptiveTickerOptions = {}) {
    this.activeFps = Math.max(1, options.activeFps ?? 60);
    this.idleFps = Math.max(1, options.idleFps ?? 30);
    this.inactivityThresholdMs = Math.max(500, options.inactivityThresholdMs ?? 4500);
    this.autoListenDom = options.autoListenDom ?? true;
    this.targetElement = options.targetElement ?? (typeof window !== 'undefined' ? window : null);
    this.onFpsModeChange = options.onFpsModeChange;

    this.currentFps = this.activeFps;
    this.isWindowHidden = typeof document !== 'undefined' && document.hidden;

    if (this.autoListenDom && typeof window !== 'undefined') {
      this.attachDomListeners();
    }

    // Interval to check inactivity transitions
    this.startInactivityChecker();
  }

  /**
   * Attach a PIXI.Ticker instance to govern.
   */
  public attachTicker(ticker: PIXI.Ticker): void {
    this.pixiTicker = ticker;
    this.evaluate();
  }

  /**
   * Detach the PIXI.Ticker instance.
   */
  public detachTicker(): void {
    this.pixiTicker = null;
  }

  /**
   * Signal user activity to immediately restore 60 FPS.
   */
  public reportActivity(_source: string = 'user'): void {
    this.lastActivityTime = performance.now();
    this.evaluate();
  }

  /**
   * Mark active user interaction (drag, pointer down, click).
   * Forces 60 FPS while active.
   */
  public setInteracting(interacting: boolean): void {
    if (this.isInteracting === interacting) return;
    this.isInteracting = interacting;
    if (interacting) {
      this.lastActivityTime = performance.now();
    }
    this.evaluate();
  }

  /**
   * Mark voice synthesis or audio playback active.
   * Forces 60 FPS during speech.
   */
  public setVoicePlaying(playing: boolean): void {
    if (this.isVoicePlaying === playing) return;
    this.isVoicePlaying = playing;
    if (playing) {
      this.lastActivityTime = performance.now();
    }
    this.evaluate();
  }

  /**
   * Set boss-key mode state (true = 0 FPS immediately).
   */
  public setBossKey(bossKey: boolean): void {
    if (this.isBossKey === bossKey) return;
    this.isBossKey = bossKey;
    this.evaluate();
  }

  /**
   * Set window visibility state (hidden = true -> 0 FPS).
   */
  public setWindowHidden(hidden: boolean): void {
    if (this.isWindowHidden === hidden) return;
    this.isWindowHidden = hidden;
    this.evaluate();
  }

  /**
   * Get current operating mode.
   */
  public getMode(): FpsMode {
    return this.currentMode;
  }

  /**
   * Get current target FPS.
   */
  public getCurrentFps(): number {
    return this.currentFps;
  }

  /**
   * Evaluate state transitions and apply target FPS.
   */
  public evaluate(): void {
    const now = performance.now();
    let nextMode: FpsMode;
    let nextFps: number;

    if (this.isBossKey || this.isWindowHidden) {
      nextMode = 'suspended_0';
      nextFps = 0;
    } else if (
      this.isInteracting ||
      this.isVoicePlaying ||
      now - this.lastActivityTime < this.inactivityThresholdMs
    ) {
      nextMode = 'active_60';
      nextFps = this.activeFps;
    } else if (now - this.lastActivityTime >= 30000) {
      nextMode = 'idle_8'; nextFps = 8;
    } else {
      nextMode = 'idle_30';
      nextFps = this.idleFps;
    }

    const changed = nextMode !== this.currentMode || nextFps !== this.currentFps;
    this.currentMode = nextMode;
    this.currentFps = nextFps;

    this.applyToTicker();

    if (changed) {
      this.onFpsModeChange?.(this.currentMode, this.currentFps);
    }
  }

  /**
   * Synchronize FPS setting to underlying PIXI Ticker.
   */
  private applyToTicker(): void {
    if (!this.pixiTicker) return;

    if (this.currentFps === 0) {
      if (this.pixiTicker.started) {
        this.pixiTicker.stop();
      }
    } else {
      this.pixiTicker.maxFPS = this.currentFps;
      if (!this.pixiTicker.started) {
        this.pixiTicker.start();
      }
    }
  }

  /**
   * Setup auto listeners for mouse/touch movements and window visibility.
   */
  private attachDomListeners(): void {
    const target = this.targetElement || window;

    let lastMoveReport = 0;
    const onMove = () => {
      const now = performance.now();
      // Throttle pointer activity reports to at most once per 100ms
      if (now - lastMoveReport > 100) {
        lastMoveReport = now;
        this.reportActivity('mousemove');
      }
    };

    const onPointerDown = () => {
      this.reportActivity('pointerdown');
    };

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        this.setWindowHidden(document.hidden);
      }
    };

    const onBlur = () => {
      // Background idle reduction when app loses focus
      this.evaluate();
    };

    const onFocus = () => {
      this.reportActivity('focus');
    };

    target.addEventListener('mousemove', onMove as EventListener, { passive: true });
    target.addEventListener('pointermove', onMove as EventListener, { passive: true });
    target.addEventListener('pointerdown', onPointerDown as EventListener, { passive: true });
    target.addEventListener('touchstart', onPointerDown as EventListener, { passive: true });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);
    }

    this.domCleanupFns.push(() => {
      target.removeEventListener('mousemove', onMove as EventListener);
      target.removeEventListener('pointermove', onMove as EventListener);
      target.removeEventListener('pointerdown', onPointerDown as EventListener);
      target.removeEventListener('touchstart', onPointerDown as EventListener);

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
      }
    });
  }

  /**
   * Periodic checker for idle threshold transition.
   */
  private startInactivityChecker(): void {
    if (this.checkIntervalId) return;

    this.checkIntervalId = setInterval(() => {
      // Only evaluate if we are currently in active mode and neither interacting nor voice playing
      if (this.currentMode !== 'suspended_0' && !this.isInteracting && !this.isVoicePlaying) {
        const now = performance.now();
        if (now - this.lastActivityTime >= this.inactivityThresholdMs) {
          this.evaluate();
        }
      }
    }, 500);
  }

  /**
   * Dispose ticker regulator and cleanup all listeners.
   */
  public destroy(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    for (const cleanup of this.domCleanupFns) {
      try {
        cleanup();
      } catch (_) {}
    }
    this.domCleanupFns = [];

    this.pixiTicker = null;
  }
}
