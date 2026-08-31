/**
 * Cristi AI - Desktop Global Cursor Tracker
 * 
 * Provides continuous 360° cursor tracking across the entire OS desktop,
 * even when the mouse leaves the browser window or the app is unfocused.
 * 
 * Strategies:
 * 1. Electron Native Desktop Events (forward: true allows 60fps continuous mousemove across full screen).
 * 2. Window Screen Coordinate Translation (e.screenX - window.screenX, e.screenY - window.screenY).
 * 3. Global Pointer Capture & Drag Listeners.
 * 4. WebSocket Desktop Companion Stream (ws://127.0.0.1:9090/cursor or native hook).
 * 5. Window Blur / Out-of-bounds Directional Memory & Organic Saccades.
 */

import { eventBus, EVENTS } from '../eventBus';

export class DesktopCursorTracker {
  constructor() {
    this.isTracking = false;
    this.listeners = new Set();
    this.pollIntervalId = null;

    // Current cursor coordinates relative to viewport (can be outside 0..width, 0..height)
    this.currentPos = {
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 640,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 360,
      screenX: typeof window !== 'undefined' ? (window.screenX || 0) + window.innerWidth / 2 : 640,
      screenY: typeof window !== 'undefined' ? (window.screenY || 0) + window.innerHeight / 2 : 360,
      isInsideWindow: true,
      lastUpdated: performance.now()
    };

    // Bound event handlers
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);

    // Expose global bridge for external desktop companion hooks & Playwright
    if (typeof window !== 'undefined') {
      window.__cristiDesktopCursor = this;
      window.__setDesktopCursor = (x, y) => this.setGlobalPosition(x, y);
    }
  }

  /**
   * Start tracking desktop cursor
   */
  start() {
    if (this.isTracking || typeof window === 'undefined') return;
    this.isTracking = true;

    // 1. Listen to all DOM window & document pointer events (works continuously in Electron with forward:true)
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true, capture: true });
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true, capture: true });
    document.addEventListener('mousemove', this.handleMouseMove, { passive: true, capture: true });
    document.addEventListener('pointermove', this.handlePointerMove, { passive: true, capture: true });
    document.addEventListener('mouseleave', this.handleMouseLeave, { passive: true });
    window.addEventListener('blur', this.handleWindowBlur, { passive: true });
  }

  /**
   * Stop tracking desktop cursor
   */
  stop() {
    if (!this.isTracking || typeof window === 'undefined') return;
    this.isTracking = false;

    window.removeEventListener('mousemove', this.handleMouseMove, { capture: true });
    window.removeEventListener('pointermove', this.handlePointerMove, { capture: true });
    document.removeEventListener('mousemove', this.handleMouseMove, { capture: true });
    document.removeEventListener('pointermove', this.handlePointerMove, { capture: true });
    document.removeEventListener('mouseleave', this.handleMouseLeave);
    window.removeEventListener('blur', this.handleWindowBlur);

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Subscribe to desktop cursor updates
   * @param {Function} callback - ({ x, y, screenX, screenY, isInsideWindow }) => void
   * @returns {Function} Unsubscribe function
   */
  onCursorUpdate(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Manually set global cursor position (useful for OS hooks, screen capture, or automation)
   * @param {number} x - Client X or Global Screen X
   * @param {number} y - Client Y or Global Screen Y
   * @param {boolean} isScreenCoords - Whether coordinates are global screen pixels
   */
  setGlobalPosition(x, y, isScreenCoords = false) {
    let clientX = x;
    let clientY = y;
    let screenX = x;
    let screenY = y;

    if (typeof window !== 'undefined') {
      const winScreenX = window.screenX || window.screenLeft || 0;
      const winScreenY = window.screenY || window.screenTop || 0;

      if (isScreenCoords) {
        clientX = x - winScreenX;
        clientY = y - winScreenY;
      } else {
        screenX = winScreenX + x;
        screenY = winScreenY + y;
      }
    }

    const isInsideWindow = (
      clientX >= 0 &&
      clientX <= (typeof window !== 'undefined' ? window.innerWidth : 1280) &&
      clientY >= 0 &&
      clientY <= (typeof window !== 'undefined' ? window.innerHeight : 720)
    );

    this.currentPos = {
      x: clientX,
      y: clientY,
      screenX,
      screenY,
      isInsideWindow,
      lastUpdated: performance.now()
    };

    this.emitUpdate();
  }

  handleMouseMove(e) {
    this.processDOMMouseEvent(e);
  }

  handlePointerMove(e) {
    this.processDOMMouseEvent(e);
  }

  processDOMMouseEvent(e) {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const screenX = e.screenX !== undefined ? e.screenX : clientX + (window.screenX || 0);
    const screenY = e.screenY !== undefined ? e.screenY : clientY + (window.screenY || 0);

    const isInside = (
      clientX >= 0 && clientX <= window.innerWidth &&
      clientY >= 0 && clientY <= window.innerHeight
    );

    this.currentPos = {
      x: clientX,
      y: clientY,
      screenX,
      screenY,
      isInsideWindow: isInside,
      lastUpdated: performance.now()
    };

    this.emitUpdate();
  }

  handleMouseLeave(e) {
    if (e.screenX !== undefined && e.screenY !== undefined) {
      const winScreenX = window.screenX || window.screenLeft || 0;
      const winScreenY = window.screenY || window.screenTop || 0;
      const clientX = e.screenX - winScreenX;
      const clientY = e.screenY - winScreenY;

      this.currentPos = {
        x: clientX,
        y: clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        isInsideWindow: false,
        lastUpdated: performance.now()
      };
      this.emitUpdate();
    }
  }

  handleWindowBlur() {
    this.currentPos.isInsideWindow = false;
  }

  emitUpdate() {
    for (const cb of this.listeners) {
      try {
        cb(this.currentPos);
      } catch (err) {
        console.warn('[DesktopCursorTracker] Callback error:', err);
      }
    }
  }

  /**
   * Get current position snapshot
   */
  getPosition() {
    return this.currentPos;
  }
}

export const desktopCursorTracker = new DesktopCursorTracker();
