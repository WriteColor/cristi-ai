import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioInputProcessor } from '../src/domain/gemini/AudioInputProcessor';

test('stop/start while permission is pending keeps the new capture and releases the stale stream', async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousContext = globalThis.AudioContext;
  const previousWorklet = globalThis.AudioWorkletNode;
  const requests: ((stream: unknown) => void)[] = [];
  const stopped = new Set<number>();
  const stream = (id: number) => ({ getTracks: () => [{ stop: () => stopped.add(id) }] });
  const node = () => ({ connect() {}, disconnect() {}, gain: { value: 1 } });
  class Context {
    state = 'running'; destination = {};
    audioWorklet = { addModule: async () => {} };
    createGain = node; createMediaStreamSource = node;
    async resume() {} async close() { this.state = 'closed'; }
  }
  class Worklet {
    port = { onmessage: null, postMessage() {}, close() {} };
    connect() {} disconnect() {}
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    mediaDevices: { getUserMedia: () => new Promise(resolve => requests.push(resolve)) },
  } });
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  globalThis.AudioWorkletNode = Worklet as unknown as typeof AudioWorkletNode;
  const capture = new AudioInputProcessor();
  try {
    const first = capture.start(); capture.stop();
    const second = capture.start(); assert.equal(requests.length, 2);
    requests[0](stream(1)); await first;
    assert(stopped.has(1)); assert.equal(capture.start(), second, 'old completion must not clear new pending start');
    requests[1](stream(2)); await second;
    assert(capture.isRecording); assert(!stopped.has(2));
    capture.stop(); assert(stopped.has(2));
  } finally {
    capture.stop();
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    globalThis.AudioContext = previousContext; globalThis.AudioWorkletNode = previousWorklet;
  }
});
