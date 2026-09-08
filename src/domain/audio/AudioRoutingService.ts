/**
 * Cristi AI - Audio Routing Service & Acoustic Feedback Shield
 * 
 * Responsibilities:
 * - Source-aware audio routing with strict source separation (no cross-contamination).
 * - Enforces rigorous frame tagging: `sourceId`, `sessionId`, `correlationId`.
 * - Acoustic Feedback Shield: marks synthesized audio (Cristi TTS) to prevent
 *   it from looping back into microphone or loopback speech recognizers.
 * - Memory leak prevention with time-windowed LRU caches and bounded capacity.
 */

import { eventBus } from '@/services/eventBus.js';
import type {
  AudioFrameEnvelope,
  AudioRoute,
  AudioSourceMetadata,
  FeedbackShieldConfig
} from '@/types';

interface TrackedSignature {
  signatureId: string;
  sourceId: string;
  sessionId: string;
  correlationId: string;
  timestamp: number;
  durationMs: number;
  energy: number;
  fingerprint: string;
}

export class AudioRoutingService {
  private sources = new Map<string, AudioSourceMetadata>();
  private routes = new Map<string, AudioRoute>();
  private generatedFrameIds = new Map<string, { sourceId: string; sessionId: string; correlationId: string; createdAt: number }>();
  private trackedSignatures: TrackedSignature[] = [];

  private maxTrackedSignatures = 500;
  private retentionWindowMs = 6000; // 6 seconds window for echo cancellation
  private shieldEnabled = true;

  constructor(config?: FeedbackShieldConfig) {
    if (config) {
      this.configureShield(config);
    }
  }

  /**
   * Configure feedback shield parameters.
   */
  public configureShield(config: FeedbackShieldConfig): void {
    if (typeof config.enabled === 'boolean') {
      this.shieldEnabled = config.enabled;
    }
    if (typeof config.maxTrackedSignatures === 'number' && config.maxTrackedSignatures > 0) {
      this.maxTrackedSignatures = Math.min(2000, Math.max(50, config.maxTrackedSignatures));
    }
    if (typeof config.retentionWindowMs === 'number' && config.retentionWindowMs > 0) {
      this.retentionWindowMs = Math.min(30000, Math.max(1000, config.retentionWindowMs));
    }
  }

  /**
   * Register an audio input/output source.
   */
  public registerSource(metadata: {
    sourceId: string;
    name?: string;
    type?: AudioSourceMetadata['type'];
    sampleRate?: number;
    channels?: number;
  }): boolean {
    if (!metadata?.sourceId) return false;
    this.sources.set(metadata.sourceId, {
      sourceId: metadata.sourceId,
      name: metadata.name || metadata.sourceId,
      type: metadata.type || 'custom',
      registeredAt: Date.now(),
      sampleRate: metadata.sampleRate,
      channels: metadata.channels
    });
    return true;
  }

  /**
   * Unregister an audio source.
   */
  public unregisterSource(sourceId: string): boolean {
    this.routes.delete(sourceId);
    return this.sources.delete(sourceId);
  }

  /**
   * Establish or update a route from sourceId to targetId.
   */
  public setRoute(
    sourceId: string,
    targetId: string,
    options: { enabled?: boolean; purpose?: string } = {}
  ): boolean {
    if (!sourceId || !targetId) return false;
    const route: AudioRoute = {
      sourceId,
      targetId,
      enabled: options.enabled !== false,
      purpose: options.purpose || 'pipeline'
    };
    this.routes.set(sourceId, route);

    eventBus.emitDomain('audio.route_changed', route, {
      source: 'audio_router',
      privacy: 'internal'
    });
    return true;
  }

