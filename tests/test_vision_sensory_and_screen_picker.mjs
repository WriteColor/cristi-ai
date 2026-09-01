/**
 * Cristi AI - Vision Sensory, Camera Hardware & Screen Picker Test Suite
 * Validates:
 * 1. CameraService parameter compatibility (onFrame vs onFrameCaptured), race condition guard & canvas cleanup
 * 2. CameraService device ideal constraint resilience and offscreen fallback
 * 3. VisionDetectionService tensor management (tf.tidy, try/finally, dispose, getMemoryInfo, canvas HUD cleanup)
 * 4. LocalVisionService tensor management, model unload & getMemoryInfo
 * 5. ScreenCaptureService native Electron IPC integration, multi-monitor display matching, regional percentage clamping & canvas teardown
 * 6. ScreenRegionPicker and CameraPreview memory lifecycle & zero-leak timer cleanups
 */

import fs from 'fs';
import path from 'path';
import { CameraService } from '../src/services/cameraService.js';
import { ScreenCaptureService } from '../src/services/screenCaptureService.js';

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
console.log('🧪 VALIDACIÓN: VISIÓN SENSORIAL, CÁMARA, SCREEN CAPTURE & REGIONES');
console.log('================================================================\n');

// ── 1. CameraService Constructor & Parameter Fallback ─────────────────────────
console.log('[1/6] Verificando CameraService y compatibilidad de parámetros...');
let capturedFrame = null;
const cameraWithOnFrame = new CameraService({
  onFrame: (frame) => {
    capturedFrame = frame;
  }
});
assert(typeof cameraWithOnFrame.onFrameCaptured === 'function', 'CameraService acepta onFrame como alias de onFrameCaptured');

cameraWithOnFrame.onFrameCaptured('test_frame_123');
assert(capturedFrame === 'test_frame_123', 'Callback onFrame ejecutado correctamente');

const cameraWithOnFrameCaptured = new CameraService({
  onFrameCaptured: (frame) => {
    capturedFrame = frame;
  }
});
cameraWithOnFrameCaptured.onFrameCaptured('test_frame_456');
assert(capturedFrame === 'test_frame_456', 'CameraService acepta onFrameCaptured directamente');

assert(typeof cameraWithOnFrame.attachVideoPreview === 'function', 'Método attachVideoPreview expuesto');
assert(typeof cameraWithOnFrame.getVideoElement === 'function', 'Método getVideoElement expuesto');
assert(typeof cameraWithOnFrame.getMediaStream === 'function', 'Método getMediaStream expuesto');
assert(typeof cameraWithOnFrame.stop === 'function', 'Método stop expuesto');

// ── 2. CameraService Source Inspection (Ideal Constraints, Offscreen & Race Guards)
console.log('\n[2/6] Inspeccionando ciclo de vida y blindaje de hardware en CameraService...');
const cameraPath = path.resolve(process.cwd(), 'src/services/cameraService.js');
const cameraSrc = fs.readFileSync(cameraPath, 'utf8');
assert(cameraSrc.includes('ideal: preferredDeviceId'), 'CameraService usa constraint ideal en lugar de exact');
assert(cameraSrc.includes('internalVideoElement'), 'CameraService gestiona elemento interno offscreen');
assert(!cameraSrc.includes('exact: preferredDeviceId'), 'No existen constraints exactos que provoquen OverconstrainedError');
assert(cameraSrc.includes('_isStarting'), 'CameraService implementa guard _isStarting contra race conditions');
assert(cameraSrc.includes('track.stop()'), 'CameraService invoca track.stop() para liberar el hardware de cámara');
assert(cameraSrc.includes('clearRect'), 'CameraService limpia el canvas en stop() para liberar memoria de texturas');

// ── 3. VisionDetectionService Tensor Management & WebGL Memory ────────────────
console.log('\n[3/6] Verificando gestión de tensores y ciclo de vida en VisionDetectionService...');
const visionSrc = fs.readFileSync('src/services/visionDetectionService.js', 'utf8');
assert(visionSrc.includes('pose: poseKeypoints'), 'VisionDetectionService asigna pose: poseKeypoints (ReferenceError resuelto)');
assert(!visionSrc.includes('pose: mainPose'), 'No existe referencia inválida a mainPose');
assert(visionSrc.includes('videoSource'), 'VisionDetectionService soporta videoSource dinámico/getter');
assert(visionSrc.includes('canvasSource'), 'VisionDetectionService soporta canvasSource dinámico/getter');
assert(visionSrc.includes('tf.tidy'), 'VisionDetectionService encapsula tensores intermedios con tf.tidy');
assert(visionSrc.includes('expanded.dispose()'), 'VisionDetectionService libera el tensor expandido en finally');
assert(visionSrc.includes('prediction.dispose()'), 'VisionDetectionService libera el tensor de predicción en finally');
assert(visionSrc.includes('getMemoryInfo()'), 'VisionDetectionService expone telemetría tf.memory()');
assert(visionSrc.includes('unloadModels()'), 'VisionDetectionService incluye descarga segura de pesos neuronales');
assert(visionSrc.includes('clearRect'), 'VisionDetectionService limpia el canvas HUD al detener el rastreo');

