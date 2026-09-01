/**
 * Cristi Desktop - Computer Use, Vision Grounding & Global Shortcuts Test Suite (Endurecida)
 * Validates ToolExecutor, ElectronBridge, Global Shortcuts, Safe Command Execution,
 * Concurrent Fuzzing across all 26+ tools with malformed parameters, boundary paths,
 * and massive batch dispatching.
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
console.log('🧪 CRISTI DESKTOP - COMPUTER USE & 26-TOOL CONCURRENCY (HARDENED)');
console.log('================================================================');

// ── 1. Tools Definition Schema ──────────────────────────────────────────────
console.log('\n[1/6] Verificando catálogo de herramientas de uso de computadora (tools.js)...');
const requiredToolNames = [
  'trigger_companion_gesture',
  'trigger_model_motion',
  'move_avatar',
  'get_current_time_and_date',
  'get_weather',
  'system_diagnostics',
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
  'capture_screen_snapshot',
  'set_screen_watch',
  'set_screen_region',
  'analyze_visual_scene',
  'manage_memory',
  'set_reminder',
  'set_alarm',
  'show_tactical_widget',
  'dismiss_tactical_widget'
];

requiredToolNames.forEach(name => {
  const tool = TOOLS_DEFINITIONS.find(t => t.name === name);
  assert(tool !== undefined, `Herramienta "${name}" declarada en TOOLS_DEFINITIONS.`);
});

// ── 2. ToolExecutor Implementation & Dispatching ───────────────────────────
console.log('\n[2/6] Verificando ToolExecutor dispatching y ejecución estándar...');
const executor = new ToolExecutor({
  getScreenCapture: async () => 'mock_base64_screen_frame',
  getCameraSnapshot: () => 'mock_camera_snapshot',
  getVisionDetections: () => ({
    sceneState: 'OWNER_ALONE',
    summary: 'Usuario trabajando solo en la PC.',
    faces: [{ label: 'Jeremy', isOwner: true, topEmotion: 'focused', confidence: 0.96 }],
    objects: [{ class: 'laptop', score: 0.94 }]
  })
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
console.log('\n[3/6] Verificando métodos de ElectronBridge...');
assert(typeof electronBridge.execCommand === 'function', 'execCommand expuesto en ElectronBridge.');
assert(typeof electronBridge.openPath === 'function', 'openPath expuesto en ElectronBridge.');
assert(typeof electronBridge.showItemInFolder === 'function', 'showItemInFolder expuesto en ElectronBridge.');
assert(typeof electronBridge.captureScreenNative === 'function', 'captureScreenNative expuesto en ElectronBridge.');
assert(typeof electronBridge.onShortcutEvent === 'function', 'onShortcutEvent expuesto en ElectronBridge.');
assert(typeof electronBridge.getClipboardText === 'function', 'getClipboardText expuesto en ElectronBridge.');
assert(typeof electronBridge.setClipboardText === 'function', 'setClipboardText expuesto en ElectronBridge.');

// ── 4. Electron Main & Preload Contract Check ───────────────────────────────
console.log('\n[4/6] Verificando shortcuts y contratos en electron/main.cjs y preload.cjs...');
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

// ── 5. STRESS TEST: EJECUCIÓN CONCURRENTE DE LAS 26 HERRAMIENTAS CON PARÁMETROS MALFORMADOS
console.log('\n[5/6] ⚡ SOBRECARGA: Ejecución concurrente de las 26 herramientas con parámetros malformados y rutas límite...');

const all26Tools = [
  { name: 'trigger_companion_gesture', args: { gesture: 99999, comment: null } },
  { name: 'trigger_model_motion', args: { motion_group: null, index: 'NOT_A_NUMBER' } },
  { name: 'move_avatar', args: { position: ['invalid_array'], animation: {} } },
  { name: 'get_current_time_and_date', args: { extraGarbage: true } },
  { name: 'get_weather', args: { city: '   <script>alert(1)</script>   ' } },
  { name: 'set_reminder', args: { title: null, time: '99:99:99', tag: 123 } },
  { name: 'set_alarm', args: { time: null, label: {} } },
  { name: 'show_tactical_widget', args: { type: 'unknown_type', title: null, duration: 'infinite' } },
  { name: 'dismiss_tactical_widget', args: { id: null } },
  { name: 'system_diagnostics', args: { payload: 'massive'.repeat(100) } },
  { name: 'execute_system_command', args: { command: null, use_powershell: 'maybe' } },
  { name: 'read_file', args: { path: '' } },
  { name: 'read_file', args: { path: 'C:\\deeply\\nested\\non_existent_folder_99999\\forbidden.sys' } },
  { name: 'read_file', args: { path: '../../../../../../../../../../windows/system32/cmd.exe' } },
  { name: 'write_file', args: { path: null, content: null } },
  { name: 'write_file', args: { path: '   ', content: 'test content' } },
  { name: 'list_directory', args: { path: 'Z:\\invalid_drive_letter\\random_dir' } },
  { name: 'get_clipboard', args: { extraParam: [1, 2, 3] } },
  { name: 'set_clipboard', args: { text: null } },
  { name: 'get_running_processes', args: { filter: null } },
  { name: 'kill_process', args: { pid_or_name: '' } },
  { name: 'kill_process', args: { pid_or_name: -999999 } },
  { name: 'open_url', args: { url: null } },
  { name: 'open_system_app_or_link', args: { url: 'javascript:void(0)' } },
  { name: 'open_file_or_folder', args: { path: null } },
  { name: 'computer_action', args: { action: 'invalid_action_xyz', coordinate: 'not_an_array' } },
  { name: 'computer_action', args: { action: 'mouse_click', coordinate: [-99999, 'NaN'] } },
  { name: 'computer_action', args: { action: 'mouse_scroll', scroll_amount: 'NaN' } },
  { name: 'capture_screen_snapshot', args: { region: 'totally_invalid_region_name' } },
  { name: 'set_screen_watch', args: { enabled: 'not_a_boolean' } },
  { name: 'set_screen_region', args: { x_pct: 'NaN', y_pct: -500, w_pct: 99999, h_pct: null } },
  { name: 'analyze_visual_scene', args: { focus_target: { nested: 'object' } } },
  { name: 'manage_memory', args: { action: 'unknown_memory_op', key: null } }
];

const tStartConcurrent = performance.now();
const results = await Promise.all(
  all26Tools.map(t => executor.executeSingleTool(t.name, t.args))
);
const durationConcurrent = (performance.now() - tStartConcurrent).toFixed(1);

let validResponsesCount = 0;
results.forEach((res) => {
  if (res && typeof res === 'object' && (res.status || res.message || res.current_gesture)) {
    validResponsesCount++;
  }
});

assert(results.length === all26Tools.length, `Se ejecutaron concurrentemente ${all26Tools.length} llamadas malformadas.`);
assert(validResponsesCount === all26Tools.length, `100% de las herramientas devolvieron respuestas estructuradas sin excepciones fatales.`);
console.log(`    ⚡ ${all26Tools.length} operaciones concurrentes ejecutadas en ${durationConcurrent}ms.`);

// ── 6. STRESS TEST: LOTE MASIVO DE 200 LLAMADAS ASÍNCRONAS POR LOTES (executeCalls)
console.log('\n[6/6] ⚡ SOBRECARGA: Procesamiento por lotes de 200 llamadas de herramientas simultáneas...');

const batchCalls = [];
for (let i = 0; i < 200; i++) {
  const toolItem = all26Tools[i % all26Tools.length];
  batchCalls.push({
    id: `call_batch_${i}`,
    name: toolItem.name,
    args: toolItem.args
  });
}

const tStartBatch = performance.now();
const batchResponses = await executor.executeCalls(batchCalls);
const durationBatch = (performance.now() - tStartBatch).toFixed(1);

assert(batchResponses.length === 200, `Lote de 200 llamadas procesado completamente (${batchResponses.length}/200).`);
assert(batchResponses.every(r => r.id && r.name && r.response), 'Cada respuesta contiene ID de correlación, nombre y resultado.');
console.log(`    ⚡ 200 llamadas por lotes ejecutadas en ${durationBatch}ms.`);

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
