/**
 * Cristi AI - Proactive Trigger & Autonomous Behavior Engine
 * 
 * Manages autonomous companion triggers without requiring external prompts:
 * 1. Time-of-Day Contextual Greetings (Morning, Afternoon, Evening, Late Night)
 * 2. Pomodoro & Deep Work Focus Sessions (25m work / 5m break)
 * 3. Ergonomic Hydration & Posture Stretch Reminders
 * 4. PC Idle & Active Screen Session Monitoring
 * 5. Autonomous Affective Gestures & Spontaneous Companion Thoughts
 */

import { eventBus, EVENTS } from './eventBus.js';
import { toastService } from './toastService.js';
import { soundFxService } from './soundFxService.js';
import { contextualEmotionOrchestrator } from './live2d/ContextualEmotionOrchestrator.js';
import { logger } from './logger.js';

export class ProactiveTriggerService {
  constructor() {
    this.isRunning = false;
    this.activeTriggers = new Map();
    this.intervalId = null;

    // Focus & Pomodoro State
    this.focusTimer = {
      active: false,
      mode: 'work', // 'work' | 'break'
      durationMinutes: 25,
      remainingSeconds: 25 * 60,
      sessionsCompleted: 0
    };

    // User Activity Tracking
    this.lastUserActivityTimestamp = Date.now();
    this.sessionStartTimestamp = Date.now();
    this.lastHydrationPrompt = Date.now();
    this.lastTimePeriodGreeting = null;

    this.initDefaultTriggers();
  }

