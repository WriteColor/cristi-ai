/**
 * Cristi AI - Proactive Scheduler & Task Manager
 * High-level orchestration for scheduled reminders, alarms, periodic health checks,
 * and autonomous companion routines.
 */

import { eventBus, EVENTS } from './eventBus.js';
import { logger } from './logger.js';

export class ProactiveScheduler {
  constructor() {
    this.scheduledTasks = new Map();
    this.checkIntervalId = null;
    this.init();
  }

  init() {
    if (typeof setInterval !== 'undefined') {
      this.checkIntervalId = setInterval(() => this.tick(), 1000);
    }
  }

  /**
   * Schedule a one-time or recurring reminder
   */
  scheduleReminder({ id = `reminder_${Date.now()}`, time, title, tag = 'Cristi', action = null }) {
    const task = {
      id,
      type: 'reminder',
      targetTime: time,
      title,
      tag,
      action,
      executed: false,
      createdAt: Date.now()
    };
    this.scheduledTasks.set(id, task);
    logger.info('SCHEDULER', `Recordatorio programado "${title}" para las ${time}`);
    return task;
  }

  /**
   * Schedule an alarm
   */
  scheduleAlarm({ id = `alarm_${Date.now()}`, time, label = 'Alarma', action = null }) {
    const task = {
      id,
      type: 'alarm',
      targetTime: time,
      label,
      action,
      executed: false,
      createdAt: Date.now()
    };
    this.scheduledTasks.set(id, task);
    logger.info('SCHEDULER', `Alarma programada "${label}" para las ${time}`);
    return task;
  }

  /**
   * Cancel a scheduled task
   */
  cancelTask(id) {
    return this.scheduledTasks.delete(id);
  }

  /**
   * Evaluate scheduled tasks every second
   */
  tick() {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    for (const [id, task] of this.scheduledTasks.entries()) {
      if (!task.executed && task.targetTime === currentTimeStr) {
        task.executed = true;

        if (task.type === 'reminder') {
          eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
            id: task.id,
            type: 'reminder',
            title: task.title,
            time: currentTimeStr,
            tag: task.tag,
            done: false
          });
        } else if (task.type === 'alarm') {
          eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
            id: task.id,
            type: 'alarm',
            title: `Alarma: ${task.label}`,
            time: currentTimeStr,
            tag: 'Alarma',
            done: false
          });
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
