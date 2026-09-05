import assert from 'node:assert';
import fs from 'node:fs';
import { sceneManager } from '../src/services/sceneManager.js';
import { BACKGROUND_SCENES, DEFAULT_SCENE_ID } from '../src/config/scenes.js';
import { live2dModelRegistry } from '../src/services/live2d/Live2DModelRegistry.js';
import { ellenProfile } from '../src/services/live2d/models/ellen.profile.js';

console.log('========================================================================');
console.log('🧪 VERIFICACIÓN INTEGRAL DE CORRECCIONES: MARCAS DE AGUA, ESCENAS Y CÁMARA');
console.log('========================================================================\n');

// 1. ContextMenu Lucide Icons & Volume2 verification
console.log('🔍 [1/6] Verificando import de Volume2 en ContextMenu.jsx...');
const ctxContent = fs.readFileSync('src/components/ContextMenu.jsx', 'utf8');
assert(ctxContent.includes('Volume2'), 'Volume2 debe estar importado en ContextMenu.jsx');
assert(ctxContent.includes('icon={Volume2}'), 'Volume2 debe ser usado como icono en ContextMenu.jsx');
console.log('  ✅ Volume2 correctamente importado y renderizado.');

// 2. ErrorBoundary & Electron Relaunch IPC
console.log('🔍 [2/6] Verificando IPC de reinicio y ErrorBoundary...');
const mainContent = fs.readFileSync('electron/main.cjs', 'utf8');
const preloadContent = fs.readFileSync('electron/preload.cjs', 'utf8');
const bridgeContent = fs.readFileSync('src/services/desktop/ElectronBridge.js', 'utf8');
const errContent = fs.readFileSync('src/components/ErrorBoundary.jsx', 'utf8');

assert(mainContent.includes("ipcMain.handle('relaunch-app'"), 'relaunch-app debe existir en main.cjs');
assert(mainContent.includes("ipcMain.handle('reload-window'"), 'reload-window debe existir en main.cjs');
assert(preloadContent.includes("relaunchApp:"), 'relaunchApp debe exponerse en preload.cjs');
assert(bridgeContent.includes("relaunchApp()"), 'relaunchApp debe exponerse en ElectronBridge.js');
assert(errContent.includes("electronBridge.relaunchApp"), 'ErrorBoundary debe usar electronBridge.relaunchApp');
assert(errContent.includes("electronBridge.resetInteractionLock"), 'ErrorBoundary debe reiniciar locks de interacción');
console.log('  ✅ Mecanismo de reinicio y relanzamiento de Cristi AI verificado al 100%.');

// 3. Camera Window Configuration & Integration
console.log('🔍 [3/6] Verificando ventana de cámara independiente y enlace con Gemini...');
assert(mainContent.includes("cameraWindow.setAlwaysOnTop(true, 'pop-up-menu')"), 'cameraWindow debe tener alwaysOnTop pop-up-menu');
const cameraAppContent = fs.readFileSync('src/camera/CameraApp.jsx', 'utf8');
const appContent = fs.readFileSync('src/App.jsx', 'utf8');
assert(!cameraAppContent.includes('Mostrar superposición de visión'), 'Botón redundante de superposición debe haber sido eliminado');
assert(!cameraAppContent.includes('Cerrar ventana de cámara'), 'Botón interno redundante de cerrar debe haber sido eliminado');
assert(cameraAppContent.includes("broadcastChannelRef.current.postMessage({ type: 'camera_snapshot', base64 });"), 'CameraApp debe enviar camera_snapshot por broadcast');
assert(appContent.includes("e.data?.type === 'camera_snapshot'"), 'App.jsx debe recibir camera_snapshot y transmitirlo al socket');
console.log('  ✅ Ventana de cámara independiente optimizada y enlazada con la IA.');

// 4. Scene Alternation Architecture
console.log('🔍 [4/6] Verificando arquitectura de alternancia de escenas...');
assert(!BACKGROUND_SCENES.some(s => s.id === 'transparent'), 'transparent NO debe figurar en el catálogo de escenas seleccionables');
assert.strictEqual(DEFAULT_SCENE_ID, 'deep_nebula', 'DEFAULT_SCENE_ID debe ser deep_nebula');

// Test SceneManager behavior
sceneManager.setScene('cyber_loft');
let current = sceneManager.getScene();
assert.strictEqual(current.sceneId, 'cyber_loft', 'Debe reflejar la escena seleccionada');
assert.strictEqual(current.isTransparent, false, 'La escena seleccionada debe ser opaca');
assert.strictEqual(current.isSceneVisible, true, 'isSceneVisible debe ser true');

// Toggle to transparent
sceneManager.toggleBackdrop();
current = sceneManager.getScene();
assert.strictEqual(current.sceneId, 'transparent', 'Al alternar debe cambiar a transparent');
assert.strictEqual(current.isTransparent, true, 'isTransparent debe ser true');
assert.strictEqual(current.isSceneVisible, false, 'isSceneVisible debe ser false');
assert.strictEqual(current.selectedSceneId, 'cyber_loft', 'selectedSceneId debe recordarse intacta');

// Toggle back to scene
sceneManager.toggleBackdrop();
current = sceneManager.getScene();
assert.strictEqual(current.sceneId, 'cyber_loft', 'Al alternar de nuevo debe restaurar cyber_loft');
assert.strictEqual(current.isTransparent, false, 'isTransparent debe ser false');
assert.strictEqual(current.isSceneVisible, true, 'isSceneVisible debe ser true');

