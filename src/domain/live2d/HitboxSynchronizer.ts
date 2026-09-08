/**
 * Cristi AI - Hitbox Synchronizer for Live2D & Electron Click-Through
 * 
 * Accurately maps the Live2D model PIXI bounding box (model.getBounds())
 * to the HTML/CSS interactive hit target container (.live2d-hit-target)
 * using real viewport coordinates for seamless selective click-through with Electron.
 */

import * as PIXI from 'pixi.js';
import type { Live2DModel } from 'pixi-live2d-display/cubism4';

export interface HitboxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HitboxSynchronizerOptions {
  /** CSS selector for the interactive target container (default: '.live2d-hit-target') */
  targetSelector?: string;
  /** Explicit HTMLElement target if selector is not used */
  targetElement?: HTMLElement | null;
  /** Hitbox identifier for Electron registration (default: 'live2d') */
  hitboxId?: string;
  /** Minimum dimension in pixels to consider valid (default: 10) */
  minDimension?: number;
  /** Clamp bounding box within window/viewport bounds (default: true) */
  clampToViewport?: boolean;
  /** Optional callback fired when hitbox bounds update */
  onHitboxUpdated?: (rect: HitboxRect) => void;
  /** Optional callback fired when hitbox is cleared */
  onHitboxCleared?: () => void;
}

export class HitboxSynchronizer {
  private targetSelector: string;
  private targetElement: HTMLElement | null = null;
  private hitboxId: string;
  private minDimension: number;
  private clampToViewport: boolean;
  private onHitboxUpdated?: (rect: HitboxRect) => void;
  private onHitboxCleared?: () => void;

  private isEnabled: boolean = true;
  private lastSyncedRect: HitboxRect | null = null;

  constructor(options: HitboxSynchronizerOptions = {}) {
    this.targetSelector = options.targetSelector ?? '.live2d-hit-target';
    this.targetElement = options.targetElement ?? null;
    this.hitboxId = options.hitboxId ?? 'live2d';
    this.minDimension = options.minDimension ?? 10;
    this.clampToViewport = options.clampToViewport ?? true;
    this.onHitboxUpdated = options.onHitboxUpdated;
    this.onHitboxCleared = options.onHitboxCleared;
  }

  /**
   * Set or update target DOM element.
   */
  public setTargetElement(element: HTMLElement | null): void {
    this.targetElement = element;
    if (element && this.lastSyncedRect) {
      this.applyStyles(element, this.lastSyncedRect);
    }
  }

  /**
   * Resolve DOM element via targetElement or CSS selector query.
   */
  public resolveTargetElement(): HTMLElement | null {
    if (this.targetElement && document.contains(this.targetElement)) {
      return this.targetElement;
    }
    if (typeof document !== 'undefined' && this.targetSelector) {
      this.targetElement = document.querySelector<HTMLElement>(this.targetSelector);
    }
    return this.targetElement;
  }

  /**
   * Enable or disable hitbox synchronization.
   */
  public setEnabled(enabled: boolean): void {
    if (this.isEnabled === enabled) return;
    this.isEnabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Compute exact viewport hitbox from Live2D model and synchronize with DOM and Electron.
   */
  public sync(model: Live2DModel | null, app: PIXI.Application | null): HitboxRect | null {
    if (!this.isEnabled || !model || !app?.screen) {
      return null;
    }

    try {
      // In PIXI v7 with autoDensity: true, getBounds() corresponds 1:1 to CSS pixels
      const bounds = model.getBounds();
      if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
        return null;
      }

      if (bounds.width < this.minDimension || bounds.height < this.minDimension) {
        return null;
      }

      const screenW = app.screen.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
      const screenH = app.screen.height || (typeof window !== 'undefined' ? window.innerHeight : 1080);

      const rawX = Math.round(bounds.x);
      const rawY = Math.round(bounds.y);
      const rawW = Math.round(bounds.width);
      const rawH = Math.round(bounds.height);

      let rect: HitboxRect;

      if (this.clampToViewport) {
        const clampedX = Math.max(0, rawX);
        const clampedY = Math.max(0, rawY);
        const clampedW = Math.max(0, Math.min(rawW, screenW - clampedX));
        const clampedH = Math.max(0, Math.min(rawH, screenH - clampedY));

        if (clampedW < this.minDimension || clampedH < this.minDimension) {
          return null;
        }

        rect = {
          x: clampedX,
          y: clampedY,
          width: clampedW,
          height: clampedH,
        };
      } else {
        rect = {
          x: rawX,
          y: rawY,
          width: rawW,
          height: rawH,
        };
      }

      // Dirty check to prevent DOM reflow thrashing if unchanged
      if (
        this.lastSyncedRect &&
        Math.abs(this.lastSyncedRect.x - rect.x) < 1 &&
        Math.abs(this.lastSyncedRect.y - rect.y) < 1 &&
        Math.abs(this.lastSyncedRect.width - rect.width) < 1 &&
        Math.abs(this.lastSyncedRect.height - rect.height) < 1
      ) {
        return this.lastSyncedRect;
      }

      this.lastSyncedRect = rect;

      // Apply coordinates to target DOM container
      const targetEl = this.resolveTargetElement();
      if (targetEl) {
        this.applyStyles(targetEl, rect);
      }

      // Sync with Electron click-through selective bridge
      this.syncElectronHitbox(rect);

      this.onHitboxUpdated?.(rect);
      return rect;
    } catch (err) {
      console.warn('[HitboxSynchronizer] Error calculating model bounds:', err);
      return null;
    }
  }

  /**
   * Apply exact CSS coordinates to HTML hitbox container.
   */
  private applyStyles(element: HTMLElement, rect: HitboxRect): void {
    element.style.position = 'absolute';
    element.style.left = `${rect.x}px`;
    element.style.top = `${rect.y}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.pointerEvents = 'auto';
  }

  /**
   * Register with Electron click-through service if available in runtime.
   */
  private syncElectronHitbox(rect: HitboxRect): void {
    if (typeof window === 'undefined') return;

    // Check for electron bridge or click-through service on window / global scope
    const win = window as any;
    if (win.electronBridge?.syncHitboxes) {
      try {
        win.electronBridge.syncHitboxes([rect]);
      } catch (_) {}
    } else if (win.clickThroughService?.registerHitbox) {
      try {
        win.clickThroughService.registerHitbox(this.hitboxId, rect);
      } catch (_) {}
    }
  }

  /**
   * Hide target container and remove active Electron hitbox.
   */
  public clear(): void {
    this.lastSyncedRect = null;
    const targetEl = this.resolveTargetElement();
    if (targetEl) {
      targetEl.style.left = '-9999px';
      targetEl.style.top = '-9999px';
      targetEl.style.width = '0px';
      targetEl.style.height = '0px';
      targetEl.style.pointerEvents = 'none';
    }

    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.clickThroughService?.unregisterHitbox) {
        try {
          win.clickThroughService.unregisterHitbox(this.hitboxId);
        } catch (_) {}
      } else if (win.electronBridge?.syncHitboxes) {
        try {
          win.electronBridge.syncHitboxes([]);
        } catch (_) {}
      }
    }

    this.onHitboxCleared?.();
  }

  /**
   * Get current cached hitbox rectangle.
   */
  public getCurrentRect(): HitboxRect | null {
    return this.lastSyncedRect;
  }

  /**
   * Dispose synchronizer.
   */
  public destroy(): void {
    this.clear();
    this.targetElement = null;
  }
}
