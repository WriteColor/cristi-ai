/**
 * Cristi Desktop - Live2D Behavioral Dynamics & Animation Controller 2.0
 * Coordinates biological idling, stochastic multi-wave breathing, reactive pupil kinetics,
 * gaze tracking saccades, harmonic pendulum physics, and affective Bezier gestures via Live2DAdapter.
 */

import { eventBus, EVENTS } from '../eventBus.js';
import { live2dModelRegistry } from './Live2DModelRegistry.js';
import { Live2DPhysicsEngine } from './Live2DPhysicsEngine.js';

export class Live2DController {
  constructor(adapter, modelId = 'yanderegirl') {
    this.adapter = adapter;
    this.modelId = modelId;
    this.isRunning = false;
    this.unsubscribeList = [];

    // Kinetic Physics Engine 2.0
    this.physicsEngine = new Live2DPhysicsEngine();

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

    // Reactive Pupil & Eye Aperture state
    this.pupilAperture = 1.0; // 0.8 (focused/narrow) to 1.15 (excited/wide)
    this.targetPupilAperture = 1.0;

    // Expression lock
    this._expressionLockedParams = new Set();
    this._expressionLockExpiry = 0; // ms timestamp

    // Stochastic Breathing (Multi-Wave Composite)
    this.breathTime = 0;
    this.breathBaseSpeed = 1.45; // rad/s (~14 breaths per minute)
    this.breathDepthModifier = 1.0;
    this.sighTimer = 0;
    this.nextSighInterval = 22000; // 22s - 45s between deep breaths

    // Speech rhythm & dynamic bobbing
    this.speechHeadBob = 0;
    this.speechBodySway = 0;
    this.speechEnergyAccumulator = 0;

    // Saccades (Natural Micro-Jitter)
    this.saccadeOffset = { x: 0, y: 0 };
    this.saccadeTimer = 0;
    this.nextSaccadeInterval = 1200;

    // Initialize physics if adapter is already present
    if (this.adapter?.model?.internalModel?.coreModel) {
      const profile = live2dModelRegistry.getModel(this.modelId);
      this.physicsEngine.bindModel(this.adapter.model.internalModel.coreModel, profile);
    }

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
    if (this.adapter?.model?.internalModel?.coreModel) {
      const profile = live2dModelRegistry.getModel(this.modelId);
      this.physicsEngine.bindModel(this.adapter.model.internalModel.coreModel, profile);
    }
    this.setEmotion('idle');
  }

  setAdapter(adapter) {
    this.adapter = adapter;
    if (this.adapter?.model?.internalModel?.coreModel) {
      const profile = live2dModelRegistry.getModel(this.modelId);
      this.physicsEngine.bindModel(this.adapter.model.internalModel.coreModel, profile);
    }
  }

  setGazeTarget(normalizedX, normalizedY) {
    this.targetGaze.x = Math.min(Math.max(normalizedX, -1), 1);
    this.targetGaze.y = Math.min(Math.max(normalizedY, -1), 1);
  }

