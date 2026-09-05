import { eventBus, EVENTS } from '../eventBus.js';

/** Single-owner visual transport for Gemini Live. */
export class VisionFrameDispatcher {
  constructor({ socketRef, minIntervalMs = 1000, maxAgeMs = 8000 } = {}) {
    this.socketRef = socketRef;
    this.minIntervalMs = Math.max(500, minIntervalMs);
    this.maxAgeMs = Math.max(this.minIntervalMs, maxAgeMs);
    this.pending = null;
    this.timer = null;
    this.timerDueAt = 0;
    this.lastSentAt = 0;
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
    this.pending = { base64, source, createdAt: Date.now(), priority };
    this.flushSoon(priority ? 0 : Math.max(0, this.minIntervalMs - (Date.now() - this.lastSentAt)));
    return true;
  }

  flushSoon(delay = 0) {
    if (this.destroyed) return;
    const dueAt = Date.now() + Math.max(0, delay);
    if (this.timer && this.timerDueAt <= dueAt) return;
    if (this.timer) clearTimeout(this.timer);
    this.timerDueAt = dueAt;
    this.timer = setTimeout(() => { this.timer = null; this.timerDueAt = 0; void this.flush(); }, Math.max(0, delay));
  }

  async flush() {
    if (this.destroyed || !this.pending) return false;
    const frame = this.pending;
    if (Date.now() - frame.createdAt > this.maxAgeMs) { this.pending = null; return false; }
    if (this.isSpeaking && !frame.priority) { this.flushSoon(250); return false; }
    const socket = this.socketRef?.current;
    const ws = socket?.websocket;
    const openState = globalThis.WebSocket?.OPEN ?? 1;
    if (!socket?.isConnected || !ws || ws.readyState !== openState) { this.flushSoon(500); return false; }
    if (ws.bufferedAmount > 65536) { this.flushSoon(100); return false; }
    this.pending = null;
    const sent = socket.sendRealtimeMedia(frame.base64, 'image/jpeg');
    if (sent !== false) { this.lastSentAt = Date.now(); return true; }
    this.pending = frame;
    this.flushSoon(250);
    return false;
  }

  reset() {
    this.pending = null;
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
