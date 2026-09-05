/**
 * Cristi AI - Screen Capture Performance, Lag Elimination & Emoji Ban Test Suite
 */

import assert from 'node:assert';
import fs from 'node:fs';

console.log('========================================================================');
console.log('🧪 TEST: SCREEN CAPTURE OPTIMIZATIONS & TOTAL EMOJI BAN VERIFICATION');
console.log('========================================================================\n');

// 1. Verify Strict Emoji Prohibition in Models & Persona Prompt
console.log('🔍 [1/5] Verificando prohibición estricta de emojis en el prompt del sistema...');
const modelsContent = fs.readFileSync('src/config/models.js', 'utf8');
assert(modelsContent.includes('PROHIBICIÓN TOTAL Y ABSOLUTA DE EMOJIS'), 'SYSTEM_PERSONA_PROMPT debe incluir prohibición estricta de emojis.');
assert(modelsContent.includes('CERO EMOJIS'), 'Prompt debe especificar cero emojis.');
console.log('  ✅ Prohibición total de emojis presente en SYSTEM_PERSONA_PROMPT.');

// 2. Verify Strict Emoji Ban Directive in GeminiLiveSocket
console.log('🔍 [2/5] Verificando inyección de directiva de prohibición de emojis en GeminiLiveSocket...');
const socketContent = fs.readFileSync('src/services/geminiLiveSocket.js', 'utf8');
assert(socketContent.includes('DIRECTIVA ESTRICTA DE EMOJIS: Queda TOTALMENTE PROHIBIDO usar, escribir o pronunciar emojis'), 'GeminiLiveSocket debe inyectar la directiva de prohibición estricta de emojis.');
console.log('  ✅ Inyección de prohibición estricta de emojis en WebSocket verificada.');

// 3. Verify App.jsx Subtitle Sanitization & Audio Callback Stability
console.log('🔍 [3/5] Verificando estabilidad de callbacks en App.jsx (sin errores de referencia)...');
const appContent = fs.readFileSync('src/App.jsx', 'utf8');
assert(!appContent.includes('setMicVolume(vol)'), 'App.jsx no debe llamar a setMicVolume inexistente.');
assert(appContent.includes('cleanText = text ? text.replace'), 'App.jsx debe limpiar emojis antes de actualizar subtítulos.');
console.log('  ✅ App.jsx no contiene excepciones de llamada y filtra subtítulos.');

// 4. Verify Native Screen Capture Mutex, Caching & Resolution in main.cjs
console.log('🔍 [4/5] Verificando mutex de captura de pantalla, tamaño compacto y compresión en electron/main.cjs...');
const mainContent = fs.readFileSync('electron/main.cjs', 'utf8');
assert(mainContent.includes('isScreenCaptureInProgress'), 'main.cjs debe tener mutex isScreenCaptureInProgress.');
assert(mainContent.includes('lastScreenCaptureCache'), 'main.cjs debe implementar caché de frames para evitar contención de GPU.');
assert(mainContent.includes('Math.min(768,'), 'main.cjs debe limitar ancho de captura a 768px para visión eficiente.');
assert(mainContent.includes('.toJPEG(55)'), 'main.cjs debe comprimir JPEG a calidad 55 para rendimiento ultraligero.');
console.log('  ✅ Mutex de GPU, caché anti-tirones y compresión ultra-rápida activos en el proceso principal.');

// 5. Verify FPS Capping & Self-Pacing in ScreenCaptureService & VisionStreamManager
console.log('🔍 [5/5] Verificando límite estricto de FPS (0.5 FPS) y auto-regulación en streaming de visión...');
const screenServiceContent = fs.readFileSync('src/services/screenCaptureService.js', 'utf8');
assert(screenServiceContent.includes('Math.min(0.5, fps)'), 'ScreenCaptureService debe limitar FPS continuo a 0.5 FPS.');
assert(screenServiceContent.includes('inFlight'), 'ScreenCaptureService debe proteger el ciclo nativo con inFlight lock.');

const visionManagerContent = fs.readFileSync('src/services/vision/VisionStreamManager.js', 'utf8');
assert(visionManagerContent.includes('Math.min(0.5, fps)'), 'VisionStreamManager debe limitar FPS continuo a 0.5 FPS.');
assert(visionManagerContent.includes('inFlight'), 'VisionStreamManager debe prevenir intervalos superpuestos.');
console.log('  ✅ Límite estricto de 0.5 FPS y auto-regulación de fotogramas comprobados.');

console.log('\n🎉 TODAS LAS VERIFICACIONES DE RENDIMIENTO Y ELIMINACIÓN DE EMOJIS EXITOSAS!');
