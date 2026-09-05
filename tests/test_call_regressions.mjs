import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { AudioOutputService } from '../src/services/audioOutputService.js';
import { AudioInputService } from '../src/services/audioInputService.js';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { proactiveScheduler } from '../src/services/proactiveScheduler.js';
import { contextualEmotionOrchestrator } from '../src/services/live2d/ContextualEmotionOrchestrator.js';

after(() => { proactiveScheduler.destroy(); contextualEmotionOrchestrator.destroy(); });

const pcm = Buffer.alloc(9600).toString('base64'); // 200ms at 24kHz
test('Live setup includes frames arriving outside microphone activity', () => {
  const messages = [];
  const client = new GeminiLiveSocket({ apiKey: 'test-key' });
  client.websocket = { readyState: WebSocket.OPEN, send: data => messages.push(JSON.parse(data)) };
  client.sendInitialSetup();
  assert.equal(messages[0].setup.realtimeInputConfig.turnCoverage, 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO');
  assert.deepEqual(messages[0].setup.outputAudioTranscription, {});
});
test('scoped Live clients can exclude companion instructions and tools', () => {
  const messages = [];
  const client = new GeminiLiveSocket({ apiKey: 'test-key', includeCompanionContext: false, tools: [], systemPrompt: 'Read only visible words.' });
  client.websocket = { readyState: WebSocket.OPEN, send: data => messages.push(JSON.parse(data)) };
  client.sendInitialSetup();
  assert.deepEqual(messages[0].setup.tools, []);
  assert.equal(messages[0].setup.systemInstruction.parts[0].text, 'Read only visible words.');
});
test('visual turns explicitly supersede stale image context', () => {
  const messages = [];
  const client = new GeminiLiveSocket({ apiKey: 'test-key', modelId: 'gemini-2.5-flash-native-audio-preview-12-2025' });
  client.isConnected = true;
  client.websocket = { readyState: WebSocket.OPEN, send: data => messages.push(JSON.parse(data)) };
  client.sendTextMessage('Lee el texto actual.', 'data:image/jpeg;base64,valid-frame');
  const text = messages.at(-1).realtimeInput?.text || messages.at(-1).clientContent?.turns?.[0]?.parts?.at(-1)?.text;
  assert.ok(text, 'la petición visual debe incluir texto en el turno Live');
  assert.match(text, /observación visual más reciente/i);
  assert.match(text, /ignora por completo/i);
});
test('stalled visual turns trigger bounded reconnect watchdogs', async () => {
  const client = new GeminiLiveSocket({ apiKey: 'test-key', responseWatchdogMs: 1000 });
  client.isConnected = true;
  client.websocket = { readyState: WebSocket.OPEN, send() {}, close() {} };
  client.sendTextMessage('Analiza el frame actual.', 'data:image/jpeg;base64,valid-frame');
  await new Promise(resolve => setTimeout(resolve, 1050));
  assert.equal(client.awaitingTextResponse, false);
  assert.ok(client.reconnectTimer, 'el watchdog debe programar reconexión');
  client.disconnect();
});
function output() {
  const service = new AudioOutputService();
  const sources = [];
  service.audioContext = {
    state: 'running', currentTime: 1,
    createBuffer: (_, size, rate) => ({ duration: size / rate, getChannelData: () => new Float32Array(size) }),
    createBufferSource: () => {
      const source = { playbackRate: { value: 1 }, connect() {}, disconnect() {}, stop() {},
        start(time) { this.time = time; sources.push(this); } };
      return source;
    },
    close() { this.state = 'closed'; return Promise.resolve(); }
  };
  service.gainNode = { disconnect() {}, gain: { cancelScheduledValues() {}, setValueAtTime() {} } };
  return { service, sources };
}

test('PCM bursts and a renderer stall never overlap or replay audio', async () => {
  const { service, sources } = output();
  try {
    await service.playChunk(pcm);
    service._flushQueue();
    for (let i = 0; i < 50; i++) await service.playChunk(pcm);
    for (let i = 1; i < sources.length; i++) {
      assert.ok(Math.abs(sources[i].time - sources[i - 1].time - 0.2 / 0.96) < 1e-9);
    }
    service.audioContext.currentTime = service.nextScheduleTime + 2;
    await service.playChunk(pcm);
    const resumed = sources.at(-1);
    assert.ok(resumed.time >= service.audioContext.currentTime);
    const end = service.nextScheduleTime;
    await service.playChunk(pcm);
    assert.equal(sources.at(-1).time, end);
  } finally { service.destroy(); }
});

test('interruption cancels PCM waiting for AudioContext resume', async () => {
  const { service, sources } = output();
  service.audioContext.state = 'suspended';
  let resume;
  service.resumeContextIfNeeded = () => new Promise((resolve) => { resume = resolve; });
  const playback = service.playChunk(pcm);
  service.stopImmediate();
  service.audioContext.state = 'running';
  resume();
  await playback;
  assert.equal(service.pcmQueue.length, 0);
  assert.equal(sources.length, 0);
  service.destroy();
});

test('turn completion survives asynchronous audio resume', async () => {
  const { service } = output();
  service.audioContext.state = 'suspended';
  let resume;
  service.resumeContextIfNeeded = () => new Promise((resolve) => { resume = resolve; });
  const playback = service.playChunk(pcm);
  service.signalTurnComplete();
  service.audioContext.state = 'running';
  resume();
  await playback;
  assert.equal(service.isTurnComplete, true);
  service.destroy();
});

class FakeWebSocket {
  static OPEN = 1;
  static instances = [];
  constructor() { this.readyState = 0; this.sent = []; this.bufferedAmount = 0; FakeWebSocket.instances.push(this); }
  send(data) { this.sent.push(JSON.parse(data)); }
  open() { this.readyState = 1; this.onopen?.(); }
  close(code = 1006) { this.readyState = 3; this.onclose?.({ code, wasClean: code === 1000, reason: '' }); }
  message(data) { this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) }); }
}
globalThis.WebSocket = FakeWebSocket;
function socket(options = {}) {
  const client = new GeminiLiveSocket({ apiKey: 'test-only', maxReconnectAttempts: 2, ...options });
  client.sendInitialSetup = () => client.websocket.send('{"setup":{}}');
  client.connect();
  return { client, ws: client.websocket };
}
async function ready(client, ws) {
  ws.open(); ws.message({ setupComplete: {} }); await client._messageChain;
}

