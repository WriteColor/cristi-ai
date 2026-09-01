/**
 * Cristi Desktop - Audio DSP, AudioWorklet, Jitter Buffering & Speaker Recognition Test Suite
 */

import { AudioInputService } from '../src/services/audioInputService.js';
import { AudioOutputService } from '../src/services/audioOutputService.js';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { SpeakerRecognitionService } from '../src/services/audio/SpeakerRecognitionService.js';

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
console.log('🎙️ CRISTI DESKTOP - AUDIO SUBSYSTEM & SPEAKER BIOMETRICS VALIDATION');
console.log('================================================================');

// ── 1. AudioInputService DSP & Resampling ────────────────────────────────────
console.log('\n[1/5] Verificando AudioInputService (DSP, HPF 80Hz, Resampling 16kHz & Mute)...');
const audioIn = new AudioInputService({});
assert(audioIn.targetSampleRate === 16000, 'Frecuencia de muestreo objetivo establecida en 16,000 Hz.');
assert(audioIn.rollingBufferSize === 64000, 'Buffer rotativo de telemetría de 4 segundos inicializado.');

// Test 48kHz -> 16kHz resampling
const sample48k = new Float32Array(480); // 10ms at 48kHz
for (let i = 0; i < 480; i++) sample48k[i] = Math.sin((i / 480) * Math.PI * 2);
const resampled16k = audioIn.resampleAudio(sample48k, 48000, 16000);
assert(resampled16k.length === 160, `Re-muestreo a 16kHz exacto (Esperado: 160, Obtenido: ${resampled16k.length}).`);

// Test Float32 to 16-bit Int PCM Little Endian conversion
const pcmBuffer = audioIn.floatTo16BitPCM(resampled16k);
assert(pcmBuffer.byteLength === 320, 'Conversión a Int16 PCM Little Endian correcta (320 bytes).');

// Test Base64 chunked encoding
const b64 = audioIn.arrayBufferToBase64(pcmBuffer);
assert(typeof b64 === 'string' && b64.length > 0, 'Codificación Base64 por chunks de alto rendimiento validada.');

// Test Mute / Unmute
assert(audioIn.isMuted === false, 'Micrófono inicia en estado des-silenciado.');
audioIn.mute();
assert(audioIn.isMuted === true, 'audioIn.mute() cambia isMuted a true.');
assert(audioIn.getTelemetry().isMuted === true, 'Telemetría refleja isMuted correctamente.');
audioIn.unmute();
assert(audioIn.isMuted === false, 'audioIn.unmute() restablece isMuted a false.');
audioIn.toggleMute();
assert(audioIn.isMuted === true, 'audioIn.toggleMute() conmuta correctamente.');
audioIn.unmute();

// ── 2. AudioOutputService Jitter Buffering & Barge-in ─────────────────────────
console.log('\n[2/5] Verificando AudioOutputService, Jitter Buffering & Reset en Barge-in...');
const audioOut = new AudioOutputService({});
assert(audioOut.sampleRate === 24000, 'Frecuencia de salida configurada a 24,000 Hz (Gemini Live standard).');
assert(audioOut.jitterLeadTime === 0.035, 'Buffer de jitter configurado con lead-time de 35ms.');

// Verify stopImmediate resets nextScheduleTime to 0
audioOut.nextScheduleTime = 123.456;
audioOut.isPlaying = true;
audioOut.stopImmediate();
assert(audioOut.nextScheduleTime === 0, 'Barge-in / stopImmediate resetea nextScheduleTime = 0.');
assert(audioOut.isPlaying === false, 'stopImmediate detiene el estado isPlaying.');
assert(audioOut.activeSources.length === 0, 'stopImmediate vacía todas las fuentes activas.');

// ── 3. GeminiLiveSocket Resilient Reconnection & Barge-in ─────────────────────
console.log('\n[3/5] Verificando GeminiLiveSocket (Exponential Backoff & Barge-in Dispatch)...');
let errorReported = null;
const socketWithoutKey = new GeminiLiveSocket({
  apiKey: '',
  onError: (err) => { errorReported = err; }
});
socketWithoutKey.connect();
assert(errorReported !== null, 'Detección amigable de API Key no configurada sin excepciones fatales.');
assert(socketWithoutKey.maxReconnectAttempts === 5, 'Máximo de 5 intentos de reconexión configurado.');

