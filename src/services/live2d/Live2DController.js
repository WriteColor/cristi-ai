/**
 * Cristi AI - Live2D Behavioral Dynamics & Animation Controller
 * Coordinates biological idling, natural blinking, voice-reactive kinetics,
 * gaze tracking saccades, and affective gestures via the Live2DAdapter.
 */

import { eventBus, EVENTS } from '../eventBus';
import { live2dModelRegistry } from './Live2DModelRegistry';

export class Live2DController {
  constructor(adapter, modelId = 'yanderegirl') {
    this.adapter = adapter;
    this.modelId = modelId;
    this.isRunning = false;
    this.unsubscribeList = [];

    // State tracking
    this.currentEmotion = 'idle';
    this.isSpeaking = false;
    this.isListening = false;
    this.isUserSpeaking = false;

    // Gaze target (-1.0 to 1.0)
    this.targetGaze = { x: 0, y: 0 };
    this.currentGaze = { x: 0, y: 0 };

    // Blinking state machine
    this.blinkTimer = 0;
    this.nextBlinkInterval = 3000;
    this.blinkProgress = -1; // -1 = not blinking, 0.0 to 1.0 = in progress
    this.blinkDuration = 180; // ms

    // Expression lock: when a parameter-based expression is active, track which
    // parameter IDs should not be overwritten by the organic animation loop.
    // This prevents setEyes/setEyebrows/setMouth from undoing active expressions.
    this._expressionLockedParams = new Set();
    this._expressionLockExpiry = 0; // ms timestamp

    // Breathing accumulator
    this.breathTime = 0;
    this.breathSpeed = 1.6; // rad/s

    // Speech rhythm & dynamic bobbing
    this.speechHeadBob = 0;
    this.speechBodySway = 0;
    this.speechEnergyAccumulator = 0;

    // Saccades (natural micro eye jitter)
    this.saccadeOffset = { x: 0, y: 0 };
    this.saccadeTimer = 0;
    this.nextSaccadeInterval = 1200;

    this.bindEvents();
  }

  bindEvents() {
    this.unsubscribeList.push(
      // Real-time audio features
      eventBus.on(EVENTS.AUDIO_ANALYSIS, (metrics) => {
        this.onAudioAnalysis(metrics);
      }),

      // Speech lifecycle
      eventBus.on(EVENTS.SPEECH_START, () => {
        this.isSpeaking = true;
      }),
      eventBus.on(EVENTS.SPEECH_END, () => {
        this.isSpeaking = false;
        if (this.adapter) {
          this.adapter.setMouth(0, 0);
        }
      }),

      // User speech
      eventBus.on(EVENTS.USER_SPEAKING, () => {
        this.isUserSpeaking = true;
        if (this.adapter) {
          this.adapter.setHeadAngle(this.currentGaze.x * 12, this.currentGaze.y * 8 - 4, -4);
        }
      }),
      eventBus.on(EVENTS.USER_STOPPED_SPEAKING, () => {
        this.isUserSpeaking = false;
      }),

      // Emotion / Expression triggers
      eventBus.on(EVENTS.EMOTION_CHANGED, (emotion) => {
        this.setEmotion(emotion);
      }),

      // Gaze target updates
      eventBus.on(EVENTS.GAZE_TARGET_CHANGED, (target) => {
        this.setGazeTarget(target.x, target.y);
      })
    );
  }

  setModel(modelId, adapter) {
    this.modelId = modelId;
    if (adapter) this.adapter = adapter;
    this.setEmotion('idle');
  }

  setAdapter(adapter) {
    this.adapter = adapter;
  }

  setGazeTarget(normalizedX, normalizedY) {
    this.targetGaze.x = Math.min(Math.max(normalizedX, -1), 1);
    this.targetGaze.y = Math.min(Math.max(normalizedY, -1), 1);
  }

