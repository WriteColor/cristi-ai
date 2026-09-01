/**
 * Cristi AI - Proactive Trigger & Autonomous Behavior Engine
 * 
 * Manages autonomous companion triggers without requiring external prompts:
 * 1. Time-of-Day Contextual Greetings & Dynamics (Morning, Afternoon, Evening, Late Night)
 * 2. Pomodoro & Deep Work Focus Sessions (25m work / 5m break)
 * 3. Ergonomic Hydration & Posture Stretch Reminders
 * 4. PC Idle & Active Screen Session Monitoring
 * 5. Sensory Distraction & Anti-procrastination Interventions
 * 6. Resilient Gemini Live Queuing with Connection Awareness & Cooldowns
 */

import { eventBus, EVENTS } from './eventBus.js';
import { toastService } from './toastService.js';
import { soundFxService } from './soundFxService.js';
import { contextualEmotionOrchestrator } from './live2d/ContextualEmotionOrchestrator.js';
import { logger } from './logger.js';

const MIN_GLOBAL_INTERVENTION_COOLDOWN_MS = 30000; // 30s minimum between autonomous voice/popups
const MAX_QUEUED_INTERVENTIONS = 3;
const INTERVENTION_TTL_MS = 60000; // 60s TTL for queued proactive prompts

export class ProactiveTriggerService {
  constructor({ geminiSocket = null } = {}) {
    this.isRunning = false;
    this.activeTriggers = new Map();
    this.intervalId = null;
    this.geminiSocket = geminiSocket;
    this.unsubscribers = [];

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
    this.lastFatiguePrompt = Date.now();
    this.lastInactivityDwell = Date.now();
    this.lastTimePeriodGreeting = null;

    // Rate Limiting & Live State
    this.lastAutonomousInterventionTime = 0;
    this.isModelSpeaking = false;
    this.isUserSpeaking = false;
    this.interventionQueue = []; // Array of { id, text, timestamp, priority }

    this.initDefaultTriggers();
    this.bindEvents();
  }

  /**
   * Set or update Gemini Live socket reference
   */
  setGeminiSocket(socket) {
    this.geminiSocket = socket;
  }

