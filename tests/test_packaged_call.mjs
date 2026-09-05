import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const outputDir = path.resolve('tests/output');
const profile = fs.mkdtempSync(path.join(outputDir, 'electron-probe-'));
const report = { errors: [], models: [], checks: [] };
let app;
try {
  app = await electron.launch({
    executablePath: path.resolve('release/win-unpacked/Cristi AI Companion.exe'),
    args: [`--user-data-dir=${profile}`, '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    cwd: profile,
    env: { ...process.env, APPDATA: path.join(profile, 'roaming'), LOCALAPPDATA: path.join(profile, 'local') },
    timeout: 30000
  });
  const packaged = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, userData: app.getPath('userData') }));
  assert.equal(packaged.packaged, true);
  assert.ok(packaged.userData.startsWith(profile), 'Test must use an isolated profile');
  const page = await app.firstWindow();
  page.on('pageerror', err => report.errors.push(err.message));
  await page.waitForFunction(() => window.__cristiAvatar?.model && window.__cristiApp, { timeout: 30000 });
  assert.equal(new URL(page.url()).protocol, 'app:');
  report.checks.push('Packaged app:// startup with isolated settings');
  const baseline = await page.evaluate(() => window.__cristiApp.eventBus.listeners.get('audio_analysis')?.size);
  const ids = await page.evaluate(() => window.__cristiApp.live2dModelRegistry.getAllModels().map(model => model.id));
  for (const id of ids) {
    await page.evaluate(id => window.__cristiApp.switchLive2DModel(id), id);
    await page.waitForFunction(id => window.__cristiAvatar?.controller?.modelId === id && document.querySelector('.live2d-hit-target')?.style.pointerEvents !== 'none', id, { timeout: 30000 });
    const state = await page.evaluate(() => ({
      model: window.__cristiAvatar.controller.modelId,
      subscriptions: window.__cristiApp.eventBus.listeners.get('audio_analysis')?.size,
      textures: window.__cristiAvatar.model.textures.length,
      autoUpdate: window.__cristiAvatar.model.autoUpdate
    }));
    assert.equal(state.subscriptions, baseline, `${id} leaked audio listeners`);
    assert.ok(state.textures > 0);
    assert.equal(state.autoUpdate, false, 'Avatar must have one animation clock');
    report.models.push(state);
  }
  report.checks.push('All avatar models load without accumulating audio listeners');
  const settingsPromise = app.waitForEvent('window');
  await page.evaluate(() => window.__cristiApp.openSettings());
  const settings = await settingsPromise;
  settings.on('pageerror', err => report.errors.push(err.message));
  await settings.waitForLoadState('domcontentloaded');
  await settings.waitForFunction(() => document.querySelector('#settings-root')?.childElementCount > 0);
  assert.ok(settings.url().includes('settings.html'));
  await page.evaluate(() => window.__cristiApp.closeSettings());
  report.checks.push('Packaged settings window and preload IPC');

  // Reload with a simulated transport. Microphone input is Chromium's synthetic
  // device; this test neither captures the user nor connects to an API.
  await page.addInitScript(() => {
    localStorage.setItem('cristi_ai_settings_v1', JSON.stringify({ apiKey: 'synthetic-test-key', modelId: 'gemini-3.1-flash-live-preview', live2dModelId: 'hiyori', voiceName: 'Aoede' }));
    window.__testAudioSources = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = time => {
        window.__testAudioSources.push({ time, duration: source.buffer.duration / source.playbackRate.value });
        start(time);
      };
      return source;
    };
    class TestSocket {
      static OPEN = 1;
      constructor() { this.readyState = 0; this.bufferedAmount = 0; setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 10); }
      send(data) { if (JSON.parse(data).setup) queueMicrotask(() => this.onmessage?.({ data: '{"setupComplete":{}}' })); }
      close() { this.readyState = 3; this.onclose?.({ code: 1000, wasClean: true }); }
    }
    window.WebSocket = TestSocket;
  });
  await page.evaluate(() => window.electronAPI.saveAppConfig({ apiKey: 'synthetic-test-key', modelId: 'gemini-3.1-flash-live-preview', live2dModelId: 'hiyori', voiceName: 'Aoede' }));
  await page.reload();
  await page.waitForFunction(() => window.__cristiApp && window.__cristiAvatar?.model);
  await page.evaluate(() => window.__cristiApp.connect());
  await page.waitForFunction(() => window.__cristiApp.getStatus().isConnected);
  const input = await page.evaluate(() => window.__cristiApp.audioInRef.current.getTelemetry());
  assert.equal(input.isRecording, true);
  assert.equal(input.processorType, 'AudioWorklet (Low Latency)');
  await page.waitForFunction(() => window.__cristiApp.audioInRef.current.getTelemetry().processedChunksCount > 5);
  report.input = input;
  const payload = Buffer.alloc(9600).toString('base64');
  await page.evaluate(async pcm => {
    const client = window.__cristiApp.socketRef.current;
    await client.handleServerMessage(JSON.stringify({ serverContent: { inputTranscription: { text: 'Esta es una transcripción larga que debe conservar todas las palabras, saltar de línea y ocupar el mismo ancho que los subtítulos de Cristi. '.repeat(3) } } }));
    for (const text of ['Esta respuesta ', 'se acumula completa ', 'sin reemplazar fragmentos.']) {
      await client.handleServerMessage(JSON.stringify({ serverContent: { outputTranscription: { text } } }));
    }
    window.__testAudioSources = [];
    for (let i = 0; i < 15; i++) {
      await client.handleServerMessage(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { data: pcm, mimeType: 'audio/pcm;rate=24000' } }] } } }));
    }
    await client.handleServerMessage('{"serverContent":{"turnComplete":true}}');
    const until = performance.now() + 180;
    while (performance.now() < until) { /* bounded renderer stall */ }
  }, payload);
  await page.waitForFunction(() => window.__testAudioSources.length > 1);
  const sources = await page.evaluate(() => window.__testAudioSources);
  for (let i = 1; i < sources.length; i++) assert.ok(sources[i].time >= sources[i - 1].time + sources[i - 1].duration - 1e-6);
  await page.waitForFunction(() => !window.__cristiApp.audioOutRef.current.isPlaying);
  const subtitles = await page.evaluate(() => {
    const overlay = document.querySelector('aside[aria-label="Subtítulos en vivo"]');
    return { status: window.__cristiApp.getStatus(), texts: [...overlay.querySelectorAll('div > span:last-child')].map(span => ({ width: span.parentElement.clientWidth, fontSize: getComputedStyle(span).fontSize, whiteSpace: getComputedStyle(span).whiteSpace, overflow: getComputedStyle(span).textOverflow })) };
  });
  assert.equal(subtitles.status.modelTranscript, 'Esta respuesta se acumula completa sin reemplazar fragmentos.');
  assert.ok(subtitles.status.userTranscript.length > 300);
  assert.equal(subtitles.texts[0].width, subtitles.texts[1].width);
  assert.equal(subtitles.texts[0].fontSize, subtitles.texts[1].fontSize);
  assert.notEqual(subtitles.texts[1].overflow, 'ellipsis');
  await page.screenshot({ path: path.join(outputDir, 'packaged-subtitles.png') });
  await page.evaluate(async () => { await window.__cristiApp.disconnect(); await window.__cristiApp.disconnect(); });
  await page.waitForFunction(() => {
    const status = window.__cristiApp.getStatus();
    return !status.isConnected && !status.isConnecting;
  });
  const status = await page.evaluate(() => ({ status: window.__cristiApp.getStatus(), recording: window.__cristiApp.audioInRef.current.isRecording }));
  assert.equal(status.status.isConnected, false);
  assert.equal(status.status.isConnecting, false);
  assert.equal(status.recording, false);
  report.checks.push('AudioWorklet input; ordered Web Audio under stall; full subtitles; idempotent hangup');
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await app?.close();
  fs.writeFileSync(path.join(outputDir, 'packaged-call-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
