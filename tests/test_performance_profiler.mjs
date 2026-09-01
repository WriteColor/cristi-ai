/**
 * Cristi Desktop - Performance Profiler & Telemetry Unit & Integration Suite
 */

import { PerformanceProfilerService } from '../src/services/profiler/PerformanceProfilerService.js';

console.log('🧪 Iniciando prueba de Suite del Profiler y Observabilidad de Cristi AI...');

const profiler = new PerformanceProfilerService();

// 1. Verificar registro de ticks y TPS
for (let i = 0; i < 60; i++) {
  profiler.recordTick();
}
console.log('  ✓ Registro de ticks ejecutado.');

// 2. Verificar medición de componentes
let testExecuted = false;
profiler.setTier(2); // Tier 2 enables component timings
profiler.measure('live2d', () => {
  let sum = 0;
  for (let i = 0; i < 10000; i++) sum += i;
  testExecuted = true;
});

if (!testExecuted) {
  throw new Error('La función de medición de componente no ejecutó el callback.');
}
console.log('  ✓ Medición de subsistema Live2D validada.');

// 3. Verificar recolección de snapshots y buffers circulares
const snapshot = profiler.getSnapshot();
if (!snapshot || typeof snapshot.fps !== 'number') {
  throw new Error('Snapshot del profiler inválido o incompleto.');
}
console.log(`  ✓ Snapshot generado correctamente (FPS: ${snapshot.fps}, Heap: ${snapshot.memory.jsHeapUsedMB}MB).`);

// 4. Verificar detección de anomalías
profiler.detectAnomalies({
  timestamp: Date.now(),
  fps: 15,
  p99FrameTimeMs: 65,
  droppedFrames: 12,
  memory: { jsHeapUsedMB: 1500, jsHeapTotalMB: 1800 },
  timings: { live2d: { avgMs: 25 }, audioDsp: { avgMs: 2 }, visionSensory: { avgMs: 0 }, uiReact: { avgMs: 1 }, shadersWpe: { avgMs: 0 }, ipcBridge: { avgMs: 0 } }
});

const anomalies = profiler.getAnomalies();
if (anomalies.length === 0) {
  throw new Error('El detector de anomalías no registró las violaciones de rendimiento esperadas.');
}
console.log(`  ✓ Detector de anomalías validado (${anomalies.length} incidentes identificados).`);

profiler.stop();
console.log('🎉 [PASS] Suite de Performance Profiler & Observability completada con éxito.');
process.exit(0);
