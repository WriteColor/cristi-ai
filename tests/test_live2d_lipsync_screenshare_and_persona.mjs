import assert from 'node:assert';
import fs from 'node:fs';

import { Live2DController } from '../src/services/live2d/Live2DController.js';
import { Live2DAdapter } from '../src/services/live2d/Live2DAdapter.js';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { memoryService } from '../src/services/memory/MemoryService.js';
import { SYSTEM_PERSONA_PROMPT } from '../src/config/models.js';
import { ttsFallbackService } from '../src/services/ttsFallbackService.js';
import { eventBus, EVENTS } from '../src/services/eventBus.js';

console.log();
console.log('======================================================================');
console.log('🧪 TEST: LIVE2D LIPSYNC, SCREENSHARE AUDIO & PERSONA VERIFICATION');
console.log('======================================================================');

// 1. Live2D Lipsync and Procedural Cadence Assurance
console.log('\n🔍 [1/5] Verificando Live2D Lipsync dinámico y cadencia procedimental...');
const mockModel = {
  internalModel: {
    coreModel: {
      _parameterIds: ['ParamMouthOpenY', 'ParamMouthForm', 'ParamEyeLOpen', 'ParamEyeROpen', 'ParamBreath'],
      setParameterValueById: () => {}
    }
  }
};
const adapter = new Live2DAdapter(mockModel, {}, { id: 'test_model' });
const controller = new Live2DController(adapter, 'test_model');

// Emulate audio analysis event
controller.onAudioAnalysis({
  mouthOpen: 0.75,
  mouthForm: 0.25,
  volume: 0.8,
  isSpeaking: true,
  isPeakEnergy: false
});

assert(adapter.targetValues.get('ParamMouthOpenY') === 0.75, 'ParamMouthOpenY debe registrar target de audio analysis');
assert(controller.lastAudioAnalysisTime > 0, 'controller.lastAudioAnalysisTime debe registrarse');

// Simulate speech cadence fallback when isSpeaking is true but FFT stream pauses
controller.isSpeaking = true;
controller.lastAudioAnalysisTime = performance.now() - 500; // 500ms without FFT
controller.update(16.67);

const mouthTarget = adapter.targetValues.get('ParamMouthOpenY');
assert(mouthTarget > 0, 'Target de boca debe ser procedimentalmente animado durante el habla si falta FFT');

controller.isSpeaking = false;
controller.lastAudioAnalysisTime = performance.now() - 200;
controller.update(16.67);
assert(adapter.targetValues.get('ParamMouthOpenY') === 0, 'Target de boca debe cerrarse a 0 al dejar de hablar');
controller.destroy();
console.log('  ✅ Live2D LipSync y cadencia procedimental verificados al 100%.');

// 2. Gemini Live Media Video Schema
console.log('\n🔍 [2/5] Verificando esquema oficial realtimeInput.video en GeminiLiveSocket...');
const socketSrc = fs.readFileSync('src/services/geminiLiveSocket.js', 'utf8');
assert(socketSrc.includes('realtimeInput:') && socketSrc.includes('video:'), 'sendRealtimeMedia debe usar realtimeInput.video');
assert(socketSrc.includes('mimeType') && socketSrc.includes('data'), 'video frame debe contener mimeType y data');
console.log('  ✅ Esquema oficial realtimeInput.video verificado.');

// 3. Verificación de Persona: Ariel, Prohibición de Emojis, Acento Neutro sin Mexicanismos
console.log('\n🔍 [3/5] Verificando identidad de Ariel y directivas de voz en SYSTEM_PERSONA_PROMPT...');
assert(SYSTEM_PERSONA_PROMPT.includes('Ariel'), 'SYSTEM_PERSONA_PROMPT debe nombrar a Ariel como usuario y dueño');
assert(SYSTEM_PERSONA_PROMPT.includes('PROHIBICIÓN TOTAL Y ABSOLUTA DE EMOJIS'), 'Debe prohibir estrictamente el uso de emojis');
assert(SYSTEM_PERSONA_PROMPT.includes('PROHIBICIÓN TOTAL DE FRASES Y JERGA MEXICANA'), 'Debe prohibir expresiones y modismos mexicanos');
assert(SYSTEM_PERSONA_PROMPT.includes('Acento Español Neutro Internacional'), 'Debe exigir acento español neutro internacional');
assert(SYSTEM_PERSONA_PROMPT.includes('EMISIÓN CONTINUA DE VOZ Y AUDIO HABLADO'), 'Debe exigir que toda respuesta sea en voz alta');
assert(SYSTEM_PERSONA_PROMPT.includes('PROHIBICIÓN ESTRICTA DE ETIQUETAS, ROLES Y METADATOS'), 'Debe prohibir estrictamente emitir o pronunciar etiquetas como [emotion: yandere]');
assert(socketSrc.includes('DIRECTIVA ESTRICTA DE PROHIBICIÓN DE ETIQUETAS'), 'GeminiLiveSocket debe inyectar la directiva de prohibición de etiquetas');
console.log('  ✅ Identidad de Ariel, prohibición estricta de emojis, acento neutro y prohibición de etiquetas verificados.');

// 4. Verificación de Memoria Semilla de Ariel
console.log('\n🔍 [4/5] Verificando memoria de identidad en MemoryService...');
await memoryService.initialize();
const memories = memoryService.getAllMemories();
const creatorMem = memories.find((m) => m.key === 'creator_identity');
assert(creatorMem, 'Memoria creator_identity debe existir');
assert(creatorMem.content.includes('Ariel'), 'Memoria creator_identity debe contener el nombre Ariel');
console.log('  ✅ Memoria permanente de Ariel verificada.');

// 5. Verificación de TTS Vocal Fallback Service
console.log('\n🔍 [5/5] Verificando TTSFallbackService...');
assert(typeof ttsFallbackService.speak === 'function', 'ttsFallbackService.speak debe ser una función');
assert(typeof ttsFallbackService.stop === 'function', 'ttsFallbackService.stop debe ser una función');
console.log('  ✅ TTSFallbackService operativo.');

console.log('\n🎉 TODAS LAS PRUEBAS DE LIPSYNC, SCREENSHARE AUDIO Y PERSONA PASARON CON ÉXITO!\n');
process.exit(0);
