import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, EVENTS, eventBus } from '../src/services/eventBus.js';
import { TranslationOutputCoordinator } from '../src/services/translation/TranslationOutputCoordinator.js';
import { TranslationService } from '../src/services/translation/TranslationService.js';

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('local translation publishes text before synthesis and plays a completed result exactly once', async () => {
  const bus = new EventBus();
  const outputEvents = [];
  const generated = [];
  let playCalls = 0;
  const coordinator = new TranslationOutputCoordinator({
    bus,
    router: { markGenerated: (frameId, source) => generated.push({ frameId, source }) },
    getAudioOutput: () => ({
      isPlaying: false,
      getTelemetry: () => ({ queueLength: 0, activeSourcesCount: 0 }),
      async playAudioChunk(data) { playCalls += 1; assert.equal(data, 'AQIDBA=='); }
    })
  });
  const unsubscribe = bus.on('translation.local_output', (event) => outputEvents.push(event.payload));
  coordinator.start();

  const payload = {
    sourceId: 'discord_voice:guild:user',
    speakerId: 'user',
    sourceLanguage: 'en',
    translation: 'Hola Cristi',
    outputRoute: 'local'
  };
  bus.emitDomain(EVENTS.TRANSLATION_TEXT_READY, payload, { source: 'test', correlationId: 'translation-1' });
  await nextTick();
  assert.equal(outputEvents.length, 1);
  assert.equal(outputEvents[0].stage, 'text_ready');
  assert.equal(playCalls, 0);

  bus.emitDomain(EVENTS.TRANSLATION_COMPLETED, {
    ...payload,
    audio: { data: 'AQIDBA==', sampleRate: 24000, frameId: 'tts-1' }
  }, { source: 'test', correlationId: 'translation-1' });
  await nextTick();
  assert.equal(outputEvents.length, 1, 'el texto no se vuelve a publicar tras completar TTS');
  assert.equal(playCalls, 1);
  assert.deepEqual(generated, [{ frameId: 'tts-1', source: 'cristi_translation' }]);

  bus.emitDomain(EVENTS.TRANSLATION_COMPLETED, {
    ...payload,
    audio: { data: 'AQIDBA==', sampleRate: 24000, frameId: 'tts-1' }
  }, { source: 'test', correlationId: 'translation-1' });
  await nextTick();
  assert.equal(playCalls, 1, 'una retransmisión no genera una segunda voz');

  unsubscribe();
  coordinator.destroy();
});

test('local translation keeps its subtitle but drops audio while live PCM is occupied', async () => {
  const bus = new EventBus();
  let playCalls = 0;
  const coordinator = new TranslationOutputCoordinator({
    bus,
    getAudioOutput: () => ({
      isPlaying: true,
      getTelemetry: () => ({ queueLength: 1, activeSourcesCount: 1 }),
      async playAudioChunk() { playCalls += 1; }
    })
  });
  const outputEvents = [];
  const unsubscribe = bus.on('translation.local_output', (event) => outputEvents.push(event.payload));
  coordinator.start();
  bus.emitDomain(EVENTS.TRANSLATION_COMPLETED, {
    sourceId: 'game_loopback', translation: 'Subtítulo conservado', outputRoute: 'local',
    audio: { data: 'AQI=', sampleRate: 24000 }
  }, { source: 'test', correlationId: 'translation-busy' });
  await nextTick();
  assert.equal(outputEvents.length, 1);
  assert.equal(playCalls, 0);
  unsubscribe();
  coordinator.destroy();
});

test('translation aggregation closes on silence, emits text before delayed TTS, and discards superseded utterances', async () => {
  let handler = null;
  let resolveSynthesis;
  const textReady = [];
  const completed = [];
  const service = new TranslationService({ provider: {
    isVoiceActivity: (data) => data !== 'silence',
    transcribe: async ({ data }) => ({ text: data === 'AQIDBA==' ? 'first phrase' : 'second phrase' }),
    detectLanguage: async () => ({ language: 'en' }),
    translate: async ({ text }) => ({ text: `es:${text}` }),
    synthesize: () => new Promise((resolve) => { resolveSynthesis = resolve; })
  }});
  const source = { sourceId: 'game_loopback', setFrameHandler(next) { handler = next; } };
  const unsubText = busSubscribe(EVENTS.TRANSLATION_TEXT_READY, textReady);
  const unsubComplete = busSubscribe(EVENTS.TRANSLATION_COMPLETED, completed);
  service.attachSource(source, { aggregateMs: 250, maxUtteranceMs: 1800 });
  handler({ frameId: 'a', sourceId: 'game_loopback', data: 'AQI=', sampleRate: 16000 });
  handler({ frameId: 'b', sourceId: 'game_loopback', data: 'AwQ=', sampleRate: 16000 });
  handler({ frameId: 'silence', sourceId: 'game_loopback', data: 'silence', sampleRate: 16000 });
  await nextTick();
  assert.equal(textReady.length, 1);
  assert.equal(textReady[0].transcript, 'first phrase');
  assert.equal(completed.length, 0, 'TTS lento no retrasa el subtítulo');
  resolveSynthesis({ data: 'AQI=', sampleRate: 24000 });
  await nextTick();
  assert.equal(completed.length, 1);
  unsubText();
  unsubComplete();
  service.destroy();

  let supersedeHandler = null;
  let resolveFirstTranscription;
  let transcriptionCalls = 0;
  const supersededCompleted = [];
  const supersedingService = new TranslationService({ provider: {
    isVoiceActivity: (data) => data !== 'silence',
    transcribe: ({ data }) => {
      transcriptionCalls += 1;
      if (transcriptionCalls === 1) return new Promise((resolve) => { resolveFirstTranscription = resolve; });
      return Promise.resolve({ text: data === 'AwQ=' ? 'new' : 'unexpected' });
    },
    detectLanguage: async () => ({ language: 'en' }),
    translate: async ({ text }) => ({ text: `es:${text}` })
  }});
  const supersedeSource = { sourceId: 'external_voice', setFrameHandler(next) { supersedeHandler = next; } };
  const unsubSuperseded = busSubscribe(EVENTS.TRANSLATION_COMPLETED, supersededCompleted);
  supersedingService.attachSource(supersedeSource, { aggregateMs: 50 });
  supersedeHandler({ frameId: 'one', sourceId: 'external_voice', data: 'AQI=' });
  supersedeHandler({ frameId: 'pause-one', sourceId: 'external_voice', data: 'silence' });
  await nextTick();
  supersedeHandler({ frameId: 'two', sourceId: 'external_voice', data: 'AwQ=' });
  supersedeHandler({ frameId: 'pause-two', sourceId: 'external_voice', data: 'silence' });
  resolveFirstTranscription({ text: 'old' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(supersededCompleted.length, 1);
  assert.equal(supersededCompleted[0].transcript, 'new');
  assert.equal(supersedingService.getMetrics().superseded, 1);
  unsubSuperseded();
  supersedingService.destroy();
});

test('translation service refuses capture attachment after the user disables external translation', async () => {
  const service = new TranslationService();
  const source = { setFrameHandler() {} };
  assert.equal(service.setEnabled(false), false);
  assert.equal(service.attachSource(source), false);
  assert.deepEqual(await service.processFrame({ data: 'AQI=' }), { success: false, disabled: true });
  service.destroy();
});

function busSubscribe(type, target) {
  // TranslationService deliberately uses the shared domain bus so integrations
  // receive one envelope regardless of source. Tests observe that same bus.
  return eventBus.on(type, (event) => target.push(event.payload));
}
