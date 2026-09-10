import { StreamingResampler } from '../domain/audio/StreamingResampler';
declare const sampleRate: number;
declare class AudioWorkletProcessor { readonly port: MessagePort; }
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;
class CaptureProcessor extends AudioWorkletProcessor {
  private resampler = new StreamingResampler(sampleRate, 16000);
  private buffer = new Int16Array(320);
  private index = 0;
  private previousInput = 0;
  private previousOutput = 0;
  private energy = 0;
  private muted = false;
  private epoch = 0;
  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<{ muted: boolean; epoch: number }>) => {
      this.muted = event.data.muted; this.epoch = event.data.epoch;
      this.resampler = new StreamingResampler(sampleRate, 16000);
      this.buffer = new Int16Array(320); this.index = this.energy = this.previousInput = this.previousOutput = 0;
    };
  }
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || this.muted) return true;
    const filtered = new Float32Array(input.length);
    const alpha = Math.exp(-2 * Math.PI * 80 / sampleRate);
    for (let i = 0; i < input.length; i++) {
      const value = alpha * (this.previousOutput + input[i] - this.previousInput);
      this.previousInput = input[i]; this.previousOutput = value;
      filtered[i] = value;
    }
    for (const sample of this.resampler.process(filtered)) {
      const clamped = Math.max(-1, Math.min(1, sample));
      this.buffer[this.index++] = Math.round(clamped * (clamped < 0 ? 32768 : 32767));
      this.energy += clamped * clamped;
      if (this.index === 320) {
        const pcm = this.buffer;
        this.port.postMessage({ pcm: pcm.buffer, volume: Math.sqrt(this.energy / 320), epoch: this.epoch }, [pcm.buffer]);
        this.buffer = new Int16Array(320); this.index = 0; this.energy = 0;
      }
    }
    return true;
  }
}
registerProcessor('cristi-capture', CaptureProcessor);
