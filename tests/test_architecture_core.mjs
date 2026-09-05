import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, eventBus, EVENTS } from '../src/services/eventBus.js';
import { MemoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';
import { AudioRoutingService } from '../src/services/translation/AudioRoutingService.js';
import { TranslationService } from '../src/services/translation/TranslationService.js';
import { DesktopLoopbackCaptureService } from '../src/services/translation/DesktopLoopbackCaptureService.js';
import { MemoryIndex } from '../src/services/memory/MemoryIndex.js';
import { MemoryRepository } from '../src/services/memory/MemoryRepository.js';
import { DiscordVoiceService } from '../src/services/discord/DiscordVoiceService.js';
import { GeminiTranslationProvider } from '../src/services/translation/GeminiTranslationProvider.js';
import fs from 'node:fs';

test('domain event envelopes are traceable and wildcard listeners are isolated', () => {
  const bus = new EventBus();
  const seen = [];
  bus.onAny((type, data) => seen.push({ type, data }));
  const event = bus.emitDomain('memory.created', { key: 'music' }, {
    source: 'test', sessionId: 's1', correlationId: 'c1', priority: 'high', privacy: 'private'
  });
  assert.equal(event.sessionId, 's1');
  assert.equal(event.correlationId, 'c1');
  assert.equal(seen.length, 2);
  assert.equal(seen[0].type, 'domain_event');
  assert.equal(seen[1].type, 'memory.created');
});

test('memory sessions persist summaries and supersede contradictions', async () => {
  let stored = [];
  const memory = new MemoryService({ repository: {
    storageKey: 'test-memory',
    async load() { return stored; },
    async save(records) { stored = structuredClone(records); return true; }
  }});
  await memory.initialize();
  memory.startSession('test-session');
  memory.recordTurn({ role: 'user', text: 'Me gusta jugar Minecraft por las noches.' });
  memory.recordTurn({ role: 'model', text: 'Lo recordaré para acompañarte.' });
  const first = await memory.remember({ key: 'favorite_game', content: 'Minecraft', category: MEMORY_CATEGORIES.PREFERENCE, source: 'test' });
  const second = await memory.remember({ key: 'favorite_game', content: 'Stardew Valley', category: MEMORY_CATEGORIES.PREFERENCE, source: 'test' });
  assert.equal(second.id, first.id);
  assert.equal(second.previousVersions.length, 1);
  const summary = await memory.endSession();
  assert.equal(summary.category, MEMORY_CATEGORIES.CONVERSATION);
  assert.match(summary.content, /Minecraft/);
});

test('Spotify credentials are never hardcoded in the application bundle', () => {
  const spotifySource = fs.readFileSync('src/services/spotify/SpotifyService.js', 'utf8');
  const appSource = fs.readFileSync('src/App.jsx', 'utf8');
  assert.doesNotMatch(spotifySource, /137a82bce2e94563959a2d99bca747b7|68a444218dab4a25898c2bbdd76b35db/);
  assert.doesNotMatch(appSource, /137a82bce2e94563959a2d99bca747b7|68a444218dab4a25898c2bbdd76b35db/);
});

test('concurrent memory sessions keep turns isolated and closing one cannot erase a replacement', async () => {
  let releaseSave;
  const saveGate = new Promise(resolve => { releaseSave = resolve; });
  const saved = [];
  const repository = {
    storageKey: 'isolated-session-test',
    load: async () => [],
    save: async (memories) => { await saveGate; saved.push([...memories]); }
  };
  const memory = new MemoryService({ repository });
  await memory.initialize();
  // Let initialization's empty save finish before testing the close race.
  releaseSave();
  await Promise.resolve();
  memory.startSession('live_1', { source: 'gemini_live' });
  memory.recordTurn({ sessionId: 'live_1', role: 'user', text: 'Mensaje de la llamada.' });
  memory.ensureSession('discord_c1', { source: 'discord' });
  memory.recordTurn({ sessionId: 'discord_c1', role: 'user', text: 'Mensaje privado de Discord.' });
  assert.deepEqual(memory.getSession('live_1').turns.map(turn => turn.text), ['Mensaje de la llamada.']);
  assert.deepEqual(memory.getSession('discord_c1').turns.map(turn => turn.text), ['Mensaje privado de Discord.']);

  let releaseClosingSave;
  repository.save = async (memories) => {
    await new Promise(resolve => { releaseClosingSave = resolve; });
    saved.push([...memories]);
  };
  memory.recordTurn({ sessionId: 'live_1', role: 'model', text: 'Respuesta antigua.' });
  const closing = memory.endSession({ sessionId: 'live_1', source: 'gemini_live' });
  memory.ensureSession('live_1', { source: 'gemini_live' });
  memory.recordTurn({ sessionId: 'live_1', role: 'user', text: 'Mensaje de la llamada nueva.' });
  releaseClosingSave();
  await closing;
  assert.deepEqual(memory.getSession('live_1').turns.map(turn => turn.text), ['Mensaje de la llamada nueva.']);
  assert.equal(memory.getSession('discord_c1').turns.length, 1);
  assert.ok(memory.getAllMemories().some(item => item.content.includes('Respuesta antigua.')));
});

test('translation routing rejects generated audio and preserves source boundaries', async () => {
  const routing = new AudioRoutingService();
  routing.registerSource('game_loopback');
  const generatedId = 'generated-1';
  routing.markGenerated(generatedId);
  assert.equal(routing.acceptFrame({ frameId: generatedId, sourceId: 'game_loopback', data: 'pcm' }), false);

  const service = new TranslationService({ provider: {
    transcribe: async () => ({ text: 'hola' }),
    detectLanguage: async () => ({ language: 'es' }),
    translate: async ({ text }) => ({ text: `${text} translated` }),
    synthesize: async () => ({ frameId: generatedId, pcm: 'audio' })
  }});
  const result = await service.processFrame({ frameId: 'external-1', sourceId: 'game_loopback', data: 'pcm' });
  assert.equal(result.success, true);
  assert.equal(result.sourceLanguage, 'es');
  assert.equal(result.translation, 'hola translated');
  assert.equal(service.getMetrics().completed, 1);
});

test('translation source attachment keeps one latest frame per source and preserves speaker context', async () => {
  let handler = null;
  const completed = [];
  const service = new TranslationService({ provider: {
    isVoiceActivity: () => true,
    transcribe: async ({ data }) => {
      await new Promise((resolve) => setTimeout(resolve, 8));
      return { text: String(data), speakerId: 'speaker-a' };
    },
    detectLanguage: async () => ({ language: 'en' }),
    translate: async ({ text }) => ({ text: `es:${text}` }),
    synthesize: async ({ text }) => ({ frameId: `generated-${text}` })
  }});
  const source = { setFrameHandler(next) { handler = next; } };
  const unsubscribe = eventBus.on(EVENTS.TRANSLATION_COMPLETED, (event) => completed.push(event.payload));
  assert.equal(service.attachSource(source, { targetLanguage: 'es' }), true);
  handler({ frameId: 'f1', sourceId: 'game_loopback', data: 'first', sampleRate: 16000 });
  handler({ frameId: 'f2', sourceId: 'game_loopback', data: 'latest', sampleRate: 16000 });
  await new Promise((resolve) => setTimeout(resolve, 40));
  unsubscribe();
  assert.equal(completed.length, 2);
  assert.equal(completed[0].speakerId, 'speaker-a');
  assert.equal(completed.at(-1).transcript, 'latest');
  assert.equal(service.detachSource(source), true);
  assert.equal(service.attachEventSource('test.translation.audio', { targetLanguage: 'es' }), true);
  eventBus.emitDomain('test.translation.audio', { frameId: 'f3', sourceId: 'discord_voice:g1:u1', data: 'event', sampleRate: 16000 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(service.detachEventSource('test.translation.audio'), true);
});

test('desktop loopback capture fails safely outside a browser media environment', async () => {
  const capture = new DesktopLoopbackCaptureService();
  const result = await capture.start({ sourceId: 'game_loopback' });
  assert.equal(result.success, false);
  assert.match(result.error, /loopback no disponible/i);
  assert.equal(capture.getStatus().running, false);
});

test('desktop loopback cancellation cannot revive a late permission stream', async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousWorklet = globalThis.AudioWorkletNode;
  let resolvePermission;
  let stopped = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    mediaDevices: { getDisplayMedia: () => new Promise((resolve) => { resolvePermission = resolve; }) }
  } });
  globalThis.AudioWorkletNode = class FakeAudioWorkletNode {};
  const capture = new DesktopLoopbackCaptureService();
  const starting = capture.start({ sourceId: 'game_loopback' });
  capture.stop();
  resolvePermission({ getTracks: () => [{ stop: () => { stopped += 1; } }], getAudioTracks: () => [] });
  const result = await starting;
  assert.equal(result.success, false);
  assert.equal(stopped, 1);
  assert.equal(capture.getStatus().running, false);
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
  else delete globalThis.navigator;
  globalThis.AudioWorkletNode = previousWorklet;
});

