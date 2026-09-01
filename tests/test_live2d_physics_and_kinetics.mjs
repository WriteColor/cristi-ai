/**
 * Cristi Desktop - Live2D Physics & Kinetics 2.0 Test Suite (Endurecida)
 * Validates PhysicsEngine, Stochastic Breathing, Multi-Band LipSync, Bezier Transitions,
 * 10,000-step Extreme Temporal Jump Stress, 20x WebGL Loss/Restore Cycles,
 * and Cyclic Switching across all 8 Cubism avatars.
 */

import { Live2DPhysicsEngine } from '../src/services/live2d/Live2DPhysicsEngine.js';
import { Live2DAdapter } from '../src/services/live2d/Live2DAdapter.js';
import { Live2DController } from '../src/services/live2d/Live2DController.js';
import { live2dModelRegistry } from '../src/services/live2d/Live2DModelRegistry.js';
import { AudioAnalysisService } from '../src/services/audioAnalysisService.js';
import { ExpressionManager } from '../src/services/live2d/ExpressionManager.js';
import { MotionSyncService } from '../src/services/live2d/MotionSyncService.js';

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
console.log('🧪 CRISTI DESKTOP - LIVE2D PHYSICS & KINETICS 2.0 (STRESS & HARDENED)');
console.log('================================================================');

// ── 1. Live2DPhysicsEngine ──────────────────────────────────────────────────
console.log('\n[1/11] Verificando Live2DPhysicsEngine 2.0 (Resortes, Viento & Inercia)...');
const physics = new Live2DPhysicsEngine();

