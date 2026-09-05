import { eventBus, EVENTS } from '../eventBus.js';
import { logger } from '../logger.js';

/** Single-owner visual transport for Gemini Live. */
export class VisionFrameDispatcher {
  constructor({ socketRef, minIntervalMs = 1000, maxAgeMs = 8000 } = {}) {
    this.socketRef = socketRef;
    this.minIntervalMs = Math.max(500, minIntervalMs);
    this.maxAgeMs = Math.max(this.minIntervalMs, maxAgeMs);
    this.pending = new Map();
    this.timer = null;
    this.timerDueAt = 0;
    this.lastSentAt = -Infinity;
    this.isSpeaking = false;
    this.destroyed = false;
    this._unsubStart = eventBus.on(EVENTS.AUDIO_START, () => { this.isSpeaking = true; });
    this._unsubEnd = eventBus.on(EVENTS.AUDIO_END, () => {
      this.isSpeaking = false;
      this.flushSoon(80);
    });
  }

  enqueue(base64, source = 'vision', { priority = false } = {}) {
    if (this.destroyed || typeof base64 !== 'string' || base64.length < 32) return false;
    if (!this.pending.has(source) && this.pending.size >= 8) return false;
    // Updating a source preserves its queue position so camera cannot starve screen.
    this.pending.set(source, { base64, source, createdAt: Date.now(), priority, socket: this.socketRef?.current });
    this.flushSoon(Math.max(0, this.minIntervalMs - (Date.now() - this.lastSentAt)));
    return true;
  }

  setSocketRef(socketRef) {
    if (this.socketRef !== socketRef) this.reset();
    this.socketRef = socketRef;
  }

  clearSource(source) {
    this.pending.delete(source);
    if (!this.pending.size && this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
      this.timerDueAt = 0;
    }
  }

  flushSoon(delay = 0) {
    if (this.destroyed || !this.pending.size) return;
    const dueAt = Date.now() + Math.max(0, delay);
    if (this.timer && this.timerDueAt <= dueAt) return;
    if (this.timer) clearTimeout(this.timer);
    this.timerDueAt = dueAt;
    this.timer = setTimeout(() => { this.timer = null; this.timerDueAt = 0; void this.flush(); }, Math.max(0, delay));
  }

  flush() {
    if (this.destroyed) return false;
    const socket = this.socketRef?.current;
    const now = Date.now();
    for (const [source, pending] of this.pending) {
      if (now - pending.createdAt > this.maxAgeMs || (pending.socket && pending.socket !== socket)) {
        this.pending.delete(source);
      }
    }
    const frame = this.pending.values().next().value;
    if (!frame) return false;
    const remaining = this.minIntervalMs - (now - this.lastSentAt);
    if (remaining > 0) { this.flushSoon(remaining); return false; }
    if (this.isSpeaking && !frame.priority) { this.flushSoon(250); return false; }
    const ws = socket?.websocket;
    const openState = globalThis.WebSocket?.OPEN ?? 1;
    if (!socket?.isConnected || !ws || ws.readyState !== openState) { this.flushSoon(500); return false; }
    if (ws.bufferedAmount > 65536) { this.flushSoon(100); return false; }
    try {
      const sent = socket.sendRealtimeMedia(frame.base64, 'image/jpeg');
      if (sent !== false) {
        if (this.pending.get(frame.source) === frame) this.pending.delete(frame.source);
        this.lastSentAt = Date.now();
        this.flushSoon(this.minIntervalMs);
        return true;
      }
    } catch (error) {
      logger.warn('VISION', 'No se pudo enviar el fotograma:', error.message);
    }
    this.flushSoon(250);
    return false;
  }

  reset() {
    this.pending.clear();
    this.lastSentAt = -Infinity;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.timerDueAt = 0;
  }

  destroy() {
    this.destroyed = true;
    this.reset();
    this._unsubStart?.();
    this._unsubEnd?.();
    this._unsubStart = this._unsubEnd = null;
  }
}

export const visionFrameDispatcher = new VisionFrameDispatcher();
