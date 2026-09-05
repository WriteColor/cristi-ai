// Real Gemini + packaged Electron native capture. Requires an API key and desktop.
// A visible temporary fixture supplies known words; no chat messages or tools run.
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { ScreenCaptureService } from '../src/services/screenCaptureService.js';
import { VisionFrameDispatcher } from '../src/services/vision/VisionFrameDispatcher.js';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { eventBus, EVENTS } from '../src/services/eventBus.js';
import { proactiveScheduler } from '../src/services/proactiveScheduler.js';
import { contextualEmotionOrchestrator } from '../src/services/live2d/ContextualEmotionOrchestrator.js';

const output = path.resolve('tests/output');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(output, 'native-vision-profile-'));
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const apiKey = process.env.VITE_GEMINI_API_KEY || env.match(/^VITE_GEMINI_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
const companion = process.env.CRISTI_VISION_COMPANION === '1';
const report = { fixture: true, companion, transport: 'packaged native IPC + production capture and dispatcher', rounds: [] };
let app;
let capture;
let dispatcher;
let client;
const words = ['TULIPAN', 'COMETA', 'MARIPOSA', 'VENTANA', 'PLANETA', 'CARAMELO'];
async function until(predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for vision delivery');
    await delay(50);
  }
}
try {
  assert.ok(apiKey, 'VITE_GEMINI_API_KEY is required');
  app = await electron.launch({
    executablePath: path.resolve('release/win-unpacked/Cristi AI Companion.exe'),
    args: [`--user-data-dir=${profile}`], cwd: profile,
    env: { ...process.env, APPDATA: path.join(profile, 'roaming'), LOCALAPPDATA: path.join(profile, 'local') }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.electronAPI?.isElectron);
  const bounds = await app.evaluate(async ({ BrowserWindow, screen }) => {
    const bounds = screen.getPrimaryDisplay().bounds;
    const fixture = new BrowserWindow({ ...bounds, frame: false, show: true, alwaysOnTop: true, webPreferences: { sandbox: true } });
    fixture.setTitle('Cristi — prueba temporal de visión');
    globalThis.__visionFixture = fixture;
    await fixture.loadURL('data:text/html,<html><body>Preparing visual test</body></html>');
    fixture.setBounds(bounds);
    fixture.setAlwaysOnTop(true, 'floating');
    fixture.focus();
    return bounds;
  });
  globalThis.window = { screen: bounds, electronAPI: { isElectron: true,
    captureScreenNative: region => page.evaluate(region => window.electronAPI.captureScreenNative(region), region) } };

  for (const modelId of (process.env.CRISTI_VISION_MODELS?.split(',') || ['gemini-3.1-flash-live-preview', 'gemini-2.5-flash-native-audio-preview-12-2025'])) {
    let connected = false;
    let currentRound = null;
    let complete = false;
    const frames = [];
    let failure;
    client = new GeminiLiveSocket({ apiKey, modelId, maxReconnectAttempts: 0,
      includeCompanionContext: companion, tools: companion ? null : [],
      systemPrompt: 'Visual transport test. Only read the large words visible in the latest image. Do not infer missing content. Do not use tools. Do not greet. Wait for a question.',
      thinkingConfig: { thinkingBudget: 0 },
      onOpen: () => { connected = true; },
      onError: error => { failure = error.message; },
      onAudioChunk: data => {
        if (!currentRound) return;
        if (!currentRound.firstAudioMs) currentRound.firstAudioMs = Date.now() - currentRound.requestAt;
        currentRound.chunks++;
        currentRound.pcmBytes += Buffer.from(data, 'base64').length;
        eventBus.emit(EVENTS.AUDIO_START);
      },
      onOutputTranscription: text => { if (currentRound) currentRound.transcript = text; },
      onTurnComplete: () => { complete = true; eventBus.emit(EVENTS.AUDIO_END); },
      onToolCall: calls => client.sendToolResponse(calls.map(call => ({ id: call.id, name: call.name, output: { error: 'Tools disabled in vision test.' } })))
    });
    const send = client.sendRealtimeMedia.bind(client);
    client.sendRealtimeMedia = (data, mime) => {
      const sent = send(data, mime);
      if (sent) frames.push({ at: Date.now(), bytes: Buffer.from(data, 'base64').length });
      return sent;
    };
    dispatcher = new VisionFrameDispatcher({ socketRef: { current: client } });
    capture = new ScreenCaptureService({ onFrame: data => {
      fs.writeFileSync(path.join(output, 'native-vision-latest.jpg'), Buffer.from(data, 'base64'));
      dispatcher.enqueue(data, 'screen');
    } });
    client.connect();
    await until(() => connected || failure);
    assert.ok(connected, failure);
    for (const mode of ['full', 'region']) {
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      const [top, bottom] = shuffled;
      await app.evaluate(async (_, { top, bottom }) => {
        const html = `<html><body style="margin:0;font:bold 8vw Arial;text-align:center"><div style="height:50vh;background:#ffe090;display:grid;place-items:center">${top}</div><div style="height:50vh;background:#afaaff;display:grid;place-items:center">${bottom}</div></body></html>`;
        await globalThis.__visionFixture.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      }, { top, bottom });
      if (mode === 'region') capture.setRegion({ x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 48 });
      else capture.clearRegion();
      dispatcher.clearSource('screen');
      const before = frames.length;
      await capture.startContinuous();
      capture.triggerImmediateCapture();
      // Realtime video and text are independent server streams. Establish an
      // ongoing video feed before asking, rather than assuming cross-stream order.
      await until(() => frames.length >= before + 2 || failure);
      assert.ok(!failure, failure);
      currentRound = { modelId, mode, expected: mode === 'full' ? [top, bottom] : [top], hidden: mode === 'region' ? bottom : null,
        requestAt: Date.now(), chunks: 0, pcmBytes: 0, transcript: '' };
      report.rounds.push(currentRound);
      complete = false;
      client.sendTextMessage('Lee únicamente las palabras grandes que aparecen en la imagen más reciente. No menciones imágenes anteriores.');
      await until(() => complete || failure, 45000);
      assert.ok(!failure, failure);
      currentRound.responseMs = Date.now() - currentRound.requestAt;
      const normalized = currentRound.transcript.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      currentRound.grounded = currentRound.expected.every(word => normalized.includes(word))
        && (!currentRound.hidden || !normalized.includes(currentRound.hidden));
      assert.ok(currentRound.grounded, `${mode}: model did not identify current visible words: ${currentRound.transcript}`);
      assert.ok(currentRound.pcmBytes > 0);
      const afterSpeech = frames.length;
      await until(() => frames.length >= afterSpeech + 2);
      currentRound.framesAfterSpeech = frames.length - afterSpeech;
      currentRound.framesSent = frames.length - before;
      console.log(JSON.stringify(currentRound));
      capture.stopContinuous();
    }
    capture.stopAll();
    dispatcher.destroy();
    client.disconnect({ endSession: false });
  }
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  capture?.stopAll();
  dispatcher?.destroy();
  client?.disconnect({ endSession: false });
  await app?.close();
  proactiveScheduler.destroy();
  contextualEmotionOrchestrator.destroy();
  delete globalThis.window;
  fs.writeFileSync(path.join(output, companion ? 'live-native-vision-companion.json' : 'live-native-vision-lifecycle.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
