import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { VisionFrameDispatcher } from '../src/services/vision/VisionFrameDispatcher.js';
import { eventBus, EVENTS } from '../src/services/eventBus.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
after(() => eventBus.clear?.());

test('vision dispatcher keeps the latest frame and never sends while audio is active', async () => {
  const sent = [];
  const socketRef = { current: { isConnected: true, websocket: { readyState: 1, bufferedAmount: 0 }, sendRealtimeMedia: (data) => { sent.push(data); return true; } } };
  const dispatcher = new VisionFrameDispatcher({ socketRef, minIntervalMs: 25 });
  try {
    eventBus.emit(EVENTS.AUDIO_START);
    dispatcher.enqueue('a'.repeat(64));
    await wait(35);
    assert.equal(sent.length, 0);
    eventBus.emit(EVENTS.AUDIO_END);
    await wait(100);
    assert.deepEqual(sent, ['a'.repeat(64)]);
  } finally { dispatcher.destroy(); }
});

test('backpressure retries without losing the newest frame', async () => {
  let congested = true;
  const sent = [];
  const socketRef = { current: { isConnected: true, websocket: { readyState: 1, get bufferedAmount() { return congested ? 100000 : 0; } }, sendRealtimeMedia: data => { sent.push(data); return true; } } };
  const dispatcher = new VisionFrameDispatcher({ socketRef, minIntervalMs: 10 });
  dispatcher.enqueue('old'.repeat(16));
  await wait(130);
  dispatcher.enqueue('new'.repeat(16));
  await wait(100);
  assert.equal(sent.length, 0);
  congested = false;
  await wait(160);
  assert.deepEqual(sent, ['new'.repeat(16)]);
  dispatcher.destroy();
});

test('different screen regions are never coalesced into one native frame', async () => {
  const source = await import('node:fs');
  const main = source.readFileSync('electron/main.cjs', 'utf8');
  assert.match(main, /activeScreenCapturePromises\.has\(regionKey\)/);
  assert.doesNotMatch(main, /return activeScreenCapturePromise;/);
});
