import { build } from 'esbuild';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
await build({ entryPoints: ['tests/electron-harness.ts'], outfile: '.test-build/electron-harness.cjs', bundle: true,
  platform: 'node', format: 'cjs', packages: 'external' });
for (const name of ['playwright', 'memory']) await fs.copyFile(`electron/dist/${name}.worker.cjs`, `.test-build/${name}.worker.cjs`);
const data = await fs.mkdtemp(path.join(os.tmpdir(), 'cristi-e2e-'));
const env = { ...process.env, CRISTI_TEST_DATA: data };
for (const key of ['ELECTRON_RUN_AS_NODE', 'GEMINI_API_KEY', 'VITE_GEMINI_API_KEY', 'DISCORD_BOT_TOKEN', 'SPOTIFY_CLIENT_SECRET']) delete env[key];
const app = await electron.launch({ args: [path.resolve('.test-build/electron-harness.cjs')], env, timeout: 45000 });
const errors = [];
try {
  const main = await app.firstWindow();
  main.on('pageerror', error => errors.push(error.message));
  await main.waitForURL('app://cristi/index.html');
  await main.waitForSelector('#root .app-container', { state: 'attached', timeout: 60000 });
  await main.waitForSelector('[data-avatar-ready="true"]', { state: 'attached', timeout: 30000 }).catch(async error => { console.error(await main.locator('[data-avatar-ready]').getAttribute('data-avatar-error')); throw error; });
  const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => window.webContents.getLastWebPreferences()));
  for (const prefs of preferences) {
    assert.equal(prefs.sandbox, true); assert.equal(prefs.webSecurity, true);
    assert.equal(prefs.contextIsolation, true); assert.equal(prefs.nodeIntegration, false);
  }
  const surface = await main.evaluate(() => ({ shell: typeof window.electronAPI.execCommand,
    getSecret: typeof window.electronAPI.getSecureSecret, setSecret: typeof window.electronAPI.setSecureSecret,
    debug: typeof window.__cristiApp, require: typeof window.require }));
  assert.deepEqual(surface, { shell: 'undefined', getSecret: 'undefined', setSecret: 'undefined', debug: 'undefined', require: 'undefined' });
  const paths = await main.evaluate(async () => {
    const paths = ['/..%5c..%5c.env', '/%2e%2e%2f.env', '/C:%5cWindows%5cwin.ini', '/package.json'];
    return Promise.all(paths.map(async pathname => (await fetch('app://cristi' + pathname)).status));
  });
  assert(paths.every(status => status === 404));
  for (const page of ['index.html', 'settings.html', 'camera.html']) {
    const csp = await main.evaluate(async page => (await fetch('app://cristi/' + page)).headers.get('content-security-policy'), page);
    assert(csp.includes("default-src 'self'") && csp.includes("object-src 'none'"));
  }
  const savedMemory = await main.evaluate(() => window.electronAPI.memorySave([{ id: 'fixture', text: 'test memory' }]));
  assert.equal(savedMemory.success, true);
  const loadedMemory = await main.evaluate(() => window.electronAPI.memoryLoad());
  assert.equal(loadedMemory.memories[0].id, 'fixture');
  const browserStatus = await main.evaluate(() => window.electronAPI.playwrightExecute('status', {}));
  assert.equal(browserStatus.success, true); assert.equal(browserStatus.isRunning, false);
  const count = (await app.windows()).length;
  await main.evaluate(() => window.open('https://example.invalid'));
  assert.equal((await app.windows()).length, count);
  const denied = await main.evaluate(async () => {
    try { await navigator.mediaDevices.getUserMedia({ video: true }); return false; } catch { return true; }
  });
  assert(denied, 'Main renderer must not request camera');
  await main.evaluate(() => { location.href = 'https://example.invalid'; });
  await main.waitForTimeout(150);
  assert.equal(main.url(), 'app://cristi/index.html');
  const settingsPromise = app.waitForEvent('window');
  await main.evaluate(() => window.electronAPI.openSettingsWindow());
  const settings = await settingsPromise;
  settings.on('pageerror', error => errors.push(error.message));
  await settings.waitForURL('app://cristi/settings.html');
  await settings.waitForSelector('#settings-root > *', { state: 'attached' });
  const initialSettingsAssets = await settings.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  assert(!initialSettingsAssets.some(name => name.includes('cubism4.es-')), 'General settings must not eagerly load the avatar engine');
  await settings.getByRole('button', { name: 'Personajes Live2D', exact: true }).click();
  await settings.waitForSelector('canvas', { state: 'attached' });
  await settings.evaluate(async () => {
    await window.electronAPI.setSecureSecret('gemini.apiKey', 'CANARY_E2E_SECRET');
    await window.electronAPI.saveAppConfig({ apiKey: 'CANARY_E2E_SECRET', modelId: 'gemini-3.1-flash-live-preview' });
  });
  const config = await settings.evaluate(() => window.electronAPI.getAppConfig());
  for (const page of [main, settings]) assert(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('CANARY_E2E_SECRET'));
  assert.equal(config.hasGeminiCredential, true); assert.equal(config.apiKey, undefined);
  assert(!(await fs.readFile(path.join(data, 'cristi-config.json'), 'utf8')).includes('CANARY_E2E_SECRET'));
  assert(!(await fs.readFile(path.join(data, 'cristi-secrets.json'), 'utf8')).includes('CANARY_E2E_SECRET'));
  const cameraPromise = app.waitForEvent('window');
  await main.evaluate(() => window.electronAPI.openCameraWindow());
  const camera = await cameraPromise;
  await camera.waitForURL('app://cristi/camera.html');
  await camera.waitForSelector('#camera-root > *', { state: 'attached' });
  const cameraSurface = await camera.evaluate(() => Object.keys(window.electronAPI).sort());
  assert.deepEqual(cameraSurface, ['closeCameraWindow', 'getAppConfig', 'getAppVersion', 'isElectron']);
  const media = await camera.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); return false; } catch { return true; }
  });
  assert(media, 'Camera window permits only video (synthetic test device)');
  for (const preferences of await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => window.webContents.getLastWebPreferences()))) {
    assert(preferences.sandbox && preferences.webSecurity && preferences.contextIsolation && !preferences.nodeIntegration);
  }
  await settings.evaluate(() => window.electronAPI.closeSettingsWindow()).catch(error => { if (!settings.isClosed()) throw error; });
  await main.evaluate(() => localStorage.setItem('cristi_ai_settings_v1', JSON.stringify({ apiKey: 'LEGACY_CANARY', spotifyClientSecret: 'LEGACY_CANARY', discord: { botToken: 'LEGACY_CANARY' } })));
  const migratedWindow = app.waitForEvent('window');
  await main.reload();
  const migrationSettings = await migratedWindow;
  await migrationSettings.waitForURL('app://cristi/settings.html');
  await main.waitForFunction(() => !(localStorage.getItem('cristi_ai_settings_v1') || '').includes('LEGACY_CANARY'));
  const migrated = await main.evaluate(() => window.electronAPI.credentialStatus());
  assert(migrated.hasGeminiCredential && migrated.hasDiscordCredential && migrated.hasSpotifyCredential);
  assert(!(await fs.readFile(path.join(data, 'cristi-secrets.json'), 'utf8')).includes('LEGACY_CANARY'));
  assert.deepEqual(errors, [], 'Renderer startup errors');
  console.log('Electron E2E: production pages, sandbox, CSP, traversal, navigation, capabilities and encrypted canary passed.');
} finally {
  await app.close();
  // Only the verified temp directory created above is removed.
  if (path.dirname(data) === os.tmpdir() && path.basename(data).startsWith('cristi-e2e-')) await fs.rm(data, { recursive: true, force: true });
}