test('Live input waits for setupComplete and concurrent connect is idempotent', async () => {
  let opened = 0;
  const { client, ws } = socket({ onOpen: () => opened++ });
  try {
    client.connect();
    assert.equal(client.websocket, ws);
    ws.open(); client.sendAudioChunk('AA==');
    assert.equal(opened, 0);
    assert.equal(ws.sent.length, 1);
    ws.message({ setupComplete: {} }); await client._messageChain;
    client.sendAudioChunk('AA==');
    assert.equal(opened, 1);
    assert.equal(ws.sent.length, 2);
  } finally { client.disconnect(); }
});

test('transcripts preserve all deltas, words and punctuation until the next turn', async () => {
  const inputs = [], outputs = [];
  const { client, ws } = socket({ onInputTranscription: t => inputs.push(t), onOutputTranscription: t => outputs.push(t) });
  try {
    await ready(client, ws);
    for (const text of ['Hola', ', ', 'Cristi', '.']) ws.message({ serverContent: { inputTranscription: { text } } });
    for (const text of ['Te', ' estoy', ' escuchando', '.']) ws.message({ serverContent: { outputTranscription: { text } } });
    ws.message({ serverContent: { modelTurn: { parts: [{ thought: true, text: 'private thought' }, { text: 'duplicate text channel' }] }, turnComplete: true } });
    await client._messageChain;
    assert.equal(inputs.at(-1), 'Hola, Cristi.');
    assert.equal(outputs.at(-1), 'Te estoy escuchando.');
    assert.equal(outputs.length, 4);
    ws.message({ serverContent: { inputTranscription: { text: 'Siguiente.' }, outputTranscription: { text: 'Sí.' } } });
    await client._messageChain;
    assert.equal(inputs.at(-1), 'Siguiente.');
    assert.equal(outputs.at(-1), 'Sí.');
  } finally { client.disconnect(); }
});