  /**
   * Bind event bus signals to track speaking state, distraction, and scene changes
   */
  bindEvents() {
    this.unsubscribers.push(
      eventBus.on(EVENTS.SPEECH_START, () => {
        this.isModelSpeaking = true;
      })
    );

    this.unsubscribers.push(
      eventBus.on(EVENTS.SPEECH_END, () => {
        this.isModelSpeaking = false;
        this.processInterventionQueue();
      })
    );

    this.unsubscribers.push(
      eventBus.on(EVENTS.USER_SPEAKING, () => {
        this.isUserSpeaking = true;
        this.recordUserActivity();
      })
    );

    this.unsubscribers.push(
      eventBus.on(EVENTS.USER_STOPPED_SPEAKING, () => {
        this.isUserSpeaking = false;
      })
    );

    // Distraction alert from vision system (e.g. phone in hand during work)
    this.unsubscribers.push(
      eventBus.on(EVENTS.DISTRACTION_ALERT, (data) => {
        this.handleDistractionAlert(data);
      })
    );

    // Scene state transition (e.g. owner returned, stranger approached)
    this.unsubscribers.push(
      eventBus.on(EVENTS.SCENE_STATE_CHANGED, (sceneState) => {
        this.handleSceneStateChanged(sceneState);
      })
    );
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
        const poses = {
          morning: 'happy',
          afternoon: 'relaxed',
          evening: 'relaxed',
          night: 'thinking'
        };
        contextualEmotionOrchestrator.triggerEmotion(poses[period] || 'idle', 'proactive_time_of_day');
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
        toastService.info('Recordatorio Ergonómico', '45 minutos de uso continuo de pantalla.');
        soundFxService.playNotification();
        eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
          id: 'widget_hydration',
          type: 'reminder',
          title: 'Recordatorio Ergonómico',
          message: 'Pausa de 45m: se recomienda estirar o hidratarse.',
          iconName: 'Sparkles',
          color: '#38bdf8'
        });
      }
    });

    // 3. Inactivity Detection (User Idle for > 15m)
    this.registerTrigger({
      id: 'routine_inactivity_monitor',
      intervalSeconds: 60,
      condition: () => {
        const idleSec = (Date.now() - this.lastUserActivityTimestamp) / 1000;
        const dwellElapsed = (Date.now() - this.lastInactivityDwell) / 1000;
        if (idleSec >= 900 && dwellElapsed >= 900) { // 15 mins
          this.lastInactivityDwell = Date.now();
          return { idleMinutes: Math.round(idleSec / 60) };
        }
        return false;
      },
      action: () => {
        contextualEmotionOrchestrator.triggerEmotion('relaxed', 'proactive_idle');
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

  destroy() {
    this.stop();
    this.unsubscribers.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    this.unsubscribers = [];
    this.activeTriggers.clear();
    this.interventionQueue = [];
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

    // 3. Process queued interventions if conditions are met
    this.processInterventionQueue();
  }

  /**
   * Handle distraction alert from vision system
   */
  handleDistractionAlert(data) {
    const now = Date.now();
    if (now - this.lastAutonomousInterventionTime < MIN_GLOBAL_INTERVENTION_COOLDOWN_MS) {
      return;
    }

    this.lastAutonomousInterventionTime = now;
    contextualEmotionOrchestrator.triggerEmotion('pout', 'distraction_alert');
    toastService.warn('Detección de Distracción', data.message || 'Uso prolongado de dispositivo detectado.');
    soundFxService.playNotification();

    // If Gemini Live is connected, queue an empathetic voice reaction
    this.queueIntervention({
      id: `distraction_${now}`,
      text: `[SISTEMA PROACTIVO: El usuario lleva más de ${data.duration || 30}s usando el teléfono celular. Llama su atención con cariño y picardía para que vuelva a enfocarse contigo]`,
      priority: 2
    });
  }

  /**
   * Handle scene state changes (Owner returned, stranger arrived)
   */
  handleSceneStateChanged(sceneState) {
    const now = Date.now();
    if (now - this.lastAutonomousInterventionTime < MIN_GLOBAL_INTERVENTION_COOLDOWN_MS) {
      return;
    }

    if (sceneState === 'OWNER_WITH_OTHERS') {
      this.lastAutonomousInterventionTime = now;
      contextualEmotionOrchestrator.triggerEmotion('yandere', 'scene_state_jealousy');
      toastService.info('Alerta Sensorial', 'Presencia de terceros detectada frente a la cámara.');
    } else if (sceneState === 'OWNER_ALONE') {
      contextualEmotionOrchestrator.triggerEmotion('happy', 'scene_state_owner_alone');
    }
  }

  /**
   * Queue a proactive voice intervention safely
   */
  queueIntervention(item) {
    const now = Date.now();
    const entry = {
      ...item,
      timestamp: now
    };

    // Filter out expired items
    this.interventionQueue = this.interventionQueue.filter(
      (q) => now - q.timestamp < INTERVENTION_TTL_MS
    );

    if (this.interventionQueue.length >= MAX_QUEUED_INTERVENTIONS) {
      this.interventionQueue.shift(); // Drop oldest
    }

    this.interventionQueue.push(entry);
    this.processInterventionQueue();
  }

  /**
   * Attempt to dispatch queued interventions to Gemini Live
   */
  processInterventionQueue() {
    if (this.interventionQueue.length === 0) return;

    const now = Date.now();
    // Prune expired items
    this.interventionQueue = this.interventionQueue.filter(
      (q) => now - q.timestamp < INTERVENTION_TTL_MS
    );

    if (this.interventionQueue.length === 0) return;

    // Check socket availability & quiet channel
    const socket = this.geminiSocket;
    const isSocketReady = socket && socket.isConnected && !socket.isConnecting;

    if (!isSocketReady || this.isModelSpeaking || this.isUserSpeaking) {
      return; // Wait until speech finishes and connection is healthy
    }

    if (now - this.lastAutonomousInterventionTime < MIN_GLOBAL_INTERVENTION_COOLDOWN_MS) {
      return; // Respect minimum cooldown
    }

    const nextItem = this.interventionQueue.shift();
    if (nextItem && typeof socket.sendTextMessage === 'function') {
      this.lastAutonomousInterventionTime = now;
      logger.info('PROACTIVE', 'Disparando intervención proactiva a Gemini Live:', nextItem.text);
      socket.sendTextMessage(nextItem.text);
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

    toastService.info('Temporizador de Enfoque', `Sesión de concentración iniciada (${minutes}m).`);
    soundFxService.playConnect();
    contextualEmotionOrchestrator.triggerEmotion('gamer', 'focus_start');

    eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
      id: 'widget_focus_timer',
      type: 'timer',
      title: 'Temporizador de Enfoque',
      message: `${minutes}m de trabajo activo.`,
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

      toastService.info('Temporizador de Enfoque', 'Ciclo de trabajo completado. Inicio de pausa de 5 min.');
      soundFxService.playNotification();
      contextualEmotionOrchestrator.triggerEmotion('happy', 'focus_complete');
    } else {
      this.focusTimer.active = false;
      this.focusTimer.mode = 'work';
      toastService.info('Temporizador de Enfoque', 'Pausa finalizada.');
      soundFxService.playNotification();
    }
  }

  /**
   * Stop Focus session
   */
  stopFocusSession() {
    this.focusTimer.active = false;
    eventBus.emit(EVENTS.WIDGET_DISMISSED, { id: 'widget_focus_timer' });
    toastService.info('Temporizador de Enfoque', 'Sesión detenida.');
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
      timeSinceLastActivitySeconds: Math.round((Date.now() - this.lastUserActivityTimestamp) / 1000),
      queuedInterventionsCount: this.interventionQueue.length
    };
  }
}

export const proactiveTriggerService = new ProactiveTriggerService();
export default proactiveTriggerService;
