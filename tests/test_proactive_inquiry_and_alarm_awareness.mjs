/**
 * Cristi AI - Proactive Inquiry & Conversation Starter + Alarm Awareness & Dismiss Test Suite
 */

import assert from 'node:assert';
import fs from 'node:fs';
import { proactiveScheduler } from '../src/services/proactiveScheduler.js';
import { proactiveTriggerService } from '../src/services/proactiveTriggerService.js';
import { toastService } from '../src/services/toastService.js';
import { eventBus, EVENTS } from '../src/services/eventBus.js';
import { memoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';

console.log('========================================================================');
console.log('🧪 TEST: PROACTIVE INQUIRY ENGINE & ALARM AWARENESS + DISMISS BUG FIX');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// 1. Verify DesktopWidgets & Toast Dismiss Fix
// -----------------------------------------------------------------------------
console.log('🔍 [1/5] Verificando corrección de descarte de alarmas en DesktopWidgets y Toasts...');

const widgetsJsx = fs.readFileSync('src/components/DesktopWidgets.jsx', 'utf8');
assert(widgetsJsx.includes('handleDismiss(widget.id)'), 'DesktopWidgets debe invocar handleDismiss con widget.id');
assert(widgetsJsx.includes('e.stopPropagation()'), 'DesktopWidgets action buttons deben aislar eventos con stopPropagation()');
assert(widgetsJsx.includes('e.preventDefault()'), 'DesktopWidgets action buttons deben prevenir acciones por defecto');
assert(widgetsJsx.includes('onPointerDown'), 'DesktopWidgets debe capturar onPointerDown para evitar click-through erróneo');
assert(widgetsJsx.includes('proactiveScheduler.cancelTask'), 'handleDismiss en DesktopWidgets debe cancelar la tarea en proactiveScheduler');
assert(widgetsJsx.includes('EVENTS.WIDGET_DISMISSED'), 'handleDismiss debe emitir EVENTS.WIDGET_DISMISSED');

const indexCss = fs.readFileSync('src/index.css', 'utf8');
assert(indexCss.includes('.cristi-widget-actions'), 'index.css debe contener estilos para .cristi-widget-actions');
assert(indexCss.includes('.cristi-widget-action-btn'), 'index.css debe contener estilos interactivos para .cristi-widget-action-btn');
assert(indexCss.includes('pointer-events-auto'), 'Botones de widgets deben tener pointer-events-auto garantizado');

const toastContainerJsx = fs.readFileSync('src/components/ToastContainer.jsx', 'utf8');
assert(toastContainerJsx.includes('alarm: Clock'), 'ToastContainer debe soportar icono dedicado Clock para alarmas');
assert(toastContainerJsx.includes('t.type === \'alarm\''), 'ToastContainer debe renderizar botón y estilo visual persistente para alarmas');

assert(typeof toastService.alarm === 'function', 'toastService debe implementar método alarm()');
console.log('  ✅ Descarte de widgets y notificaciones de alarma completamente blindado.');

// -----------------------------------------------------------------------------
// 2. Verify ProactiveScheduler & Upcoming Alarm Awareness
// -----------------------------------------------------------------------------
console.log('🔍 [2/5] Verificando ProactiveScheduler y detección de alarmas cercanas...');

// Schedule a test alarm for 10 minutes ahead
const now = new Date();
const targetDate = new Date(now.getTime() + 10 * 60000);
const targetTimeStr = targetDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const testAlarm = proactiveScheduler.scheduleAlarm({
  id: 'test_alarm_999',
  time: targetTimeStr,
  label: 'Estudiar matemáticas'
});

assert(testAlarm.id === 'test_alarm_999', 'Alarma debe crearse con ID');
assert(testAlarm.targetTime === targetTimeStr, 'Alarma debe almacenar hora objetivo');

const minutesRemaining = proactiveScheduler.calculateMinutesRemaining(targetTimeStr);
assert(typeof minutesRemaining === 'number' && minutesRemaining >= 9 && minutesRemaining <= 11, `Minutos restantes (${minutesRemaining}) deben ser ~10m`);

const upcoming = proactiveScheduler.getUpcomingTasks(60);
assert(upcoming.some(t => t.id === 'test_alarm_999'), 'getUpcomingTasks debe incluir la alarma programada');

const promptContext = proactiveScheduler.getPromptContext();
assert(promptContext.includes('ALARMAS Y RECORDATORIOS ACTIVOS'), 'getPromptContext debe generar bloque de alarmas para Gemini');
assert(promptContext.includes('Estudiar matemáticas'), 'getPromptContext debe mencionar la etiqueta de la alarma');
assert(promptContext.includes(targetTimeStr), 'getPromptContext debe incluir la hora de la alarma');

// Test cancelTask via WIDGET_DISMISSED event
eventBus.emit(EVENTS.WIDGET_DISMISSED, { id: 'test_alarm_999' });
assert(!proactiveScheduler.scheduledTasks.has('test_alarm_999'), 'WIDGET_DISMISSED debe cancelar automáticamente la tarea en scheduler');

console.log('  ✅ Conciencia de alarmas próximas, cálculo de minutos y contexto de prompt verificados.');

// -----------------------------------------------------------------------------
// 3. Verify Proactive Inquisitive Dialogue Engine
// -----------------------------------------------------------------------------
console.log('🔍 [3/5] Verificando motor de indagación y conversación proactiva (romper silencios)...');

let dispatchedMessage = null;
const mockSocket = {
  isConnected: true,
  isConnecting: false,
  sendTextMessage: (msg) => {
    dispatchedMessage = msg;
  }
};

proactiveTriggerService.setGeminiSocket(mockSocket);
assert(proactiveTriggerService.geminiSocket === mockSocket, 'setGeminiSocket debe asociar el socket activo');

// Verify dialogue tracking
proactiveTriggerService.recordDialogueActivity();
assert(Date.now() - proactiveTriggerService.lastDialogueTimestamp < 500, 'recordDialogueActivity debe actualizar timestamp de diálogo');
assert(proactiveTriggerService.silenceThresholdSec >= 30, 'silenceThresholdSec debe ser dinámico y >= 30s');

// Force trigger an inquisitive conversation starter
proactiveTriggerService.lastDialogueTimestamp = Date.now() - 60000; // 60s ago
proactiveTriggerService.lastAutonomousInterventionTime = 0;
await memoryService.remember({
  key: 'test_proactive_context',
  content: 'Ariel dejó pendiente comprobar la estabilidad de la llamada.',
  category: MEMORY_CATEGORIES.CONVERSATION,
  importance: 0.8,
  source: 'test'
});

proactiveTriggerService.triggerInquisitiveConversationStarter(60);
assert(dispatchedMessage !== null, 'triggerInquisitiveConversationStarter debe enviar un turno de texto a Gemini Live');
assert(dispatchedMessage.includes('[SISTEMA PROACTIVO'), 'El prompt de indagación debe contener directiva proactiva');
console.log('  Mensaje proactivo generado:', dispatchedMessage.substring(0, 100) + '...');

console.log('  ✅ Motor de indagación proactiva y temas de conversación autónomos verificados.');

// -----------------------------------------------------------------------------
// 4. Verify Persona Prompt Guidelines in models.js
// -----------------------------------------------------------------------------
console.log('🔍 [4/5] Verificando directivas de personalidad en models.js...');

const modelsCode = fs.readFileSync('src/config/models.js', 'utf8');
assert(modelsCode.includes('11. Proactividad Total, Conversadora Curiosa e Indagación de sus Gustos'), 'models.js debe incluir sección 11 de proactividad e indagación');
assert(modelsCode.includes('manage_memory'), 'models.js debe instruir guardar recuerdos usando manage_memory');
assert(modelsCode.includes('12. Conciencia y Recordatorio Proactivo de Alarmas y Fechas Cercanas'), 'models.js debe incluir sección 12 de conciencia de alarmas');

console.log('  ✅ Secciones 11 y 12 del System Persona Prompt validadas.');

// -----------------------------------------------------------------------------
// 5. Verify Tool Executor and Gemini Live Setup Prompt
// -----------------------------------------------------------------------------
console.log('🔍 [5/5] Verificando toolExecutor.js y prompt enriquecido en geminiLiveSocket.js...');

const toolExecCode = fs.readFileSync('src/services/toolExecutor.js', 'utf8');
assert(toolExecCode.includes('proactiveScheduler.scheduleAlarm'), 'toolExecutor debe invocar proactiveScheduler.scheduleAlarm en set_alarm');
assert(toolExecCode.includes('proactiveScheduler.scheduleReminder'), 'toolExecutor debe invocar proactiveScheduler.scheduleReminder en set_reminder');

const liveSocketCode = fs.readFileSync('src/services/geminiLiveSocket.js', 'utf8');
assert(liveSocketCode.includes('schedulerContext'), 'geminiLiveSocket debe inyectar schedulerContext en el setup');
assert(liveSocketCode.includes('proactivityDirective'), 'geminiLiveSocket debe inyectar proactivityDirective en el setup');

const appJsxCode = fs.readFileSync('src/App.jsx', 'utf8');
assert(appJsxCode.includes('proactiveTriggerService.setGeminiSocket(socket)'), 'App.jsx debe vincular socket a proactiveTriggerService en onOpen');
assert(appJsxCode.includes('proactiveScheduler.setGeminiSocket(socket)'), 'App.jsx debe vincular socket a proactiveScheduler en onOpen');

console.log('  ✅ Integración global en toolExecutor, geminiLiveSocket y App.jsx validada.');

proactiveScheduler.destroy();
proactiveTriggerService.destroy();

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE INDAGACIÓN PROACTIVA Y CONCIENCIA DE ALARMAS PASARON AL 100%!\n');
process.exit(0);