  /**
   * Set high-level affective emotion using model's semantic action resolver
   * @param {string} emotion 
   */
  setEmotion(emotion) {
    this.currentEmotion = (emotion || 'idle').toLowerCase();
    if (!this.adapter) return;

    // Reset neutral baseline first if switching back to idle
    if (this.currentEmotion === 'idle' || this.currentEmotion === 'none') {
      this.adapter.resetNeutralState();
      return;
    }

    // 1. Resolve semantic action for current active model
    const resolved = live2dModelRegistry.resolveSemanticAction(this.modelId, this.currentEmotion);

    if (resolved.type === 'expression' && resolved.name) {
      this.adapter.setExpression(resolved.name);
      // Expression via expressionManager — no parameter lock needed
      this._expressionLockedParams.clear();
      this._expressionLockExpiry = 0;
    } else if (resolved.type === 'parameters' && resolved.targets) {
      // Parameter-based expression: lock these IDs so the organic animation
      // loop doesn't overwrite them each frame.
      this._expressionLockedParams = new Set(Object.keys(resolved.targets));
      this._expressionLockExpiry = performance.now() + 8000; // 8 second lock
      for (const [pId, val] of Object.entries(resolved.targets)) {
        this.adapter.setDirectParamTarget(pId, val);
      }
    }

    // 2. Apply gentle emotional visual overlays (blush, eyebrows, eyes) respecting model mapping
    switch (this.currentEmotion) {
      case 'happy':
      case 'smile':
        this.adapter.setCheeks(0.6);
        this.adapter.setEyes(0.9, 0.9, 0.8, 0.8, 0, 0);
        this.adapter.setEyebrows(0.3, 0.3, 0.2, 0.2, 0.5, 0.5);
        this.adapter.setMouth(0, 0.8);
        break;
      case 'blush':
        this.adapter.setCheeks(1.0);
        this.adapter.setEyebrows(0.2, 0.2, 0.1, 0.1, 0.4, 0.4);
        this.adapter.setEyes(0.85, 0.85, 0.5, 0.5, 0, 0);
        break;
      case 'wink':
        this.adapter.setCheeks(0.7);
        this.adapter.setEyes(1.0, 0.0, 0.2, 1.0, 0, 0);
        break;
      case 'yandere':
      case 'crazy':
        this.adapter.setCheeks(0.8);
        this.adapter.setEyebrows(-0.3, -0.3, -0.4, -0.4, 0.6, 0.6);
        break;
      case 'mad':
      case 'pout':
      case 'angry':
        this.adapter.setCheeks(0.5);
        this.adapter.setEyebrows(-0.6, -0.6, -0.6, -0.6, -0.4, -0.4);
        this.adapter.setMouth(0, -0.5);
        break;
      case 'surprised':
      case 'scared':
        this.adapter.setEyes(1.0, 1.0, 0, 0, 0, 0);
        this.adapter.setEyebrows(0.7, 0.7, 0.4, 0.4, 0.2, 0.2);
        break;
      case 'sad':
        this.adapter.setEyebrows(-0.5, -0.5, 0.4, 0.4, -0.5, -0.5);
        this.adapter.setMouth(0, -0.6);
        break;
      default:
        break;
    }
  }

  onAudioAnalysis(metrics) {
    if (!this.adapter) return;

    // 1. Direct proportional Lip-Sync & Formant shape
    this.adapter.setMouth(metrics.mouthOpen, metrics.mouthForm);

    // 2. Speech energy kinetics: accumulate small head bobs and body sways
    if (metrics.isSpeaking) {
      this.speechEnergyAccumulator += metrics.volume * 0.4;
      
      // If peak energy detected (emphasis word), trigger a gentle nod
      if (metrics.isPeakEnergy) {
        this.speechHeadBob = -6.0;
        this.speechBodySway = (Math.random() - 0.5) * 3.5;
      }
    }
  }

