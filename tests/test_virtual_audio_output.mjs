import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, EVENTS, eventBus } from '../src/services/eventBus.js';
import { VirtualAudioOutputService } from '../src/services/translation/VirtualAudioOutputService.js';
import { TranslationOutputCoordinator } from '../src/services/translation/TranslationOutputCoordinator.js';
import { TranslationService } from '../src/services/translation/TranslationService.js';
import { ConfigManager } from '../src/services/configManager.js';
import { DesktopLoopbackCaptureService } from '../src/services/translation/DesktopLoopbackCaptureService.js';

function createContext() {
  const sources = [];
  return {
    currentTime: 2,
    state: 'running',
    sinkIds: [],
    destination: {},
    async setSinkId(deviceId) { this.sinkIds.push(deviceId); },
    createBuffer(_channels, length, sampleRate) {
      const samples = new Float32Array(length);
      return { sampleRate, getChannelData: () => samples, samples };
    },
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, startAt: null, onended: null, start(at) { this.startAt = at; } };
      sources.push(source);
      return source;
    },
    async close() { this.state = 'closed'; },
    sources
  };
}

test('virtual output selects only the configured render endpoint and protects loopback during playback', async () => {
  const bus = new EventBus();
  const context = createContext();
  const service = new VirtualAudioOutputService({ bus, audioContextFactory: () => context });
  const lifecycle = [];
  const stop = bus.onAny((type) => lifecycle.push(type));

  assert.equal((await service.configure({ deviceId: 'vb-cable-input', deviceLabel: 'CABLE Input' })).configured, true);
  assert.deepEqual(context.sinkIds, ['vb-cable-input']);
  const result = await service.playAudioChunk('AQIDBA==', { sampleRate: 16000, frameId: 'voice-1' });
  assert.equal(result.success, true);
  assert.equal(context.sources.length, 1);
  assert.ok(lifecycle.includes('translation.virtual_output_started'));
  context.sources[0].onended();
  assert.ok(lifecycle.includes('translation.virtual_output_ended'));
  assert.equal(service.getStatus().configured, true);
  stop();
  await service.destroy();
});

test('game voice route publishes subtitles immediately and sends synthesized PCM only to virtual output', async () => {
  const bus = new EventBus();
  const outputs = [];
  let gameCalls = 0;
  let localCalls = 0;
  const coordinator = new TranslationOutputCoordinator({
    bus,
    getAudioOutput: () => ({ async playAudioChunk() { localCalls += 1; } }),
    getGameAudioOutput: () => ({ async playAudioChunk(data, options) {
      gameCalls += 1;
      assert.equal(data, 'AQIDBA==');
      assert.equal(options.sampleRate, 16000);
      return { success: true };
    } })
  });
  const stop = bus.on('translation.game_voice_output', (event) => outputs.push(event.payload));
  coordinator.start();
  const payload = { sourceId: 'user_game_voice', translation: 'Hello team', outputRoute: 'game_voice' };
  bus.emitDomain(EVENTS.TRANSLATION_TEXT_READY, payload, { source: 'test', correlationId: 'game-voice-1' });
  await tick();
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].stage, 'text_ready');
  bus.emitDomain(EVENTS.TRANSLATION_COMPLETED, {
    ...payload, audio: { data: 'AQIDBA==', sampleRate: 16000, frameId: 'game-tts-1' }
  }, { source: 'test', correlationId: 'game-voice-1' });
  await tick();
  assert.equal(gameCalls, 1);
  assert.equal(localCalls, 0);
  stop();
  coordinator.destroy();
});

test('loopback remains protected until the virtual output has ended', () => {
  const loopback = new DesktopLoopbackCaptureService();
  loopback._installSpeechProtection();
  eventBus.emitDomain('translation.virtual_output_started', {}, { source: 'test' });
  assert.equal(loopback.getStatus().speechProtected, true);
  eventBus.emitDomain('translation.virtual_output_ended', {}, { source: 'test' });
  assert.equal(loopback.getStatus().speechProtected, false);
  loopback._releaseSpeechProtection();
});

test('explicit text translation emits a subtitle before TTS and preserves the game voice route', async () => {
  const textReady = [];
  const completed = [];
  const offText = eventBus.on(EVENTS.TRANSLATION_TEXT_READY, (event) => textReady.push(event.payload));
  const offComplete = eventBus.on(EVENTS.TRANSLATION_COMPLETED, (event) => completed.push(event.payload));
  let releaseTts;
  const service = new TranslationService({ provider: {
    translateAndDetect: async () => ({ text: 'Hola equipo', sourceLanguage: 'en' }),
    synthesize: () => new Promise((resolve) => { releaseTts = resolve; })
  } });
  const pending = service.translateText({ text: 'Hello team', targetLanguage: 'es', outputRoute: 'game_voice' });
  await tick();
  assert.equal(textReady.length, 1);
  assert.equal(textReady[0].outputRoute, 'game_voice');
  assert.equal(completed.length, 0);
  releaseTts({ data: 'AQI=', sampleRate: 24000 });
  const result = await pending;
  assert.equal(result.success, true);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].outputRoute, 'game_voice');
  offText();
  offComplete();
  service.destroy();
});

test('configuration accepts a bounded virtual game device identifier', () => {
  const manager = new ConfigManager();
  const config = manager.sanitizeConfig({ translationGameAudioDeviceId: ' vb-input ', translationGameAudioDeviceLabel: ' CABLE Input ' });
  assert.equal(config.translationGameAudioDeviceId, 'vb-input');
  assert.equal(config.translationGameAudioDeviceLabel, 'CABLE Input');
});

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
