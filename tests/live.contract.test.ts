import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiLiveSocket } from '../src/domain/gemini/LiveTransport';

class Socket {
  static OPEN = 1; static instances: Socket[] = [];
  readyState = 1; bufferedAmount = 0; sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null; onclose: ((event: object) => void) | null = null;
  constructor(public url: string) { Socket.instances.push(this); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code: number, reason: string) { this.readyState = 3; this.onclose?.({ code, reason, wasClean: true }); }
}

test('live setup, token-only URL, transcript revisions, complete and cancellation contract', async () => {
  const original = globalThis.WebSocket; globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  const input: string[] = []; const output: string[] = []; const events: string[] = []; let tools = 0;
  const client = new GeminiLiveSocket({ tokenProvider: async () => 'auth_tokens/test', includeCompanionContext: false,
    onInputTranscription: text => input.push(text), onOutputTranscription: text => output.push(text),
    onGenerationStart: () => events.push('start'), onGenerationComplete: () => events.push('generated'),
    onTurnComplete: () => events.push('turn'), onInterrupted: () => events.push('interrupted'),
    onToolCall: calls => { tools += calls.length; }, onToolCallCancellation: () => events.push('cancel'),
    onAudioChunk: () => events.push('audio') });
  try {
    await client.connect(); const socket = Socket.instances.at(-1)!; socket.onopen?.();
    assert(socket.url.includes('access_token=auth_tokens%2Ftest')); assert(!socket.url.includes('?key='));
    assert(socket.sent[0].setup);
    await client.handleServerMessage(JSON.stringify({ setupComplete: {} })); assert(client.isConnected);
    const fixture = [
      { serverContent: { interimInputTranscription: { text: 'hola mar' } } },
      { serverContent: { interimInputTranscription: { text: 'hola mundo' } } },
      { serverContent: { inputTranscription: { text: 'hola mundo', finished: true } } },
      { serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAA=', mimeType: 'audio/pcm;rate=24000' } }] }, outputTranscription: { text: 'Buenos ' } } },
      { serverContent: { outputTranscription: { text: 'días' }, generationComplete: true } },
      { serverContent: { turnComplete: true } },
      { toolCall: { functionCalls: [{ id: 'one', name: 'test', args: {} }] } },
      { toolCall: { functionCalls: [{ id: 'one', name: 'test', args: {} }] } },
      { toolCallCancellation: { ids: ['one'] } },
    ];
    for (const frame of fixture) await client.handleServerMessage(JSON.stringify(frame));
    assert.equal(input.at(-1), 'hola mundo'); assert.equal(output.at(-1), 'Buenos días');
    assert.deepEqual(events.slice(0, 4), ['start', 'audio', 'generated', 'turn']); assert.equal(tools, 1);
    client.endAudioStream(); assert.deepEqual(socket.sent.at(-1), { realtimeInput: { audioStreamEnd: true } });
    const count = socket.sent.length; socket.bufferedAmount = 10000;
    assert.equal(client.sendVideoFrame('AAAA'), false);
    assert(client.sendAudioChunk(new ArrayBuffer(640))); assert.equal(socket.sent.length, count);
    socket.bufferedAmount = 0; client.drainInput(); assert.equal(socket.sent.length, count + 1);
    client.disconnect(); assert(!client.isConnected); assert.equal(client._audioDrainTimer, undefined);
  } finally { client.disconnect(); globalThis.WebSocket = original; }
});

test('disconnect cancels a pending token request before socket creation', async () => {
  let finish!: (token: string) => void;
  const client = new GeminiLiveSocket({ tokenProvider: () => new Promise(resolve => { finish = resolve; }) });
  const pending = client.connect(); client.disconnect(); finish('auth_tokens/test'); await pending;
  assert.equal(client.websocket, null); assert.equal(client.isConnected, false);
});
