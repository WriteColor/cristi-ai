import assert from 'node:assert';
import fs from 'node:fs';

console.log('======================================================================');
console.log('🧪 TEST: CAMERA FREEZE PREVENTION & SOCKET RECONNECT LOOP ELIMINATION');
console.log('======================================================================\n');

// 1. Electron Main Process Window Configuration
console.log('🔍 [1/5] Verificando configuración DWM y throttling de cameraWindow en main.cjs...');
const mainSrc = fs.readFileSync('electron/main.cjs', 'utf8');
assert(mainSrc.includes("cameraWindow.setAlwaysOnTop(true, 'pop-up-menu')"), 'cameraWindow debe usar pop-up-menu para coexistir con mainWindow sin suspensión DWM');
assert(!mainSrc.includes("cameraWindow.setAlwaysOnTop(true, 'screen-saver')"), 'cameraWindow no debe usar screen-saver (causaba congelamiento de Live2D)');
assert(mainSrc.includes('backgroundThrottling: false'), 'cameraWindow debe deshabilitar backgroundThrottling');
console.log('  ✅ cameraWindow configurada sin suspensión DWM y con aceleración continua.');

// 2. CameraApp Offscreen Canvas & 0.5 FPS Frame Pacing
console.log('\n🔍 [2/5] Verificando cadencia de 0.5 FPS y lienzo reutilizable en CameraApp.jsx...');
const cameraAppSrc = fs.readFileSync('src/camera/CameraApp.jsx', 'utf8');
assert(cameraAppSrc.includes('now - lastStreamTime >= 2000'), 'CameraApp debe transmitir a 0.5 FPS (1 fotograma cada 2000ms)');
assert(!cameraAppSrc.includes('frameCount % 30 === 0 && videoRef.current'), 'CameraApp no debe emitir a 2 FPS (60fps/30)');
assert(cameraAppSrc.includes('offscreenCanvas'), 'CameraApp debe reutilizar offscreenCanvas');
assert(cameraAppSrc.includes("offscreenCanvas.toDataURL('image/jpeg', 0.5)"), 'CameraApp debe usar compresión ligera 0.5');
console.log('  ✅ CameraApp optimizada a 0.5 FPS con lienzo reutilizable y compresión eficiente.');

// 3. Speech Shield & Throttle in App.jsx
console.log('\n🔍 [3/5] Verificando Speech Shield y protección contra saturación en App.jsx...');
const appSrc = fs.readFileSync('src/App.jsx', 'utf8');
assert(appSrc.includes('!isSpeakingRef.current &&'), 'App.jsx debe proteger el socket con Speech Shield (no enviar video mientras Cristi habla)');
assert(appSrc.includes('sendRealtimeVisionFrame') && appSrc.includes('lastVisionSendTimeRef'), 'App.jsx debe limitar la tasa de envío de fotogramas de cámara');
assert(!appSrc.includes('cameraRef.current.startPeriodicStreaming(0.5)'), 'App.jsx no debe tener streaming duplicado ni colisión de hardware');
console.log('  ✅ Speech Shield, limitador de tasa y eliminación de colisión de hardware en App.jsx verificados.');

// 4. GeminiLiveSocket Media Protocol & Safety
console.log('\n🔍 [4/5] Verificando esquema oficial video (realtimeInput.video) y protección de buffer en GeminiLiveSocket...');
const socketSrc = fs.readFileSync('src/services/geminiLiveSocket.js', 'utf8');
assert(socketSrc.includes('video:') && socketSrc.includes('realtimeInput'), 'GeminiLiveSocket debe enviar realtimeInput.video');
assert(socketSrc.includes('mimeType') && socketSrc.includes('data'), 'video frame debe incluir mimeType y data');
assert(socketSrc.includes('32768'), 'Traffic guard debe usar límite de 32KB');
console.log('  ✅ Protocolo de streaming de video y seguridad de socket verificados.');

// 5. ElectronBridge Camera API Exposure
console.log('\n🔍 [5/5] Verificando exposición de APIs de cámara en ElectronBridge.js...');
const bridgeSrc = fs.readFileSync('src/services/desktop/ElectronBridge.js', 'utf8');
assert(bridgeSrc.includes('openCameraWindow()'), 'ElectronBridge debe exponer openCameraWindow');
assert(bridgeSrc.includes('closeCameraWindow()'), 'ElectronBridge debe exponer closeCameraWindow');
assert(bridgeSrc.includes('isCameraWindowOpen()'), 'ElectronBridge debe exponer isCameraWindowOpen');
assert(bridgeSrc.includes('onCameraWindowState('), 'ElectronBridge debe exponer onCameraWindowState');
console.log('  ✅ Métodos de control de ventana de cámara en ElectronBridge verificados.');

console.log('\n🎉 PRUEBA DE PREVENCIÓN DE CONGELAMIENTO Y BUCLE DE LLAMADA COMPLETADA CON ÉXITO!\n');
process.exit(0);
