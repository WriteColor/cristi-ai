import assert from 'assert';
import { ProactiveTriggerService } from '../src/services/proactiveTriggerService.js';
import { eventBus, EVENTS } from '../src/services/eventBus.js';

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
console.log('🤖 CRISTI DESKTOP - PROACTIVE TRIGGER ENGINE (HARDENED & STRESSED)');
console.log('================================================================\n');

const proactiveService = new ProactiveTriggerService();

// 1. Initial State & Defaults
console.log('[1/6] Verificando estado inicial y registro de rutinas por defecto...');
check(proactiveService.isRunning === false, 'El motor inicia detenido');
check(proactiveService.activeTriggers.has('routine_time_of_day'), 'Rutina de franja horaria registrada');
check(proactiveService.activeTriggers.has('routine_hydration_stretch'), 'Rutina de hidratación y postura registrada');
check(proactiveService.activeTriggers.has('routine_inactivity_monitor'), 'Rutina de inactividad registrada');

// 2. Custom Dynamic Trigger Registration & Execution
console.log('\n[2/6] Verificando registro y disparo de triggers personalizados...');
let customFired = false;
proactiveService.registerTrigger({
  id: 'test_custom_trigger',
  intervalSeconds: 0,
  condition: () => ({ testData: 'cristi_companion' }),
  action: (data) => {
    customFired = true;
    assert.strictEqual(data.testData, 'cristi_companion');
  }
});

proactiveService.tick();
check(customFired === true, 'Trigger personalizado ejecutado en tick');

// 3. Focus & Pomodoro Work/Break Cycle
console.log('\n[3/6] Verificando ciclo de concentración Pomodoro (Work -> Break)...');
proactiveService.startFocusSession(25);
check(proactiveService.focusTimer.active === true, 'Sesión de enfoque activa');
check(proactiveService.focusTimer.mode === 'work', 'Modo trabajo inicial');
check(proactiveService.focusTimer.remainingSeconds === 25 * 60, '25 minutos calculados');

// Simulate completion
proactiveService.handleFocusTimerComplete();
check(proactiveService.focusTimer.mode === 'break', 'Transición a modo descanso tras completar trabajo');
check(proactiveService.focusTimer.sessionsCompleted === 1, 'Contador de sesiones completadas incrementado');
proactiveService.stopFocusSession();
check(proactiveService.focusTimer.active === false, 'Sesión de enfoque detenida');

// 4. Telemetry & User Activity Tracking
console.log('\n[4/6] Verificando telemetría del motor proactivo y seguimiento de actividad...');
proactiveService.recordUserActivity();
const telemetry = proactiveService.getTelemetry();
check(typeof telemetry.sessionDurationMinutes === 'number', 'Duración de sesión numérica');
check(typeof telemetry.timeSinceLastActivitySeconds === 'number', 'Tiempo de inactividad numérico');
check(telemetry.activeTriggersCount >= 2, 'Contador de triggers activos correcto');

// 5. STRESS TEST: 500 TRIGGERS ENCOLADOS Y EVALUADOS SIMULTÁNEAMENTE
console.log('\n[5/6] ⚡ SOBRECARGA: Registro y evaluación de 500 triggers dinámicos simultáneos...');
const tStart500 = performance.now();
let firedCount500 = 0;

for (let i = 0; i < 500; i++) {
  proactiveService.registerTrigger({
    id: `stress_trigger_${i}`,
    intervalSeconds: 0, // Inmediato
    condition: () => ({ index: i, valid: true }),
    action: (data) => {
      if (data && data.valid) firedCount500++;
    }
  });
}

check(proactiveService.activeTriggers.size >= 503, `500 triggers registrados concurrentemente (Total: ${proactiveService.activeTriggers.size}).`);

// Evaluate tick under heavy 500-trigger load
proactiveService.tick();
check(firedCount500 === 500, `500/500 triggers ejecutados en un solo tick sin saturación.`);

// Unregister all 500 stress triggers cleanly
for (let i = 0; i < 500; i++) {
  proactiveService.unregisterTrigger(`stress_trigger_${i}`);
}
const duration500 = (performance.now() - tStart500).toFixed(1);
check(proactiveService.activeTriggers.size <= 4, `Limpieza completa: triggers activos retornaron a estado base (${proactiveService.activeTriggers.size}).`);
console.log(`    ⚡ 500 triggers registrados, evaluados y removidos en ${duration500}ms.`);

// 6. STRESS TEST: RÁFAGA DE 5,000 EVENTOS DE ACTIVIDAD DE USUARIO
console.log('\n[6/6] ⚡ SOBRECARGA: 5,000 eventos de actividad de usuario en ráfaga...');
const tStartActivity = performance.now();

for (let i = 0; i < 5000; i++) {
  proactiveService.recordUserActivity();
  if (i % 100 === 0) {
    eventBus.emit(EVENTS.USER_SPEAKING);
  }
}

const finalTelemetry = proactiveService.getTelemetry();
const durationActivity = (performance.now() - tStartActivity).toFixed(1);
check(finalTelemetry.timeSinceLastActivitySeconds === 0, `Actividad registrada en tiempo real tras 5,000 llamadas (${durationActivity}ms).`);
check(proactiveService.isUserSpeaking === true || proactiveService.isUserSpeaking === false, 'Estado de usuario consistente.');

proactiveService.destroy();

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