let interruptedFired = false;
const liveSocket = new GeminiLiveSocket({
  apiKey: 'test-key',
  onInterrupted: () => { interruptedFired = true; }
});
liveSocket.handleServerMessage(JSON.stringify({
  serverContent: {
    interrupted: true
  }
}));
assert(interruptedFired === true, 'Mensaje de interrupción del servidor activa onInterrupted inmediatamente.');

// ── 4. SpeechRecognitionService Graceful Handling ────────────────────────────
console.log('\n[4/5] Verificando SpeechRecognitionService (Compatibilidad Dual & Degradación Elegante)...');
import { SpeechRecognitionService } from '../src/services/speechRecognition.js';

let speechResultText = null;
const speechService = new SpeechRecognitionService({
  onResult: (text, isFinal) => {
    speechResultText = text;
  }
});
assert(typeof speechService.start === 'function', 'SpeechRecognitionService expone método start.');
assert(typeof speechService.stop === 'function', 'SpeechRecognitionService expone método stop.');
assert(typeof speechService.destroy === 'function', 'SpeechRecognitionService expone método destroy.');
assert(speechService.isSupported() === false || speechService.isSupported() === true, 'isSupported() evaluado sin excepciones.');
speechService.start(); // Should gracefully handle absence of Web Speech API in Node.js
speechService.stop();
speechService.destroy();
assert(speechService.shouldStayActive === false, 'destroy() apaga shouldStayActive de forma segura.');

// ── 5. SpeakerRecognitionService Cosine Biometrics ──────────────────────────
console.log('\n[5/5] Verificando SpeakerRecognitionService (MFCC + Cosine Similarity)...');
const speakerService = new SpeakerRecognitionService();

// Synthetic Voice Generator (Harmonic Formants)
function generateVoiceUtterance(f0, durationSec = 1.5) {
  const numSamples = Math.floor(16000 * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / 16000;
    const s =
      0.5 * Math.sin(2 * Math.PI * f0 * t) +
      0.3 * Math.sin(2 * Math.PI * 500 * t) +
      0.2 * Math.sin(2 * Math.PI * 1500 * t) +
      0.1 * Math.sin(2 * Math.PI * 2500 * t);
    const envelope = Math.sin(Math.PI * (i / numSamples));
    samples[i] = s * envelope;
  }
  return samples;
}

// Enroll 3 Owner Samples (F0 ~ 138-142 Hz)
const ownerSampleList = [
  { id: 's1', label: 'Muestra 1', audioSamples: generateVoiceUtterance(138) },
  { id: 's2', label: 'Muestra 2', audioSamples: generateVoiceUtterance(142) },
  { id: 's3', label: 'Muestra 3', audioSamples: generateVoiceUtterance(140) }
];

const enrolledProfile = speakerService.enrollSamples('Jeremy', ownerSampleList);
assert(speakerService.hasEnrolledProfile(), 'Perfil del dueño enrolado con centroide 192D exitoso.');
assert(enrolledProfile.samples.length === 3, '3 muestras de voz agregadas al perfil biométrico.');

// Test Owner Verification
const ownerTestAudio = generateVoiceUtterance(139);
const ownerDecision = speakerService.verifySpeaker(ownerTestAudio);
assert(ownerDecision.isOwner === true, `Dueño autenticado correctamente (Score: ${ownerDecision.score}, Confianza: ${ownerDecision.confidence}%).`);
assert(ownerDecision.score >= speakerService.matchThreshold, `Score del dueño (${ownerDecision.score}) supera umbral de match (${speakerService.matchThreshold}).`);

// Test Stranger Rejection (F0 = 260 Hz with different harmonic distribution)
function generateStrangerUtterance(f0 = 260, durationSec = 1.5) {
  const numSamples = Math.floor(16000 * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / 16000;
    const s =
      0.5 * Math.sin(2 * Math.PI * f0 * t) +
      0.4 * Math.sin(2 * Math.PI * 850 * t) +
      0.3 * Math.sin(2 * Math.PI * 3100 * t);
    const envelope = Math.sin(Math.PI * (i / numSamples));
    samples[i] = s * envelope;
  }
  return samples;
}

const strangerTestAudio = generateStrangerUtterance(260);
const strangerDecision = speakerService.verifySpeaker(strangerTestAudio);
assert(strangerDecision.isOwner === false, `Voz de tercero rechazada exitosamente (Score: ${strangerDecision.score}, Label: ${strangerDecision.label}).`);
assert(strangerDecision.score < speakerService.rejectThreshold, `Score de tercero (${strangerDecision.score}) cae por debajo del umbral de rechazo (${speakerService.rejectThreshold}).`);

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
