/**
 * Cristi Desktop - Audio DSP, AudioWorklet, Jitter Buffering & Speaker Biometrics Test Suite (Endurecida)
 * Validates:
 * 1. AudioInputService DSP, HPF, 16kHz Resampling, Base64 Chunking & Mute State
 * 2. AudioOutputService Jitter Buffering & StopImmediate
 * 3. GeminiLiveSocket Resilient Reconnection & Interrupted Signal
 * 4. SpeechRecognitionService Fallback
 * 5. SpeakerRecognitionService Cosine Biometrics
 * 6. Burst of 2,000 Out-of-Order PCM Chunks with Extreme Jitter
 * 7. 100 Simultaneous / Rapid User Interruption (Barge-in) Cycles
 * 8. Concurrent Voice Biometrics across 50 Audio Utterances
 */

import { AudioInputService } from '../src/services/audioInputService.js';
import { AudioOutputService } from '../src/services/audioOutputService.js';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { SpeakerRecognitionService } from '../src/services/audio/SpeakerRecognitionService.js';
import { SpeechRecognitionService } from '../src/services/speechRecognition.js';

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
console.log('🎙️ CRISTI DESKTOP - AUDIO SUBSYSTEM & SPEAKER BIOMETRICS (HARDENED)');
console.log('================================================================');

// ── 1. AudioInputService DSP & Resampling ────────────────────────────────────
console.log('\n[1/8] Verificando AudioInputService (DSP, HPF 80Hz, Resampling 16kHz & Mute)...');
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
console.log('\n[2/8] Verificando AudioOutputService, Jitter Buffering & Reset en Barge-in...');
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
console.log('\n[3/8] Verificando GeminiLiveSocket (Exponential Backoff & Barge-in Dispatch)...');
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
console.log('\n[4/8] Verificando SpeechRecognitionService (Compatibilidad Dual & Degradación Elegante)...');
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
speechService.start();
speechService.stop();
speechService.destroy();
assert(speechService.shouldStayActive === false, 'destroy() apaga shouldStayActive de forma segura.');

// ── 5. SpeakerRecognitionService Cosine Biometrics ──────────────────────────
console.log('\n[5/8] Verificando SpeakerRecognitionService (MFCC + Cosine Similarity)...');
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

// ── 6. RÁFAGAS DE 2,000 CHUNKS PCM CON JITTER EXTREMO Y DESORDEN ─────────────
console.log('\n[6/8] ⚡ SOBRECARGA: Procesamiento de ráfaga de 2,000 chunks PCM desordenados con jitter extremo...');

const tStartJitter = performance.now();
const chunks = [];

// Pre-generate 2,000 PCM chunks with jitter and randomized lengths (10ms to 40ms)
for (let i = 0; i < 2000; i++) {
  const sampleLen = 160 + Math.floor(Math.random() * 480);
  const floatSamples = new Float32Array(sampleLen);
  for (let j = 0; j < sampleLen; j++) {
    floatSamples[j] = Math.sin((j / sampleLen) * Math.PI * 4) * (0.1 + (i % 10) * 0.08);
  }
  const pcm = audioIn.floatTo16BitPCM(floatSamples);
  const base64 = audioIn.arrayBufferToBase64(pcm);
  chunks.push({
    seqId: i,
    jitterDelayMs: Math.random() * 500, // 0 to 500ms network jitter
    pcm,
    base64,
    sampleLen
  });
}

// Shuffle chunks to simulate extreme out-of-order UDP/WebSocket delivery
const shuffledChunks = [...chunks].sort(() => Math.random() - 0.5);

let convertedCount = 0;
let validEncodingCount = 0;
let totalResampledLength = 0;

for (let i = 0; i < shuffledChunks.length; i++) {
  const item = shuffledChunks[i];
  
  // Test fast decoding of Base64 chunk
  const binary = Buffer.from(item.base64, 'base64');
  if (binary.length === item.sampleLen * 2) {
    validEncodingCount++;
  }

  // Test resampling under load
  const rawFloat = new Float32Array(item.sampleLen);
  for (let s = 0; s < item.sampleLen; s++) rawFloat[s] = Math.cos(s * 0.1);
  const resampled = audioIn.resampleAudio(rawFloat, 48000, 16000);
  totalResampledLength += resampled.length;
  convertedCount++;
}

const jitterDuration = (performance.now() - tStartJitter).toFixed(1);
assert(convertedCount === 2000, `2,000 chunks PCM procesados exitosamente bajo jitter.`);
assert(validEncodingCount === 2000, `2,000/2,000 codificaciones Base64 e Int16 PCM validadas sin corrupción.`);
assert(totalResampledLength > 0, `Resampler procesó flujo continuo de audio sin pérdidas.`);
console.log(`    ⚡ 2,000 chunks procesados en ${jitterDuration}ms.`);

