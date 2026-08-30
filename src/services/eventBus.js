/**
 * Cristi AI - Decoupled Global Event Bus & Signal Hub
 * Enables high-performance, pub/sub reactive communication across AI, Audio,
 * Live2D Avatar, Hardware/Sensors, Game Integration, and UI layers.
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.historyBuffer = [];
    this.maxHistory = 100;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name (e.g. 'audio_start', 'speech_end', 'sensor_event')
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (typeof callback !== 'function') return () => {};

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event once
   * @param {string} event 
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).delete(callback);
    if (this.listeners.get(event).size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers with data
   * @param {string} event 
   * @param {any} data 
   */
  emit(event, data = null) {
    const timestamp = Date.now();
    const eventRecord = { event, data, timestamp };

    // Maintain circular debug buffer
    this.historyBuffer.push(eventRecord);
    if (this.historyBuffer.length > this.maxHistory) {
      this.historyBuffer.shift();
    }

    if (!this.listeners.has(event)) return;

    const handlers = Array.from(this.listeners.get(event));
    for (const handler of handlers) {
      try {
        handler(data, timestamp);
      } catch (err) {
        console.error(`[EventBus] Error in handler for event "${event}":`, err);
      }
    }
  }

  /**
   * Clear all listeners
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
  GAME_ACTION_REQUESTED: 'game_action_requested'
};