test('desktop loopback prefers Electron WASAPI transport and forwards tagged PCM frames', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let frameListener = null;
  let stopped = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    electronAPI: {
      isElectron: true,
      onDesktopAudioNativeFrame: (callback) => { frameListener = callback; return () => { frameListener = null; }; },
      onDesktopAudioNativeEvent: () => () => {},
      desktopAudioNativeStart: async () => {
        setTimeout(() => frameListener?.({ frameId: 'wasapi-test-1', sourceId: 'game_loopback', sampleRate: 48000, data: 'AQI=' }), 0);
        return { success: true, transport: 'wasapi', sourceId: 'game_loopback' };
      },
      desktopAudioNativeStop: async () => { stopped = true; return { success: true }; }
    }
  } });
  const capture = new DesktopLoopbackCaptureService();
  const frames = [];
  capture.setFrameHandler((frame) => frames.push(frame));
  const result = await capture.start({ sourceId: 'game_loopback' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(result.transport, 'wasapi');
  assert.equal(capture.getStatus().transport, 'wasapi');
  assert.equal(frames[0].sampleRate, 48000);
  capture.stop();
  assert.equal(stopped, true);
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else delete globalThis.window;
});

test('memory index supports bounded semantic fallback and replacement without stale postings', () => {
  const index = new MemoryIndex({ dimensions: 32 });
  index.upsert({ id: 'one', key: 'juego favorito', content: 'Minecraft por las noches', category: 'preference' });
  index.upsert({ id: 'two', key: 'bebida', content: 'café sin azúcar', category: 'preference' });
  assert.equal(index.search('Minecraft', { limit: 1 })[0].id, 'one');
  index.upsert({ id: 'one', key: 'juego favorito', content: 'Stardew Valley los fines de semana', category: 'preference' });
  assert.equal(index.search('Minecraft', { limit: 2, minScore: 0.01 }).some((item) => item.id === 'one'), false);
  assert.equal(index.search('Stardew', { limit: 1 })[0].id, 'one');
});

