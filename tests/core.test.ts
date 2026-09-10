import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PathPolicy, validateRelativePath } from '../electron/src/security/PathPolicy';
import { samePage, registerSender, trustedKind } from '../electron/src/security/SenderPolicy';
import { channelAllowed, validateRequest } from '../shared/ipc/contracts';
import { publicSettings, redactText } from '../shared/security';
import { StreamingResampler } from '../src/domain/audio/StreamingResampler';
import { AudioPlayoutQueue } from '../src/domain/audio/AudioPlayoutQueue';
import { AudioInputQueue } from '../src/domain/gemini/AudioInputQueue';
import { TranscriptAssembler } from '../src/domain/transcription/TranscriptAssembler';
import { LiveSessionSupervisor } from '../src/domain/gemini/LiveSessionSupervisor';
import { useSessionStore } from '../src/stores/useSessionStore';

for (const input of ['../secret', 'a/../../secret', '/secret', 'C:\\secret', '\\\\server\\share', '\\\\?\\C:\\secret', 'foo\0bar', 'a:stream', 'NUL.txt', 'dir./secret']) {
  test(`reject path ${JSON.stringify(input)}`, () => assert.throws(() => validateRelativePath(input)));
}
test('path scopes reject symlink/junction escape and allow missing descendants', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cristi-policy-'));
  const inside = path.join(root, 'inside'); const outside = path.join(root, 'outside');
  await fs.mkdir(inside); await fs.mkdir(outside); await fs.writeFile(path.join(outside, 'secret'), 'canary');
  try {
    const policy = new PathPolicy({ exports: inside });
    assert.equal(await policy.resolveWithin('exports', 'new/file.txt'), path.join(inside, 'new/file.txt'));
    await fs.symlink(outside, path.join(inside, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(policy.resolveWithin('exports', 'escape/secret'));
    await assert.rejects(policy.resolveWithin('workspaceApproved', 'secret'));
  } finally { await fs.rm(root, { recursive: true }); }
});
test('sender URL exact origin, page and no credentials', () => {
  assert(samePage('app://cristi/camera.html', 'app://cristi/camera.html'));
  for (const url of ['app://cristi/settings.html', 'app://evil/camera.html', 'https://cristi/camera.html', 'app://x@cristi/camera.html']) assert(!samePage(url, 'app://cristi/camera.html'));
});
test('schemas block cross-window, arbitrary scripts, bad payloads and unscoped paths', () => {
  assert(!channelAllowed('live-token', 'camera'));
  assert(!channelAllowed('secure-set-secret', 'main'));
  assert(!channelAllowed('capture-screen-native', 'settings'));
  assert.throws(() => validateRequest('playwright-execute', ['evaluate', { script: 'process.exit()' }]));
  assert.throws(() => validateRequest('playwright-execute', ['navigate', { url: 'file:///C:/secret' }]));
  assert.throws(() => validateRequest('read-file', ['C:\\secret']));
  assert.throws(() => validateRequest('save-app-config', [{ a: 'x'.repeat(2_000_000) }]));
  assert.throws(() => validateRequest('minecraft-move-to', [{ x: NaN, y: 1, z: 1 }]));
  assert.deepEqual(validateRequest('read-file', [{ scope: 'exports', path: 'result.txt' }]), [{ scope: 'exports', path: 'result.txt' }]);
});
test('nested secrets absent from config and backup exports', () => {
  const clean = publicSettings({ apiKey: 'CANARY', discord: { botToken: 'CANARY', autoReply: false }, snapshots: [{ config: { spotifyClientSecret: 'CANARY' } }] });
  assert(!JSON.stringify(clean).includes('CANARY')); assert.equal(clean.discord.autoReply, false);
  assert(!redactText('wss://host?key=CANARY&access_token=CANARY').includes('CANARY'));
});
test('stateful resampler is independent of block partition and has exact clock', () => {
  for (const rate of [44100, 48000]) {
    const input = Float32Array.from({ length: rate * 2 }, (_, i) => Math.sin(2 * Math.PI * 1000 * i / rate));
    const whole = new StreamingResampler(rate).process(input, true);
    const streaming = new StreamingResampler(rate);
    const parts: number[] = [];
    for (let i = 0; i < input.length; i += 137) parts.push(...streaming.process(input.subarray(i, i + 137)));
    parts.push(...streaming.process(new Float32Array(), true));
    assert.equal(parts.length, 32000);
    assert.deepEqual(Float32Array.from(parts), whole);
  }
});
test('resampler rejects alias energy above target Nyquist', () => {
  const input = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(2 * Math.PI * 12000 * i / 48000));
  const output = new StreamingResampler(48000).process(input, true).subarray(100, 15900);
  const rms = Math.sqrt(output.reduce((sum, sample) => sum + sample * sample, 0) / output.length);
  assert(rms < 0.01, `Aliasing RMS ${rms}`);
});
test('10 minute input clock with partitioned 44.1 kHz blocks', () => {
  const resampler = new StreamingResampler(44100);
  const silence = new Float32Array(882);
  let samples = 0;
  for (let i = 0; i < 30000; i++) samples += resampler.process(silence).length;
  samples += resampler.process(new Float32Array(), true).length;
  assert.equal(samples, 600 * 16000);
});
test('input congestion preserves ordering, bounds age and measures discontinuity', () => {
  const queue = new AudioInputQueue();
  const chunks = [Buffer.alloc(640, 1).toString('base64'), Buffer.alloc(640, 2).toString('base64')];
  for (const chunk of chunks) assert(queue.push(chunk, 0));
  const sent: string[] = []; queue.drain(chunk => { sent.push(chunk); return true; }, 100);
  assert.deepEqual(sent, chunks);
  assert(queue.push(chunks[0], 0)); assert(!queue.drain(() => true, 201)); assert.equal(queue.droppedMs, 20);
  for (let i = 0; i < 10; i++) assert(queue.push(chunks[0], 300));
  assert(!queue.push(chunks[0], 300)); assert.equal(queue.size, 0); assert.equal(queue.droppedMs, 240);
});
test('playout generation finality is monotonic and jitter adapts', () => {
  const queue = new AudioPlayoutQueue(); queue.begin();
  for (let i = 0; i < 20; i++) queue.receive(i * 20, 20);
  const stable = queue.targetMs; queue.receive(1000, 20); assert(queue.targetMs > stable);
  queue.finishGeneration(); queue.finishTurn(); queue.receive(1100, 20);
  assert(queue.generationComplete && queue.turnComplete); assert.equal(queue.state, 'DRAINING');
  const epoch = queue.generation; queue.interrupt(); assert(queue.generation > epoch);
});
test('transcripts assemble deltas, replace interim corrections and reject stale revisions', () => {
  const t = new TranscriptAssembler(); t.begin(1);
  t.update('Hola '); t.update('mundo'); t.update('Hola mundo'); assert.equal(t.snapshot.text, 'Hola mundo');
  t.update('Hola mundo cruel', { mode: 'snapshot' }); t.update('Hola mundo azul', { mode: 'snapshot' });
  t.update('stale', { revision: 1 }); assert.equal(t.snapshot.text, 'Hola mundo azul');
  t.finalize(); t.update('late'); assert.equal(t.snapshot.text, 'Hola mundo azul');
  t.begin(2); t.update('こんにちは', { mode: 'snapshot' }); t.update('old', { turnId: 1 }); assert.equal(t.snapshot.text, 'こんにちは');
});
test('reconnect budget survives short-lived successful sockets; full jitter and policy classification', () => {
  const supervisor = new LiveSessionSupervisor(2, () => 0.5);
  assert.equal(supervisor.nextDelay(1006, '', 0), 500);
  assert.equal(supervisor.nextDelay(1008, 'temporary overload', 1), 1000);
  assert.equal(supervisor.nextDelay(1006, '', 2), null);
  assert.equal(supervisor.nextDelay(1006, '', 120001), 500);
  assert.equal(new LiveSessionSupervisor().nextDelay(1008, 'invalid payload'), null);
});
test('clearing connecting flag does not disconnect a ready session', () => {
  const store = useSessionStore.getState(); store.setIsConnected(true); store.setIsConnecting(false);
  assert.equal(useSessionStore.getState().connectionState, 'READY');
  store.setIsConnecting(true); assert(!useSessionStore.getState().isConnected);
});


