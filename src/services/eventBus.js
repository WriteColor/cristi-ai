/**
 * Cristi AI - Decoupled Global Event Bus & Signal Hub
 * Enables high-performance, pub/sub reactive communication across AI, Audio,
 * Live2D Avatar, Hardware/Sensors, Game Integration, and UI layers.
 * 
 * Features:
 * - Robust error isolation: Handler errors do not halt notification pipeline
 * - Zero-leak memory lifecycle: Sets auto-purged on empty, clean unsubscribers returned
 * - Stream-rate GC optimization: High-frequency events (60Hz) excluded from historyBuffer
 * - Safe iteration: Snapshot array iteration immune to subscriber mutations during emit
 */

const HIGH_FREQUENCY_STREAM_EVENTS = new Set([
  'audio_analysis',
  'audio_chunk',
  'parameter_changed',
  'gaze_target_changed',
  'vision_detections_updated'
]);

export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.historyBuffer = [];
    this.maxHistory = 100;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name (e.g. 'audio_start', 'speech_end', 'sensor_event')
   * @param {Function} callback - Handler function
   * @returns {Function} Clean unsubscribe function
   */
  on(event, callback) {
    if (!event || typeof callback !== 'function') return () => {};

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.off(event, callback);
    };
  }

  /**
   * Subscribe to an event once
   * @param {string} event 
   * @param {Function} callback 
   * @returns {Function} Clean unsubscribe function
   */
  once(event, callback) {
    if (!event || typeof callback !== 'function') return () => {};

    let executed = false;
    const wrapper = (data, timestamp) => {
      if (executed) return;
      executed = true;
      this.off(event, wrapper);
      try {
        callback(data, timestamp);
      } catch (err) {
        console.error(`[EventBus] Error in once-handler for event "${event}":`, err);
      }
    };

    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (!event || !this.listeners.has(event)) return;
    const set = this.listeners.get(event);
    set.delete(callback);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Alias for off()
   */
  removeListener(event, callback) {
    return this.off(event, callback);
  }

  /**
   * Remove all listeners for a given event, or all listeners if no event specified
   * @param {string} [event] 
   */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Check if any listeners exist for an event
   * @param {string} event 
   * @returns {boolean}
   */
  hasListeners(event) {
    return (this.listeners.get(event)?.size || 0) > 0;
  }

  /**
   * Count active listeners for an event
   * @param {string} event 
   * @returns {number}
   */
  listenerCount(event) {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * Get raw array of active listeners for an event
   * @param {string} event 
   * @returns {Array<Function>}
   */
  rawListeners(event) {
    const set = this.listeners.get(event);
    return set ? Array.from(set) : [];
  }

  /**
   * Emit an event to all subscribers with data
   * @param {string} event 
   * @param {any} data 
   */
  emit(event, data = null) {
    if (!event) return;
    const timestamp = Date.now();

    // Only record non-stream discrete events to debug history buffer (avoids GC churn)
    if (!HIGH_FREQUENCY_STREAM_EVENTS.has(event)) {
      this.historyBuffer.push({ event, data, timestamp });
      if (this.historyBuffer.length > this.maxHistory) {
        this.historyBuffer.shift();
      }
    }

    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    // Snapshot iteration to prevent concurrent modification bugs
    const handlers = Array.from(set);
    for (let i = 0; i < handlers.length; i++) {
      try {
        handlers[i](data, timestamp);
      } catch (err) {
        console.error(`[EventBus] Error in handler for event "${event}":`, err);
      }
    }
  }

  /**
   * Clear all listeners and history
   */
  clear() {
    this.listeners.clear();
    this.historyBuffer = [];
  }

  /**
   * Get recent event history
   * @param {number} count 
   * @returns {Array}
   */
  getHistory(count = 20) {
    return this.historyBuffer.slice(-count);
  }
}

// Global Singleton Instance
export const eventBus = new EventBus();

// Standard System Event Names Constants
export const EVENTS = {
  // Audio & Voice Lifecycle
  AUDIO_START: 'audio_start',
  AUDIO_CHUNK: 'audio_chunk',
  AUDIO_ANALYSIS: 'audio_analysis', // { volume, energy, mouthOpen, mouthForm, pitch, bands }
  AUDIO_END: 'audio_end',
  SPEECH_START: 'speech_start',
  SPEECH_END: 'speech_end',
  USER_SPEAKING: 'user_speaking',
  USER_STOPPED_SPEAKING: 'user_stopped_speaking',
  BARGE_IN_TRIGGERED: 'barge_in_triggered',

  // Live2D Avatar & Dynamics
  MODEL_LOADING: 'model_loading',
  MODEL_LOADED: 'model_loaded',
  MODEL_LOAD_FALLBACK: 'model_load_fallback',
  MODEL_LOAD_ERROR: 'model_load_error',
  MODEL_CHANGED: 'model_changed',
  EMOTION_CHANGED: 'emotion_changed',
  EXPRESSION_CHANGED: 'expression_changed',
  MOTION_REQUESTED: 'motion_requested',
  PARAMETER_CHANGED: 'parameter_changed',
  AVATAR_POSE_TRIGGERED: 'avatar_pose_triggered',
  GAZE_TARGET_CHANGED: 'gaze_target_changed',

  // Tool Calling & Agentic System
  TOOL_EXECUTION_START: 'tool_execution_start',
  TOOL_EXECUTION_END: 'tool_execution_end',
  SCREEN_WATCH_CHANGED: 'screen_watch_changed',
  SCREEN_REGION_CHANGED: 'screen_region_changed',

  // Sensory Vision & Anti-procrastination
  VISION_DETECTIONS_UPDATED: 'vision_detections_updated',
  DISTRACTION_ALERT: 'distraction_alert',
  SCENE_STATE_CHANGED: 'scene_state_changed',

  // External Hardware & IoT Sensors
  SENSOR_EVENT: 'sensor_event',
  EXTERNAL_DEVICE_EVENT: 'external_device_event',
  DEVICE_CONNECTED: 'device_connected',
  DEVICE_DISCONNECTED: 'device_disconnected',
  ACTUATOR_COMMAND: 'actuator_command',

  // Video Games & Minecraft Integration
  GAME_EVENT: 'game_event',
  GAME_STATE_CHANGED: 'game_state_changed',
  GAME_ACTION_REQUESTED: 'game_action_requested',

  // Futuristic HUD Toast Notifications
  TOAST_TRIGGERED: 'toast_triggered',

  // Dynamic Desktop Tactical Widgets
  WIDGET_TRIGGERED: 'widget_triggered',
  WIDGET_DISMISSED: 'widget_dismissed'
};

export default eventBus;