  /**
   * Set high-level affective emotion with smooth Cubic Bezier parameter blending
   * @param {string} emotion 
   */
  setEmotion(emotion) {
    this.currentEmotion = (emotion || 'idle').toLowerCase();
    if (!this.adapter) return;

    // Reset neutral baseline first if switching back to idle
    if (this.currentEmotion === 'idle' || this.currentEmotion === 'none') {
      this.adapter.resetNeutralState();
      this.targetPupilAperture = 1.0;
      return;
    }

    // 1. Resolve semantic action for current active model
    const resolved = live2dModelRegistry.resolveSemanticAction(this.modelId, this.currentEmotion);

    if (resolved.type === 'expression' && resolved.name) {
      this.adapter.setExpression(resolved.name);
      this._expressionLockedParams.clear();
      this._expressionLockExpiry = 0;
    } else if (resolved.type === 'parameters' && resolved.targets) {
      // Parameter-based expression: smooth Bezier blend
      this._expressionLockedParams = new Set(Object.keys(resolved.targets));
      this._expressionLockExpiry = performance.now() + 8000;
      for (const [pId, val] of Object.entries(resolved.targets)) {
        this.adapter.setBezierTarget(pId, val, 450);
      }
    }

    // 2. Affective visual overlays & reactive pupil dilation
    switch (this.currentEmotion) {
      case 'love':
        this.adapter.setCheeks(1.0);
        this.adapter.setEyes(0.95, 0.95, 0.9, 0.9, 0, 0);
        this.adapter.setEyebrows(0.3, 0.3, 0.2, 0.2, 0.4, 0.4);
        this.targetPupilAperture = 1.15;
        break;
      case 'happy':
      case 'smile':
        this.adapter.setCheeks(0.6);
        this.adapter.setEyes(0.9, 0.9, 0.8, 0.8, 0, 0);
        this.adapter.setEyebrows(0.3, 0.3, 0.2, 0.2, 0.5, 0.5);
        this.targetPupilAperture = 1.05;
        break;
      case 'blush':
      case 'shy':
        this.adapter.setCheeks(1.0);
        this.adapter.setEyebrows(0.2, 0.2, 0.1, 0.1, 0.4, 0.4);
        this.adapter.setEyes(0.85, 0.85, 0.5, 0.5, 0, 0);
        this.targetPupilAperture = 1.08;
        break;
      case 'wink':
        this.adapter.setCheeks(0.7);
        this.adapter.setEyes(1.0, 0.0, 0.2, 1.0, 0, 0);
        this.targetPupilAperture = 1.0;
        break;
      case 'yandere':
      case 'crazy':
        this.adapter.setCheeks(0.8);
        this.adapter.setEyebrows(-0.3, -0.3, -0.4, -0.4, 0.6, 0.6);
        this.targetPupilAperture = 1.25; // Dilated unhinged gaze
        break;
      case 'mad':
      case 'pout':
      case 'angry':
        this.adapter.setCheeks(0.5);
        this.adapter.setEyebrows(-0.6, -0.6, -0.6, -0.6, -0.4, -0.4);
        this.targetPupilAperture = 0.85; // Narrowed glare
        break;
      case 'surprised':
      case 'scared':
      case 'shock':
        this.adapter.setEyes(1.0, 1.0, 0, 0, 0, 0);
        this.adapter.setEyebrows(0.7, 0.7, 0.4, 0.4, 0.2, 0.2);
        this.targetPupilAperture = 1.20;
        break;
      case 'sad':
        this.adapter.setEyebrows(-0.5, -0.5, 0.4, 0.4, -0.5, -0.5);
        this.adapter.setEyes(0.75, 0.75, 0, 0, 0, 0);
        this.targetPupilAperture = 0.92;
        break;
      case 'smug':
        this.adapter.setEyebrows(0.3, -0.1, 0.2, -0.2, 0.4, 0.1);
        this.adapter.setEyes(0.85, 0.95, 0.6, 0.2, 0, 0);
        this.adapter.setCheeks(0.3);
        this.targetPupilAperture = 1.0;
        break;
      case 'thinking':
      case 'curious':
        this.adapter.setEyebrows(0.3, -0.2, 0.2, -0.1, 0.2, -0.1);
        this.adapter.setHeadAngle(4, -4, -3);
        this.targetPupilAperture = 0.95;
        break;
      case 'gamer':
      case 'excited':
        this.adapter.setCheeks(0.5);
        this.adapter.setEyes(1.0, 1.0, 0.6, 0.6, 0, 0);
        this.adapter.setEyebrows(0.4, 0.4, 0.3, 0.3, 0.4, 0.4);
        this.targetPupilAperture = 1.12;
        break;
      case 'relaxed':
        this.adapter.setEyebrows(0, 0, 0, 0, 0, 0);
        this.adapter.setEyes(0.7, 0.7, 0.2, 0.2, 0, 0);
        this.adapter.setCheeks(0.2);
        this.targetPupilAperture = 0.95;
        break;
      default:
        break;
    }
  }