  /**
   * Main update tick called by requestAnimationFrame / Pixi Ticker
   * @param {number} deltaMs - Elapsed milliseconds
   */
  update(deltaMs) {
    if (!this.adapter) return;

    const deltaSec = deltaMs / 1000;
    const modelCaps = live2dModelRegistry.getCapabilities(this.modelId);

    // ── 1. Biological Breathing ─────────────────────────────────────────────
    if (modelCaps.breathing) {
      this.breathTime += deltaSec * this.breathSpeed;
      const breathVal = (Math.sin(this.breathTime) + 1) * 0.5; // 0.0 to 1.0
      this.adapter.setBreath(breathVal);
    }

    // ── 2. Natural Autonomous Eye Blinking ──────────────────────────────────
    if (modelCaps.eyeBlink) {
      this.blinkTimer += deltaMs;
      if (this.blinkProgress < 0 && this.blinkTimer >= this.nextBlinkInterval) {
        // Start blink
        this.blinkProgress = 0;
        this.blinkTimer = 0;
        this.nextBlinkInterval = 2500 + Math.random() * 3500; // 2.5s - 6s
      }

      let eyeOpenL = 1.0;
      let eyeOpenR = 1.0;

      if (this.blinkProgress >= 0) {
        this.blinkProgress += deltaMs / this.blinkDuration;
        if (this.blinkProgress >= 1.0) {
          this.blinkProgress = -1; // Finished
        } else {
          // Sine curve for smooth closing and opening
          const p = this.blinkProgress;
          const blinkFactor = p < 0.5 ? 1.0 - p * 2.0 : (p - 0.5) * 2.0;
          eyeOpenL = Math.max(0, Math.min(1, blinkFactor));
          eyeOpenR = Math.max(0, Math.min(1, blinkFactor));
        }
      }

      // If winking, keep right eye shut
      if (this.currentEmotion === 'wink') {
        eyeOpenR = 0;
      }

      // Only call setEyes if the eye open/smile params are not expression-locked
      const now = performance.now();
      const lockActive = this._expressionLockExpiry > now;
      if (lockActive) {
        // Clear expired lock
        if (this._expressionLockExpiry <= now) {
          this._expressionLockedParams.clear();
          this._expressionLockExpiry = 0;
        }
      }
      const eyeParamLocked = lockActive && (
        this._expressionLockedParams.has('ParamEyeLOpen') ||
        this._expressionLockedParams.has('ParamEyeROpen') ||
        this._expressionLockedParams.has('ParamEyeLSmile') ||
        this._expressionLockedParams.has('ParamEyeRSmile')
      );
      if (!eyeParamLocked) {
        this.adapter.setEyes(
          eyeOpenL,
          eyeOpenR,
          this.currentEmotion === 'happy' ? 0.8 : 0,
          this.currentEmotion === 'happy' || this.currentEmotion === 'wink' ? 0.8 : 0,
          this.currentGaze.x + this.saccadeOffset.x,
          this.currentGaze.y + this.saccadeOffset.y
        );
      } else {
        // Only update eyeball tracking, not the open/smile values
        this.adapter.setCapabilityTarget('eye_ball_x', this.currentGaze.x + this.saccadeOffset.x);
        this.adapter.setCapabilityTarget('eye_ball_y', this.currentGaze.y + this.saccadeOffset.y);
      }
    }

    // ── 3. Eye Saccades (Micro-jitter avoiding dead stare) ─────────────────
    this.saccadeTimer += deltaMs;
    if (this.saccadeTimer >= this.nextSaccadeInterval) {
      this.saccadeTimer = 0;
      this.nextSaccadeInterval = 800 + Math.random() * 1800;
      this.saccadeOffset = {
        x: (Math.random() - 0.5) * 0.08,
        y: (Math.random() - 0.5) * 0.06
      };
    }

    // ── 4. Smooth Gaze & Head Orientation ─────────────────────────────────
    const gazeLerp = Math.min(deltaSec * 5.0, 1.0);
    this.currentGaze.x += (this.targetGaze.x - this.currentGaze.x) * gazeLerp;
    this.currentGaze.y += (this.targetGaze.y - this.currentGaze.y) * gazeLerp;

    // Decay speech head bob and body sway smoothly
    this.speechHeadBob += (0 - this.speechHeadBob) * (deltaSec * 8.0);
    this.speechBodySway += (0 - this.speechBodySway) * (deltaSec * 4.0);

    const headAngleX = this.currentGaze.x * 24;
    const headAngleY = this.currentGaze.y * 18 + this.speechHeadBob;
    const headAngleZ = this.currentGaze.x * -6 + (this.isUserSpeaking ? -4 : 0);

    this.adapter.setHeadAngle(headAngleX, headAngleY, headAngleZ);

    // ── 5. Body Sway and Torso Tracking ────────────────────────────────────
    if (modelCaps.bodyMovement) {
      const bodyAngleX = this.currentGaze.x * 7 + this.speechBodySway;
      const bodyAngleY = this.currentGaze.y * 5;
      const bodyAngleZ = this.currentGaze.x * -3;
      this.adapter.setBodyAngle(bodyAngleX, bodyAngleY, bodyAngleZ);
    }

    // ── 6. Push all smoothed targets into Cubism Core ──────────────────────
    // Expire lock if past time
    if (this._expressionLockExpiry > 0 && performance.now() > this._expressionLockExpiry) {
      this._expressionLockedParams.clear();
      this._expressionLockExpiry = 0;
    }
    this.adapter.update(deltaSec * 60.0);
  }

  destroy() {
    this.unsubscribeList.forEach((unsub) => unsub());
    this.unsubscribeList = [];
    this.adapter = null;
  }
}
