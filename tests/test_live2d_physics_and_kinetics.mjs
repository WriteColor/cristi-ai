/**
 * Cristi Desktop - Live2D Physics & Kinetics 2.0 Test Suite
 * Validates PhysicsEngine, Stochastic Breathing, Multi-Band LipSync, Bezier Transitions,
 * and Model Registry across all 8 Cubism avatars.
 */

import { Live2DPhysicsEngine } from '../src/services/live2d/Live2DPhysicsEngine.js';
import { Live2DAdapter } from '../src/services/live2d/Live2DAdapter.js';
import { Live2DController } from '../src/services/live2d/Live2DController.js';
import { live2dModelRegistry } from '../src/services/live2d/Live2DModelRegistry.js';
import { AudioAnalysisService } from '../src/services/audioAnalysisService.js';

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
console.log('🧪 CRISTI DESKTOP - LIVE2D PHYSICS & KINETICS 2.0 VALIDATION');
console.log('================================================================');

// ── 1. Live2DPhysicsEngine ──────────────────────────────────────────────────
console.log('\n[1/5] Verificando Live2DPhysicsEngine 2.0 (Resortes, Viento & Inercia)...');
const physics = new Live2DPhysicsEngine();

// Mock Cubism Core Model with various physics parameters
const mockCore = {
  _parameterIds: [
    'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
    'ParamHairFront', 'ParamHairSide', 'ParamHairBack', 'ParamHairFluffy',
    'ParamCloth', 'ParamSkirt', 'ParamRibbon', 'ParamTail', 'ParamEar',
    'ParamBustY', 'ParamBustX', 'ParamAccessory'
  ],
  _paramValues: {},
  setParameterValueById(id, val) {
    this._paramValues[id] = val;
  }
};

physics.bindModel(mockCore);
assert(physics.springs.size >= 10, `Detectados y vinculados ${physics.springs.size} parámetros físicos dinámicos.`);

// Test wind force generation
const wind1 = physics.computeWind(0.016);
const wind2 = physics.computeWind(0.016);
assert(typeof wind1 === 'number' && !isNaN(wind1), 'Simulación de viento genera valores numéricos válidos.');

// Test physical step integration
const appliedParams = {};
physics.update(
  0.016,
  { headX: 15, headY: -5, headZ: 8, bodyX: 4, bodyY: 0, bodyZ: -2 },
  (paramId, val) => {
    appliedParams[paramId] = val;
  }
);

assert(Object.keys(appliedParams).length > 0, 'La integración física calcula y emite desplazamientos elásticos.');
assert(appliedParams['ParamHairFront'] !== undefined, 'Parámetro ParamHairFront calculado.');
assert(appliedParams['ParamHairSide'] !== undefined, 'Parámetro ParamHairSide calculado.');
assert(appliedParams['ParamCloth'] !== undefined, 'Parámetro ParamCloth calculado.');
assert(appliedParams['ParamRibbon'] !== undefined, 'Parámetro ParamRibbon calculado.');

// ── 2. Live2DAdapter Bezier Transitions & Auto-Discovery ────────────────────
console.log('\n[2/5] Verificando Live2DAdapter (Bezier Curves & Introspección)...');
const adapter = new Live2DAdapter({
  internalModel: {
    coreModel: mockCore
  }
});

assert(adapter.mapping['head_angle_x']?.paramId === 'ParamAngleX', 'Auto-descubrimiento de head_angle_x mapeado a ParamAngleX.');
assert(adapter.mapping['head_angle_y']?.paramId === 'ParamAngleY', 'Auto-descubrimiento de head_angle_y mapeado a ParamAngleY.');

// Test Bezier target transition
adapter.setBezierTarget('ParamAngleX', 20, 200);
assert(adapter.bezierTransitions.has('ParamAngleX'), 'Transición Bezier registrada.');