  /**
   * Marks synthesized/generated audio from Cristi to prevent acoustic feedback
   * or re-entry into the microphone recognition pipeline.
   * 
   * Accepts:
   * - AudioBuffer (Web Audio API)
   * - Int16Array / Float32Array / ArrayBuffer (PCM)
   * - Base64 PCM string or frameId
   * - Envelope object containing data/frameId
   */
  public markGenerated(
    audioBuffer:
      | AudioBuffer
      | ArrayBuffer
      | ArrayBufferView
      | string
      | {
          data?: string | ArrayBuffer | ArrayBufferView;
          frameId?: string;
          sessionId?: string;
          correlationId?: string;
          sampleRate?: number;
          durationMs?: number;
        },
    options: {
      sourceId?: string;
      sessionId?: string;
      correlationId?: string;
      durationMs?: number;
      sampleRate?: number;
    } = {}
  ): string {
    const timestamp = Date.now();
    const sourceId = options.sourceId || 'cristi_tts';
    const sessionId = options.sessionId || 'session_current';
    const correlationId = options.correlationId || `corr_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;

    let frameId = `gen_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    let durationMs = options.durationMs || 0;
    let energy = 0;
    let fingerprint = '';

    if (typeof audioBuffer === 'string') {
      // Check if it's already a frameId or base64
      if (audioBuffer.length < 120 && !audioBuffer.includes('/') && !audioBuffer.includes('+')) {
        frameId = audioBuffer;
      } else {
        // Base64 PCM
        const pcm = this.decodeBase64Pcm(audioBuffer);
        energy = this.calculatePcmEnergy(pcm);
        fingerprint = this.calculateFingerprint(pcm);
        durationMs = durationMs || (pcm.length / (options.sampleRate || 24000)) * 1000;
      }
    } else if (typeof AudioBuffer !== 'undefined' && audioBuffer instanceof AudioBuffer) {
      durationMs = audioBuffer.duration * 1000;
      const channelData = audioBuffer.getChannelData(0);
      energy = this.calculateFloatEnergy(channelData);
      fingerprint = this.calculateFloatFingerprint(channelData);
    } else if (audioBuffer instanceof Int16Array) {
      energy = this.calculatePcmEnergy(audioBuffer);
      fingerprint = this.calculateFingerprint(audioBuffer);
      durationMs = durationMs || (audioBuffer.length / (options.sampleRate || 24000)) * 1000;
    } else if (audioBuffer instanceof Float32Array) {
      energy = this.calculateFloatEnergy(audioBuffer);
      fingerprint = this.calculateFloatFingerprint(audioBuffer);
      durationMs = durationMs || (audioBuffer.length / (options.sampleRate || 24000)) * 1000;
    } else if (audioBuffer instanceof ArrayBuffer) {
      const pcm = new Int16Array(audioBuffer);
      energy = this.calculatePcmEnergy(pcm);
      fingerprint = this.calculateFingerprint(pcm);
      durationMs = durationMs || (pcm.length / (options.sampleRate || 24000)) * 1000;
    } else if (
      typeof audioBuffer === 'object' &&
      audioBuffer !== null &&
      !ArrayBuffer.isView(audioBuffer) &&
      !(audioBuffer instanceof ArrayBuffer) &&
      !(typeof AudioBuffer !== 'undefined' && audioBuffer instanceof AudioBuffer)
    ) {
      const obj = audioBuffer as {
        data?: string | ArrayBuffer | ArrayBufferView;
        frameId?: string;
        sessionId?: string;
        correlationId?: string;
        sampleRate?: number;
        durationMs?: number;
      };
      if (obj.frameId) frameId = obj.frameId;
      if (obj.sessionId) options.sessionId = obj.sessionId;
      if (obj.correlationId) options.correlationId = obj.correlationId;

      if (obj.data) {
        return this.markGenerated(obj.data, {
          ...options,
          sampleRate: obj.sampleRate || options.sampleRate,
          durationMs: obj.durationMs || options.durationMs
        });
      }
    }

    // Register frame ID
    this.generatedFrameIds.set(frameId, {
      sourceId,
      sessionId,
      correlationId,
      createdAt: timestamp
    });

    // Register acoustic fingerprint for feedback detection
    if (fingerprint) {
      this.trackedSignatures.push({
        signatureId: frameId,
        sourceId,
        sessionId,
        correlationId,
        timestamp,
        durationMs: durationMs || 1000,
        energy,
        fingerprint
      });
    }

    this.pruneOldSignatures(timestamp);

    return frameId;
  }

  /**
   * Check if a frame was generated by Cristi (direct ID lookup).
   */
  public isSelfGenerated(frameId: string): boolean {
    if (!frameId) return false;
    return this.generatedFrameIds.has(frameId);
  }

