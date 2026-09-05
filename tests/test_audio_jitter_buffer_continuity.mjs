/**
 * Test: Audio Jitter Buffer Continuity & Zero Choppiness Verification
 */

import { AudioOutputService } from '../src/services/audioOutputService.js';

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${msg}`);
  } else {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(msg);
  }
}

console.log('================================================================');
console.log('🧪 TEST: AUDIO STREAMING JITTER BUFFER & CONTINUITY VERIFICATION');
console.log('================================================================\n');

// 1. Instantiation & Initial State
const audioOut = new AudioOutputService();
assert(audioOut.isPlaying === false, 'audioOut inicia inactivo');
assert(audioOut.isTurnComplete === false, 'isTurnComplete inicia en false');
assert(audioOut.pcmQueue.length === 0, 'Cola de chunks PCM inicia vacía');

// 2. Mock AudioContext
let mockTime = 1.0;
const scheduledSources = [];

audioOut.audioContext = {
  state: 'running',
  get currentTime() { return mockTime; },
  createBuffer: (channels, length, sampleRate) => ({
    duration: length / sampleRate,
    length,
    sampleRate,
    getChannelData: () => new Float32Array(length)
  }),
  createBufferSource: () => {
    const src = {
      buffer: null,
      connect: () => {},
      start: (time) => {
        src.startTime = time;
        scheduledSources.push(src);
      },
      stop: () => {},
      disconnect: () => {}
    };
    return src;
  }
};
audioOut.gainNode = {
  connect: () => {},
  disconnect: () => {},
  gain: {
    value: 1.0,
    cancelScheduledValues: () => {},
    setValueAtTime: () => {}
  }
};

// 3. Generate mock 24kHz PCM chunk (480 samples = 20ms)
const sampleCount = 480;
const pcmBytes = new Uint8Array(sampleCount * 2);
const view = new DataView(pcmBytes.buffer);
for (let i = 0; i < sampleCount; i++) {
  view.setInt16(i * 2, Math.sin(i * 0.1) * 16000, true);
}
const base64Chunk = Buffer.from(pcmBytes.buffer).toString('base64');

// Test pre-buffering: enqueue 3 chunks (total 60ms)
console.log('[1/4] Verificando colchón de pre-buffering adaptativo...');
await audioOut.playChunk(base64Chunk);
assert(audioOut._isPrebuffering === true, 'Primer chunk activa prebuffering para absorber jitter inicial');
assert(audioOut.pcmQueue.length === 1, 'Primer chunk encolado');

await audioOut.playChunk(base64Chunk);
assert(audioOut.pcmQueue.length === 2, 'Segundo chunk encolado');

// Force flush or wait target duration
audioOut._flushQueue();
assert(audioOut.isPlaying === true, 'Reproducción iniciada tras flush de buffer');
assert(scheduledSources.length === 1, 'Chunks concatenados en una única fuente inicial');
assert(scheduledSources[0].startTime >= mockTime, 'Fuente programada en tiempo presente');

// 4. Test Stream Continuity: Send subsequent chunks while playing
console.log('\n[2/4] Verificando continuidad de scheduling sin huecos...');
const prevEndTime = audioOut.nextScheduleTime;
await audioOut.playChunk(base64Chunk);
assert(scheduledSources.length === 2, 'Segundo bloque de audio programado');
assert(Math.abs(scheduledSources[1].startTime - prevEndTime) < 0.0001, 'Continuidad perfecta: nuevo chunk inicia exactamente al final del anterior');

// 5. Test Underrun Recovery without artificial 60ms gap
console.log('\n[3/4] Verificando recuperación rápida de starvation/jitter (sin hueco de 60ms)...');
// Advance time past nextScheduleTime to simulate network packet delay
mockTime = audioOut.nextScheduleTime + 0.050; // 50ms late
await audioOut.playChunk(base64Chunk);
const lastSource = scheduledSources[scheduledSources.length - 1];
const gap = lastSource.startTime - mockTime;
assert(gap >= 0.010 && gap <= 0.020, `Recuperación de starvation usa colchón mínimo de seguridad (~15ms, actual: ${(gap*1000).toFixed(1)}ms), evitando huecos artificiales de 60ms`);

// 6. Test Turn Complete signaling
console.log('\n[4/4] Verificando señalización de fin de turno...');
audioOut.signalTurnComplete();
assert(audioOut.isTurnComplete === true, 'Turn complete registrado');

console.log('\n================================================================');
console.log(`🎉 ${passed}/${total} PRUEBAS DE CONTINUIDAD DE AUDIO EXITOSAS (100%)`);
console.log('================================================================');