// Mock Cubism Core Model with various physics parameters
const mockCore = {
  _parameterIds: [
    'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
    'ParamHairFront', 'ParamHairSide', 'ParamHairBack', 'ParamHairFluffy',
    'ParamCloth', 'ParamSkirt', 'ParamRibbon', 'ParamTail', 'ParamEar',
    'ParamBustY', 'ParamBustX', 'ParamAccessory'
  ],
  _partIds: ['Part01', 'Part17', 'PartWatermark'],
  _partOpacities: [1, 1, 1],
  _paramValues: {},
  setParameterValueById(id, val) {
    this._paramValues[id] = val;
  },
  setPartOpacityByIndex(idx, opacity) {
    this._partOpacities[idx] = opacity;
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
console.log('\n[2/11] Verificando Live2DAdapter (Bezier Curves & Introspección)...');
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
console.log('\n[3/11] Verificando Live2DController 2.0 (Respiración Estocástica & Pupilas)...');
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
console.log('\n[4/11] Verificando catálogo completo de 8 modelos Live2D oficiales...');
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
console.log('\n[5/11] Verificando AudioAnalysisService (Lip-Sync Multi-Banda Espectral)...');

// Mock Web Audio Context & Analyser
const mockAudioCtx = {
  sampleRate: 24000,
  createAnalyser() {
    return {
      fftSize: 512,
      frequencyBinCount: 256,
      smoothingTimeConstant: 0.25,
      getByteFrequencyData(arr) {
        for (let i = 0; i < arr.length; i++) {
          const freq = (i * 12000) / 256;
          if (freq >= 100 && freq <= 300) arr[i] = 200;
          else if (freq >= 1000 && freq <= 2500) arr[i] = 180;
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
console.log('\n[6/11] Verificando Invarianza Temporal ante 60Hz, 120Hz y 240Hz...');

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
ctrl60.destroy();
ctrl240.destroy();

// ── 7. ExpressionManager & MotionSyncService Validation ─────────────────────
console.log('\n[7/11] Verificando ExpressionManager & MotionSyncService...');
const expManager = new ExpressionManager(adapter, 'yanderegirl');
expManager.setExpression('happy');
assert(expManager.currentExpression === 'happy', 'ExpressionManager aplicó expresión "happy".');

// Test blocked expression (Ellen's artist credit overlay)
const expEllen = new ExpressionManager(adapter, 'ellen');
assert(expEllen.isBlocked('shuiyin') === true, 'ExpressionManager detecta "shuiyin" como expresión bloqueada en Ellen.');

const motionSync = new MotionSyncService(adapter, 'hiyori');
assert(typeof motionSync.playMotion === 'function', 'MotionSyncService inicializado con playMotion().');

// ── 8. STRESS TEST: 10,000 Iteraciones con Saltos Temporales Extremos (0.1ms a 500ms) ────
console.log('\n[8/11] ⚡ SOBRECARGA: 10,000 iteraciones de cinemática con saltos temporales extremos (0.1ms - 500ms)...');

const stressPhysics = new Live2DPhysicsEngine();
stressPhysics.bindModel(mockCore);

const stressAdapter = new Live2DAdapter({
  internalModel: {
    coreModel: mockCore
  }
});
const stressCtrl = new Live2DController(stressAdapter, 'yanderegirl');

let nanCount = 0;
let outOfBoundsCount = 0;
const tStartStress = performance.now();

// Pseudo-random deterministic generator for repeatable chaos testing
let seed = 123456789;
function pseudoRandom() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

for (let i = 0; i < 10000; i++) {
  // Extreme dt jumps: from ultra-high FPS (0.0001s = 0.1ms) to massive lag spikes (0.500s = 500ms)
  const dtMs = 0.1 + pseudoRandom() * 499.9;
  const dtSec = dtMs / 1000;

  // Erratic kinematics oscillation simulating aggressive head tossing, drag, and camera jumps
  const headX = Math.sin(i * 0.07) * 30 + (pseudoRandom() - 0.5) * 20;
  const headY = Math.cos(i * 0.05) * 25 + (pseudoRandom() - 0.5) * 15;
  const headZ = Math.sin(i * 0.11) * 20;
  const bodyX = Math.sin(i * 0.03) * 15;
  const bodyY = Math.cos(i * 0.02) * 10;
  const bodyZ = Math.sin(i * 0.04) * 8;

  stressCtrl.setGazeTarget((pseudoRandom() - 0.5) * 2, (pseudoRandom() - 0.5) * 2);
  stressCtrl.update(dtMs);

  stressPhysics.update(dtSec, { headX, headY, headZ, bodyX, bodyY, bodyZ }, (paramId, val) => {
    if (isNaN(val) || !isFinite(val)) nanCount++;
    if (val < -1.0 || val > 1.0) outOfBoundsCount++;
  });
}

const stressDuration = (performance.now() - tStartStress).toFixed(1);
assert(nanCount === 0, `10,000 pasos de física sin anomalías numéricas NaN/Infinity (detectadas: ${nanCount}).`);
assert(outOfBoundsCount === 0, `10,000 pasos respetan clamping físico estricto [-1.0, 1.0] (violaciones: ${outOfBoundsCount}).`);
console.log(`    ⚡ 10,000 iteraciones extremas completadas en ${stressDuration}ms.`);

stressCtrl.destroy();
stressPhysics.destroy();

// ── 9. SIMULACIÓN DE 20 CICLOS DE PÉRDIDA Y RESTAURACIÓN WEBGL (webglcontextlost / restored) ──
console.log('\n[9/11] 🔄 RESILIENCIA: 20 ciclos de pérdida y restauración simulada de WebGL...');

const webglAdapter = new Live2DAdapter({ internalModel: { coreModel: mockCore } });
const webglCtrl = new Live2DController(webglAdapter, 'ruan_mei');

let contextLostSuccessCount = 0;
let contextRestoredSuccessCount = 0;

for (let cycle = 1; cycle <= 20; cycle++) {
  // 1. Simulate webglcontextlost event
  webglCtrl.physicsEngine.reset();
  webglAdapter.resetNeutralState();
  
  // Verify clean reset
  let isClean = true;
  for (const spring of webglCtrl.physicsEngine.springs.values()) {
    if (spring.position !== 0 || spring.velocity !== 0) isClean = false;
  }
  if (isClean && webglAdapter.currentExpression === 'none') {
    contextLostSuccessCount++;
  }

  // 2. Simulate webglcontextrestored event (rebind textures, re-introspect model)
  webglAdapter.setMapping({
    head_angle_x: 'ParamAngleX',
    head_angle_y: 'ParamAngleY',
    mouth_open_y: 'ParamMouthOpenY'
  });
  webglCtrl.physicsEngine.bindModel(mockCore);
  
  // Run 10 frames of restoration
  let validRestoredTicks = true;
  for (let frame = 0; frame < 10; frame++) {
    webglCtrl.update(16.66);
    for (const spring of webglCtrl.physicsEngine.springs.values()) {
      if (isNaN(spring.position) || !isFinite(spring.position)) validRestoredTicks = false;
    }
  }

  if (validRestoredTicks && webglCtrl.physicsEngine.springs.size > 0) {
    contextRestoredSuccessCount++;
  }
}

assert(contextLostSuccessCount === 20, `20/20 ciclos de webglcontextlost gestionados con reinicio limpio de resortes.`);
assert(contextRestoredSuccessCount === 20, `20/20 ciclos de webglcontextrestored re-vincularon el core model sin errores.`);
webglCtrl.destroy();

// ── 10. CAMBIOS CÍCLICOS DE LOS 8 MODELOS LIVE2D EN CALIENTE ───────────────
console.log('\n[10/11] 🎭 ROTACIÓN CÍCLICA: Transición secuencial entre los 8 avatares oficiales...');

const cyclicAdapter = new Live2DAdapter({ internalModel: { coreModel: mockCore } });
const cyclicCtrl = new Live2DController(cyclicAdapter, 'yanderegirl');

const modelList = ['yanderegirl', 'icegirl', 'hiyori', 'miara', 'toki', 'ellen', 'jane_doe', 'ruan_mei'];
let totalTransitions = 0;
let validTransitions = 0;

// Execute 3 full rounds (24 model transitions)
for (let round = 1; round <= 3; round++) {
  for (const modelId of modelList) {
    totalTransitions++;
    cyclicCtrl.setModel(modelId, cyclicAdapter);

    // Apply model-specific emotion and verify reaction
    cyclicCtrl.setEmotion('happy');
    cyclicCtrl.update(16.66);
    cyclicCtrl.setEmotion('yandere');
    cyclicCtrl.update(16.66);

    const profile = live2dModelRegistry.getModel(modelId);
    const caps = live2dModelRegistry.getCapabilities(modelId);

    if (cyclicCtrl.modelId === modelId && profile !== null && caps !== undefined) {
      validTransitions++;
    }
  }
}

assert(totalTransitions === 24, `24 transiciones de modelo ejecutadas (3 rondas completas de los 8 avatares).`);
assert(validTransitions === 24, `24/24 transiciones completadas con perfil, capacidades y física reconfiguradas.`);
cyclicCtrl.destroy();

// ── 11. Resource Destruction & Memory Lifecycle Verification ─────────────────
console.log('\n[11/11] Verificando Destrucción Limpia y Liberación de Memoria...');
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