test('connection events ignore late setup after disconnect and preserve derived flags', () => {
  const store = useSessionStore.getState(); store.dispatchConnection('DISCONNECT');
  store.dispatchConnection('SETUP_COMPLETE'); assert.equal(useSessionStore.getState().connectionState, 'DISCONNECTED');
  store.dispatchConnection('CONNECT'); store.dispatchConnection('SETUP_COMPLETE'); store.dispatchConnection('RECONNECT');
  assert.equal(useSessionStore.getState().connectionState, 'RECONNECTING'); assert.equal(useSessionStore.getState().isConnected, false);
  store.dispatchConnection('FAIL'); assert.equal(useSessionStore.getState().isConnecting, false);
});

test('sender identity rejects unregistered windows and child frames', () => {
  const mainFrame = { url: 'app://cristi/index.html' };
  let destroyed = () => {};
  const sender = { id: 345, mainFrame, once: (_event: string, callback: () => void) => { destroyed = callback; } };
  registerSender(sender as never, 'main', mainFrame.url);
  assert.equal(trustedKind({ sender, senderFrame: mainFrame } as never), 'main');
  assert.throws(() => trustedKind({ sender, senderFrame: { ...mainFrame } } as never));
  destroyed(); assert.throws(() => trustedKind({ sender, senderFrame: mainFrame } as never));
});

test('Spotify URI cannot invoke a foreign protocol or executable', () => {
  for (const uri of ['file:///C:/Windows/calc.exe', 'ms-settings:', 'https://example.com', 'spotify:../../escape'])
    assert.throws(() => validateRequest('spotify-control', ['open_uri', { uri }]));
  assert.doesNotThrow(() => validateRequest('spotify-control', ['open_uri', { uri: 'spotify:track:123abc' }]));
});