  /**
   * Validates and routes an incoming audio frame.
   * Performs feedback shielding: checks if the frame matches recently generated
   * synthesized audio, dropping it or marking it if an acoustic match is found.
   */
  public acceptFrame(frameInput: {
    frameId?: string;
    sourceId: string;
    sessionId?: string;
    correlationId?: string;
    data: string; // Base64 PCM16
    sampleRate?: number;
    channels?: number;
    timestamp?: number;
  }): AudioFrameEnvelope | null {
    const timestamp = frameInput.timestamp || Date.now();
    const sourceId = frameInput.sourceId;
    if (!sourceId || !frameInput.data) return null;

    // Check if route is disabled
    const route = this.routes.get(sourceId);
    if (route && !route.enabled) return null;

    const frameId = frameInput.frameId || `audio_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const sessionId = frameInput.sessionId || 'session_default';
    const correlationId = frameInput.correlationId || `corr_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const sampleRate = frameInput.sampleRate || 16000;

    // Direct match check
    if (this.isSelfGenerated(frameId)) {
      return null;
    }

    // Acoustic Feedback Shield inspection (for microphone or loopback input)
    if (this.shieldEnabled && (sourceId.includes('mic') || sourceId.includes('loopback'))) {
      const pcm = this.decodeBase64Pcm(frameInput.data);
      const incomingEnergy = this.calculatePcmEnergy(pcm);

      // Only check if frame has substantial energy
      if (incomingEnergy > 0.005) {
        const incomingFingerprint = this.calculateFingerprint(pcm);
        const match = this.findAcousticEchoMatch(incomingFingerprint, incomingEnergy, timestamp);

        if (match) {
          // Frame is Cristi's own acoustic echo leaking through speakers into mic!
          eventBus.emitDomain('audio.feedback_blocked', {
            sourceId,
            frameId,
            matchedSignatureId: match.signatureId,
            energy: incomingEnergy,
            detectedDelayMs: timestamp - match.timestamp
          }, {
            source: 'audio_router',
            sessionId,
            correlationId,
            privacy: 'internal'
          });
          return null; // Drop frame from mic input
        }
      }
    }

    const envelope: AudioFrameEnvelope = {
      frameId,
      sourceId,
      sessionId,
      correlationId,
      data: frameInput.data,
      sampleRate,
      channels: frameInput.channels || 1,
      timestamp,
      isGenerated: false
    };

    // Emit domain event for consumers
    eventBus.emitDomain('audio.frame_received', envelope, {
      source: sourceId,
      sessionId,
      correlationId,
      privacy: sourceId.includes('mic') ? 'sensitive' : 'local'
    });

    return envelope;
  }

  /**
   * Search for acoustic match in recently generated output buffers.
   */
  private findAcousticEchoMatch(
    incomingFingerprint: string,
    incomingEnergy: number,
    currentTimestamp: number
  ): TrackedSignature | null {
    if (!incomingFingerprint) return null;

    for (let i = this.trackedSignatures.length - 1; i >= 0; i--) {
      const sig = this.trackedSignatures[i];
      const ageMs = currentTimestamp - sig.timestamp;
      if (ageMs < 0) continue;
      if (ageMs > this.retentionWindowMs) break; // Array is chronologically sorted

      // Fingerprint similarity test (hamming distance on hex/bit tokens)
      const similarity = this.calculateSimilarity(incomingFingerprint, sig.fingerprint);
      if (similarity >= 0.82) {
        return sig;
      }
    }

    return null;
  }

  /**
   * Prune expired frame IDs and signatures to prevent memory leaks.
   */
  private pruneOldSignatures(now: number): void {
    const cutoff = now - this.retentionWindowMs;

    // Prune tracked signatures
    while (this.trackedSignatures.length > 0 && this.trackedSignatures[0].timestamp < cutoff) {
      this.trackedSignatures.shift();
    }
    if (this.trackedSignatures.length > this.maxTrackedSignatures) {
      this.trackedSignatures.splice(0, this.trackedSignatures.length - this.maxTrackedSignatures);
    }

    // Prune frame IDs map
    for (const [id, info] of this.generatedFrameIds.entries()) {
      if (info.createdAt < cutoff) {
        this.generatedFrameIds.delete(id);
      } else {
        break; // Map maintains insertion order
      }
    }
  }

