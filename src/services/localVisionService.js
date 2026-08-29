/**
 * Cristi AI - Dual Local Vision & Anti-Procrastination Multi-Activity Engine
 * Integrates Object Detection (COCO-SSD) + Native MoveNet Pose Estimation in WebGL
 * to detect:
 * 1. Smartphone Usage via Wrist-to-Phone Euclidean Proximity
 * 2. Gaming (Controller / Remote detection)
 * 3. Reading Manga / Manhwa / Books (Book detection)
 * 4. Video / Anime Streaming (TV / Screen detection)
 * 5. Productive Work (Laptop / Keyboard / Focused Presence)
 */

import * as tf from '@tensorflow/tfjs-core';
import { loadGraphModel } from '@tensorflow/tfjs-converter';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { VISION_CONFIG } from '../config/visionConfig.js';
import { logger } from './logger.js';

// MoveNet Keypoint Index Mapping
const MOVENET_KEYPOINTS = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
];

export class LocalVisionService {
  constructor() {
    this.objectModel = null;
    this.movenetModel = null;
    this.isInitializing = false;
    this.isReady = false;

    // Tracking state
    this.phoneDetected = false;
    this.phoneInHand = false;
    this.activityDurationSeconds = 0;
    this.lastDetectionTime = 0;
    this.currentActivity = VISION_CONFIG.ACTIVITIES.PRODUCTIVE_WORK;
    this.lastAlertTime = 0;

    // Callbacks
    this.telemetryListeners = new Set();
    this.alertListeners = new Set();
    this.activityListeners = new Set();
  }

  /**
   * Initialize both vision models in WebGL
   */
  async initialize() {
    if (this.isReady || this.isInitializing) return;
    this.isInitializing = true;

    try {
      logger.info('VISION', 'Iniciando carga de modelos de visión local (COCO-SSD + MoveNet Pose)...');

      await tf.setBackend('webgl');
      await tf.ready();

      const [objModel, poseModel] = await Promise.all([
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
        loadGraphModel('https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4', { fromTFHub: true }).catch((e) => {
          logger.warn('VISION', `Aviso MoveNet online: ${e.message}`);
          return null;
        })
      ]);

      this.objectModel = objModel;
      this.movenetModel = poseModel;
      this.isReady = true;
      this.isInitializing = false;

      logger.info('VISION', '✅ Modelos de visión local y estimación de pose cargados exitosamente.');
    } catch (err) {
      this.isInitializing = false;
      logger.error('VISION', `Error inicializando visión local: ${err.message}`);
    }
  }

