import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundFxService } from '../src/domain/audio/SoundFxService';
import { AudioRoutingService } from '../src/domain/audio/AudioRoutingService';

test('SoundFxService controls volume, toggle state, and handles non-browser environments safely', () => {
  const soundFx = new SoundFxService();

  assert.equal(soundFx.isEnabled, true);

  soundFx.setEnabled(false);
  assert.equal(soundFx.isEnabled, false);

  soundFx.setEnabled(true);
  assert.equal(soundFx.isEnabled, true);

  // In Node.js environment without window/AudioContext, sound methods must not throw
  assert.doesNotThrow(() => soundFx.playClick());
  assert.doesNotThrow(() => soundFx.playSuccess());
  assert.doesNotThrow(() => soundFx.playWarning());
  assert.doesNotThrow(() => soundFx.playError());
  assert.doesNotThrow(() => soundFx.playBossKey());
  assert.doesNotThrow(() => soundFx.playMuteToggle(true));
  assert.doesNotThrow(() => soundFx.playMuteToggle(false));
  assert.doesNotThrow(() => soundFx.setVolume(0.5));
});

test('AudioRoutingService registers sources, configures routes, and prevents feedback loops', () => {
  const router = new AudioRoutingService();

  // Register sources
  assert.equal(router.registerSource('mic_default', { kind: 'microphone' }), true);
  assert.equal(router.registerSource('desktop_loopback', { kind: 'loopback' }), true);

  // Configure routes
  assert.equal(router.setRoute('mic_default', 'gemini_live_input', { purpose: 'dialogue' }), true);
  assert.equal(router.setRoute('desktop_loopback', 'audio_analysis', { purpose: 'spectrum' }), true);

  const route = router.getRoute('mic_default');
  assert.ok(route);
  assert.equal(route?.targetId, 'gemini_live_input');

  // Prevent feedback loops by marking generated audio frames
  const generatedId = 'gen_frame_9988';
  router.markGenerated(generatedId, 'cristi_tts');
  assert.equal(router.isGenerated(generatedId), true);
  assert.equal(router.isGenerated('real_user_mic_frame'), false);

  // Unregister source clears route
  router.unregisterSource('mic_default');
  assert.equal(router.getRoute('mic_default'), undefined);
});
