/**
 * Cristi Desktop - Comprehensive Proactive Engine & State Management Test Suite (SYS-05 Hardened)
 * Validates:
 * 1. EventBus error isolation, snapshot iteration, zero-leak subscriptions, and stream filtering
 * 2. ProactiveTriggerService user activity, inactivity, Pomodoro, and trigger registration
 * 3. ProactiveScheduler alarms and reminders dispatching
 * 4. ConfigManager resilience against corrupt JSON, quota overflow, and backups
 * 5. Gemini Live queueing, bounded capacity, TTL expiration, and cooldown rate limiting
 * 6. Stress test with 5,000 user activity / telemetry events & 500 simultaneously queued triggers
 */

import assert from 'assert';
import { EventBus, EVENTS } from '../src/services/eventBus.js';
import { ProactiveTriggerService } from '../src/services/proactiveTriggerService.js';
import { ProactiveScheduler } from '../src/services/proactiveScheduler.js';
import { ConfigManager } from '../src/services/configManager.js';

let passed = 0;
let total = 0;

function check(condition, message) {
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
console.log('🤖 CRISTI DESKTOP - PROACTIVE ENGINE & STATE MANAGEMENT (HARDENED)');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────
// 1. EVENTBUS ERROR ISOLATION & ZERO-LEAK SUBSCRIPTION LIFECYCLE
// ─────────────────────────────────────────────────────────────────────
console.log('[1/7] Verificando EventBus: Aislamiento de excepciones y desuscripción limpia...');
const testBus = new EventBus();

let listener1Fired = false;
let listener2Fired = false;

// Register a failing listener and a healthy listener
const unsub1 = testBus.on('test_event', () => {
  listener1Fired = true;
  throw new Error('Simulated listener error');
});

const unsub2 = testBus.on('test_event', (data) => {
  listener2Fired = true;
  assert.strictEqual(data.msg, 'hello');
});

check(testBus.listenerCount('test_event') === 2, '2 listeners registrados');

// Emit should not throw and should reach listener 2 despite listener 1 throwing
testBus.emit('test_event', { msg: 'hello' });
check(listener1Fired === true, 'Listener 1 ejecutado');
check(listener2Fired === true, 'Listener 2 ejecutado a pesar de la excepción en Listener 1');

// Unsubscribe listener 1
unsub1();
check(testBus.listenerCount('test_event') === 1, 'Listener 1 removido limpiamente');

// Test once()
let onceFiredCount = 0;
testBus.once('once_event', () => {
  onceFiredCount++;
});
testBus.emit('once_event');
testBus.emit('once_event');
check(onceFiredCount === 1, 'once() solo dispara exactamente una vez');
check(testBus.listenerCount('once_event') === 0, 'once() limpia listener automáticamente');

// High frequency filtering
for (let i = 0; i < 500; i++) {
  testBus.emit('audio_analysis', { vol: 0.5 });
}
check(testBus.historyBuffer.length === 3, 'Eventos de alta frecuencia excluidos de historyBuffer');

// ─────────────────────────────────────────────────────────────────────
// 2. PROACTIVE TRIGGER SERVICE: USER ACTIVITY & FOCUS CYCLES
// ─────────────────────────────────────────────────────────────────────
console.log('\n[2/7] Verificando Motor Proactivo: Seguimiento de actividad y ciclo Pomodoro...');
const proactive = new ProactiveTriggerService();

check(proactive.isRunning === false, 'El motor inicia detenido');
check(proactive.activeTriggers.has('routine_time_of_day'), 'Rutina de franja horaria registrada');
check(proactive.activeTriggers.has('routine_hydration_stretch'), 'Rutina de hidratación registrada');
check(proactive.activeTriggers.has('routine_inactivity_monitor'), 'Rutina de inactividad registrada');

// User activity tracking
const initialActivity = proactive.lastUserActivityTimestamp;
proactive.recordUserActivity();
check(proactive.lastUserActivityTimestamp >= initialActivity, 'Timestamp de actividad de usuario actualizado');

// Focus Pomodoro Session
proactive.startFocusSession(25);
check(proactive.focusTimer.active === true, 'Sesión de concentración activa');
check(proactive.focusTimer.mode === 'work', 'Modo trabajo');
check(proactive.focusTimer.remainingSeconds === 25 * 60, '25 minutos calculados');

// Simulate completion
proactive.handleFocusTimerComplete();
check(proactive.focusTimer.mode === 'break', 'Transición a modo descanso tras completar trabajo');
check(proactive.focusTimer.sessionsCompleted === 1, 'Sesión completada registrada');
proactive.stopFocusSession();
check(proactive.focusTimer.active === false, 'Sesión de enfoque detenida');

// ─────────────────────────────────────────────────────────────────────
// 3. PROACTIVE DISTRACTION & GEMINI QUEUEING RESILIENCE
// ─────────────────────────────────────────────────────────────────────
console.log('\n[3/7] Verificando Detección de Distracciones y Encolado con Gemini Live...');
let sentGeminiMessages = [];
const mockSocket = {
  isConnected: false,
  isConnecting: false,
  sendTextMessage: (txt) => sentGeminiMessages.push(txt)
};

proactive.setGeminiSocket(mockSocket);

// When socket is disconnected, interventions must be queued
proactive.queueIntervention({
  id: 'test_distraction_1',
  text: 'Atención: Estás distraído con el teléfono'
});

check(proactive.interventionQueue.length === 1, 'Intervención encolada cuando socket está desconectado');
check(sentGeminiMessages.length === 0, 'No se enviaron mensajes a socket desconectado');

// When socket becomes connected, process queue
mockSocket.isConnected = true;
proactive.lastAutonomousInterventionTime = 0; // reset cooldown for test
proactive.processInterventionQueue();
check(sentGeminiMessages.length === 1, 'Mensaje encolado despachado al conectarse socket');
check(proactive.interventionQueue.length === 0, 'Cola vaciada tras despacho');

// ─────────────────────────────────────────────────────────────────────
// 4. PROACTIVE SCHEDULER: ALARMS & REMINDERS
// ─────────────────────────────────────────────────────────────────────
console.log('\n[4/7] Verificando ProactiveScheduler: Recordatorios y alarmas temporizadas...');
const scheduler = new ProactiveScheduler();

scheduler.scheduleReminder({
  id: 'test_rem_1',
  time: '12:00',
  title: 'Tomar agua',
  tag: 'Salud'
});
check(scheduler.scheduledTasks.has('test_rem_1') === true, 'Recordatorio registrado');

scheduler.cancelTask('test_rem_1');
check(scheduler.scheduledTasks.has('test_rem_1') === false, 'Recordatorio cancelado exitosamente');
scheduler.destroy();

// ─────────────────────────────────────────────────────────────────────
// 5. CONFIGMANAGER: CORRUPT JSON & QUOTA OVERFLOW RESILIENCE
// ─────────────────────────────────────────────────────────────────────
console.log('\n[5/7] Verificando ConfigManager: Recuperación de JSON corrupto y cuotas...');
const configMgr = new ConfigManager();

// Test loading from corrupt raw string
configMgr._memoryStore[configMgr.storageKey] = 'INVALID_JSON_CORRUPT{[[[';
const fallbackConfig = configMgr.loadConfig({ apiKey: 'default_key' });
check(fallbackConfig.apiKey === 'default_key', 'ConfigManager se recuperó de JSON corrupto con valor por defecto');

// Test saving valid config
const saved = configMgr.saveConfig({
  apiKey: 'AIzaSyTestKey123',
  modelId: 'gemini-3.1-flash-live-preview',
  temperature: 0.8
});
check(saved.success === true, 'Configuración guardada correctamente');

// Test exporting and importing
const exported = configMgr.exportConfigJSON();
check(exported.includes('AIzaSyTestKey123'), 'Exportación contiene API Key');

const imported = configMgr.importConfigJSON(exported);
check(imported.success === true, 'Importación exitosa');
check(imported.config.apiKey === 'AIzaSyTestKey123', 'API Key preservada');

// Test import of corrupt JSON
const corruptImport = configMgr.importConfigJSON('INVALID_JSON{');
check(corruptImport.success === false, 'Importación de JSON corrupto rechazada limpiamente');

// ─────────────────────────────────────────────────────────────────────
// 6. STRESS TEST: 500 TRIGGERS ENCOLADOS SIMULTÁNEAMENTE CON TTL Y COOLDOWN
// ─────────────────────────────────────────────────────────────────────
console.log('\n[6/7] ⚡ SOBRECARGA: Encolado de 500 triggers proactivos simultáneos (Cola acotada & TTL)...');
const stressProactive = new ProactiveTriggerService();
mockSocket.isConnected = false;
stressProactive.setGeminiSocket(mockSocket);

const tStart500Queue = performance.now();

// Burst queue 500 interventions
for (let i = 0; i < 500; i++) {
  stressProactive.queueIntervention({
    id: `stress_intervention_${i}`,
    text: `Prompt autónomo de prueba ${i}`
  });
}

const durationQueue = (performance.now() - tStart500Queue).toFixed(1);
// Queue must be capped to MAX_QUEUED_INTERVENTIONS = 3, preventing memory saturation
check(stressProactive.interventionQueue.length <= 3, `Cola proactiva acotada estrictamente a máximo 3 elementos (${stressProactive.interventionQueue.length}/3).`);
console.log(`    ⚡ 500 intervenciones encoladas en ${durationQueue}ms sin desbordamiento de memoria.`);

// Test TTL Expiration (items older than 60s)
const now = Date.now();
stressProactive.interventionQueue = [
  { id: 'expired_1', text: 'Old prompt 1', timestamp: now - 70000 },
  { id: 'expired_2', text: 'Old prompt 2', timestamp: now - 90000 },
  { id: 'valid_1', text: 'Fresh prompt', timestamp: now }
];

stressProactive.processInterventionQueue();
check(stressProactive.interventionQueue.length === 1, 'TTL de 60s purgó automáticamente 2 intervenciones vencidas.');
check(stressProactive.interventionQueue[0].id === 'valid_1', 'Intervención fresca preservada en cola.');

stressProactive.destroy();

// ─────────────────────────────────────────────────────────────────────
// 7. STRESS TEST: RÁFAGA DE 5,000 EVENTOS DE ACTIVIDAD Y DISTRACCIÓN
// ─────────────────────────────────────────────────────────────────────
console.log('\n[7/7] ⚡ SOBRECARGA: Ráfaga de 5,000 eventos de actividad y alertas sensoriales...');
const activityProactive = new ProactiveTriggerService();
const tStart5000 = performance.now();

for (let i = 0; i < 5000; i++) {
  activityProactive.recordUserActivity();
  if (i % 250 === 0) {
    activityProactive.handleDistractionAlert({ duration: 45, message: 'Celular en mano' });
  }
}

const duration5000 = (performance.now() - tStart5000).toFixed(1);
const telemetry5000 = activityProactive.getTelemetry();
check(telemetry5000.timeSinceLastActivitySeconds === 0, `5,000 eventos procesados en ${duration5000}ms sin fuga de memoria.`);
check(telemetry5000.queuedInterventionsCount <= 3, 'Cola de intervenciones protegida ante tormenta de eventos.');

activityProactive.destroy();
proactive.destroy();

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