test('memory repository prefers native SQLite IPC and retains a JSON fallback contract', async () => {
  let saved = null;
  const repository = new MemoryRepository({ bridge: {
    isElectron: true,
    async memoryLoad() { return { success: true, backend: 'sqlite', memories: [{ id: 'native-1' }] }; },
    async memorySave(records) { saved = records; return { success: true, backend: 'sqlite' }; }
  }});
  assert.deepEqual(await repository.load(), [{ id: 'native-1' }]);
  assert.equal(await repository.save([{ id: 'native-2' }]), true);
  assert.deepEqual(saved, [{ id: 'native-2' }]);
});

test('memory initialization seeds fresh storage without resurrecting an intentional clear', async () => {
  let stored = null;
  const repository = {
    storageKey: 'seed-test',
    async load() { return stored; },
    async save(records) { stored = structuredClone(records); return true; }
  };
  const first = new MemoryService({ repository });
  await first.initialize();
  assert.equal(first.getAllMemories().length, 2);
  await first.clearAll();
  const restarted = new MemoryService({ repository });
  await restarted.initialize();
  assert.equal(restarted.getAllMemories().length, 0);
});

test('discord voice adapter isolates participant sources and handles lifecycle without Electron', async () => {
  let audioHandler = null;
  let eventHandler = null;
  const sentAudio = [];
  let left = false;
  const bridge = {
    onDiscordVoiceAudio(handler) { audioHandler = handler; return () => { audioHandler = null; }; },
    onDiscordVoiceEvent(handler) { eventHandler = handler; return () => { eventHandler = null; }; },
    async discordVoiceJoin() { return { success: true }; },
    async discordVoiceLeave() { left = true; return { success: true }; },
    async discordVoiceSendAudio(payload) { sentAudio.push(payload); return { success: true }; }
  };
  const bus = new EventBus();
  const service = new DiscordVoiceService({ bridge, bus });
  assert.equal((await service.join({ guildId: 'g1', channelId: 'c1' })).success, true);
  assert.equal(service.getStatus().status, 'connected');
  const routed = audioHandler({ frameId: 'voice-1', guildId: 'g1', channelId: 'c1', userId: 'u1', data: 'cGNi', sampleRate: 16000 });
  assert.equal(routed.sourceId, 'discord_voice:g1:u1');
  bus.emitDomain(EVENTS.TRANSLATION_COMPLETED, {
    sourceId: routed.sourceId,
    audio: { data: 'AQIDBA==', sampleRate: 24000 }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sentAudio.length, 0);
  bus.emitDomain(EVENTS.TRANSLATION_COMPLETED, {
    sourceId: routed.sourceId,
    outputRoute: 'discord_voice',
    channelId: 'c1',
    audio: { data: 'AQIDBA==', sampleRate: 24000 }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sentAudio.length, 1);
  assert.notEqual(sentAudio[0].data, 'AQIDBA==');
  bus.emitDomain(EVENTS.TRANSLATION_COMPLETED, {
    sourceId: 'discord_voice:other-guild:u1',
    outputRoute: 'discord_voice',
    audio: { data: 'AQIDBA==', sampleRate: 16000 }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sentAudio.length, 1);
  eventHandler({ type: 'ready' });
  await service.leave();
  assert.equal(left, true);
  service.destroy();
});

test('Discord voice transport ignores the bot identity to prevent outbound translation loops', () => {
  const main = fs.readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(main, /discordClient\?\.user\?\.id/);
  assert.match(main, /Never decode the bot's own outbound translation/);
  assert.match(main, /scheduleDiscordVoiceReconnect/);
  assert.match(main, /DISCORD_VOICE_RECONNECT_MAX_ATTEMPTS/);
});

test('Gemini translation provider keeps audio transcription and text translation independently mockable', async () => {
  const requests = [];
  const provider = new GeminiTranslationProvider({
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      const prompt = JSON.parse(options.body).contents[0].parts[0].text;
      const text = prompt.startsWith('Transcribe') ? 'hello Ariel' : 'hola Ariel';
      return { ok: true, status: 200, async json() { return { candidates: [{ content: { parts: [{ text }] } }] }; } };
    },
    synthesize: async ({ text }) => ({ frameId: `tts-${text}` })
  });
  const transcript = await provider.transcribe({ data: 'cGNi', sourceId: 'discord_voice:g:u' });
  const translation = await provider.translate({ text: transcript.text, sourceLanguage: 'en', targetLanguage: 'es' });
  const audio = await provider.synthesize({ text: translation.text });
  assert.equal(transcript.text, 'hello Ariel');
  assert.equal(translation.text, 'hola Ariel');
  assert.equal(audio.frameId, 'tts-hola Ariel');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.contents[0].parts[1].inlineData.mimeType, 'audio/pcm;rate=16000');
  await provider.transcribe({ data: 'cGNi', sampleRate: 24000, sourceId: 'discord_voice:g:u' });
  assert.equal(requests[2].body.contents[0].parts[1].inlineData.mimeType, 'audio/pcm;rate=24000');
});

test('Gemini translation provider can synthesize a translated PCM response', async () => {
  let requestBody = null;
  const provider = new GeminiTranslationProvider({
    apiKey: 'tts-key',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AQIDBA==' } }] } }] };
        }
      };
    }
  });
  const audio = await provider.synthesize({ text: 'Hola Ariel', language: 'es' });
  assert.equal(audio.data, 'AQIDBA==');
  assert.equal(audio.sampleRate, 24000);
  assert.deepEqual(requestBody.generationConfig.responseModalities, ['AUDIO']);
});

