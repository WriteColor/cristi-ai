/**
 * Test Suite: Voice Hot-Swap & Microsoft Robotic Voice Fallback Elimination
 */

import assert from 'assert';
import fs from 'fs';
import { TTSFallbackService, ttsFallbackService } from '../src/services/ttsFallbackService.js';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { GEMINI_STANDARD_VOICES, sanitizeVoiceForModel } from '../src/config/voices.js';

console.log('======================================================================');
console.log('🧪 TEST: VOICE HOT-SWAP & ROBOTIC MICROSOFT FALLBACK ELIMINATION');
console.log('======================================================================');

// 1. Verify TTSFallbackService is disabled by default (no robotic fallback)
console.log('\n🔍 [1/4] Verificando que TTSFallbackService esté desactivado por defecto...');
const ttsInstance = new TTSFallbackService();
assert.strictEqual(ttsInstance.enabled, false, 'TTSFallbackService debe tener enabled=false por defecto');

// Test that calling speak() does nothing when disabled
let synthCalled = false;
globalThis.window = {
  speechSynthesis: {
    speak: () => { synthCalled = true; },
    cancel: () => {},
    speaking: false,
    getVoices: () => [
      { name: 'Microsoft Sabina - Spanish (Mexico)', lang: 'es-MX' },
      { name: 'Microsoft Helena - Spanish (Spain)', lang: 'es-ES' }
    ]
  }
};

ttsInstance.speak('Hola Ariel mi amor');
assert.strictEqual(synthCalled, false, 'speak() no debe invocar window.speechSynthesis cuando enabled=false');
console.log('  ✅ Fallback a modelos de Microsoft desactivado correctamente.');

// 2. Verify Mexican Accent exclusion in getPreferredVoice
console.log('\n🔍 [2/4] Verificando filtro anti-acento mexicano en getPreferredVoice...');
const chosenVoice = ttsInstance.getPreferredVoice();
assert(chosenVoice, 'Debe encontrar una voz');
assert(!chosenVoice.name.toLowerCase().includes('sabina'), 'Nunca debe elegir Sabina (acento mexicano)');
assert(!chosenVoice.lang.toLowerCase().includes('mx'), 'Nunca debe elegir idioma es-MX');
assert(chosenVoice.name.toLowerCase().includes('helena'), 'Debe preferir voz neutra como Helena si existiese');
console.log(`  ✓ Voz seleccionada (en caso de habilitación manual): ${chosenVoice.name}`);
console.log('  ✅ Filtro de acento neutro verificado.');

// 3. Verify GeminiLiveSocket hot-swap methods
console.log('\n🔍 [3/4] Verificando métodos switchVoice y switchModel en GeminiLiveSocket...');
const socket = new GeminiLiveSocket({
  apiKey: 'test-key',
  voiceName: 'Aoede',
  modelId: 'gemini-3.1-flash-live-preview'
});

assert.strictEqual(typeof socket.switchVoice, 'function', 'switchVoice debe ser una función');
assert.strictEqual(typeof socket.switchModel, 'function', 'switchModel debe ser una función');

socket.switchVoice('Kore');
assert.strictEqual(socket.voiceName, 'Kore', 'switchVoice debe actualizar voiceName a Kore');

socket.switchVoice('Leda');
assert.strictEqual(socket.voiceName, 'Leda', 'switchVoice debe actualizar voiceName a Leda');

socket.switchModel('gemini-2.5-flash');
assert.strictEqual(socket.modelId, 'gemini-2.5-flash', 'switchModel debe actualizar modelId');
console.log('  ✅ Métodos de hot-swap de voz y modelo verificados.');

// 4. Verify verified 4 female voices catalog
console.log('\n🔍 [4/4] Verificando catálogo oficial de 4 voces femeninas...');
assert.strictEqual(GEMINI_STANDARD_VOICES.length, 4, 'Debe haber exactamente 4 voces');
const voiceNames = GEMINI_STANDARD_VOICES.map(v => v.name);
assert(voiceNames.includes('Aoede'));
assert(voiceNames.includes('Kore'));
assert(voiceNames.includes('Zephyr'));
assert(voiceNames.includes('Leda'));

// Check sanitize
assert.strictEqual(sanitizeVoiceForModel('any', 'Aoede'), 'Aoede');
assert.strictEqual(sanitizeVoiceForModel('any', 'Kore'), 'Kore');
assert.strictEqual(sanitizeVoiceForModel('any', 'Charon'), 'Aoede'); // Removed voice falls back to Aoede
console.log('  ✅ Catálogo verificado: Aoede, Kore, Zephyr, Leda.');

console.log('\n🎉 PRUEBA DE HOT-SWAP Y ELIMINACIÓN DE FALLBACK MICROSOFT EXITOSA!\n');
process.exit(0);
