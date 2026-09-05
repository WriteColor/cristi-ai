/**
 * Cristi AI - Live Call Keepalive, Infinite Auto-Reconnect & Flirtatious Cadence Test Suite
 */

import assert from 'node:assert';
import fs from 'node:fs';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { AudioOutputService } from '../src/services/audioOutputService.js';

console.log('========================================================================');
console.log('🧪 TEST: KEEPALIVE HEARBEAT, AUTO-RECONNECT & COQUETTISH SLOW CADENCE');
console.log('========================================================================\n');

// 1. Verify Keepalive Heartbeat & Infinite Reconnect in GeminiLiveSocket
console.log('🔍 [1/4] Verificando Keepalive Heartbeat y auto-reconexión persistente en GeminiLiveSocket...');
const socket = new GeminiLiveSocket({
  apiKey: 'test-api-key',
  maxReconnectAttempts: Infinity
});

assert(typeof socket.startKeepAlive === 'function', 'GeminiLiveSocket debe implementar startKeepAlive()');
assert(typeof socket.stopKeepAlive === 'function', 'GeminiLiveSocket debe implementar stopKeepAlive()');
assert(typeof socket.sendSilentKeepAlive === 'function', 'GeminiLiveSocket debe implementar sendSilentKeepAlive()');
assert(socket.maxReconnectAttempts === Infinity, 'maxReconnectAttempts configurable a Infinity');
assert(typeof socket.lastAudioSendTime === 'number', 'lastAudioSendTime inicializado como timestamp');
console.log('  ✅ Métodos de KeepAlive e infraestructura de reconexión infinita verificados.');

// 2. Verify Cadence and Flirtatious Slower Tone in Persona Prompts
console.log('🔍 [2/4] Verificando directiva de cadencia pausada y coqueta en models.js y geminiLiveSocket.js...');
const modelsContent = fs.readFileSync('src/config/models.js', 'utf8');
assert(modelsContent.includes('Cadencia Seductora, Pausada y Coqueta'), 'SYSTEM_PERSONA_PROMPT debe instruir cadencia pausada y coqueta.');
assert(modelsContent.includes('un poquito más lento de lo normal'), 'Prompt debe especificar hablar un poquito más lento de lo normal.');

const socketContent = fs.readFileSync('src/services/geminiLiveSocket.js', 'utf8');
assert(socketContent.includes('DIRECTIVA DE CADENCIA COQUETA Y VELOCIDAD'), 'GeminiLiveSocket debe inyectar la directiva de velocidad y cadencia coqueta.');
console.log('  ✅ Directivas de ritmo pausado y tono coqueto presentes en el sistema.');

// 3. Verify Web Audio Output Playback Rate for Slower Cadence
console.log('🔍 [3/4] Verificando velocidad de reproducción relajada (0.96) en AudioOutputService...');
const audioOut = new AudioOutputService();
assert(audioOut.playbackRate === 0.96, 'AudioOutputService debe configurar playbackRate = 0.96 para cadencia coqueta.');
console.log('  ✅ Playback rate de 0.96 validado.');

// 4. Verify Watchdog and Session Persistence in App.jsx
console.log('🔍 [4/4] Verificando watchdog de reconexión y persistencia de llamada en App.jsx...');
const appContent = fs.readFileSync('src/App.jsx', 'utf8');
assert(appContent.includes('isCallActiveRef'), 'App.jsx debe rastrear si la llamada está activa con isCallActiveRef.');
assert(!appContent.includes('reconnectWatchdogRef'), 'La reconexión debe tener un solo propietario: GeminiLiveSocket.');
assert(appContent.includes('maxReconnectAttempts: Infinity'), 'App.jsx debe pasar maxReconnectAttempts: Infinity para que la llamada nunca se muera sola.');
console.log('  ✅ App.jsx garantiza que la llamada no se desconecte y se reabra automáticamente.');

console.log('\n🎉 TODAS LAS PRUEBAS DE KEEPALIVE, RECONEXIÓN Y CADENCIA COQUETA EXITOSAS!\n');
process.exit(0);