test('translation service binds class-based providers when configured at runtime', async () => {
  const provider = new GeminiTranslationProvider({
    apiKey: 'runtime-key',
    fetchImpl: async (_url, options) => ({
      ok: true,
      async json() {
        const prompt = JSON.parse(options.body).contents[0].parts[0].text;
        return { candidates: [{ content: { parts: [{ text: prompt.startsWith('Transcribe') ? 'hello' : 'hola' }] } }] };
      }
    })
  });
  const service = new TranslationService();
  service.configure(provider);
  const result = await service.processFrame({ frameId: 'runtime', sourceId: 'runtime', data: 'AQI=' });
  assert.equal(result.success, true);
  assert.equal(result.translation, 'hola');
});

test('translation aggregation batches short PCM frames before a network provider call', async () => {
  let handler = null;
  const payloads = [];
  const service = new TranslationService({ provider: {
    isVoiceActivity: () => true,
    transcribe: async ({ data }) => { payloads.push(data); return { text: 'hello' }; },
    detectLanguage: async () => ({ language: 'en' }),
    translate: async () => ({ text: 'hola' })
  }});
  const source = { sourceId: 'game_loopback', setFrameHandler(next) { handler = next; } };
  service.attachSource(source, { aggregateMs: 20 });
  handler({ frameId: 'a', sourceId: 'game_loopback', data: 'AQI=', sampleRate: 16000 });
  handler({ frameId: 'b', sourceId: 'game_loopback', data: 'AwQ=', sampleRate: 16000 });
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0], 'AQIDBA==');
  service.destroy();
});