  onTelemetry(listener) {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  onAlert(listener) {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  onActivityChange(listener) {
    this.activityListeners.add(listener);
    return () => this.activityListeners.delete(listener);
  }

  /**
   * Classify Multi-Activity from detected objects and pose keypoints
   */
  classifyActivity({ objects, isPhoneInHand, hasPerson }) {
    if (!hasPerson) {
      return VISION_CONFIG.ACTIVITIES.USER_ABSENT;
    }

    if (isPhoneInHand) {
      return VISION_CONFIG.ACTIVITIES.PHONE_USAGE;
    }

    const classes = objects.map((o) => o.class.toLowerCase());

    if (classes.includes('remote') || classes.includes('joystick') || classes.includes('game controller')) {
      return VISION_CONFIG.ACTIVITIES.GAMING;
    }

    if (classes.includes('book')) {
      return VISION_CONFIG.ACTIVITIES.READING_MANGA;
    }

    if (classes.includes('tv') || classes.includes('television')) {
      return VISION_CONFIG.ACTIVITIES.WATCHING_ANIME;
    }

    if (classes.includes('laptop') || classes.includes('keyboard') || classes.includes('mouse')) {
      return VISION_CONFIG.ACTIVITIES.PRODUCTIVE_WORK;
    }

    return VISION_CONFIG.ACTIVITIES.PRODUCTIVE_WORK;
  }

  /**
   * Process a single video frame from camera
   */
  async processFrame(videoElement) {
    if (!this.isReady || !videoElement || videoElement.readyState < 2) {
      return null;
    }

    try {
      const videoWidth = videoElement.videoWidth || 640;
      const videoHeight = videoElement.videoHeight || 480;

      // 1. Detect Objects
      const objectsPromise = this.objectModel.detect(videoElement, 8, VISION_CONFIG.objectMinConfidence);

      // 2. Detect Pose Keypoints via MoveNet
      let poseKeypoints = null;
      if (this.movenetModel) {
        try {
          const tfImg = tf.browser.fromPixels(videoElement);
          const resized = tf.image.resizeBilinear(tfImg, [192, 192]);
          const casted = tf.cast(resized, 'int32');
          const expanded = tf.expandDims(casted, 0);

          const prediction = this.movenetModel.predict(expanded);
          const arrayData = await prediction.array();
          
          tfImg.dispose();
          resized.dispose();
          casted.dispose();
          expanded.dispose();
          prediction.dispose();

          if (arrayData && arrayData[0] && arrayData[0][0]) {
            poseKeypoints = arrayData[0][0].map((kp, idx) => ({
              name: MOVENET_KEYPOINTS[idx],
              y: kp[0] * videoHeight,
              x: kp[1] * videoWidth,
              score: kp[2]
            }));
          }
        } catch (_) {}
      }

      const objects = await objectsPromise;
      const now = Date.now();
      const elapsedSec = this.lastDetectionTime ? (now - this.lastDetectionTime) / 1000 : 0.1;
      this.lastDetectionTime = now;

      // Extract target objects
      const phoneDetections = objects.filter((o) => o.class === 'cell phone');

      // Extract wrists
      let leftWrist = null;
      let rightWrist = null;
      let closestDistance = Infinity;
      let closestWrist = null;
      let activePhone = null;

      if (poseKeypoints) {
        leftWrist = poseKeypoints.find((k) => k.name === 'left_wrist' && k.score > VISION_CONFIG.poseMinScore);
        rightWrist = poseKeypoints.find((k) => k.name === 'right_wrist' && k.score > VISION_CONFIG.poseMinScore);
      }

      // Calculate Euclidean distance between phone and wrists
      for (const phone of phoneDetections) {
        const [px, py, pw, ph] = phone.bbox;
        const phoneCenterX = px + pw / 2;
        const phoneCenterY = py + ph / 2;

        if (leftWrist) {
          const dist = Math.hypot(leftWrist.x - phoneCenterX, leftWrist.y - phoneCenterY);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestWrist = leftWrist;
            activePhone = { ...phone, centerX: phoneCenterX, centerY: phoneCenterY };
          }
        }

        if (rightWrist) {
          const dist = Math.hypot(rightWrist.x - phoneCenterX, rightWrist.y - phoneCenterY);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestWrist = rightWrist;
            activePhone = { ...phone, centerX: phoneCenterX, centerY: phoneCenterY };
          }
        }
      }

      const isPhoneInHand = activePhone !== null && closestDistance <= VISION_CONFIG.wristPhoneThresholdPx;
      const previousInHand = this.phoneInHand;
      this.phoneInHand = isPhoneInHand;
      this.phoneDetected = phoneDetections.length > 0;

      // Classify current activity
      const hasPerson = poseKeypoints !== null || objects.some((o) => o.class === 'person');
      const detectedActivity = this.classifyActivity({ objects, isPhoneInHand, hasPerson });
      const prevActivity = this.currentActivity;

      if (detectedActivity === prevActivity) {
        this.activityDurationSeconds += elapsedSec;
      } else {
        this.activityDurationSeconds = elapsedSec;
        this.currentActivity = detectedActivity;
        this.emitActivityChange(detectedActivity, prevActivity);
      }

      // Check alert conditions for different activities
      let shouldAlert = false;
      let alertCategory = null;

      if (detectedActivity === VISION_CONFIG.ACTIVITIES.PHONE_USAGE && this.activityDurationSeconds >= VISION_CONFIG.phoneUsageAlertSeconds) {
        shouldAlert = true;
        alertCategory = 'PHONE_USAGE';
      } else if (detectedActivity === VISION_CONFIG.ACTIVITIES.GAMING && this.activityDurationSeconds >= VISION_CONFIG.gamingAlertSeconds) {
        shouldAlert = true;
        alertCategory = 'GAMING';
      } else if (detectedActivity === VISION_CONFIG.ACTIVITIES.READING_MANGA && this.activityDurationSeconds >= VISION_CONFIG.readingMangaAlertSeconds) {
        shouldAlert = true;
        alertCategory = 'READING_MANGA';
      } else if (detectedActivity === VISION_CONFIG.ACTIVITIES.WATCHING_ANIME && this.activityDurationSeconds >= VISION_CONFIG.videoStreamingAlertSeconds) {
        shouldAlert = true;
        alertCategory = 'WATCHING_ANIME';
      }

      if (shouldAlert && now - this.lastAlertTime > VISION_CONFIG.distractionReminderIntervalSeconds * 1000) {
        this.lastAlertTime = now;
        this.emitAlert({
          type: detectedActivity,
          duration: Math.round(this.activityDurationSeconds),
          distancePx: closestDistance === Infinity ? null : Math.round(closestDistance),
          message: this.getRandomReaction(alertCategory)
        });
      }

      // Trigger back-to-work acknowledgment
      if (previousInHand && !isPhoneInHand && this.activityDurationSeconds > 4) {
        this.emitAlert({
          type: 'back_to_work',
          message: this.getRandomReaction('BACK_TO_WORK')
        });
      }

      const telemetry = {
        timestamp: now,
        objects,
        keypoints: poseKeypoints,
        phoneDetected: this.phoneDetected,
        phoneInHand: this.phoneInHand,
        closestDistance: closestDistance === Infinity ? null : Math.round(closestDistance),
        distanceThreshold: VISION_CONFIG.wristPhoneThresholdPx,
        activePhone,
        closestWrist,
        usageSeconds: Math.round(this.activityDurationSeconds),
        activity: detectedActivity,
        activityLabel: VISION_CONFIG.ACTIVITY_LABELS[detectedActivity] || detectedActivity
      };

      this.emitTelemetry(telemetry);
      return telemetry;
    } catch (_) {
      return null;
    }
  }

  getRandomReaction(category) {
    const list = VISION_CONFIG.REACTION_MESSAGES[category] || [];
    return list[Math.floor(Math.random() * list.length)] || '';
  }

  emitTelemetry(data) {
    for (const listener of this.telemetryListeners) {
      try { listener(data); } catch (_) {}
    }
  }

  emitAlert(data) {
    for (const listener of this.alertListeners) {
      try { listener(data); } catch (_) {}
    }
  }

  emitActivityChange(newActivity, prevActivity) {
    for (const listener of this.activityListeners) {
      try { listener(newActivity, prevActivity); } catch (_) {}
    }
  }

  dispose() {
    this.telemetryListeners.clear();
    this.alertListeners.clear();
    this.activityListeners.clear();
    if (this.movenetModel) {
      try { this.movenetModel.dispose(); } catch (_) {}
      this.movenetModel = null;
    }
    this.isReady = false;
  }
}

export const localVisionService = new LocalVisionService();