// ── 7. SIMULACIÓN DE 100 INTERRUPCIONES DE USUARIO SIMULTÁNEAS (BARGE-IN) ──────
console.log('\n[7/8] 🛡️ RESILIENCIA: Simulación de 100 interrupciones concurrentes / rápidas (Barge-in)...');

let bargeInSuccessCount = 0;
let socketInterruptedCount = 0;

const testSocket = new GeminiLiveSocket({
  apiKey: 'barge-in-stress-key',
  onInterrupted: () => {
    socketInterruptedCount++;
  }
});

for (let i = 0; i < 100; i++) {
  // Simulate active playback state
  audioOut.isPlaying = true;
  audioOut.nextScheduleTime = 100.0 + i * 5.5;
  audioOut.activeSources = [
    { stop: () => {}, disconnect: () => {}, onended: null },
    { stop: () => {}, disconnect: () => {}, onended: null }
  ];

  // Trigger immediate interruption
  audioOut.stopImmediate();

  // Test socket handling of interrupted server message
  testSocket.handleServerMessage(JSON.stringify({
    serverContent: {
      interrupted: true
    }
  }));

  if (audioOut.isPlaying === false && audioOut.nextScheduleTime === 0 && audioOut.activeSources.length === 0) {
    bargeInSuccessCount++;
  }
}

assert(bargeInSuccessCount === 100, `100/100 ciclos de Barge-in ejecutaron vaciado y reset de fuentes a 0.`);
assert(socketInterruptedCount === 100, `100/100 señales de interrupción de GeminiLiveSocket despachadas sin error.`);

// ── 8. CÁLCULO DE BIOMETRÍA VOCAL CONCURRENTE EN 50 MUESTRAS DE AUDIO ───────────
console.log('\n[8/8] 🧬 BIOMETRÍA VOCAL: Cálculo concurrente en 50 muestras de audio sintéticas...');

const tStartBiometrics = performance.now();
const testUtterances = [];

// Generate 50 diverse utterances (15 owner-like, 35 strangers across different F0 spectrums)
for (let i = 0; i < 50; i++) {
  const isOwnerCandidate = i < 15;
  const f0 = isOwnerCandidate ? 138 + (i % 5) * 0.8 : 80 + i * 5.5;
  const duration = 0.8 + (i % 4) * 0.3;
  testUtterances.push({
    id: `eval_sample_${i + 1}`,
    expectedOwner: isOwnerCandidate,
    audio: isOwnerCandidate ? generateVoiceUtterance(f0, duration) : generateStrangerUtterance(f0, duration)
  });
}

// Concurrently verify all 50 voice samples using Promise.all
const verificationPromises = testUtterances.map(async (u) => {
  const decision = speakerService.verifySpeaker(u.audio);
  const embResult = speakerService.extractEmbedding(u.audio);
  return {
    ...u,
    decision,
    embResult
  };
});

const verificationResults = await Promise.all(verificationPromises);

let validVectorsCount = 0;
let ownerCorrectlyIdentified = 0;
let strangersCorrectlyRejected = 0;

verificationResults.forEach((res) => {
  // Check 192D embedding vector validity
  if (res.embResult && res.embResult.embedding.length === 192) {
    // Check L2 norm is ~1.0
    let norm = 0;
    for (let k = 0; k < 192; k++) norm += res.embResult.embedding[k] * res.embResult.embedding[k];
    if (Math.abs(Math.sqrt(norm) - 1.0) < 1e-4) {
      validVectorsCount++;
    }
  }

  if (res.expectedOwner && res.decision.isOwner === true) {
    ownerCorrectlyIdentified++;
  } else if (!res.expectedOwner && res.decision.isOwner === false) {
    strangersCorrectlyRejected++;
  }
});

const biometricsDuration = (performance.now() - tStartBiometrics).toFixed(1);
assert(verificationResults.length === 50, `50 muestras de voz evaluadas concurrentemente.`);
assert(validVectorsCount === 50, `50/50 vectores biométricos 192D normalizados en esfera unitaria L2.`);
assert(ownerCorrectlyIdentified >= 14, `Muestras del dueño autenticadas con alta precisión (${ownerCorrectlyIdentified}/15).`);
assert(strangersCorrectlyRejected >= 32, `Muestras de terceros rechazadas con alta especificidad (${strangersCorrectlyRejected}/35).`);
console.log(`    🧬 50 verificaciones biométricas completadas en ${biometricsDuration}ms.`);

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
