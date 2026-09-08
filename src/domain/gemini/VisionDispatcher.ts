/**
 * Cristi AI - Vision Dispatcher (Backpressure-Protected Visual Frame Buffer)
 * 
 * Manages screen and camera frame streaming to Gemini Live API:
 * - Single-frame buffer (capacity = 1) with automatic discarding of stale frames
 * - Network backpressure control (inspects socket bufferedAmount)
 * - Intelligent visual transmission pause while assistant is speaking,
 *   preventing duplex audio degradation during speech synthesis
 * - Automatic flush of the freshest observation once speech completes
 */

import type { GeminiLiveClient } from './GeminiLiveClient';

export interface VisionFrameItem {
  base64: string;
  mimeType: string;
  timestamp: number;
  priority?: boolean;
}

export interface VisionDispatcherOptions {
  client?: GeminiLiveClient;
  minIntervalMs?: number; // Minimum period between frames (default: 1000ms = 1 FPS)
  maxBufferedAmountBytes?: number; // Max socket backpressure buffer (default: 32KB)
  maxFrameAgeMs?: number; // Expire frame if older than this (default: 10000ms)
}

export interface VisionDispatcherTelemetry {
  hasPendingFrame: boolean;
  isAssistantSpeaking: boolean;
  lastSentTimestamp: number;
  minIntervalMs: number;
}

export class VisionDispatcher {
  private client: GeminiLiveClient | null = null;
  private minIntervalMs: number;
  private maxBufferedAmountBytes: number;
  private maxFrameAgeMs: number;

  private latestFrame: VisionFrameItem | null = null;
  private isAssistantSpeaking = false;
  private lastSentTimestamp = 0;
  private dispatchTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  constructor(options: VisionDispatcherOptions = {}) {
    this.client = options.client || null;
    this.minIntervalMs = Math.max(250, options.minIntervalMs ?? 1000);
    this.maxBufferedAmountBytes = options.maxBufferedAmountBytes ?? 32768;
    this.maxFrameAgeMs = options.maxFrameAgeMs ?? 10000;
  }

  public setClient(client: GeminiLiveClient | null): void {
    if (this.client !== client) {
      this.clear();
      this.client = client;
    }
  }

  /**
   * Set assistant speaking state. When speaking, visual frame dispatch is paused
   * to prioritize voice bandwidth and avoid audio stutter.
   */
  public setSpeaking(isSpeaking: boolean): void {
    if (this.isAssistantSpeaking === isSpeaking) return;
    this.isAssistantSpeaking = isSpeaking;

    if (!isSpeaking) {
      // Speech finished: flush the freshest retained frame shortly
      this.scheduleFlush(60);
    }
  }

  /**
   * Enqueue a new frame from screen capture or webcam.
   * Buffer size is strictly 1: any previously queued frame is immediately replaced.
   */
  public enqueueFrame(
    frameData: string,
    mimeType = 'image/jpeg',
    options: { priority?: boolean } = {}
  ): boolean {
    if (this.isDestroyed || !frameData || frameData.length < 32) {
      return false;
    }

    const cleanBase64 = frameData.includes(',') ? frameData.split(',')[1] : frameData;

    // Single-frame buffer: overwrite existing pending frame
    this.latestFrame = {
      base64: cleanBase64.trim(),
      mimeType,
      timestamp: Date.now(),
      priority: options.priority
    };

    const now = Date.now();
    const elapsedSinceLast = now - this.lastSentTimestamp;
    const remainingInterval = Math.max(0, this.minIntervalMs - elapsedSinceLast);

    this.scheduleFlush(remainingInterval);
    return true;
  }

  private scheduleFlush(delayMs: number): void {
    if (this.isDestroyed || !this.latestFrame) return;

    if (this.dispatchTimer !== null) {
      return;
    }

    this.dispatchTimer = setTimeout(() => {
      this.dispatchTimer = null;
      this.flush();
    }, Math.max(0, delayMs));
  }

  /**
   * Attempts to dispatch the current buffered frame if network conditions permit.
   */
  public flush(): boolean {
    if (this.isDestroyed || !this.latestFrame) {
      return false;
    }

    // 1. If assistant is actively speaking, pause frame transmission unless priority
    if (this.isAssistantSpeaking && !this.latestFrame.priority) {
      return false;
    }

    // 2. Discard frame if stale
    const now = Date.now();
    if (now - this.latestFrame.timestamp > this.maxFrameAgeMs) {
      this.latestFrame = null;
      return false;
    }

    // 3. Verify minimum interval pacing
    const elapsed = now - this.lastSentTimestamp;
    if (elapsed < this.minIntervalMs && !this.latestFrame.priority) {
      this.scheduleFlush(this.minIntervalMs - elapsed);
      return false;
    }

    // 4. Client availability and connection check
    if (!this.client || !this.client.isConnected()) {
      // Re-check in 500ms
      this.scheduleFlush(500);
      return false;
    }

    // 5. Network backpressure guard (socket buffer saturation)
    const socketBuffered = this.client.getBufferedAmount();
    if (socketBuffered > this.maxBufferedAmountBytes) {
      // Socket is congested: delay dispatch until buffer drains
      this.scheduleFlush(100);
      return false;
    }

    // 6. Transmit frame
    const frameToSend = this.latestFrame;
    const success = this.client.sendRealtimeMedia(frameToSend.base64, frameToSend.mimeType);

    if (success) {
      // Discard sent frame
      if (this.latestFrame === frameToSend) {
        this.latestFrame = null;
      }
      this.lastSentTimestamp = Date.now();
      return true;
    } else {
      this.scheduleFlush(250);
      return false;
    }
  }

  public clear(): void {
    this.latestFrame = null;
    if (this.dispatchTimer !== null) {
      clearTimeout(this.dispatchTimer);
      this.dispatchTimer = null;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.clear();
    this.client = null;
  }

  public getTelemetry(): VisionDispatcherTelemetry {
    return {
      hasPendingFrame: this.latestFrame !== null,
      isAssistantSpeaking: this.isAssistantSpeaking,
      lastSentTimestamp: this.lastSentTimestamp,
      minIntervalMs: this.minIntervalMs
    };
  }
}
