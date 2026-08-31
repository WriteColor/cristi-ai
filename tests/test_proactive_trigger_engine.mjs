import assert from 'assert';
import { ProactiveTriggerService } from '../src/services/proactiveTriggerService.js';

console.log('================================================================');
console.log('🤖 CRISTI DESKTOP - PROACTIVE TRIGGER ENGINE VALIDATION');
console.log('================================================================\n');

const proactiveService = new ProactiveTriggerService();

// 1. Initial State & Defaults
console.log('[1/4] Verificando estado inicial y registro de rutinas por defecto...');
assert.strictEqual(proactiveService.isRunning, false, 'El motor inicia detenido');
assert(proactiveService.activeTriggers.has('routine_time_of_day'), 'Rutina de franja horaria registrada');
assert(proactiveService.activeTriggers.has('routine_hydration_stretch'), 'Rutina de hidratación y postura registrada');
console.log('  ✅ [PASS] Estado inicial y rutinas base verificadas.');

// 2. Custom Dynamic Trigger Registration & Execution
console.log('\n[2/4] Verificando registro y disparo de triggers personalizados...');
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
assert.strictEqual(customFired, true, 'Trigger personalizado ejecutado en tick');
console.log('  ✅ [PASS] Registro y ejecución de triggers dinámicos validado.');

// 3. Focus & Pomodoro Work/Break Cycle
console.log('\n[3/4] Verificando ciclo de concentración Pomodoro (Work -> Break)...');
proactiveService.startFocusSession(25);
assert.strictEqual(proactiveService.focusTimer.active, true, 'Sesión de enfoque activa');
assert.strictEqual(proactiveService.focusTimer.mode, 'work', 'Modo trabajo inicial');
assert.strictEqual(proactiveService.focusTimer.remainingSeconds, 25 * 60, '25 minutos calculados');

// Simulate completion
proactiveService.handleFocusTimerComplete();
assert.strictEqual(proactiveService.focusTimer.mode, 'break', 'Transición a modo descanso tras completar trabajo');
assert.strictEqual(proactiveService.focusTimer.sessionsCompleted, 1, 'Contador de sesiones completadas incrementado');
proactiveService.stopFocusSession();
assert.strictEqual(proactiveService.focusTimer.active, false, 'Sesión de enfoque detenida');
console.log('  ✅ [PASS] Ciclo de enfoque Pomodoro verificado correctamente.');

// 4. Telemetry & User Activity Tracking
console.log('\n[4/4] Verificando telemetría del motor proactivo y seguimiento de actividad...');
proactiveService.recordUserActivity();
const telemetry = proactiveService.getTelemetry();
assert.strictEqual(typeof telemetry.sessionDurationMinutes, 'number', 'Duración de sesión numérica');
assert.strictEqual(typeof telemetry.timeSinceLastActivitySeconds, 'number', 'Tiempo de inactividad numérico');
assert(telemetry.activeTriggersCount >= 2, 'Contador de triggers activos correcto');
console.log('  ✅ [PASS] Telemetría y registro de actividad verificado.');

console.log('\n================================================================');
console.log('📊 RESULTADO: TODAS LAS PRUEBAS PROACTIVAS COMPLETADAS CON ÉXITO');
console.log('================================================================\n');
