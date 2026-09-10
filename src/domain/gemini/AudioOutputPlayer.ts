import type { AudioPlaybackPort } from '../../app/ports';
import { eventBus, EVENTS } from '../../infrastructure/events/eventBus.js';
import { AudioAnalysisService } from '../audio/AudioAnalysisService.js';
import { AudioPlayoutQueue } from '../audio/AudioPlayoutQueue';
export interface AudioOutputPlayerOptions {
  onAudioStart?: () => void; onAudioEnd?: () => void;
  onLipSyncUpdate?: (value: number) => void; onVolumeChange?: (value: number) => void;
}
export class AudioOutputPlayer implements AudioPlaybackPort {
  audioContext: AudioContext | null = null;
  gainNode: GainNode | null = null;
  analysisService: AudioAnalysisService | null = null;
  isPlaying = false;
  nextScheduleTime = 0;
  readonly sampleRate = 24000;
  readonly playout = new AudioPlayoutQueue();
  private sources = new Set<AudioBufferSourceNode>();
  private queue: Float32Array[] = [];
  private prefillTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private pending = 0;
  private unsubscribe: (() => void) | null;
  constructor(private options: AudioOutputPlayerOptions = {}) {
    this.unsubscribe = eventBus.on(EVENTS.AUDIO_ANALYSIS, (metrics: { volume: number; mouthOpen: number }) => {
      options.onVolumeChange?.(metrics.volume); options.onLipSyncUpdate?.(metrics.mouthOpen);
    });
  }
  get isTurnComplete(): boolean { return this.playout.turnComplete; }
  beginGeneration(): void { this.playout.begin(); }
  initContext(): void {
    if (this.destroyed || this.audioContext) return;
    this.audioContext = new AudioContext({ latencyHint: 'interactive' });
    this.gainNode = this.audioContext.createGain(); this.gainNode.connect(this.audioContext.destination);
    this.analysisService = new AudioAnalysisService(this.audioContext);
    this.analysisService.connectSource(this.gainNode);
  }
  async resumeContext(): Promise<void> {
    this.initContext();
    if (this.audioContext?.state === 'suspended') await this.audioContext.resume();
  }
  async resumeContextIfNeeded(): Promise<void> { await this.resumeContext(); }
  signalGenerationComplete(): void { this.playout.finishGeneration(); this.flush(); this.checkEnd(); }
  signalTurnComplete(): void { this.playout.finishTurn(); this.flush(); this.checkEnd(); }
  async playChunk(base64: string): Promise<void> {
    if (this.destroyed || !base64) return;
    if (this.playout.generationComplete || this.playout.turnComplete || this.playout.state === 'INTERRUPTED') return;
    if (this.playout.generation === 0) this.beginGeneration();
    const epoch = this.playout.generation;
    this.pending++;
    try {
      if (!this.audioContext || this.audioContext.state !== 'running') await this.resumeContext();
      if (this.destroyed || epoch !== this.playout.generation || !this.audioContext) return;
      const binary = atob(base64);
      if (binary.length % 2) throw new Error('PCM16 inválido');
      const samples = new Float32Array(binary.length / 2);
      for (let i = 0; i < samples.length; i++) {
        const value = binary.charCodeAt(i * 2) | binary.charCodeAt(i * 2 + 1) << 8;
        samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
      }
      this.playout.receive(performance.now(), samples.length / 24);
      if (this.nextScheduleTime < this.audioContext.currentTime && this.sources.size === 0 && !this.playout.generationComplete) {
        if (this.isPlaying && this.queue.length === 0) this.playout.underruns++;
        this.playout.state = 'PREFILL';
      }
      if (this.playout.state === 'PREFILL') {
        this.queue.push(samples);
        if (!this.prefillTimer) this.prefillTimer = setTimeout(() => this.flush(), this.playout.targetMs);
        if (this.queue.reduce((sum, item) => sum + item.length, 0) / 24 >= this.playout.targetMs) this.flush();
      } else this.schedule(samples);
    } finally { this.pending--; this.checkEnd(); }
  }
  async playAudioChunk(data: string): Promise<void> { await this.playChunk(data); }
  private flush(): void {
    if (this.prefillTimer) clearTimeout(this.prefillTimer); this.prefillTimer = null;
    if (this.playout.state === 'PREFILL') this.playout.state = 'PLAYING';
    for (const samples of this.queue.splice(0)) this.schedule(samples);
  }
  private schedule(samples: Float32Array): void {
    const context = this.audioContext;
    if (!context || !this.gainNode || !samples.length) return;
    const buffer = context.createBuffer(1, samples.length, this.sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = context.createBufferSource(); source.buffer = buffer;
    // Clock-exact playback. Never slow the stream to control speaking style.
    source.playbackRate.value = 1;
    source.connect(this.gainNode);
    this.nextScheduleTime = Math.max(this.nextScheduleTime, context.currentTime + 0.005);
    source.start(this.nextScheduleTime); this.nextScheduleTime += buffer.duration;
    this.playout.scheduledAheadMs = (this.nextScheduleTime - context.currentTime) * 1000;
    this.sources.add(source);
    if (!this.isPlaying) {
      this.isPlaying = true; this.options.onAudioStart?.(); eventBus.emit(EVENTS.AUDIO_START); this.analysisService?.start();
    }
    source.onended = () => { source.disconnect(); this.sources.delete(source); this.checkEnd(); };
  }
  private checkEnd(): void {
    if (this.pending || this.sources.size || this.queue.length || !this.isPlaying || (!this.playout.turnComplete && !this.playout.generationComplete)) return;
    this.isPlaying = false; this.nextScheduleTime = 0; this.playout.state = 'IDLE';
    this.analysisService?.stop(); this.options.onVolumeChange?.(0); this.options.onLipSyncUpdate?.(0);
    this.options.onAudioEnd?.(); eventBus.emit(EVENTS.AUDIO_END);
  }
  stopImmediate(): void {
    this.playout.interrupt();
    if (this.prefillTimer) clearTimeout(this.prefillTimer); this.prefillTimer = null;
    this.queue = [];
    for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
    this.sources.clear(); this.isPlaying = false; this.nextScheduleTime = 0;
    this.analysisService?.stop(); this.options.onLipSyncUpdate?.(0); this.options.onVolumeChange?.(0);
    this.options.onAudioEnd?.(); eventBus.emit(EVENTS.AUDIO_END);
  }
  getTelemetry() { return { isPlaying: this.isPlaying, activeSourcesCount: this.sources.size, sampleRate: this.sampleRate,
    queueLength: this.queue.length, isTurnComplete: this.isTurnComplete, jitterLeadTimeMs: this.playout.targetMs,
    scheduledAheadMs: Math.max(0, (this.nextScheduleTime - (this.audioContext?.currentTime ?? 0)) * 1000),
    backlogAlarm: this.playout.scheduledAheadMs > 250, underruns: this.playout.underruns, state: this.playout.state }; }
  destroy(): void {
    this.destroyed = true; this.stopImmediate(); this.unsubscribe?.(); this.unsubscribe = null;
    this.analysisService?.destroy(); this.analysisService = null; this.gainNode?.disconnect(); this.gainNode = null;
    if (this.audioContext && this.audioContext.state !== 'closed') void this.audioContext.close(); this.audioContext = null;
  }
}