// Run update tick
adapter.update(1.0);
assert(adapter.currentValues.get('ParamAngleX') !== undefined, 'Valor de transición Bezier aplicado.');

// ── 3. Live2DController Kinetics, Breathing & Reactive Pupils ───────────────
console.log('\n[3/5] Verificando Live2DController 2.0 (Respiración Estocástica & Pupilas)...');
const controller = new Live2DController(adapter, 'yanderegirl');

// Test multi-wave breathing tick
controller.update(16);
assert(controller.breathTime > 0, 'Acumulador de respiración estocástica avanzando.');

// Test emotion change with Bezier blend
controller.setEmotion('love');
assert(controller.currentEmotion === 'love', 'Emoción establecida a "love".');
assert(controller.targetPupilAperture === 1.15, 'Dilatación pupilar reactiva para emoción "love" (1.15).');

controller.setEmotion('yandere');
assert(controller.targetPupilAperture === 1.25, 'Dilatación pupilar reactiva para emoción "yandere" (1.25).');

controller.setEmotion('mad');
assert(controller.targetPupilAperture === 0.85, 'Contracción pupilar reactiva para emoción "mad" (0.85).');

// ── 4. Multi-Model Registry Verification (All 8 Models) ─────────────────────
console.log('\n[4/5] Verificando catálogo completo de 8 modelos Live2D oficiales...');
const expectedModels = ['yanderegirl', 'icegirl', 'hiyori', 'miara', 'toki', 'ellen', 'jane_doe', 'ruan_mei'];
const allModels = live2dModelRegistry.getAllModels();

assert(allModels.length === 8, `Catálogo contiene exactamente 8 modelos registrados (encontrados: ${allModels.length}).`);

expectedModels.forEach((mId) => {
  const model = live2dModelRegistry.getModel(mId);
  assert(model !== null && model.id === mId, `Modelo "${mId}" registrado con perfil válido.`);
  assert(model.path && model.path.endsWith('.model3.json'), `Modelo "${mId}" tiene ruta a model3.json.`);
  assert(model.capabilities !== undefined, `Modelo "${mId}" tiene capabilities declaradas.`);
});

// ── 5. AudioAnalysisService Multi-Band Spectral LipSync ─────────────────────
console.log('\n[5/5] Verificando AudioAnalysisService (Lip-Sync Multi-Banda Espectral)...');

// Mock Web Audio Context & Analyser
const mockAudioCtx = {
  sampleRate: 24000,
  createAnalyser() {
    return {
      fftSize: 512,
      frequencyBinCount: 256,
      smoothingTimeConstant: 0.25,
      getByteFrequencyData(arr) {
        // Simulate speech formant spectrum (strong 200Hz bass + 1500Hz vowel formant)
        for (let i = 0; i < arr.length; i++) {
          const freq = (i * 12000) / 256;
          if (freq >= 100 && freq <= 300) arr[i] = 200; // Bass/jaw drop
          else if (freq >= 1000 && freq <= 2500) arr[i] = 180; // Vowel formant
          else arr[i] = 30;
        }
      },
      getByteTimeDomainData(arr) {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = 128 + Math.floor(Math.sin(i * 0.2) * 60);
        }
      },
      connect() {}
    };
  }
};

const audioAnalysis = new AudioAnalysisService(mockAudioCtx);
audioAnalysis.analyser.getByteFrequencyData(audioAnalysis.frequencyData);
audioAnalysis.analyser.getByteTimeDomainData(audioAnalysis.timeDomainData);
const metrics = audioAnalysis.computeMetrics();

assert(metrics.volume > 0, `Volumen calculado: ${metrics.volume.toFixed(3)}`);
assert(metrics.mouthOpen > 0, `Apertura mandibular (mouthOpen) calculada: ${metrics.mouthOpen.toFixed(3)}`);
assert(typeof metrics.mouthForm === 'number', `Formante de labios (mouthForm) calculado: ${metrics.mouthForm.toFixed(3)}`);
assert(metrics.spectralCentroid > 0, `Centroide espectral calculado: ${metrics.spectralCentroid.toFixed(1)} Hz`);