  /**
   * Fast acoustic fingerprint calculation (energy distribution + zero crossings + spectral band hash).
   */
  private calculateFingerprint(pcm: Int16Array): string {
    if (!pcm.length) return '';
    const step = Math.max(1, Math.floor(pcm.length / 16));
    let zeroCrossings = 0;
    const bandSums = [0, 0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < pcm.length; i++) {
      if (i > 0 && ((pcm[i] >= 0 && pcm[i - 1] < 0) || (pcm[i] < 0 && pcm[i - 1] >= 0))) {
        zeroCrossings++;
      }
      const bandIndex = Math.min(7, Math.floor((i / pcm.length) * 8));
      bandSums[bandIndex] += Math.abs(pcm[i]);
    }

    const normBands = bandSums.map((sum) => Math.min(15, Math.floor((sum / (step * 32768)) * 15)));
    const zcScore = Math.min(255, Math.floor((zeroCrossings / pcm.length) * 255));
    return `${zcScore.toString(16).padStart(2, '0')}-${normBands.map((b) => b.toString(16)).join('')}`;
  }

  private calculateFloatFingerprint(samples: Float32Array): string {
    if (!samples.length) return '';
    const step = Math.max(1, Math.floor(samples.length / 16));
    let zeroCrossings = 0;
    const bandSums = [0, 0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < samples.length; i++) {
      if (i > 0 && ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0))) {
        zeroCrossings++;
      }
      const bandIndex = Math.min(7, Math.floor((i / samples.length) * 8));
      bandSums[bandIndex] += Math.abs(samples[i]);
    }

    const normBands = bandSums.map((sum) => Math.min(15, Math.floor((sum / step) * 15)));
    const zcScore = Math.min(255, Math.floor((zeroCrossings / samples.length) * 255));
    return `${zcScore.toString(16).padStart(2, '0')}-${normBands.map((b) => b.toString(16)).join('')}`;
  }

  private calculateSimilarity(f1: string, f2: string): number {
    if (f1 === f2) return 1.0;
    if (!f1 || !f2 || f1.length !== f2.length) return 0;
    let matches = 0;
    for (let i = 0; i < f1.length; i++) {
      if (f1[i] === f2[i]) matches++;
    }
    return matches / f1.length;
  }

  private calculatePcmEnergy(pcm: Int16Array): number {
    if (!pcm.length) return 0;
    let sumSquares = 0;
    const stride = Math.max(1, Math.floor(pcm.length / 100)); // Sample 100 points for speed
    let samplesCount = 0;
    for (let i = 0; i < pcm.length; i += stride) {
      const normalized = pcm[i] / 32768.0;
      sumSquares += normalized * normalized;
      samplesCount++;
    }
    return Math.sqrt(sumSquares / Math.max(1, samplesCount));
  }

  private calculateFloatEnergy(samples: Float32Array): number {
    if (!samples.length) return 0;
    let sumSquares = 0;
    const stride = Math.max(1, Math.floor(samples.length / 100));
    let samplesCount = 0;
    for (let i = 0; i < samples.length; i += stride) {
      sumSquares += samples[i] * samples[i];
      samplesCount++;
    }
    return Math.sqrt(sumSquares / Math.max(1, samplesCount));
  }

  private decodeBase64Pcm(base64: string): Int16Array {
    if (!base64) return new Int16Array(0);
    try {
      if (typeof atob === 'function') {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      }
      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(base64, 'base64');
        return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
      }
    } catch (_) {
      return new Int16Array(0);
    }
    return new Int16Array(0);
  }

  /**
   * Returns current telemetry of routing and feedback shielding.
   */
  public getTelemetry(): {
    sourcesCount: number;
    routesCount: number;
    shieldedBuffersCount: number;
    shieldEnabled: boolean;
  } {
    return {
      sourcesCount: this.sources.size,
      routesCount: this.routes.size,
      shieldedBuffersCount: this.generatedFrameIds.size,
      shieldEnabled: this.shieldEnabled
    };
  }

  /**
   * Clean up all memory resources and state.
   */
  public destroy(): void {
    this.sources.clear();
    this.routes.clear();
    this.generatedFrameIds.clear();
    this.trackedSignatures = [];
  }
}

export const audioRoutingService = new AudioRoutingService();
export default audioRoutingService;