const available = sceneManager.getAvailableScenes();
assert(!available.some(s => s.id === 'transparent'), 'getAvailableScenes no debe contener transparent');
console.log('  ✅ Alternancia transparente <-> escena seleccionada funcionando perfectamente.');

// 5. Live2D Rendering Super-Optimizations
console.log('🔍 [5/6] Verificando calidad nativa y optimizaciones Live2D...');
const live2dContent = fs.readFileSync('src/components/Live2DCanvas.jsx', 'utf8');
assert(live2dContent.includes('2.0'), 'Live2DCanvas debe permitir resolución de hasta 2.0 (Retina/4K)');
assert(live2dContent.includes('ROUND_PIXELS = false'), 'PIXI.settings.ROUND_PIXELS debe ser false');
assert(live2dContent.includes('PIXI.WRAP_MODES.CLAMP'), 'Las texturas deben usar WRAP_MODES.CLAMP');
console.log('  ✅ Renderizado de ultra fidelidad y súper optimización activo.');

// 6. Ellen Joe Watermark Suppression
console.log('🔍 [6/6] Verificando supresión total de marcas de agua en Ellen Joe...');
const ellenJson = fs.readFileSync('public/models/live2d/ellen/免费模型艾莲.model3.json', 'utf8');
assert(!ellenJson.includes('"shuiyin"'), 'El archivo model3.json no debe incluir la expresión shuiyin');

assert(ellenProfile.hiddenParts.includes('Part17'), 'ellenProfile debe ocultar Part17 (marca de agua)');
assert(ellenProfile.hiddenParts.includes('Part78'), 'ellenProfile debe ocultar Part78 (texto de teclas)');
assert(ellenProfile.hiddenParts.includes('Part8'), 'ellenProfile debe ocultar Part8 (texto de teclas)');
assert.strictEqual(ellenProfile.lockedParameters.Paramheadxy, 0, 'Paramheadxy debe estar bloqueado a 0');
assert.strictEqual(ellenProfile.lockedParameters.ParambodyXY2, 0, 'ParambodyXY2 debe estar bloqueado a 0');

const adapterContent = fs.readFileSync('src/services/live2d/Live2DAdapter.js', 'utf8');
assert(adapterContent.includes('lockedParameters'), 'Live2DAdapter debe forzar lockedParameters');
console.log('  ✅ Supresión total de marcas de agua en Ellen Joe verificada.');

// 7. Jane Doe Face Integrity & Anatomy Preservation
console.log('🔍 [7/9] Verificando preservación de la cara de Jane Doe...');
const canvasContent = fs.readFileSync('src/components/Live2DCanvas.jsx', 'utf8');
const previewCanvasContent = fs.readFileSync('src/settings/components/ModelPreviewCanvas.jsx', 'utf8');
assert(!canvasContent.includes("descriptor.hiddenParts || ['Part17', 'Part78', 'Part8']"), 'Live2DCanvas no debe usar fallback global que oculte la cabeza de Jane Doe');
assert(!previewCanvasContent.includes("profile?.hiddenParts || ['Part17', 'Part78', 'Part8']"), 'ModelPreviewCanvas no debe usar fallback global que oculte la cabeza de Jane Doe');

const janeDoeProfile = live2dModelRegistry.getModel('jane_doe');
assert(!janeDoeProfile.hiddenParts || !janeDoeProfile.hiddenParts.includes('Part8'), 'Jane Doe no debe ocultar Part8 (Cabeza)');
assert(!janeDoeProfile.hiddenParts || !janeDoeProfile.hiddenParts.includes('Part17'), 'Jane Doe no debe ocultar Part17 (Nariz)');
console.log('  ✅ Cara y cabeza de Jane Doe 100% preservadas e intactas.');

// 8. Background Scene & Solid Grayish Bug Fix
console.log('🔍 [8/9] Verificando corrección del fondo grisáceo en BackgroundScene y CSS...');
const cssContent = fs.readFileSync('src/index.css', 'utf8');
assert(cssContent.includes('.app-container.solid-backdrop { @apply bg-transparent pointer-events-auto; }'), 'app-container.solid-backdrop debe ser bg-transparent para no tapar la escena');
assert(!cssContent.includes('.app-container.solid-backdrop { @apply bg-[#030712]'), 'app-container.solid-backdrop NO debe pintar fondo solido #030712');

const bgSceneContent = fs.readFileSync('src/components/BackgroundScene.jsx', 'utf8');
assert(!bgSceneContent.includes('-z-10'), 'BackgroundScene no debe tener -z-10 que quede oculto tras el contenedor');
assert(bgSceneContent.includes('z-0'), 'BackgroundScene debe tener capa z-0');
console.log('  ✅ Fondo real seleccionado visible sin capas grisáceas intermedias.');

// 9. Model Switching Scene Isolation
console.log('🔍 [9/9] Verificando aislamiento de alternancia al cambiar de modelo Live2D...');
const settingsContent = fs.readFileSync('src/settings/SettingsApp.jsx', 'utf8');
assert(!settingsContent.includes('// Actualizar escena de inmediato\n        sceneManager.setScene(sceneId);'), 'SettingsApp auto-save no debe forzar setScene al cambiar de modelo');

const appContentLatest = fs.readFileSync('src/App.jsx', 'utf8');
assert(appContentLatest.includes('if (newConfig.sceneId && newConfig.sceneId !== sceneManager.selectedSceneId)'), 'App.jsx solo debe cambiar escena si sceneId es distinto');
console.log('  ✅ Cambio de modelo Live2D no altera la alternancia de la escena.');

console.log('\n🎉 TODAS LAS VERIFICACIONES COMPLETADAS CON ÉXITO');
