/**
 * Cristi AI - Dual Local Vision & Anti-Procrastination Multi-Activity Engine (TypeScript)
 * Integrates Object Detection (COCO-SSD) + Native MoveNet Pose Estimation in WebGL
 * to detect:
 * 1. Smartphone Usage via Wrist-to-Phone Euclidean Proximity
 * 2. Gaming (Controller / Remote detection)
 * 3. Reading Manga / Manhwa / Books (Book detection)
 * 4. Video / Anime Streaming (TV / Screen detection)
 * 5. Productive Work (Laptop / Keyboard / Focused Presence)
 */

import { VISION_CONFIG } from '../../config/visionConfig';
import { logger } from '../../infrastructure/logging/logger';

// MoveNet Keypoint Index Mapping
export const MOVENET_KEYPOINTS = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
] as const;

export interface PoseKeypoint {
  name: string;
  y: number;
  x: number;
  score: number;
}

export interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number];
  centerX?: number;
  centerY?: number;
}

export interface VisionTelemetryData {
  timestamp: number;
  objects: DetectedObject[];
  keypoints: PoseKeypoint[] | null;
  phoneDetected: boolean;
  phoneInHand: boolean;
  closestDistance: number | null;
  distanceThreshold: number;
  activePhone: DetectedObject | null;
  closestWrist: PoseKeypoint | null;
  usageSeconds: number;
  activity: string;
  activityLabel: string;
}

export interface VisionAlertData {
  type: string;
  duration?: number;
  distancePx?: number | null;
  message: string;
}

type TfModule = typeof import('@tensorflow/tfjs-core') & {
  env?: () => { set: (key: string, value: unknown) => void };
  ready?: () => Promise<void>;
  setBackend?: (backendName: string) => Promise<boolean>;
};

type CocoSsdModel = {
  detect: (img: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, maxNumBoxes?: number, minScore?: number) => Promise<DetectedObject[]>;
  dispose?: () => void;
};

type MoveNetGraphModel = {
  predict: (input: unknown) => { array: () => Promise<number[][][][]>; dispose?: () => void };
  dispose?: () => void;
};

export class LocalVisionService {
  private tf: TfModule | null = null;
  public objectModel: CocoSsdModel | null = null;
  public movenetModel: MoveNetGraphModel | null = null;
  public isInitializing = false;
  public isReady = false;

  // Tracking state
  public phoneDetected = false;
  public phoneInHand = false;
  public activityDurationSeconds = 0;
  public lastDetectionTime = 0;
  public currentActivity: string = VISION_CONFIG.ACTIVITIES.PRODUCTIVE_WORK;
  public lastAlertTime = 0;

  // Callbacks
  private telemetryListeners = new Set<(data: VisionTelemetryData) => void>();
  private alertListeners = new Set<(data: VisionAlertData) => void>();
  private activityListeners = new Set<(newActivity: string, prevActivity: string) => void>();

  /**
   * Initialize both vision models in WebGL via lazy dynamic imports (bundle splitting Q-03)
   */
  public async initialize(): Promise<void> {
    if (this.isReady || this.isInitializing) return;
    this.isInitializing = true;

    try {
      const [tfCore, tfConverter, cocoSsdModule] = await Promise.all([
        import('@tensorflow/tfjs-core') as Promise<TfModule>,
        import('@tensorflow/tfjs-converter'),
        import('@tensorflow-models/coco-ssd'),
        import('@tensorflow/tfjs-backend-webgl')
      ]);

      this.tf = tfCore;
      const loadGraphModel = tfConverter.loadGraphModel;

      logger.info('VISION', 'Iniciando carga de modelos de visión local (COCO-SSD + MoveNet Pose)...');

      if (this.tf.setBackend) {
        await this.tf.setBackend('webgl');
      }
      if (this.tf.env) {
        this.tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
        this.tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        this.tf.env().set('WEBGL_PACK', true);
      }
      if (this.tf.ready) {
        await this.tf.ready();
      }

      const [objModel, poseModel] = await Promise.all([
        cocoSsdModule.load({ base: 'lite_mobilenet_v2' }),
        loadGraphModel('https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4', { fromTFHub: true }).catch((e: Error) => {
          logger.warn('VISION', `Aviso MoveNet online: ${e.message}`);
          return null;
        })
      ]);

      this.objectModel = objModel as unknown as CocoSsdModel;
      this.movenetModel = poseModel as unknown as MoveNetGraphModel | null;
      this.isReady = true;
      this.isInitializing = false;

      logger.info('VISION', 'Modelos de visión local y estimación de pose cargados exitosamente.');
    } catch (err) {
      this.isInitializing = false;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('VISION', `Error inicializando visión local: ${msg}`);
    }
  }

  public onTelemetry(listener: (data: VisionTelemetryData) => void): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  public onAlert(listener: (data: VisionAlertData) => void): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  public onActivityChange(listener: (newActivity: string, prevActivity: string) => void): () => void {
    this.activityListeners.add(listener);
    return () => this.activityListeners.delete(listener);
  }