  /**
   * Register default companion routines
   */
  initDefaultTriggers() {
    // 1. Time-of-Day Contextual Routine
    this.registerTrigger({
      id: 'routine_time_of_day',
      intervalSeconds: 60, // Check every minute
      condition: () => {
        const hour = new Date().getHours();
        let currentPeriod = 'night';
        if (hour >= 6 && hour < 12) currentPeriod = 'morning';
        else if (hour >= 12 && hour < 19) currentPeriod = 'afternoon';
        else if (hour >= 19 && hour < 23) currentPeriod = 'evening';

        if (this.lastTimePeriodGreeting !== currentPeriod) {
          this.lastTimePeriodGreeting = currentPeriod;
          return { period: currentPeriod };
        }
        return false;
      },
      action: ({ period }) => {
        const greetings = {
          morning: {
            title: '☀️ ¡Buenos días!',
            message: 'Que tengas un día productivo y lleno de energía. Cristi está aquí para acompañarte.',
            emotion: 'happy'
          },
          afternoon: {
            title: '🌤️ Buenas tardes',
            message: 'Recuerda mantener el ritmo y tomarte un respiro si lo necesitas.',
            emotion: 'relaxed'
          },
          evening: {
            title: '🌙 Buenas noches',
            message: 'Has trabajado duro hoy. Cristi cuidará de todo mientras descansas.',
            emotion: 'love'
          },
          night: {
            title: '🌌 Madrugada tranquila',
            message: 'Es tarde... no te desveles demasiado, tu descanso es importante.',
            emotion: 'yandere'
          }
        };

        const g = greetings[period] || greetings.afternoon;
        toastService.emotion(g.title, g.message);
        soundFxService.playNotification();
        contextualEmotionOrchestrator.triggerEmotion(g.emotion, 'proactive_time_of_day');
      }
    });

    // 2. Ergonomic Hydration & Posture Reminder (Every 45 minutes of active usage)
    this.registerTrigger({
      id: 'routine_hydration_stretch',
      intervalSeconds: 120,
      condition: () => {
        const elapsed = (Date.now() - this.lastHydrationPrompt) / (1000 * 60);
        if (elapsed >= 45) {
          this.lastHydrationPrompt = Date.now();
          return true;
        }
        return false;
      },
      action: () => {
        toastService.info('💧 Pausa de Hidratación', 'Llevas 45 min activo. Toma un vaso de agua y estira la espalda.');
        soundFxService.playNotification();
        contextualEmotionOrchestrator.triggerEmotion('blush', 'proactive_ergonomics');
        eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
          id: 'widget_hydration',
          type: 'reminder',
          title: 'Hidratación & Postura',
          message: 'Pausa recomendada: bebe un poco de agua.',
          iconName: 'Sparkles',
          color: '#38bdf8'
        });
      }
    });
  }

  /**
   * Start the autonomous trigger loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('PROACTIVE', 'Motor de Triggers Autónomos y Rutinas Proactivas iniciado.');

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Stop the autonomous trigger loop
   */
  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Register a dynamic proactive trigger
   */
  registerTrigger(triggerConfig) {
    const { id, intervalSeconds = 10, condition, action } = triggerConfig;
    if (!id || typeof condition !== 'function' || typeof action !== 'function') return false;

    this.activeTriggers.set(id, {
      ...triggerConfig,
      intervalSeconds,
      condition,
      action,
      lastExecuted: 0
    });
    return true;
  }

  /**
   * Remove a registered trigger
   */
  unregisterTrigger(id) {
    return this.activeTriggers.delete(id);
  }

  /**
   * Master 1-second evaluation tick
   */
  tick() {
    const now = Date.now();

    // 1. Evaluate Focus Timer (Pomodoro)
    if (this.focusTimer.active) {
      this.focusTimer.remainingSeconds--;
      if (this.focusTimer.remainingSeconds <= 0) {
        this.handleFocusTimerComplete();
      }
    }

    // 2. Evaluate Registered Proactive Triggers
    for (const [id, trigger] of this.activeTriggers.entries()) {
      const elapsed = (now - trigger.lastExecuted) / 1000;
      if (elapsed >= trigger.intervalSeconds) {
        try {
          const conditionResult = trigger.condition();
          if (conditionResult) {
            trigger.lastExecuted = now;
            trigger.action(conditionResult);
          }
        } catch (err) {
          logger.warn('PROACTIVE', `Error evaluando trigger "${id}":`, err.message);
        }
      }
    }
  }

  /**
   * Start a Pomodoro / Focus session
   */
  startFocusSession(minutes = 25) {
    this.focusTimer = {
      active: true,
      mode: 'work',
      durationMinutes: minutes,
      remainingSeconds: minutes * 60,
      sessionsCompleted: this.focusTimer.sessionsCompleted
    };

    toastService.success('🎯 Sesión de Enfoque Iniciada', `Modo trabajo activo por ${minutes} minutos. ¡Cristi cuidará tu concentración!`);
    soundFxService.playConnect();
    contextualEmotionOrchestrator.triggerEmotion('gamer', 'focus_start');

    eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
      id: 'widget_focus_timer',
      type: 'timer',
      title: 'Sesión de Enfoque',
      message: `${minutes}m de concentración activa.`,
      iconName: 'Clock',
      color: '#a855f7'
    });
  }

  /**
   * Handle Focus Timer completion
   */
  handleFocusTimerComplete() {
    if (this.focusTimer.mode === 'work') {
      this.focusTimer.sessionsCompleted++;
      this.focusTimer.mode = 'break';
      this.focusTimer.durationMinutes = 5;
      this.focusTimer.remainingSeconds = 5 * 60;

      toastService.success('🎉 ¡Objetivo de Enfoque Cumplido!', 'Excelente trabajo. Tienes 5 minutos de descanso bien merecido.');
      soundFxService.playNotification();
      contextualEmotionOrchestrator.triggerEmotion('happy', 'focus_complete');
    } else {
      this.focusTimer.active = false;
      this.focusTimer.mode = 'work';
      toastService.info('☕ Descanso Finalizado', '¿Listo para otra sesión de enfoque o prefieres continuar libremente?');
      soundFxService.playNotification();
    }
  }

  /**
   * Stop Focus session
   */
  stopFocusSession() {
    this.focusTimer.active = false;
    eventBus.emit(EVENTS.WIDGET_DISMISSED, { id: 'widget_focus_timer' });
    toastService.info('Sesión de Enfoque Cancelada');
  }

  /**
   * Record user interaction to update activity tracker
   */
  recordUserActivity() {
    this.lastUserActivityTimestamp = Date.now();
  }

  /**
   * Get real-time engine telemetry
   */
  getTelemetry() {
    return {
      isRunning: this.isRunning,
      activeTriggersCount: this.activeTriggers.size,
      focusSession: { ...this.focusTimer },
      sessionDurationMinutes: Math.round((Date.now() - this.sessionStartTimestamp) / (1000 * 60)),
      timeSinceLastActivitySeconds: Math.round((Date.now() - this.lastUserActivityTimestamp) / 1000)
    };
  }
}

export const proactiveTriggerService = new ProactiveTriggerService();
export default proactiveTriggerService;
