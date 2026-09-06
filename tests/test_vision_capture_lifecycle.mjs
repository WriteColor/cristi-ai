import test from 'node:test';
import assert from 'node:assert/strict';
import { ScreenCaptureService } from '../src/services/screenCaptureService.js';
import { VisionStreamManager } from '../src/services/vision/VisionStreamManager.js';
import { VisionFrameDispatcher } from '../src/services/vision/VisionFrameDispatcher.js';
import { eventBus, EVENTS } from '../src/services/eventBus.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
async function advance(t, ms) {
  t.mock.timers.tick(ms);
  for (let n = 0; n < 12; n++) await Promise.resolve();
}
function setup(t, { native = true } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const previous = Object.getOwnPropertyDescriptors(globalThis);
  globalThis.window = { screen: { width: 1920, height: 1080 }, electronAPI: { isElectron: native } };
  t.after(() => {
    for (const name of ['window', 'navigator', 'document']) {
      if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
      else delete globalThis[name];
    }
  });
}
function mediaStream() {
  const track = { stops: 0, stop() { this.stops++; } };
  return { track, getTracks: () => [track], getVideoTracks: () => [track] };
}
function socket(sent) {
  return { isConnected: true, websocket: { readyState: 1, bufferedAmount: 0 },
    sendRealtimeMedia(data) { sent.push({ data, time: Date.now() }); return true; } };
}

test('screen capture remains paced during speech and refreshes immediately after it', async t => {
  setup(t);
  const frames = [];
  const capture = new ScreenCaptureService({ onFrame: frame => frames.push(frame) });
  t.after(() => capture.stopAll());
  capture.captureActiveFrame = async () => 'screen';
  await capture.startContinuous();
  await advance(t, 120);
  assert.equal(frames.length, 1);
  eventBus.emit(EVENTS.AUDIO_START);
  await advance(t, 2000);
  assert.equal(frames.length, 2);
  eventBus.emit(EVENTS.AUDIO_END);
  await advance(t, 120);
  assert.equal(frames.length, 3);
  await advance(t, 2000);
  await advance(t, 2000);
  assert.equal(frames.length, 5, 'capture must continue beyond the immediate frame');
  capture.stopAll();
  await advance(t, 10000);
  assert.equal(frames.length, 5);
});

test('slow IPC cannot overlap immediate capture or publish into a restarted session', async t => {
  setup(t);
  const frames = [];
  const slow = deferred();
  let calls = 0;
  const capture = new ScreenCaptureService({ onFrame: frame => frames.push(frame) });
  t.after(() => capture.stopAll());
  capture.captureActiveFrame = () => ++calls === 1 ? slow.promise : Promise.resolve('fresh');
  await capture.startContinuous();
  await advance(t, 120);
  for (let n = 0; n < 3; n++) capture.triggerImmediateCapture();
  await advance(t, 5000);
  assert.equal(calls, 1);
  capture.stopContinuous();
  await capture.startContinuous();
  await advance(t, 120);
  assert.equal(calls, 1, 'restart must share the existing IPC lock');
  slow.resolve('obsolete');
  await advance(t, 0);
  assert.deepEqual(frames, []);
  await advance(t, 120);
  assert.deepEqual(frames, ['fresh']);
  await advance(t, 2000);
  assert.deepEqual(frames, ['fresh', 'fresh']);
});

test('region change discards an in-flight image of the previous area', async t => {
  setup(t);
  const first = deferred();
  const frames = [];
  const capture = new ScreenCaptureService({ onFrame: frame => frames.push(frame) });
  t.after(() => capture.stopAll());
  capture.captureActiveFrame = () => first.promise;
  await capture.startContinuous();
  await advance(t, 120);
  capture.setRegion({ x_pct: 20, y_pct: 10, w_pct: 30, h_pct: 40 });
  first.resolve('old full screen');
  await advance(t, 0);
  assert.deepEqual(frames, []);
  capture.captureActiveFrame = async () => 'new region';
  await advance(t, 2000);
  assert.deepEqual(frames, ['new region']);
});