test('translation aggregation keeps Discord speakers in independent queues', async () => {
  const batches = [];
  const service = new TranslationService({ provider: {
    isVoiceActivity: () => true,
    transcribe: async ({ data, sourceId }) => { batches.push({ data, sourceId }); return { text: sourceId }; },
    detectLanguage: async () => ({ language: 'en' }),
    translate: async ({ text }) => ({ text })
  }});
  service.attachEventSource('discord.voice_audio', { aggregateMs: 15 });
  eventBus.emitDomain('discord.voice_audio', { sourceId: 'discord_voice:g:u1', frameId: 'u1a', data: 'AQI=' });
  eventBus.emitDomain('discord.voice_audio', { sourceId: 'discord_voice:g:u2', frameId: 'u2a', data: 'AwQ=' });
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map((item) => item.sourceId).sort(), ['discord_voice:g:u1', 'discord_voice:g:u2']);
  service.destroy();
});

test('detaching a translation source suppresses delayed results before translation or audio output', async () => {
  let handler = null;
  let resolveTranscription;
  let translations = 0;
  const completed = [];
  const unsubscribe = eventBus.on(EVENTS.TRANSLATION_COMPLETED, envelope => completed.push(envelope.payload));
  const service = new TranslationService({ provider: {
    isVoiceActivity: () => true,
    transcribe: () => new Promise(resolve => { resolveTranscription = resolve; }),
    detectLanguage: async () => ({ language: 'en' }),
    translate: async () => { translations++; return { text: 'hola' }; },
    synthesize: async () => ({ data: 'AQI=', sampleRate: 16000 })
  }});
  const source = { sourceId: 'stale_source', setFrameHandler(next) { handler = next; } };
  service.attachSource(source);
  handler({ frameId: 'delayed', sourceId: 'stale_source', data: 'AQI=' });
  await new Promise(resolve => setTimeout(resolve, 0));
  service.detachSource(source);
  resolveTranscription({ text: 'hello' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(translations, 0);
  assert.equal(completed.some(result => result.sourceId === 'stale_source'), false);
  assert.ok(service.getMetrics().stale >= 1);
  unsubscribe();
  service.destroy();
});