// ── 6. Frame-Rate Invariance Validation (60Hz, 120Hz, 240Hz) ─────────────
console.log('\n[6/8] Verificando Invarianza Temporal ante 60Hz, 120Hz y 240Hz...');

// Simulate 1.0s of physical integration at 60 FPS (60 steps of 16.666ms), 120 FPS (120 steps of 8.333ms), and 240 FPS (240 steps of 4.166ms)
function simulatePhysicsSteps(fps) {
  const simEngine = new Live2DPhysicsEngine();
  simEngine.bindModel(mockCore);
  const steps = fps;
  const dt = 1.0 / fps;
  let lastVal = 0;
  for (let i = 0; i < steps; i++) {
    simEngine.update(dt, { headX: 10, headY: 0, headZ: 0, bodyX: 0, bodyY: 0, bodyZ: 0 }, (pId, val) => {
      if (pId === 'ParamHairFront') lastVal = val;
    });
  }
  return lastVal;
}

const val60 = simulatePhysicsSteps(60);
const val120 = simulatePhysicsSteps(120);
const val240 = simulatePhysicsSteps(240);

assert(Math.abs(val60 - val120) < 0.15, `Consistencia física 60Hz (${val60.toFixed(4)}) vs 120Hz (${val120.toFixed(4)})`);
assert(Math.abs(val60 - val240) < 0.20, `Consistencia física 60Hz (${val60.toFixed(4)}) vs 240Hz (${val240.toFixed(4)})`);

// Verify breathing accumulator rate invariance over 1 real second
const ctrl60 = new Live2DController(adapter, 'yanderegirl');
const ctrl240 = new Live2DController(adapter, 'yanderegirl');
for (let i = 0; i < 60; i++) ctrl60.update(1000 / 60);
for (let i = 0; i < 240; i++) ctrl240.update(1000 / 240);

assert(Math.abs(ctrl60.breathTime - ctrl240.breathTime) < 0.01, `Respiración invariante a 60Hz (${ctrl60.breathTime.toFixed(3)}) vs 240Hz (${ctrl240.breathTime.toFixed(3)})`);

// ── 7. ExpressionManager & MotionSyncService Validation ─────────────────────
console.log('\n[7/8] Verificando ExpressionManager & MotionSyncService...');
import { ExpressionManager } from '../src/services/live2d/ExpressionManager.js';
import { MotionSyncService } from '../src/services/live2d/MotionSyncService.js';

const expManager = new ExpressionManager(adapter, 'yanderegirl');
expManager.setExpression('happy');
assert(expManager.currentExpression === 'happy', 'ExpressionManager aplicó expresión "happy".');

// Test blocked expression (Ellen's artist credit overlay)
const expEllen = new ExpressionManager(adapter, 'ellen');
assert(expEllen.isBlocked('shuiyin') === true, 'ExpressionManager detecta "shuiyin" como expresión bloqueada en Ellen.');

const motionSync = new MotionSyncService(adapter, 'hiyori');
assert(typeof motionSync.playMotion === 'function', 'MotionSyncService inicializado con playMotion().');

// ── 8. Resource Destruction & Memory Lifecycle Verification ─────────────────
console.log('\n[8/8] Verificando Destrucción Limpia y Liberación de Memoria...');
controller.destroy();
assert(controller.adapter === null, 'Live2DController.destroy() desvinculó adapter.');
assert(controller.physicsEngine.springs.size === 0, 'Live2DController.destroy() limpió mapa de resortes físicos.');

adapter.destroy();
assert(adapter.currentValues.size === 0, 'Live2DAdapter.destroy() limpió currentValues.');
assert(adapter.bezierTransitions.size === 0, 'Live2DAdapter.destroy() canceló transiciones Bezier.');

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
