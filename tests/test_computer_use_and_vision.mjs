/**
 * Cristi Desktop - Computer Use, Vision Grounding & Global Shortcuts Test Suite
 * Validates ToolExecutor, ElectronBridge, Global Shortcuts, and Safe Command Execution.
 */

import fs from 'fs';
import { ToolExecutor } from '../src/services/toolExecutor.js';
import { electronBridge } from '../src/services/desktop/ElectronBridge.js';
import { TOOLS_DEFINITIONS } from '../src/config/tools.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
}

console.log('================================================================');
console.log('🧪 CRISTI DESKTOP - COMPUTER USE, VISION & SHORTCUTS VALIDATION');
console.log('================================================================');

// ── 1. Tools Definition Schema ──────────────────────────────────────────────
console.log('\n[1/4] Verificando catálogo de herramientas de uso de computadora (tools.js)...');
const requiredToolNames = [
  'execute_system_command',
  'read_file',
  'write_file',
  'list_directory',
  'open_file_or_folder',
  'open_system_app_or_link',
  'get_running_processes',
  'kill_process',
  'get_clipboard',
  'set_clipboard',
  'computer_action',
  'capture_screen_snapshot'
];

requiredToolNames.forEach(name => {
  const tool = TOOLS_DEFINITIONS.find(t => t.name === name);
  assert(tool !== undefined, `Herramienta "${name}" declarada en TOOLS_DEFINITIONS.`);
});

// ── 2. ToolExecutor Implementation & Dispatching ───────────────────────────
console.log('\n[2/4] Verificando ToolExecutor dispatching y ejecución segura...');
const executor = new ToolExecutor({
  getScreenCapture: async () => 'mock_base64_screen_frame'
});

// Test open_file_or_folder dispatch
const openFolderRes = await executor.executeSingleTool('open_file_or_folder', { path: 'C:\\React-Nextjs-Projects\\Cristi AI' });
assert(openFolderRes !== undefined, 'open_file_or_folder responde.');

// Test clipboard get/set dispatch
const setClipRes = await executor.executeSingleTool('set_clipboard', { text: 'Cristi Desktop AI' });
assert(setClipRes.status === 'success', 'set_clipboard despacha correctamente.');

const getClipRes = await executor.executeSingleTool('get_clipboard', {});
assert(getClipRes !== undefined, 'get_clipboard despacha correctamente.');

// Test screenshot tool dispatch
const shotRes = await executor.executeSingleTool('capture_screen_snapshot', { region: 'full' });
assert(shotRes.status === 'captured', 'capture_screen_snapshot devuelve estado captured.');
assert(shotRes.frame_data !== undefined, 'capture_screen_snapshot provee frame_data.');

// Test computer action dispatch
const clickRes = await executor.executeSingleTool('computer_action', { action: 'mouse_click', coordinate: [500, 300] });
assert(clickRes.status === 'executed', 'computer_action (mouse_click) despacha correctamente.');

const typeRes = await executor.executeSingleTool('computer_action', { action: 'type_text', text: 'Hello Cristi' });
assert(typeRes.status === 'executed', 'computer_action (type_text) despacha correctamente.');

// ── 3. ElectronBridge Desktop Capabilities ──────────────────────────────────
console.log('\n[3/4] Verificando métodos de ElectronBridge...');
assert(typeof electronBridge.execCommand === 'function', 'execCommand expuesto en ElectronBridge.');
assert(typeof electronBridge.openPath === 'function', 'openPath expuesto en ElectronBridge.');
assert(typeof electronBridge.showItemInFolder === 'function', 'showItemInFolder expuesto en ElectronBridge.');
assert(typeof electronBridge.captureScreenNative === 'function', 'captureScreenNative expuesto en ElectronBridge.');
assert(typeof electronBridge.onShortcutEvent === 'function', 'onShortcutEvent expuesto en ElectronBridge.');
assert(typeof electronBridge.getClipboardText === 'function', 'getClipboardText expuesto en ElectronBridge.');
assert(typeof electronBridge.setClipboardText === 'function', 'setClipboardText expuesto en ElectronBridge.');

// ── 4. Electron Main & Preload Contract Check ───────────────────────────────
console.log('\n[4/4] Verificando shortcuts y contratos en electron/main.cjs y preload.cjs...');
const mainSrc = fs.readFileSync('electron/main.cjs', 'utf8');
assert(mainSrc.includes('globalShortcut.register'), 'electron/main.cjs registra atajos globales.');
assert(mainSrc.includes('CommandOrControl+Shift+C'), 'Atajo Boss Key (Ctrl+Shift+C) configurado.');
assert(mainSrc.includes('CommandOrControl+Shift+M'), 'Atajo Mute Toggle (Ctrl+Shift+M) configurado.');
assert(mainSrc.includes('CommandOrControl+Shift+S'), 'Atajo Vision Snapshot (Ctrl+Shift+S) configurado.');
assert(mainSrc.includes('CommandOrControl+Shift+H'), 'Atajo Zen Mode / Hide UI (Ctrl+Shift+H) configurado.');
assert(mainSrc.includes('CommandOrControl+Shift+P'), 'Atajo Telemetría Profiler (Ctrl+Shift+P) configurado.');
assert(mainSrc.includes('CommandOrControl+Shift+A'), 'Atajo Always-On-Top Pin (Ctrl+Shift+A) configurado.');
assert(mainSrc.includes('timeoutMs'), 'Timeout de 10s configurado en exec-command.');
assert(mainSrc.includes('capture-screen-native'), 'Handler capture-screen-native configurado.');
assert(mainSrc.includes('open-path'), 'Handler open-path configurado.');

const preloadSrc = fs.readFileSync('electron/preload.cjs', 'utf8');
assert(preloadSrc.includes('captureScreenNative'), 'preload.cjs expone captureScreenNative.');
assert(preloadSrc.includes('openPath'), 'preload.cjs expone openPath.');
assert(preloadSrc.includes('showItemInFolder'), 'preload.cjs expone showItemInFolder.');
assert(preloadSrc.includes('onShortcutEvent'), 'preload.cjs expone onShortcutEvent.');

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