test('old sockets cannot close or deliver audio into a replacement session', async () => {
  const audio = [];
  const { client, ws } = socket({ onAudioChunk: chunk => audio.push(chunk) });
  await ready(client, ws);
  ws.message({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'replayed-pcm' } }] } } });
  await client._messageChain;
  assert.deepEqual(audio, ['replayed-pcm']);
  const staleClose = ws.onclose;
  const staleMessage = ws.onmessage;
  client.switchVoice('Kore');
  client.connect(); // supersedes the scheduled restart
  const replacement = client.websocket;
  await ready(client, replacement);
  replacement.message({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'replayed-pcm' } }] } } });
  await client._messageChain;
  staleClose({ code: 1006, reason: '' });
  staleMessage({ data: JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'stale' } }] } } }) });
  await client._messageChain;
  assert.equal(client.websocket, replacement);
  assert.equal(client.isConnected, true);
  assert.deepEqual(audio, ['replayed-pcm']);
  client.disconnect();
  assert.equal(client.reconnectTimer, null);
});

test('disconnect invalidates an in-flight Blob decode', async () => {
  const audio = [];
  const { client, ws } = socket({ onAudioChunk: chunk => audio.push(chunk) });
  await ready(client, ws);
  let decode;
  const blob = new Blob();
  blob.text = () => new Promise(resolve => { decode = resolve; });
  const message = client.handleServerMessage(blob, ws);
  client.disconnect();
  decode(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'late' } }] } } }));
  await message;
  assert.deepEqual(audio, []);
});

test('transient close reconnects once, permanent errors do not loop', async () => {
  const { client, ws } = socket();
  await ready(client, ws);
  ws.close(1006);
  assert.ok(client.reconnectTimer);
  client.connect();
  assert.equal(client.reconnectTimer, null);
  const next = client.websocket;
  await ready(client, next);
  client.onError = () => {};
  next.close(1008);
  assert.equal(client.reconnectTimer, null);
  client.disconnect();
});

test('a transient close replays one pending visual turn without looping', async () => {
  const { client, ws } = socket({ maxReconnectAttempts: 1 });
  try {
    await ready(client, ws);
    client.sendTextMessage('Lee la imagen actual.', 'data:image/jpeg;base64,frame');
    ws.close(1011);
    await new Promise(resolve => setTimeout(resolve, 1800));
    const replacement = client.websocket;
    assert.ok(replacement, 'debe abrir un socket de reemplazo');
    replacement.open(); replacement.message({ setupComplete: {} }); await client._messageChain;
    await new Promise(resolve => setTimeout(resolve, 0));
    const textTurns = replacement.sent.filter(message => message.realtimeInput?.text);
    assert.equal(textTurns.length, 1, 'el turno pendiente se reintenta exactamente una vez');
    client.disconnect();
  } finally {
    client.disconnect();
  }
});

test('outgoing media has bounded backpressure and interruption precedes audio', async () => {
  const events = [];
  const { client, ws } = socket({ onAudioChunk: () => events.push('audio'), onInterrupted: () => events.push('interrupt') });
  try {
    await ready(client, ws);
    ws.bufferedAmount = 70000;
    client.sendAudioChunk('AA==');
    assert.equal(client.sendVideoFrame('jpeg'), false);
    assert.equal(ws.sent.length, 1);
    ws.message({ serverContent: { interrupted: true, modelTurn: { parts: [{ inlineData: { data: 'cancelled' } }] } } });
    await client._messageChain;
    assert.deepEqual(events, ['interrupt']);
  } finally { client.disconnect(); }
});

test('stopping during microphone permission acquisition releases the late stream', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let acquire, stopped = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: () => new Promise(resolve => { acquire = resolve; })
  } } });
  const input = new AudioInputService();
  try {
    const starting = input.start();
    input.stop();
    acquire({ getTracks: () => [{ stop: () => stopped++ }] });
    await starting;
    assert.equal(stopped, 1);
    assert.equal(input.isRecording, false);
    assert.equal(input.mediaStream, null);
  } finally {
    input.stop();
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  }
});
