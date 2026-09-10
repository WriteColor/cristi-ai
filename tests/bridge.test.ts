import test from 'node:test';
import assert from 'node:assert/strict';
import { ElectronBridge, ElectronBridgeService } from '../src/services/desktop/ElectronBridge';
import type { ElectronApiBridge } from '../shared/ipc/contracts';

test('ElectronBridge gracefully handles non-Electron / browser environment', async () => {
  // In Node.js test environment without window, isElectronAvailable should be false
  assert.equal(ElectronBridge.isElectronAvailable(), false);
  assert.equal(ElectronBridge.isElectron, false);

  // File system methods throw clear errors outside Electron desktop
  await assert.rejects(async () => ElectronBridge.readFile('test.txt'), /unavailable in browser/i);
  await assert.rejects(async () => ElectronBridge.writeFile('test.txt', 'test'), /unavailable in browser/i);
  await assert.rejects(async () => ElectronBridge.readDirectory(''), /unavailable in browser/i);

  // Screen capture & audio fallbacks
  const screen = await ElectronBridge.captureScreenNative();
  assert.equal(screen, null);

  const audioStatus = await ElectronBridge.getDesktopAudioCaptureStatus();
  assert.deepEqual(audioStatus, { running: false, sourceId: null, transport: null, frameCount: 0, uptimeMs: 0 });

  // Credential status fallback
  const creds = await ElectronBridge.credentialStatus();
  assert.deepEqual(creds, {
    hasGeminiCredential: false,
    hasDiscordCredential: false,
    hasSpotifyCredential: false
  });

  // Display dimensions fallback via getDisplayInfo
  const dims = await ElectronBridge.getDisplayInfo();
  assert.equal(typeof dims.width, 'number');
  assert.equal(typeof dims.height, 'number');
  assert.equal(dims.scaleFactor, 1);

  // Live token throws helpful error when Electron is unavailable
  await assert.rejects(
    async () => ElectronBridge.requestLiveToken('gemini-2.0-flash'),
    /Live requiere Electron/
  );
});

test('ElectronBridge delegates strictly to window.electronAPI when available', async () => {
  const calls: { method: string; args: unknown[] }[] = [];

  const mockApi: Partial<ElectronApiBridge> = {
    isElectron: true,
    requestLiveToken: async (model: string) => {
      calls.push({ method: 'requestLiveToken', args: [model] });
      return 'auth_tokens/mock-token-123';
    },
    readFile: async (req) => {
      calls.push({ method: 'readFile', args: [req] });
      return 'mock content';
    },
    writeFile: async (req, data) => {
      calls.push({ method: 'writeFile', args: [req, data] });
      return true;
    },
    setIgnoreMouseEvents: (ignore: boolean, options?: unknown) => {
      calls.push({ method: 'setIgnoreMouseEvents', args: [ignore, options] });
    },
    setAlwaysOnTop: (value: boolean) => {
      calls.push({ method: 'setAlwaysOnTop', args: [value] });
    },
    credentialStatus: async () => {
      calls.push({ method: 'credentialStatus', args: [] });
      return {
        hasGeminiCredential: true,
        hasDiscordCredential: true,
        hasSpotifyCredential: false
      };
    },
    onConfigUpdated: (listener: (data: unknown) => void) => {
      calls.push({ method: 'onConfigUpdated', args: [listener] });
      return () => {
        calls.push({ method: 'unsubscribe-config', args: [] });
      };
    }
  };

  // Inject window with mock electronAPI
  (globalThis as unknown as { window: unknown }).window = {
    electronAPI: mockApi
  };

  try {
    const bridge = new ElectronBridgeService();
    assert.equal(bridge.isElectronAvailable(), true);
    assert.equal(bridge.isElectron, true);

    const token = await bridge.requestLiveToken('gemini-2.0-flash');
    assert.equal(token, 'auth_tokens/mock-token-123');

    const readContent = await bridge.readFile('doc.txt');
    assert.equal(readContent, 'mock content');

    const writeRes = await bridge.writeFile('out.txt', 'hello');
    assert.equal(writeRes, true);

    const creds = await bridge.credentialStatus();
    assert.deepEqual(creds, {
      hasGeminiCredential: true,
      hasDiscordCredential: true,
      hasSpotifyCredential: false
    });

    bridge.setAlwaysOnTop(true);
    bridge.setIgnoreMouseEvents(false);

    const dummyListener = () => {};
    const unsub = bridge.onConfigUpdated(dummyListener);
    assert.equal(typeof unsub, 'function');
    unsub();

    assert.equal(calls.some(c => c.method === 'requestLiveToken'), true);
    assert.equal(calls.some(c => c.method === 'readFile'), true);
    assert.equal(calls.some(c => c.method === 'writeFile'), true);
    assert.equal(calls.some(c => c.method === 'setAlwaysOnTop'), true);
    assert.equal(calls.some(c => c.method === 'setIgnoreMouseEvents'), true);
    assert.equal(calls.some(c => c.method === 'onConfigUpdated'), true);
    assert.equal(calls.some(c => c.method === 'unsubscribe-config'), true);
  } finally {
    // Restore environment
    delete (globalThis as unknown as { window?: unknown }).window;
  }
});
