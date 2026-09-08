/**
 * Cristi AI - Live2D Kinematic Motion Controller
 * 
 * Manages dispatching of motion3 animation groups ('Idle', 'Tap', 'Flick', etc.),
 * priority levels, execution cooldowns, and speech sync across Cubism models.
 */

import type { Live2DModel } from 'pixi-live2d-display/cubism4';

export enum MotionPriority {
  IDLE = 1,
  NORMAL = 2,
  FORCE = 3,
}

export interface MotionEventPayload {
  group: string;
  index: number;
  priority: MotionPriority;
  modelId?: string;
  timestamp: number;
}

export interface MotionControllerOptions {
  /** Cooldown between consecutive normal-priority motions in ms (default: 1200) */
  cooldownMs?: number;
  /** Active model identifier */
  modelId?: string;
  /** Callback fired when a motion begins execution */
  onMotionStart?: (event: MotionEventPayload) => void;
  /** Callback fired when a motion finishes */
  onMotionComplete?: (event: MotionEventPayload) => void;
  /** Callback fired when a motion fails or is rejected */
  onMotionError?: (group: string, err: Error) => void;
}

export class MotionController {
  private model: Live2DModel | null = null;
  private modelId: string;
  private cooldownMs: number;
  private lastMotionTime: number = 0;
  private currentMotionGroup: string | null = null;

  private onMotionStart?: (event: MotionEventPayload) => void;
  private onMotionComplete?: (event: MotionEventPayload) => void;
  private onMotionError?: (group: string, err: Error) => void;

  constructor(options: MotionControllerOptions = {}) {
    this.modelId = options.modelId ?? 'yanderegirl';
    this.cooldownMs = options.cooldownMs ?? 1200;
    this.onMotionStart = options.onMotionStart;
    this.onMotionComplete = options.onMotionComplete;
    this.onMotionError = options.onMotionError;
  }

  /**
   * Bind an active Live2DModel instance.
   */
  public setModel(model: Live2DModel | null, modelId?: string): void {
    this.model = model;
    if (modelId) {
      this.modelId = modelId;
    }
    this.currentMotionGroup = null;
  }

  /**
   * Trigger a motion by group name and index.
   * @param group Motion group name as defined in model3.json (e.g., 'Idle', 'Tap', 'Flick')
   * @param index Index within the group (if omitted, a random motion from the group is played)
   * @param priority Motion priority (1: IDLE, 2: NORMAL, 3: FORCE)
   * @returns Promise resolving to true if motion started successfully, false otherwise
   */
  public async playMotion(
    group: string,
    index?: number,
    priority: MotionPriority = MotionPriority.NORMAL
  ): Promise<boolean> {
    if (!this.model) {
      return false;
    }

    const now = performance.now();
    if (priority < MotionPriority.FORCE && now - this.lastMotionTime < this.cooldownMs) {
      return false;
    }

    const resolvedIndex = index !== undefined ? index : 0;
    const eventPayload: MotionEventPayload = {
      group,
      index: resolvedIndex,
      priority,
      modelId: this.modelId,
      timestamp: now,
    };

    try {
      this.lastMotionTime = now;
      this.currentMotionGroup = group;
      this.onMotionStart?.(eventPayload);

      // Trigger motion through pixi-live2d-display model API
      const success = await this.model.motion(group, index, priority);

      if (success) {
        this.onMotionComplete?.(eventPayload);
      } else {
        this.currentMotionGroup = null;
      }

      return Boolean(success);
    } catch (err: any) {
      this.currentMotionGroup = null;
      const errorObj = err instanceof Error ? err : new Error(String(err));
      console.warn(`[MotionController] Error playing motion "${group}":`, errorObj);
      this.onMotionError?.(group, errorObj);
      return false;
    }
  }

  /**
   * Play idle breathing / stance motion.
   */
  public playIdle(index?: number): Promise<boolean> {
    return this.playMotion('Idle', index, MotionPriority.IDLE);
  }

  /**
   * Play interaction tap motion (e.g. Tap, Tap@Body).
   */
  public playTap(index: number = 0, isHead: boolean = false): Promise<boolean> {
    const group = isHead ? 'Tap' : 'Tap@Body';
    // Fallback to 'Tap' if 'Tap@Body' is not present in model
    const available = this.getAvailableMotionGroups();
    const targetGroup = available.includes(group) ? group : (available.includes('Tap') ? 'Tap' : 'Idle');
    return this.playMotion(targetGroup, index, MotionPriority.NORMAL);
  }

  /**
   * Play flick interaction motion.
   */
  public playFlick(index: number = 0): Promise<boolean> {
    const available = this.getAvailableMotionGroups();
    const group = available.includes('Flick') ? 'Flick' : (available.includes('Flick@Body') ? 'Flick@Body' : 'Idle');
    return this.playMotion(group, index, MotionPriority.NORMAL);
  }

  /**
   * Play flick down motion.
   */
  public playFlickDown(index: number = 0): Promise<boolean> {
    const available = this.getAvailableMotionGroups();
    const group = available.includes('FlickDown') ? 'FlickDown' : 'Idle';
    return this.playMotion(group, index, MotionPriority.NORMAL);
  }

  /**
   * Trigger speaking posture motion if defined in the model.
   */
  public playSpeechMotion(): Promise<boolean> {
    const available = this.getAvailableMotionGroups();
    for (const candidate of ['Talk', 'Speak', 'talk', 'speak']) {
      if (available.includes(candidate)) {
        return this.playMotion(candidate, 0, MotionPriority.IDLE);
      }
    }
    return Promise.resolve(false);
  }

  /**
   * Introspect model to retrieve all defined motion group names.
   */
  public getAvailableMotionGroups(): string[] {
    if (!this.model?.internalModel) return [];

    const internal = this.model.internalModel as any;

    // 1. Check settings motions
    if (internal.settings?.motions) {
      return Object.keys(internal.settings.motions);
    }

    // 2. Check motionManager definitions
    if (internal.motionManager?.definitions) {
      return Object.keys(internal.motionManager.definitions);
    }

    return [];
  }

  /**
   * Return number of animations inside a motion group.
   */
  public getMotionCount(group: string): number {
    if (!this.model?.internalModel) return 0;
    const internal = this.model.internalModel as any;

    const motions = internal.settings?.motions?.[group] || internal.motionManager?.definitions?.[group];
    return Array.isArray(motions) ? motions.length : 0;
  }

  /**
   * Stop all playing motions and restore neutral pose.
   */
  public stopAllMotions(): void {
    this.currentMotionGroup = null;
    if (this.model?.internalModel) {
      const internal = this.model.internalModel as any;
      try {
        internal.motionManager?.stopAllMotions?.();
      } catch (_) {}
    }
  }

  /**
   * Get currently playing motion group.
   */
  public getCurrentMotionGroup(): string | null {
    return this.currentMotionGroup;
  }

  /**
   * Destroy controller and release references.
   */
  public destroy(): void {
    this.stopAllMotions();
    this.model = null;
  }
}