  public classifyActivity({ objects, isPhoneInHand, hasPerson }: { objects: DetectedObject[]; isPhoneInHand: boolean; hasPerson: boolean }): string {
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

  public async processFrame(videoElement: HTMLVideoElement | null): Promise<VisionTelemetryData | null> {
    if (!this.isReady || !videoElement || videoElement.readyState < 2 || !this.objectModel) {
      return null;
    }

    try {
      const videoWidth = videoElement.videoWidth || 640;
      const videoHeight = videoElement.videoHeight || 480;

      // 1. Detect Objects
      const objectsPromise = this.objectModel.detect(videoElement, 8, VISION_CONFIG.objectMinConfidence);

      // 2. Detect Pose Keypoints via MoveNet
      let poseKeypoints: PoseKeypoint[] | null = null;
      if (this.movenetModel && this.tf) {
        let expanded: { dispose?: () => void } | null = null;
        let prediction: { array: () => Promise<number[][][][]>; dispose?: () => void } | null = null;
        try {
          const tf = this.tf;
          expanded = (tf as any).tidy(() => {
            const tfImg = (tf as any).browser.fromPixels(videoElement);
            const resized = (tf as any).image.resizeBilinear(tfImg, [192, 192]);
            const casted = (tf as any).cast(resized, 'int32');
            return (tf as any).expandDims(casted, 0);
          });

          if (expanded) {
            prediction = this.movenetModel.predict(expanded);
            const arrayData = await prediction.array();

            if (arrayData?.[0]?.[0]) {
              poseKeypoints = arrayData[0][0].map((kp: number[], idx: number) => ({
                name: MOVENET_KEYPOINTS[idx] || `point_${idx}`,
                y: kp[0] * videoHeight,
                x: kp[1] * videoWidth,
                score: kp[2]
              }));
            }
          }
        } catch (_) {
        } finally {
          if (expanded?.dispose) {
            try { expanded.dispose(); } catch (_) {}
          }
          if (prediction?.dispose) {
            try { prediction.dispose(); } catch (_) {}
          }
        }
      }

      const objects = await objectsPromise;
      const now = Date.now();
      const elapsedSec = this.lastDetectionTime ? (now - this.lastDetectionTime) / 1000 : 0.1;
      this.lastDetectionTime = now;

      // Extract target objects
      const phoneDetections = objects.filter((o) => o.class === 'cell phone');

      // Extract wrists
      let leftWrist: PoseKeypoint | null = null;
      let rightWrist: PoseKeypoint | null = null;
      let closestDistance = Infinity;
      let closestWrist: PoseKeypoint | null = null;
      let activePhone: DetectedObject | null = null;

      if (poseKeypoints) {
        leftWrist = poseKeypoints.find((k) => k.name === 'left_wrist' && k.score > VISION_CONFIG.poseMinScore) || null;
        rightWrist = poseKeypoints.find((k) => k.name === 'right_wrist' && k.score > VISION_CONFIG.poseMinScore) || null;
      }

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

      // Check alert conditions
      let shouldAlert = false;
      let alertCategory: string | null = null;

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

      if (shouldAlert && alertCategory && now - this.lastAlertTime > VISION_CONFIG.distractionReminderIntervalSeconds * 1000) {
        this.lastAlertTime = now;
        this.emitAlert({
          type: detectedActivity,
          duration: Math.round(this.activityDurationSeconds),
          distancePx: closestDistance === Infinity ? null : Math.round(closestDistance),
          message: this.getRandomReaction(alertCategory)
        });
      }

      // Back-to-work acknowledgment
      if (previousInHand && !isPhoneInHand && this.activityDurationSeconds > 4) {
        this.emitAlert({
          type: 'back_to_work',
          message: this.getRandomReaction('BACK_TO_WORK')
        });
      }

      const telemetry: VisionTelemetryData = {
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
        activityLabel: (VISION_CONFIG.ACTIVITY_LABELS as Record<string, string>)[detectedActivity] || detectedActivity
      };

      this.emitTelemetry(telemetry);
      return telemetry;
    } catch (_) {
      return null;
    }
  }

  public getRandomReaction(category: string): string {
    const list = (VISION_CONFIG.REACTION_MESSAGES as Record<string, readonly string[]>)[category] || [];
    return list[Math.floor(Math.random() * list.length)] || '';
  }

  private emitTelemetry(data: VisionTelemetryData): void {
    for (const listener of this.telemetryListeners) {
      try { listener(data); } catch (_) {}
    }
  }

  private emitAlert(data: VisionAlertData): void {
    for (const listener of this.alertListeners) {
      try { listener(data); } catch (_) {}
    }
  }

  private emitActivityChange(newActivity: string, prevActivity: string): void {
    for (const listener of this.activityListeners) {
      try { listener(newActivity, prevActivity); } catch (_) {}
    }
  }

  public getMemoryInfo(): unknown {
    try {
      if (this.tf && (this.tf as any).memory) {
        return (this.tf as any).memory();
      }
    } catch (_) {}
    return null;
  }

  public dispose(): void {
    this.telemetryListeners.clear();
    this.alertListeners.clear();
    this.activityListeners.clear();
    if (this.movenetModel?.dispose) {
      try { this.movenetModel.dispose(); } catch (_) {}
      this.movenetModel = null;
    }
    if (this.objectModel?.dispose) {
      try { this.objectModel.dispose(); } catch (_) {}
      this.objectModel = null;
    }
    this.isReady = false;
    this.isInitializing = false;
  }
}

export const localVisionService = new LocalVisionService();
export default localVisionService;