  onAudioAnalysis(metrics) {
    if (!this.adapter) return;

    // 1. High-precision spectral multi-band Lip-Sync
    this.adapter.setMouth(metrics.mouthOpen, metrics.mouthForm);

    // 2. Voice energy kinetics & reactive pupil dilation
    if (metrics.isSpeaking) {
      this.speechEnergyAccumulator += metrics.volume * 0.4;
      this.targetPupilAperture = 1.0 + Math.min(metrics.volume * 0.25, 0.2);

      // Emphatic speech peak triggers a subtle biological nod & sway
      if (metrics.isPeakEnergy) {
        this.speechHeadBob = -5.0;
        this.speechBodySway = (Math.random() - 0.5) * 3.0;
      }
    } else {
      this.targetPupilAperture = 1.0;
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

    // ── 1. Biological Stochastic Multi-Wave Breathing ────────────────────────
    if (modelCaps.breathing) {
      this.breathTime += deltaSec * this.breathBaseSpeed;
      
      // Composite multi-harmonic wave
      const baseWave = Math.sin(this.breathTime);
      const subHarmonic = Math.sin(this.breathTime * 0.45 + 1.2) * 0.20;
      const microJitter = Math.sin(this.breathTime * 2.8) * 0.05;

      // Periodic natural deep breath / sigh
      this.sighTimer += deltaMs;
      if (this.sighTimer >= this.nextSighInterval) {
        this.sighTimer = 0;
        this.nextSighInterval = 20000 + Math.random() * 25000; // 20-45s
        this.breathDepthModifier = 1.55;
      }
      this.breathDepthModifier += (1.0 - this.breathDepthModifier) * (deltaSec * 0.7);

      const rawBreath = ((baseWave + subHarmonic + microJitter) * 0.5 + 0.5) * this.breathDepthModifier;
      const breathVal = Math.max(0, Math.min(1.0, rawBreath));
      this.adapter.setBreath(breathVal);
    }

    // ── 2. Natural Autonomous Eye Blinking & Reactive Pupil Kinetics ─────────
    // Smooth pupil aperture towards target
    this.pupilAperture += (this.targetPupilAperture - this.pupilAperture) * (deltaSec * 4.0);

    if (modelCaps.eyeBlink) {
      this.blinkTimer += deltaMs;
      if (this.blinkProgress < 0 && this.blinkTimer >= this.nextBlinkInterval) {
        this.blinkProgress = 0;
        this.blinkTimer = 0;
        this.nextBlinkInterval = 2500 + Math.random() * 3500;
      }

      let eyeOpenL = this.pupilAperture;
      let eyeOpenR = this.pupilAperture;

      if (this.blinkProgress >= 0) {
        this.blinkProgress += deltaMs / this.blinkDuration;
        if (this.blinkProgress >= 1.0) {
          this.blinkProgress = -1;
        } else {
          const p = this.blinkProgress;
          const blinkFactor = p < 0.5 ? 1.0 - p * 2.0 : (p - 0.5) * 2.0;
          eyeOpenL = Math.max(0, Math.min(1, blinkFactor * this.pupilAperture));
          eyeOpenR = Math.max(0, Math.min(1, blinkFactor * this.pupilAperture));
        }
      }

      if (this.currentEmotion === 'wink') {
        eyeOpenR = 0;
      }

      const now = performance.now();
      const lockActive = this._expressionLockExpiry > now;
      if (lockActive && this._expressionLockExpiry <= now) {
        this._expressionLockedParams.clear();
        this._expressionLockExpiry = 0;
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
        this.adapter.setCapabilityTarget('eye_ball_x', this.currentGaze.x + this.saccadeOffset.x);
        this.adapter.setCapabilityTarget('eye_ball_y', this.currentGaze.y + this.saccadeOffset.y);
      }
    }

    // ── 3. Eye Micro-Saccades (Organic Human Jitter) ─────────────────────────
    this.saccadeTimer += deltaMs;
    if (this.saccadeTimer >= this.nextSaccadeInterval) {
      this.saccadeTimer = 0;
      this.nextSaccadeInterval = 750 + Math.random() * 1600;
      this.saccadeOffset = {
        x: (Math.random() - 0.5) * 0.075,
        y: (Math.random() - 0.5) * 0.055
      };
    }

    // ── 4. Smooth Gaze & Head Orientation ─────────────────────────────────
    const gazeLerp = Math.min(deltaSec * 5.5, 1.0);
    this.currentGaze.x += (this.targetGaze.x - this.currentGaze.x) * gazeLerp;
    this.currentGaze.y += (this.targetGaze.y - this.currentGaze.y) * gazeLerp;

    this.speechHeadBob += (0 - this.speechHeadBob) * (deltaSec * 8.0);
    this.speechBodySway += (0 - this.speechBodySway) * (deltaSec * 4.0);

    const headAngleX = this.currentGaze.x * 24;
    const headAngleY = this.currentGaze.y * 18 + this.speechHeadBob;
    const headAngleZ = this.currentGaze.x * -6 + (this.isUserSpeaking ? -4 : 0);

    this.adapter.setHeadAngle(headAngleX, headAngleY, headAngleZ);

    // ── 5. Body Sway and Torso Tracking ────────────────────────────────────
    let bodyAngleX = 0;
    let bodyAngleY = 0;
    let bodyAngleZ = 0;

    if (modelCaps.bodyMovement) {
      bodyAngleX = this.currentGaze.x * 7 + this.speechBodySway;
      bodyAngleY = this.currentGaze.y * 5;
      bodyAngleZ = this.currentGaze.x * -3;
      this.adapter.setBodyAngle(bodyAngleX, bodyAngleY, bodyAngleZ);
    }

    // ── 6. Kinetic Physics Engine 2.0 Simulation ───────────────────────────
    this.physicsEngine.update(
      deltaSec,
      {
        headX: headAngleX,
        headY: headAngleY,
        headZ: headAngleZ,
        bodyX: bodyAngleX,
        bodyY: bodyAngleY,
        bodyZ: bodyAngleZ
      },
      (paramId, value) => {
        this.adapter.setDirectParamTarget(paramId, value);
      }
    );

    // ── 7. Push all smoothed targets into Cubism Core ──────────────────────
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