test('late screen permission after stop releases tracks without attaching a stream', async t => {
  setup(t, { native: false });
  const permission = deferred();
  const stream = mediaStream();
  Object.defineProperty(globalThis, 'navigator', { configurable: true,
    value: { mediaDevices: { getDisplayMedia: () => permission.promise } } });
  let ready = 0;
  const capture = new ScreenCaptureService({ onStreamReady: () => ready++ });
  t.after(() => capture.stopAll());
  const start = capture.startContinuous();
  capture.stopContinuous();
  permission.resolve(stream);
  assert.equal(await start, false);
  assert.equal(stream.track.stops, 1);
  assert.equal(capture.stream, null);
  assert.equal(ready, 0);
});

test('late camera permission cannot overwrite a newer camera or revive disposed manager', async t => {
  setup(t);
  const first = deferred();
  const oldStream = mediaStream();
  const newStream = mediaStream();
  let requests = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: () => ++requests === 1 ? first.promise : Promise.resolve(newStream)
  } } });
  globalThis.document = { createElement: name => name === 'video'
    ? { play: async () => {}, pause() {}, readyState: 2 }
    : { getContext: () => ({ drawImage() {} }), toDataURL: () => `data:image/jpeg;base64,${'c'.repeat(64)}` } };
  const manager = new VisionStreamManager();
  t.after(() => manager.dispose());
  const oldStart = manager.startCameraMonitoring();
  assert.equal(await manager.startCameraMonitoring(), true);
  first.resolve(oldStream);
  assert.equal(await oldStart, false);
  assert.equal(oldStream.track.stops, 1);
  assert.equal(manager.cameraStream, newStream);
  manager.dispose();
  assert.equal(newStream.track.stops, 1);
  assert.equal(await manager.startCameraMonitoring(), false);
});

test('manager socket replacement reaches transport and stop clears queued screen frames', async t => {
  setup(t);
  const sent = [];
  const manager = new VisionStreamManager();
  t.after(() => manager.dispose());
  manager.setSocketRef({ current: socket(sent) });
  manager.captureScreenNative = async () => 's'.repeat(64);
  manager.startScreenMonitoring();
  await advance(t, 120);
  await advance(t, 0);
  assert.equal(sent.length, 1);
  manager.frameDispatcher.enqueue('q'.repeat(64), 'screen');
  manager.stopScreenMonitoring();
  await advance(t, 5000);
  assert.equal(sent.length, 1);
});

test('transport fairly sends latest frame of each source and enforces rate after AUDIO_END', async t => {
  setup(t);
  const sent = [];
  const dispatcher = new VisionFrameDispatcher({ socketRef: { current: socket(sent) } });
  t.after(() => dispatcher.destroy());
  dispatcher.enqueue('s'.repeat(64), 'screen');
  dispatcher.enqueue('c'.repeat(64), 'camera');
  dispatcher.enqueue('d'.repeat(64), 'camera');
  await advance(t, 0);
  assert.deepEqual(sent.map(f => f.data), ['s'.repeat(64)]);
  eventBus.emit(EVENTS.AUDIO_END);
  await advance(t, 80);
  assert.equal(sent.length, 1);
  await advance(t, 920);
  assert.deepEqual(sent.map(f => f.data), ['s'.repeat(64), 'd'.repeat(64)]);
  assert.equal(sent[1].time - sent[0].time, 1000);
});

test('transport recovers from thrown send and expires frames under persistent congestion', async t => {
  setup(t);
  const sent = [];
  const current = socket(sent);
  let fail = true;
  const send = current.sendRealtimeMedia;
  current.sendRealtimeMedia = data => { if (fail) throw new Error('closed during send'); return send(data); };
  const dispatcher = new VisionFrameDispatcher({ socketRef: { current }, maxAgeMs: 1000 });
  t.after(() => dispatcher.destroy());
  dispatcher.enqueue('f'.repeat(64), 'screen');
  await advance(t, 0);
  assert.equal(sent.length, 0);
  fail = false;
  await advance(t, 250);
  assert.equal(sent.length, 1);
  current.websocket.bufferedAmount = 100000;
  dispatcher.enqueue('g'.repeat(64), 'screen');
  await advance(t, 2000);
  assert.equal(dispatcher.pending.size, 0);
  assert.equal(dispatcher.timer, null);
});
