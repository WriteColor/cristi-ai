import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioPlayoutQueue } from '../src/domain/audio/AudioPlayoutQueue';
import { GeminiLiveSocket } from '../src/domain/gemini/LiveTransport';

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 1;
  bufferedAmount = 0;
  sent: Record<string, any>[] = [];
  onopen: (() => void) | null = null;
  onclose: ((event: object) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close(code: number, reason: string) {
    this.readyState = 3;
    this.onclose?.({ code, reason, wasClean: true });
  }
}

test('AudioPlayoutQueue: production bursts faster than real-time do not inflate jitter', () => {
  const queue = new AudioPlayoutQueue();
  queue.begin();

  // Baseline arrival
  let now = 1000;
  queue.receive(now, 120);
  assert.equal(queue.jitterMs, 0);
  assert.equal(queue.targetMs, 30);

  // Gemini sends five 120ms chunks in rapid succession (every 20ms)
  // Total audio duration = 600ms, arrival elapsed = 100ms.
  // This is an advantageous burst, NOT network jitter or starvation.
  for (let i = 0; i < 5; i++) {
    now += 20;
    queue.receive(now, 120);
    // targetMs should stay bounded around min target (30ms), never blowing up to 120ms
    assert(queue.targetMs <= 35, `targetMs (${queue.targetMs}) inflated during faster-than-realtime burst`);
    assert(queue.bufferedDurationMs >= 120, 'bufferedDurationMs tracks queued audio');
  }
});

test('AudioPlayoutQueue: arrival gaps exceeding chunk duration adaptively increase targetMs', () => {
  const queue = new AudioPlayoutQueue();
  queue.begin();

  let now = 1000;
  queue.receive(now, 50);

  // Packets arrive delayed: 150ms interval for 50ms chunk (100ms starvation risk)
  for (let i = 0; i < 6; i++) {
    now += 150;
    queue.receive(now, 50);
  }

  // Jitter and targetMs should have adapted upwards to protect playout against starvation
  assert(queue.jitterMs > 10, `expected jitterMs > 10, got ${queue.jitterMs}`);
  assert(queue.targetMs > 40, `expected targetMs > 40, got ${queue.targetMs}`);
  assert(queue.targetMs <= 120, `targetMs must remain bounded <= 120ms, got ${queue.targetMs}`);
});

test('AudioPlayoutQueue: begin decays prior jitter by 50% and consume manages buffer accounting', () => {
  const queue = new AudioPlayoutQueue();
  queue.jitterMs = 40;

  queue.begin();
  assert.equal(queue.jitterMs, 20, 'jitterMs must decay by 50% across turns');
  assert.equal(queue.bufferedDurationMs, 0);
  assert.equal(queue.totalReceivedDurationMs, 0);

  // Receive two 100ms chunks
  queue.receive(1000, 100);
  queue.receive(1020, 100);
  assert.equal(queue.totalReceivedDurationMs, 200, 'totalReceivedDurationMs tracks cumulative audio');
  assert.equal(queue.bufferedDurationMs, 200, 'bufferedDurationMs tracks unconsumed audio');

  // Consume 80ms
  queue.consume(80);
  assert.equal(queue.bufferedDurationMs, 120, 'bufferedDurationMs decrements on consume');
  assert.equal(queue.totalReceivedDurationMs, 200, 'totalReceivedDurationMs does not decrement');

  // Over-consume cannot go below 0
  queue.consume(300);
  assert.equal(queue.bufferedDurationMs, 0, 'bufferedDurationMs clamps to 0');
});

test('GeminiLiveSocket sends explicit VAD endpointing config in initial setup', async () => {
  const originalWs = globalThis.WebSocket;
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;

  let setupCompleteFired = false;
  const socket = new GeminiLiveSocket({
    tokenProvider: async () => 'test_token',
    includeCompanionContext: true,
    vadSilenceDurationMs: 550,
    vadPrefixPaddingMs: 25,
    onSetupComplete: () => {
      setupCompleteFired = true;
    }
  });

  try {
    await socket.connect();
    const ws = FakeWebSocket.instances.at(-1)!;
    ws.onopen?.();

    assert.equal(ws.sent.length, 1);
    const setup = ws.sent[0].setup;
    assert.ok(setup);

    // Verify VAD activity detection config
    const vad = setup.realtimeInputConfig?.automaticActivityDetection;
    assert.ok(vad, 'realtimeInputConfig.automaticActivityDetection must be present');
    assert.equal(vad.disabled, false);
    assert.equal(vad.startOfSpeechSensitivity, 'START_SENSITIVITY_HIGH');
    assert.equal(vad.endOfSpeechSensitivity, 'END_SENSITIVITY_HIGH');
    assert.equal(vad.silenceDurationMs, 550);
    assert.equal(vad.prefixPaddingMs, 25);

    // Verify voice cadence directive
    const promptText = setup.systemInstruction?.parts?.[0]?.text;
    assert.ok(promptText);
    assert(promptText.includes('conversacional natural, fluido y continuo'), 'Prompt must use fluid cadence');
    assert(!promptText.includes('Habla un poquito más lento de lo habitual'), 'Old slow directive must be eliminated');
    assert(!promptText.includes('saboreando cada palabra'), 'Old slow directive must be eliminated');

    // Verify onSetupComplete callback
    await socket.handleServerMessage(JSON.stringify({ setupComplete: {} }));
    assert.equal(setupCompleteFired, true);
    assert.equal(socket.isConnected, true);

    // Verify playout timestamp recording
    socket.firstModelAudioChunkTimestamp = 1000;
    socket.recordPlayoutTimestamp(1045);
    assert.equal(socket.firstPlayoutTimestamp, 1045);
  } finally {
    socket.disconnect();
    globalThis.WebSocket = originalWs;
  }
});
