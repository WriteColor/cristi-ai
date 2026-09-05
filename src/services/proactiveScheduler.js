/**
 * Cristi AI - Proactive Scheduler & Task Manager
 * High-level orchestration for scheduled reminders, alarms, periodic health checks,
 * approaching alerts, and autonomous companion awareness.
 */

import { eventBus, EVENTS } from './eventBus.js';
import { toastService } from './toastService.js';
import { soundFxService } from './soundFxService.js';
import { logger } from './logger.js';

const STORAGE_KEY_SCHEDULED_TASKS = 'cristi_ai_scheduled_tasks';

export class ProactiveScheduler {
  constructor() {
    this.scheduledTasks = new Map();
    this.checkIntervalId = null;
    this.geminiSocket = null;
    this.init();
  }

  setGeminiSocket(socket) {
    this.geminiSocket = socket;
  }

  init() {
    this.loadFromStorage();
    if (typeof setInterval !== 'undefined') {
      this.checkIntervalId = setInterval(() => this.tick(), 1000);
    }

    eventBus.on(EVENTS.WIDGET_DISMISSED, ({ id }) => {
      if (id) this.cancelTask(String(id));
    });
  }

  loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY_SCHEDULED_TASKS);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const task of list) {
          if (task && task.id && !task.executed) {
            this.scheduledTasks.set(String(task.id), task);
          }
        }
      }
    } catch (_) {}
  }

  saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const list = Array.from(this.scheduledTasks.values());
      localStorage.setItem(STORAGE_KEY_SCHEDULED_TASKS, JSON.stringify(list));
    } catch (_) {}
  }

  /**
   * Schedule a one-time or recurring reminder
   */
  scheduleReminder({ id = `reminder_${Date.now()}`, time, title, tag = 'Cristi', action = null }) {
    const task = {
      id: String(id),
      type: 'reminder',
      targetTime: time,
      title,
      tag,
      action,
      executed: false,
      approachingAlerted: false,
      createdAt: Date.now()
    };
    this.scheduledTasks.set(String(id), task);
    this.saveToStorage();
    logger.info('SCHEDULER', `Recordatorio programado "${title}" para las ${time}`);
    return task;
  }

  /**
   * Schedule an alarm
   */
  scheduleAlarm({ id = `alarm_${Date.now()}`, time, label = 'Alarma', action = null }) {
    const task = {
      id: String(id),
      type: 'alarm',
      targetTime: time,
      label,
      title: `Alarma: ${label}`,
      action,
      executed: false,
      approachingAlerted: false,
      createdAt: Date.now()
    };
    this.scheduledTasks.set(String(id), task);
    this.saveToStorage();
    logger.info('SCHEDULER', `Alarma programada "${label}" para las ${time}`);
    return task;
  }

  /**
   * Cancel or dismiss a scheduled task
   */
  cancelTask(id) {
    const strId = String(id);
    const deleted = this.scheduledTasks.delete(strId);
    this.saveToStorage();
    return deleted;
  }

  /**
   * Calculate minutes remaining until a given "HH:mm" time
   */
  calculateMinutesRemaining(targetTimeStr) {
    if (!targetTimeStr || typeof targetTimeStr !== 'string') return null;
    const parts = targetTimeStr.split(':');
    if (parts.length < 2) return null;
    const targetHour = parseInt(parts[0], 10);
    const targetMin = parseInt(parts[1], 10);
    if (isNaN(targetHour) || isNaN(targetMin)) return null;

    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setHours(targetHour, targetMin, 0, 0);

    let diffMs = targetDate.getTime() - now.getTime();
    if (diffMs < -60000) {
      targetDate.setDate(targetDate.getDate() + 1);
      diffMs = targetDate.getTime() - now.getTime();
    }

    return Math.round(diffMs / 60000);
  }

  /**
   * Get all upcoming tasks sorted by minutes remaining
   */
  getUpcomingTasks(withinMinutes = 180) {
    const list = [];
    for (const task of this.scheduledTasks.values()) {
      if (task.executed) continue;
      const minutesRemaining = this.calculateMinutesRemaining(task.targetTime);
      if (minutesRemaining !== null && minutesRemaining >= 0 && minutesRemaining <= withinMinutes) {
        list.push({
          ...task,
          minutesRemaining
        });
      }
    }
    return list.sort((a, b) => a.minutesRemaining - b.minutesRemaining);
  }

  /**
   * Generate contextual prompt for Gemini Live awareness
   */
  getPromptContext() {
    const upcoming = this.getUpcomingTasks(180);
    if (upcoming.length === 0) return '';

    const lines = upcoming.map((t) => {
      const kind = t.type === 'alarm' ? 'Alarma' : 'Recordatorio';
      const name = t.label || t.title;
      const minStr = t.minutesRemaining <= 0 ? '¡es ahora mismo!' : `faltan ${t.minutesRemaining} min`;
      return `- ${kind} "${name}" programada para las ${t.targetTime} (${minStr})`;
    });

    return `\n\n[ALARMAS Y RECORDATORIOS ACTIVOS EN EL SISTEMA:\n${lines.join('\n')}\nTen siempre presentes estas alarmas y fechas en tu conversación. Si falta poco tiempo para una de ellas (o es la hora), menciónaselo a tu usuario cariñosamente para que esté preparado.]`;
  }

  /**
   * Evaluate scheduled tasks every second
   */
  tick() {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    for (const [id, task] of this.scheduledTasks.entries()) {
      if (task.executed) continue;

      const minutesRemaining = this.calculateMinutesRemaining(task.targetTime);

      // 1. Approaching Alert (when <= 5 minutes away and not yet notified)
      if (minutesRemaining !== null && minutesRemaining > 0 && minutesRemaining <= 5 && !task.approachingAlerted) {
        task.approachingAlerted = true;
        this.saveToStorage();

        logger.info('SCHEDULER', `Alarma/Recordatorio "${task.label || task.title}" próxima a cumplirse (faltan ${minutesRemaining}m).`);
        eventBus.emit(EVENTS.ALARM_APPROACHING, { task, minutesRemaining });

        if (this.geminiSocket && this.geminiSocket.isConnected && typeof this.geminiSocket.sendTextMessage === 'function') {
          const kind = task.type === 'alarm' ? 'alarma' : 'recordatorio';
          const name = task.label || task.title;
          this.geminiSocket.sendTextMessage(`[AVISO PROACTIVO DE CRISTI: Tu ${kind} "${name}" está muy cerca de cumplirse (a las ${task.targetTime}, quedan ${minutesRemaining} minutos). Menciónaselo a tu usuario con dulzura, cariño y atención.]`);
        }
      }

      // 2. Alarm Triggered (exact time)
      if (task.targetTime === currentTimeStr) {
        task.executed = true;
        this.saveToStorage();

        if (task.type === 'reminder') {
          eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
            id: task.id,
            type: 'reminder',
            title: task.title,
            time: currentTimeStr,
            tag: task.tag,
            done: false
          });
          toastService.info('Recordatorio', task.title);
        } else if (task.type === 'alarm') {
          eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
            id: task.id,
            type: 'alarm',
            title: `Alarma: ${task.label}`,
            time: currentTimeStr,
            tag: 'Alarma',
            done: false
          });
          toastService.alarm(`Alarma: ${task.label}`, `¡Es la hora programada (${currentTimeStr})!`);
        }

        soundFxService.playNotification();
        eventBus.emit(EVENTS.ALARM_TRIGGERED, { task });

        if (this.geminiSocket && this.geminiSocket.isConnected && typeof this.geminiSocket.sendTextMessage === 'function') {
          const kind = task.type === 'alarm' ? 'alarma' : 'recordatorio';
          const name = task.label || task.title;
          this.geminiSocket.sendTextMessage(`[ALARMA/RECORDATORIO ACTIVADO AHORA: Tu ${kind} "${name}" se acaba de activar en este momento (${currentTimeStr}). Avísale a tu usuario en voz alta con dulzura y estilo propio.]`);
        }

        if (typeof task.action === 'function') {
          try {
            task.action(task);
          } catch (err) {
            logger.error('SCHEDULER', `Error al ejecutar acción de tarea programada ${id}:`, err);
          }
        }
      }
    }
  }

  destroy() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.scheduledTasks.clear();
  }
}

export const proactiveScheduler = new ProactiveScheduler();
export default proactiveScheduler;
