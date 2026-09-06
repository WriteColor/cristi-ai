import test from 'node:test';
import assert from 'node:assert/strict';

import { DesktopLoopbackCaptureService } from '../src/services/translation/DesktopLoopbackCaptureService.js';

test('WASAPI loopback cleans subscriptions and restarts once after an unexpected transport error', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let frameListener = null;
  let eventListener = null;
  let starts = 0;
  let stops = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    electronAPI: {
      isElectron: true,
      onDesktopAudioNativeFrame(listener) { frameListener = listener; return () => { frameListener = null; }; },
      onDesktopAudioNativeEvent(listener) { eventListener = listener; return () => { eventListener = null; }; },
      async desktopAudioNativeStart({ sourceId }) {
        starts += 1;
        return { success: true, transport: 'wasapi', sourceId };
      },
      async desktopAudioNativeStop() { stops += 1; return { success: true }; }
    }
  } });

  try {
    const capture = new DesktopLoopbackCaptureService();
    const started = await capture.start({ sourceId: 'game_loopback', restartBaseDelayMs: 100, maxRestartAttempts: 2 });
    assert.equal(started.success, true);
    assert.equal(capture.getStatus().running, true);
    eventListener({ type: 'error', sourceId: 'game_loopback', error: 'helper exited' });
    assert.equal(capture.getStatus().running, false);
    assert.equal(capture.getStatus().restarting, true);
    assert.equal(frameListener, null, 'the failed helper can no longer feed frames');
    await new Promise((resolve) => setTimeout(resolve, 135));
    assert.equal(starts, 2);
    assert.equal(capture.getStatus().running, true);
    assert.equal(capture.getStatus().transport, 'wasapi');
    assert.ok(stops >= 1);
    capture.stop();
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  }
});

test('a finished browser audio track releases capture state instead of leaving it running', () => {
  let ended = null;
  const track = {
    addEventListener(type, listener) { if (type === 'ended') ended = listener; },
    removeEventListener() {},
    stop() {}
  };
  const capture = new DesktopLoopbackCaptureService();
  capture.running = true;
  capture.operationGeneration = 7;
  capture.stream = { getTracks: () => [track] };
  capture._watchAudioTrack(track, 7);
  ended();
  assert.equal(capture.getStatus().running, false);
  assert.equal(capture.getStatus().lastStopReason, 'audio_track_ended');
  assert.equal(capture.audioTrack, null);
});