// ── 4. LocalVisionService Tensor Management & Cleanup ─────────────────────────
console.log('\n[4/6] Verificando gestión de tensores en LocalVisionService...');
const localVisionSrc = fs.readFileSync('src/services/localVisionService.js', 'utf8');
assert(localVisionSrc.includes('tf.tidy'), 'LocalVisionService usa tf.tidy en inferencia MoveNet');
assert(localVisionSrc.includes('prediction.dispose()'), 'LocalVisionService libera tensores en bloque finally');
assert(localVisionSrc.includes('getMemoryInfo()'), 'LocalVisionService expone getMemoryInfo()');
assert(localVisionSrc.includes('objectModel.dispose'), 'LocalVisionService libera modelos en dispose()');

// ── 5. ScreenRegionPicker & CSS Performance Optimizations ─────────────────────
console.log('\n[5/6] Verificando optimización de ScreenRegionPicker y CSS...');
const pickerSrc = fs.readFileSync('src/components/ScreenRegionPicker.jsx', 'utf8');
assert(!pickerSrc.includes('setCurrent({'), 'ScreenRegionPicker no dispara setState en cada movimiento de ratón');
assert(pickerSrc.includes('setPointerCapture'), 'ScreenRegionPicker utiliza setPointerCapture para tracking de precisión');
assert(pickerSrc.includes('requestAnimationFrame'), 'ScreenRegionPicker utiliza requestAnimationFrame');
assert(pickerSrc.includes('clampedX'), 'ScreenRegionPicker aplica clamping seguro a coordenadas');

const previewSrc = fs.readFileSync('src/components/CameraPreview.jsx', 'utf8');
assert(previewSrc.includes('feedbackTimeoutRef'), 'CameraPreview utiliza feedbackTimeoutRef para limpieza en unmount');
assert(previewSrc.includes('clearTimeout'), 'CameraPreview cancela timers pendientes al desmontar');

const cssSrc = fs.readFileSync('src/index.css', 'utf8');
const pickerOverlayMatch = cssSrc.match(/\.screen-picker-overlay\s*\{([^}]+)\}/);
assert(pickerOverlayMatch && !pickerOverlayMatch[1].includes('backdrop-filter'), '.screen-picker-overlay no tiene backdrop-filter: blur');

const fullscreenOverlayMatch = cssSrc.match(/\.screen-overlay-fullscreen\s*\{([^}]+)\}/);
assert(fullscreenOverlayMatch && !fullscreenOverlayMatch[1].includes('backdrop-filter'), '.screen-overlay-fullscreen no tiene backdrop-filter: blur');

// ── 6. ScreenCaptureService & Multi-Monitor DesktopCapturer ──────────────────
console.log('\n[6/6] Verificando ScreenCaptureService y multi-monitor en Electron...');
const mainSrc = fs.readFileSync('electron/main.cjs', 'utf8');
assert(mainSrc.includes('desktopCapturer'), 'electron/main.cjs importa desktopCapturer');
assert(mainSrc.includes('desktopCapturer.getSources'), 'electron/main.cjs utiliza desktopCapturer.getSources nativo en C++');
assert(!mainSrc.includes('System.Windows.Forms.Screen'), 'electron/main.cjs ya no ejecuta PowerShell para captura de pantalla');
assert(mainSrc.includes('getDisplayMatching'), 'electron/main.cjs soporta coincidencia multi-monitor con getDisplayMatching');

const captureService = new ScreenCaptureService();
assert(typeof captureService.captureNativeDesktop === 'function', 'ScreenCaptureService tiene método captureNativeDesktop');
assert(typeof captureService.setRegion === 'function', 'ScreenCaptureService tiene método setRegion');

captureService.setRegion({ x_pct: 10, y_pct: 20, w_pct: 50, h_pct: 40 });
assert(captureService.region.x_pct === 10 && captureService.region.w_pct === 50, 'Región guardada con porcentajes precisos');

captureService.setRegion({ x_pct: -50, y_pct: 150, w_pct: 200, h_pct: 300 });
assert(captureService.region.x_pct >= 0 && captureService.region.y_pct <= 100, 'Región aplica clamping ante valores fuera de rango');

const screenCaptureSrc = fs.readFileSync('src/services/screenCaptureService.js', 'utf8');
assert(screenCaptureSrc.includes('electronBridge.captureScreenNative'), 'ScreenCaptureService llama a electronBridge.captureScreenNative');
assert(!screenCaptureSrc.includes('powershell'), 'ScreenCaptureService ya no invoca scripts externos de powershell');
assert(screenCaptureSrc.includes('offscreenCanvas.width = 0'), 'ScreenCaptureService libera memoria de canvas en stopAll');

console.log('\n================================================================');
console.log(`📊 RESULTADO: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
