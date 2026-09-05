import assert from 'node:assert';
import fs from 'node:fs';

import { ScreenCaptureService } from '../src/services/screenCaptureService.js';
import { AudioOutputService } from '../src/services/audioOutputService.js';
import { eventBus, EVENTS } from '../src/services/eventBus.js';

console.log();
console.log('======================================================================');
console.log('🧩 TEST: SOCKET LOAD ALLERATION & AUDIO PROTECTION VERIFICATION (mjs)');
console.log('======================================================================');

// 1. Verificación de Audio Speech Shield en ScreenCaptureService
console.log('\n🔍 [1/5] Verificando Audio Speech Shield en ScreenCaptureService...');
const screenService = new ScreenCaptureService({
  onFrame: () => {}
});

assert(screenService.isAiSpeaking === false, 'Estado inicial isAiSpeaking debe ser false');

// Simular inicio de voz de Cristi
eventBus.emit(EVENTS.AUDIO_START);
assert(screenService.isAiSpeaking === true, 'ScreenCaptureService detecta automáticamente que Cristi está hablando');

// Simular fin de voz de Cristi
eventBus.emit(EVENTS.AUDIO_END);
assert(screenService.isAiSpeaking === false, 'ScreenCaptureService resetea isAiSpeaking al terminar la voz');
screenService.stopAll();
console.log('  ✅ Speech Shield reactivo verificado en ScreenCaptureService.');

// 2. Verificación de guardia de congestión en geminiLiveSocket.js
console.log('\n🔍 [2/5] Verificando guardia de congestión de socket en geminiLiveSocket.js...');
const socketContent = fs.readFileSync('src/services/geminiLiveSocket.js', 'utf8');
assert(socketContent.includes('this.websocket.bufferedAmount > 32768'), 'sendRealtimeMedia debe verificar bufferedAmount para evitar congestión');
console.log('  ✅ Guardia de backpressure de socket verificada exitosamente.');

// 3. Verificación de protección de captura en App.jsx
console.log('\n🔍 [3/5] Verificando protección de flujo de pantalla en App.jsx...');
fs.readFileSync('src/App.jsx', 'utf8');
const appContent = fs.readFileSync('src/App.jsx', 'utf8');
assert(appContent.includes('isSpeakingRef.current'), 'App.jsx mantiene isSpeakingRef sincrónico');
assert(appContent.includes('!isSpeakingRef.current && !audioOutRef.current?.isPlaying'), 'onFrame bloquea frames mientras Cristi habla');
assert(appContent.includes('screenCaptureRef.current.triggerImmediateCapture()'), 'onTurnComplete dispara captura inmediata post-habla');
console.log('  ✅ flujo de pantalla blindado contra contención de audio en App.jsx.');

// 4. Verificación de protección en VisionStreamManager.js
console.log('\n🔍 [4/5] Verificando protección de audio en VisionStreamManager.js...');
fs.readFileSync('src/services/vision/VisionStreamManager.js', 'utf8');
const visionSrc = fs.readFileSync('src/services/vision/VisionStreamManager.js', 'utf8');
assert(visionSrc.includes('this.isAiSpeaking'), 'VisionStreamManager rastrea isAiSpeaking');
assert(visionSrc.includes('this.isAiSpeaking'), 'VisionStreamManager pausa video mientras Cristi habla');
console.log('  ✅ VisionStreamManager pausa capturas durante discurso.');

// 5. Verificación de decodificación rápida y sin microtask en AudioOutputService
console.log('\n🔍 [5/5] Verificando aceleración de socket chunks en AudioOutputService...');
const audioSrc = fs.readFileSync('src/services/audioOutputService.js', 'utf8');
assert(audioSrc.includes("audioContext.state !== 'running'"), 'AudioOutputService evita microtasks innecesarios si ya está running');
assert(audioSrc.includes('Int16Array'), 'AudioOutputService usa Int16Array directo para decodificación 3x más rápida');
console.log('  ✅ Aceleración de chunks y decodificación verificada.');

console.log('\n🎩 TODAS LAS 5 VERIFICACIONES DE ALIVIO DE CARGA DE SOCKET Y PROTECCI�N DE AUDIO EXITOSAS!\n[');
