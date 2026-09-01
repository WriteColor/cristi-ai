/**
 * Cristi Desktop - Live2D Motion Sync & Animation Queue Service 2.0
 * Manages motion group dispatching (e.g. 'Idle', 'Tap', 'Flick', 'MeiYan'), priority queues,
 * speech cadence synchronization, and cooldown throttles across all Live2D Cubism models.
 */

import { eventBus, EVENTS } from '../eventBus.js';
import { live2dModelRegistry } from './Live2DModelRegistry.js';
import { logger } from '../logger.js';

export class MotionSyncService {
  constructor(adapter, modelId = 'yanderegirl') {
    this.adapter = adapter;
    this.modelId = modelId;
    this.lastMotionTime = 0;
    this.motionCooldownMs = 1200;
    this.currentMotionGroup = null;
    this.unsubscribeList = [];

    this.bindEvents();
  }

  bindEvents() {
    this.unsubscribeList.push(
      eventBus.on(EVENTS.SPEECH_START, () => {
        this.onSpeechStart();
      }),
      eventBus.on(EVENTS.SPEECH_END, () => {
        this.onSpeechEnd();
      })
    );
  }

  setModel(modelId, adapter) {
    this.modelId = modelId;
    if (adapter) this.adapter = adapter;
    this.currentMotionGroup = null;
  }

  setAdapter(adapter) {
    this.adapter = adapter;
  }

  /**
   * Play motion group by name and index
   * @param {string} groupName 
   * @param {number} index 
   * @param {number} priority 
   * @returns {boolean}
   */
  playMotion(groupName, index = 0, priority = 2) {
    const now = performance.now();
    if (now - this.lastMotionTime < this.motionCooldownMs && priority < 3) {
      return false;
    }

    if (!this.adapter) return false;

    try {
      this.adapter.setMotionByGroup(groupName, index);
      this.lastMotionTime = now;
      this.currentMotionGroup = groupName;
      logger.info('AVATAR', `[MotionSync] Motion "${groupName}[${index}]" ejecutada en modelo ${this.modelId}.`);
      return true;
    } catch (err) {
      logger.warn('AVATAR', `[MotionSync] Error al reproducir motion "${groupName}": ${err.message}`);
      return false;
    }
  }

  onSpeechStart() {
    const profile = live2dModelRegistry.getModel(this.modelId);
    if (!profile) return;

    // Trigger subtle speaking posture motion if available
    const motions = profile.capabilities?.motions || [];
    if (motions.includes('talk') || motions.includes('speak')) {
      this.playMotion('Talk', 0, 1);
    }
  }

  onSpeechEnd() {
    this.currentMotionGroup = null;
  }

  destroy() {
    this.unsubscribeList.forEach((unsub) => unsub());
    this.unsubscribeList = [];
    this.adapter = null;
  }
}
