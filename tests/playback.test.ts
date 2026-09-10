import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioOutputPlayer } from '../src/domain/gemini/AudioOutputPlayer';
import { eventBus, EVENTS } from '../src/infrastructure/events/eventBus';

class FakeContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  sources: FakeSource[] = [];
  private endedIndex = 0;
  createGain() { return { connect() {}, disconnect() {} }; }
  createBuffer(_channels: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return { duration: length / rate, getChannelData: () => data };
  }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  advance(time: number) {
    this.currentTime = time;
    for (; this.endedIndex < this.sources.length; this.endedIndex++) {
      const source = this.sources[this.endedIndex];
      if (source.startTime + source.buffer.duration > time) break;
      if (!source.ended && source.startTime + source.buffer.duration <= time) {
        source.ended = true; source.onended?.();
      }
    }
  }
}
class FakeSource {
  buffer = { duration: 0 };
  playbackRate = { value: 0 };
  startTime = 0;
  ended = false;
  onended: (() => void) | null = null;
  connect() {}
  disconnect() {}
  start(time: number) { this.startTime = time; }
  stop() { this.ended = true; }
}
const pcm20ms = Buffer.alloc(480 * 2).toString('base64');
test('ten-minute output clock: 1x, bounded schedule, no overlaps or gaps', async () => {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext;
  const player = new AudioOutputPlayer();
  try {
    player.beginGeneration(); player.initContext();
    const context = player.audioContext as unknown as FakeContext;
    const ahead: number[] = [];
    // A deterministic steady network fixture. This does not model provider bursts or device latency.
    for (let i = 0; i < 30000; i++) {
      context.advance(i * 0.02);
      await player.playChunk(pcm20ms);
      ahead.push(player.getTelemetry().scheduledAheadMs);
    }
    player.signalGenerationComplete(); player.signalTurnComplete();
    assert.equal(context.sources.length, 30000);
    for (let i = 0; i < context.sources.length; i++) {
      const source = context.sources[i]; assert.equal(source.playbackRate.value, 1);
      if (i) assert(Math.abs(source.startTime - context.sources[i - 1].startTime - 0.02) < 1e-8);
    }
    const first = context.sources[0]; const last = context.sources.at(-1)!;
    assert(Math.abs(last.startTime + last.buffer.duration - first.startTime - 600) < 0.02);
    ahead.sort((a, b) => a - b); assert(ahead[Math.floor(ahead.length * 0.95)] < 250);
    context.advance(601); assert.equal(player.isPlaying, false);
    await player.playChunk(pcm20ms); assert.equal(context.sources.length, 30000, 'late PCM must not reopen a completed generation');
  } finally { player.destroy(); globalThis.AudioContext = previous; }
});

test('stop invalidates pending resume and repeated lifecycle releases subscriptions', async () => {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext;
  let updates = 0;
  const first = new AudioOutputPlayer({ onVolumeChange: () => updates++ });
  first.destroy(); first.destroy();
  const baseline = updates;
  const second = new AudioOutputPlayer({ onVolumeChange: () => updates++ });
  eventBus.emit(EVENTS.AUDIO_ANALYSIS, { volume: 0.5, mouthOpen: 0.4 });
  assert.equal(updates, baseline + 1);
  try {
    second.initContext();
    const context = second.audioContext as unknown as FakeContext;
    let resume!: () => void;
    context.state = 'suspended'; context.resume = () => new Promise(resolve => { resume = resolve; });
    const pending = second.playChunk(pcm20ms);
    second.stopImmediate(); resume(); await pending;
    assert.equal(context.sources.length, 0);
  } finally { second.destroy(); globalThis.AudioContext = previous; }
});
