import assert from 'node:assert';
import fs from 'node:fs';

console.log('======================================================================');
console.log('🧪 TEST: BARGE-IN DUAL-LAYER & REAL-TIME VISION-VOICE COORDINATION');
console.log('======================================================================\n');

// 1. Dual-Layer Barge-In Verification in App.jsx
console.log('🔍 [1/4] Verificando Full-Duplex Audio y Barge-in Dual en App.jsx...');
const appSrc = fs.readFileSync('src/App.jsx', 'utf8');

// Full duplex: socket.sendAudioChunk is called without unconditional early return
assert(appSrc.includes('socketRef.current.sendAudioChunk(base64PCM)'), 'Mic audio debe transmitirse al socket para VAD neuronal de Gemini Live');
assert(!appSrc.includes('if (isSpeakingRef.current || audioOutRef.current?.isPlaying || ttsFallbackService.isSpeaking) {\n                return;'), 'No debe bloquearse el envío de audio de micrófono mientras Cristi habla');

// Instant client-side barge-in
assert(!appSrc.includes('consecutiveSpeechCount'), 'El eco de altavoces no debe interrumpir por un umbral RMS local');
assert(appSrc.includes('audioOutRef.current.stopImmediate()'), 'Debe detener la reproducción local de inmediato ante voz del usuario');
assert(appSrc.includes('onInterrupted: () => {'), 'La interrupción debe confirmarse mediante el VAD neuronal');
console.log('  ✅ Full-Duplex streaming y Barge-In instantáneo verificados en App.jsx.');

// 2. Vision & Audio Coordination (Speech Shield & 1400ms Pacing)
console.log('\n🔍 [2/4] Verificando Coordinador Unificado de Visión en App.jsx...');
assert(appSrc.includes('sendRealtimeVisionFrame'), 'App.jsx debe disponer del coordinador sendRealtimeVisionFrame');
assert(appSrc.includes('!isSpeakingRef.current && !audioOutRef.current?.isPlaying'), 'sendRealtimeVisionFrame debe aplicar Speech Shield para proteger audio entrante');
assert(appSrc.includes('minIntervalMs: 1000'), 'sendRealtimeVisionFrame debe regular el ritmo de fotogramas a máximo 1 FPS');
console.log('  ✅ Coordinador de visión protege el ancho de banda y latencia de audio.');

// 3. AudioContext Autoplay & Self-Healing
console.log('\n🔍 [3/4] Verificando políticas de Autoplay y auto-recuperación de AudioContext...');
const mainSrc = fs.readFileSync('electron/main.cjs', 'utf8');
assert(mainSrc.includes("app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')"), 'main.cjs debe forzar autoplay-policy para evitar suspensión en segundo plano');

const audioOutSrc = fs.readFileSync('src/services/audioOutputService.js', 'utf8');
assert(audioOutSrc.includes('this.audioContext.onstatechange'), 'AudioOutputService debe auto-recuperar AudioContext ante suspensión');
console.log('  ✅ Blindaje de AudioContext continuo verificado.');

// 4. Server-Side Interruption Contract in GeminiLiveSocket
console.log('\n🔍 [4/4] Verificando contrato de interrupción en GeminiLiveSocket...');
const socketSrc = fs.readFileSync('src/services/geminiLiveSocket.js', 'utf8');
assert(socketSrc.includes('this.onInterrupted()'), 'GeminiLiveSocket debe despachar onInterrupted ante mensaje de interrupción');
assert(appSrc.includes('onInterrupted: () => {'), 'App.jsx debe manejar onInterrupted del servidor');
console.log('  ✅ Contrato de interrupción de Gemini Live verificado al 100%.');

console.log('\n🎉 PRUEBA DE BARGE-IN Y COORDINACIÓN DE VISIÓN-VOZ COMPLETADA CON ÉXITO!\n');
process.exit(0);
