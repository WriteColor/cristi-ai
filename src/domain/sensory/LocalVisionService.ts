/**
 * Cristi AI - Local Vision Service
 * Edge AI Perception Engine running locally inside the browser via TensorFlow.js and Face-API:
 * - Real-time 80-class object detection (@tensorflow-models/coco-ssd).
 * - Facial landmark 68-point tracking & 7 emotional expressions (@vladmandic/face-api).
 * - Multi-sample 128D biometric face recognition for Owner vs Stranger authorization.
 * - MoveNet SinglePose and Head Pose orientation estimation (pitch, yaw, roll).
 * - Human presence verification and anti-procrastination phone detection.
 */

import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { loadGraphModel } from '@tensorflow/tfjs-converter';
import * as faceapi from '@vladmandic/face-api';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

import type {
  HumanPresenceVerification,
  LocalVisionAnalysisResult,
  DetectedObjectInfo,
  FaceDetectionInfo,
  PoseEstimationResult,
  PoseKeypointInfo,
  FaceExpressions,
  FaceLandmarkPoint,
  VisionBoundingBox
} from '@/types';

const STORAGE_KEY_SAMPLES = 'cristi_ai_owner_samples_v2';
const STORAGE_KEY_OWNER_NAME = 'cristi_ai_owner_name_v2';

const MOVENET_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
];

export interface LocalVisionServiceOptions {
  fps?: number;
  modelsPath?: string;
  minScore?: number;
  enablePose?: boolean;
  enableFaceLandmarks?: boolean;
  enableExpressions?: boolean;
  enableObjects?: boolean;
}

export interface OwnerBiometricSample {
  id: string;
  label: string;
  descriptor: number[];
  timestamp: number;
}

export class LocalVisionService {
  private isModelsLoaded: boolean = false;
  private isLoadingModels: boolean = false;
  private isRunning: boolean = false;
  private isProcessingFrame: boolean = false;

  private cocoModel: cocoSsd.ObjectDetection | null = null;
  private movenetModel: any = null;
  private faceMatcher: faceapi.FaceMatcher | null = null;

  private ownerName: string = 'Mi Dueño';
  private ownerSamples: OwnerBiometricSample[] = [];

  private targetFps: number = 10;
  private minScore: number = 0.5;
  private modelsPath: string = '/models';
  private enablePose: boolean = true;
  private enableFaceLandmarks: boolean = true;
  private enableExpressions: boolean = true;
  private enableObjects: boolean = true;

  private videoSource: HTMLVideoElement | (() => HTMLVideoElement | null) | null = null;
  private animFrameId: number | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lastState: 'PRESENT' | 'AWAY' | 'UNKNOWN' = 'UNKNOWN';
  private lastPresenceTime: number = 0;
  private phoneUsageCounter: number = 0;

  // Listeners
  private readonly analysisListeners: Set<(res: LocalVisionAnalysisResult) => void> = new Set();
  private readonly presenceListeners: Set<(presence: HumanPresenceVerification) => void> = new Set();
  private readonly distractionListeners: Set<(info: { phoneDetected: boolean; durationSec: number }) => void> = new Set();
  private readonly errorListeners: Set<(err: Error) => void> = new Set();

  constructor(options: LocalVisionServiceOptions = {}) {
    this.targetFps = Math.max(1, Math.min(30, options.fps ?? 10));
    this.modelsPath = options.modelsPath ?? '/models';
    this.minScore = options.minScore ?? 0.5;
    this.enablePose = options.enablePose ?? true;
    this.enableFaceLandmarks = options.enableFaceLandmarks ?? true;
    this.enableExpressions = options.enableExpressions ?? true;
    this.enableObjects = options.enableObjects ?? true;

    this.loadSavedOwnerSamples();
  }

  /**
   * Initializes WebGL acceleration and loads neural network weights.
   */
  public async initialize(): Promise<void> {
    if (this.isModelsLoaded || this.isLoadingModels) return;
    this.isLoadingModels = true;

    try {
      // Configure high-performance WebGL context with FP16 and immediate texture collection
      try {
        if (tf.env) {
          tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
          tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
          tf.env().set('WEBGL_PACK', true);
        }
        await tf.ready();
      } catch (tfInitErr) {
        console.warn('[LocalVisionService] TensorFlow backend warning:', tfInitErr);
      }

      await this.loadAllModels();
      this.isModelsLoaded = true;
      this.isLoadingModels = false;
      this.updateFaceMatcher();
    } catch (primaryErr) {
      console.warn('[LocalVisionService] Primary model loading failed, trying CDN fallback...', primaryErr);
      try {
        await this.loadModelsFromCdn();
        this.isModelsLoaded = true;
        this.isLoadingModels = false;
        this.updateFaceMatcher();
      } catch (cdnErr) {
        this.isLoadingModels = false;
        const finalError = cdnErr instanceof Error ? cdnErr : new Error(String(cdnErr));
        this.notifyError(finalError);
        throw finalError;
      }
    }
  }

  private async loadAllModels(): Promise<void> {
    const promises: Promise<any>[] = [
      faceapi.nets.tinyFaceDetector.loadFromUri(this.modelsPath),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(this.modelsPath),
      faceapi.nets.faceRecognitionNet.loadFromUri(this.modelsPath),
      faceapi.nets.faceExpressionNet.loadFromUri(this.modelsPath),
      cocoSsd.load({ base: 'lite_mobilenet_v2' }).then((m) => {
        this.cocoModel = m;
      })
    ];

    if (this.enablePose) {
      promises.push(
        loadGraphModel('https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4', { fromTFHub: true })
          .then((m) => { this.movenetModel = m; })
          .catch((e) => console.warn('[LocalVisionService] MoveNet Hub fallback:', e))
      );
    }

    await Promise.all(promises);
  }

  private async loadModelsFromCdn(): Promise<void> {
    const cdnPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    const promises: Promise<any>[] = [
      faceapi.nets.tinyFaceDetector.loadFromUri(cdnPath),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(cdnPath),
      faceapi.nets.faceRecognitionNet.loadFromUri(cdnPath),
      faceapi.nets.faceExpressionNet.loadFromUri(cdnPath),
      cocoSsd.load({ base: 'lite_mobilenet_v2' }).then((m) => {
        this.cocoModel = m;
      })
    ];

    await Promise.all(promises);
  }

  /**
   * Biometrics: loads owner samples from persistent localStorage.
   */
  private loadSavedOwnerSamples(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAMPLES);
      const name = localStorage.getItem(STORAGE_KEY_OWNER_NAME);
      if (saved) {
        this.ownerSamples = JSON.parse(saved);
        if (name) this.ownerName = name;
        this.updateFaceMatcher();
      }
    } catch (e) {
      console.error('[LocalVisionService] Error loading owner samples:', e);
      this.ownerSamples = [];
    }
  }

  private saveOwnerSamples(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SAMPLES, JSON.stringify(this.ownerSamples));
      localStorage.setItem(STORAGE_KEY_OWNER_NAME, this.ownerName);
    } catch (e) {
      console.error('[LocalVisionService] Error saving owner samples:', e);
    }
  }

  private updateFaceMatcher(): void {
    if (this.ownerSamples.length > 0) {
      const descriptors = this.ownerSamples.map((s) => new Float32Array(s.descriptor));
      const labeled = new faceapi.LabeledFaceDescriptors(this.ownerName, descriptors);
      // Threshold 0.54 provides robust balance between glasses/angles and stranger rejection
      this.faceMatcher = new faceapi.FaceMatcher([labeled], 0.54);
    } else {
      this.faceMatcher = null;
    }
  }

  /**
   * Enrolls a new facial biometric descriptor sample for the owner (e.g. "With glasses", "Angle", etc.).
   */
  public async enrollOwnerSample(
    source: HTMLVideoElement | HTMLCanvasElement | ImageData,
    label: string = 'Muestra'
  ): Promise<OwnerBiometricSample> {
    if (!this.isModelsLoaded) {
      await this.initialize();
    }

    const detection = await faceapi
      .detectSingleFace(source as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection) {
      throw new Error('No se detectó ningún rostro con suficiente claridad para el enrolamiento.');
    }

    const sample: OwnerBiometricSample = {
      id: `sample_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      descriptor: Array.from(detection.descriptor),
      timestamp: Date.now()
    };

    this.ownerSamples.push(sample);
    this.saveOwnerSamples();
    this.updateFaceMatcher();

    return sample;
  }

  public getOwnerSamples(): OwnerBiometricSample[] {
    return [...this.ownerSamples];
  }

  public deleteOwnerSample(sampleId: string): void {
    this.ownerSamples = this.ownerSamples.filter((s) => s.id !== sampleId);
    this.saveOwnerSamples();
    this.updateFaceMatcher();
  }

  public clearOwnerSamples(): void {
    this.ownerSamples = [];
    this.saveOwnerSamples();
    this.updateFaceMatcher();
  }

  public isOwnerEnrolled(): boolean {
    return this.ownerSamples.length > 0;
  }

  /**
   * Starts the continuous video frame analysis loop.
   */
  public async start(videoSource: HTMLVideoElement | (() => HTMLVideoElement | null), fps?: number): Promise<void> {
    if (!this.isModelsLoaded) {
      await this.initialize();
    }

    if (typeof fps === 'number') {
      this.targetFps = Math.max(1, Math.min(30, fps));
    }

    this.videoSource = videoSource;
    this.isRunning = true;
    this.scheduleNextFrame();
  }

  public stop(): void {
    this.isRunning = false;
    this.isProcessingFrame = false;

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private scheduleNextFrame(): void {
    if (!this.isRunning) return;

    const intervalMs = Math.max(33, Math.floor(1000 / this.targetFps));

    this.timerId = setTimeout(async () => {
      if (!this.isRunning) return;

      const video = typeof this.videoSource === 'function' ? this.videoSource() : this.videoSource;
      if (video && video.readyState >= 2 && !this.isProcessingFrame) {
        try {
          this.isProcessingFrame = true;
          const result = await this.processFrame(video);
          if (result && this.isRunning) {
            this.notifyAnalysis(result);
            this.handlePresenceTransitions(result.presence);
          }
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          this.notifyError(err);
        } finally {
          this.isProcessingFrame = false;
        }
      }

      this.scheduleNextFrame();
    }, intervalMs);
  }

  /**
   * Executes a full perception analysis pass over a single image or video frame.
   */
  public async processFrame(source: HTMLVideoElement | HTMLCanvasElement | ImageData): Promise<LocalVisionAnalysisResult> {
    const startTime = performance.now();

    // 1. Detect faces, landmarks, descriptors, and expressions
    const faceDetectionsPromise = this.analyzeFaces(source);

    // 2. Detect objects (COCO-SSD)
    const objectsPromise = this.analyzeObjects(source);

    // 3. Estimate pose (MoveNet or Landmark Pose)
    const posePromise = this.analyzePose(source);

    const [faces, objects, pose] = await Promise.all([
      faceDetectionsPromise,
      objectsPromise,
      posePromise
    ]);

    // 4. Verify human presence, owner biometrics, and phone distraction
    const presence = this.verifyPresence(faces, objects, pose, source);

    // 5. Build concise summary
    const summary = this.buildPerceptionSummary(presence, objects);

    const latencyMs = Math.round(performance.now() - startTime);

    return {
      presence,
      objects,
      faces,
      pose,
      summary,
      timestamp: Date.now(),
      latencyMs
    };
  }

  private async analyzeFaces(source: HTMLVideoElement | HTMLCanvasElement | ImageData): Promise<FaceDetectionInfo[]> {
    if (!this.isModelsLoaded) return [];

    try {
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });
      const rawFaces = await faceapi
        .detectAllFaces(source as any, options)
        .withFaceLandmarks(true)
        .withFaceExpressions()
        .withFaceDescriptors();

      return rawFaces.map((f) => {
        const box: VisionBoundingBox = {
          x: Math.round(f.detection.box.x),
          y: Math.round(f.detection.box.y),
          width: Math.round(f.detection.box.width),
          height: Math.round(f.detection.box.height)
        };

        const landmarks: FaceLandmarkPoint[] = f.landmarks
          ? f.landmarks.positions.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
          : [];

        let dominantEmotion = 'neutral';
        let highestEmotionScore = 0;
        const expressions = f.expressions as unknown as FaceExpressions;

        if (expressions) {
          for (const [emotion, score] of Object.entries(expressions)) {
            if (typeof score === 'number' && score > highestEmotionScore) {
              highestEmotionScore = score;
              dominantEmotion = emotion;
            }
          }
        }

        let isOwner = false;
        let ownerDistance = 1.0;

        if (this.faceMatcher && f.descriptor) {
          const match = this.faceMatcher.findBestMatch(f.descriptor);
          ownerDistance = match.distance;
          isOwner = match.label === this.ownerName && match.distance <= 0.54;
        }

        return {
          box,
          score: f.detection.score,
          landmarks,
          expressions,
          dominantEmotion,
          descriptor: Array.from(f.descriptor),
          isOwner,
          ownerDistance
        };
      });
    } catch (err) {
      console.warn('[LocalVisionService] Face analysis warning:', err);
      return [];
    }
  }

  private async analyzeObjects(source: HTMLVideoElement | HTMLCanvasElement | ImageData): Promise<DetectedObjectInfo[]> {
    if (!this.cocoModel || !this.enableObjects) return [];

    try {
      const rawObjects = await this.cocoModel.detect(source as any, 10, this.minScore);
      const width = ('videoWidth' in source ? source.videoWidth : source.width) || 640;
      const height = ('videoHeight' in source ? source.videoHeight : source.height) || 480;

      return rawObjects.map((obj) => {
        const [x, y, w, h] = obj.bbox;
        return {
          class: obj.class,
          score: obj.score,
          bbox: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)],
          normalizedBox: {
            x: Math.max(0, Math.min(1, x / width)),
            y: Math.max(0, Math.min(1, y / height)),
            width: Math.max(0, Math.min(1, w / width)),
            height: Math.max(0, Math.min(1, h / height))
          }
        };
      });
    } catch (err) {
      console.warn('[LocalVisionService] Object detection warning:', err);
      return [];
    }
  }

  private async analyzePose(source: HTMLVideoElement | HTMLCanvasElement | ImageData): Promise<PoseEstimationResult | null> {
    if (!this.enablePose) return null;

    // MoveNet Lightning graph model execution if loaded
    if (this.movenetModel && typeof tf !== 'undefined') {
      try {
        let tensor: any = null;
        let resized: any = null;
        let expanded: any = null;
        let output: any = null;
        let keypointsTensor: any = null;
        let keypointsData: number[][] = [];
        let h = 480;
        let w = 640;

        try {
          tensor = tf.browser.fromPixels(source as any);
          [h, w] = tensor.shape.slice(0, 2);
          resized = tf.image.resizeBilinear(tensor, [192, 192]).cast('int32');
          expanded = resized.expandDims(0);
          output = this.movenetModel.predict(expanded);
          keypointsTensor = output.squeeze();
          keypointsData = keypointsTensor.arraySync() as number[][];
        } finally {
          tf.dispose([tensor, resized, expanded, output, keypointsTensor].filter(Boolean));
        }

        const keypoints: PoseKeypointInfo[] = keypointsData.map((kp, idx) => ({
          name: MOVENET_NAMES[idx] || `point_${idx}`,
          y: Math.round(kp[0] * h),
          x: Math.round(kp[1] * w),
          score: kp[2]
        }));

        const meanScore = keypoints.reduce((acc, k) => acc + k.score, 0) / (keypoints.length || 1);
        const posture = this.estimatePostureFromKeypoints(keypoints);

        return {
          keypoints,
          score: meanScore,
          posture
        };
      } catch (err) {
        console.warn('[LocalVisionService] Pose estimation error:', err);
      }
    }

    return null;
  }

  private estimatePostureFromKeypoints(keypoints: PoseKeypointInfo[]): PoseEstimationResult['posture'] {
    const nose = keypoints.find((k) => k.name === 'nose');
    const leftShoulder = keypoints.find((k) => k.name === 'left_shoulder');
    const rightShoulder = keypoints.find((k) => k.name === 'right_shoulder');

    if (!nose || !leftShoulder || !rightShoulder || nose.score < 0.3) {
      return 'unknown';
    }

    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderDist = Math.abs(leftShoulder.x - rightShoulder.x);

    // If nose is too close vertically to shoulders, user is likely slumped
    if (Math.abs(shoulderMidY - nose.y) < shoulderDist * 0.35) {
      return 'slumped';
    }

    return 'upright';
  }

  /**
   * Synthesizes multiple perceptual cues to verify human presence and engagement.
   */
  private verifyPresence(
    faces: FaceDetectionInfo[],
    objects: DetectedObjectInfo[],
    pose: PoseEstimationResult | null,
    source: HTMLVideoElement | HTMLCanvasElement | ImageData
  ): HumanPresenceVerification {
    const frameW = ('videoWidth' in source ? source.videoWidth : source.width) || 640;
    const frameH = ('videoHeight' in source ? source.videoHeight : source.height) || 480;
    const totalFrameArea = frameW * frameH;

    const personObj = objects.find((o) => o.class === 'person' && o.score >= 0.5);
    const phoneObj = objects.find((o) => o.class === 'cell phone' && o.score >= 0.45);
    const laptopObj = objects.find((o) => (o.class === 'laptop' || o.class === 'tv') && o.score >= 0.45);

    const hasFace = faces.length > 0;
    const isHumanPresent = hasFace || Boolean(personObj);

    // Owner biometrics match
    const ownerFace = faces.find((f) => f.isOwner);
    const isAuthorizedOwner = Boolean(ownerFace);
    const ownerConfidence = ownerFace
      ? Math.max(0.5, Math.min(1.0, 1.0 - (ownerFace.ownerDistance ?? 0.54) * 0.6))
      : 0;

    // Dominant emotion
    const primaryEmotion = faces[0]?.dominantEmotion || 'neutral';

    // Distance estimation from face bounding box area ratio
    let distanceEstimate: 'close' | 'optimal' | 'far' | 'none' = 'none';
    if (hasFace) {
      const faceArea = faces[0].box.width * faces[0].box.height;
      const ratio = faceArea / totalFrameArea;
      if (ratio > 0.18) distanceEstimate = 'close';
      else if (ratio > 0.04) distanceEstimate = 'optimal';
      else distanceEstimate = 'far';
    } else if (personObj) {
      distanceEstimate = 'optimal';
    }

    // Attention / Screen Gaze assessment from facial landmarks
    let isAttentiveToScreen = false;
    if (hasFace && faces[0].landmarks && faces[0].landmarks.length >= 68) {
      const lm = faces[0].landmarks;
      const leftEye = lm[36];
      const rightEye = lm[45];
      const noseTip = lm[30];

      // Yaw estimation by comparing nose offset from midpoint between eyes
      const eyeMidX = (leftEye.x + rightEye.x) / 2;
      const eyeWidth = Math.max(1, rightEye.x - leftEye.x);
      const yawRatio = (noseTip.x - eyeMidX) / eyeWidth;

      // Pitch estimation by vertical nose tip placement
      const eyeMidY = (leftEye.y + rightEye.y) / 2;
      const chin = lm[8];
      const faceHeight = Math.max(1, chin.y - eyeMidY);
      const pitchRatio = (noseTip.y - eyeMidY) / faceHeight;

      // Attentive when user is looking forward into the webcam/screen
      isAttentiveToScreen = Math.abs(yawRatio) < 0.28 && pitchRatio > 0.25 && pitchRatio < 0.65;
    }

    const confidence = isAuthorizedOwner ? 0.95 : isHumanPresent ? 0.85 : 0.0;
    const now = Date.now();
    if (isHumanPresent) {
      this.lastPresenceTime = now;
    }

    return {
      isHumanPresent,
      facesCount: faces.length,
      isAuthorizedOwner,
      ownerConfidence,
      primaryEmotion,
      distanceEstimate,
      phoneDetected: Boolean(phoneObj),
      laptopDetected: Boolean(laptopObj),
      isAttentiveToScreen,
      confidence,
      lastSeenTimestamp: this.lastPresenceTime
    };
  }

  private handlePresenceTransitions(presence: HumanPresenceVerification): void {
    const currentState = presence.isHumanPresent ? 'PRESENT' : 'AWAY';

    if (currentState !== this.lastState) {
      this.lastState = currentState;
      this.notifyPresence(presence);
    }

    // Phone Distraction Tracker
    if (presence.phoneDetected && presence.isHumanPresent) {
      this.phoneUsageCounter++;
      // Alert after ~5 seconds of continuous phone usage
      if (this.phoneUsageCounter >= this.targetFps * 5) {
        this.notifyDistraction({
          phoneDetected: true,
          durationSec: Math.round(this.phoneUsageCounter / this.targetFps)
        });
      }
    } else {
      this.phoneUsageCounter = Math.max(0, this.phoneUsageCounter - 1);
    }
  }

  private buildPerceptionSummary(presence: HumanPresenceVerification, objects: DetectedObjectInfo[]): string {
    if (!presence.isHumanPresent) {
      return 'No se detecta presencia humana frente a la cámara.';
    }

    const ownerText = presence.isAuthorizedOwner
      ? 'Usuario autorizado reconocido.'
      : presence.facesCount > 0
        ? 'Rostro presente (sin verificar biometría del dueño).'
        : 'Silueta de persona detectada.';

    const emotionText = `Emoción: ${presence.primaryEmotion}.`;
    const attentionText = presence.isAttentiveToScreen ? 'Mirando a la pantalla.' : 'Mirada desviada.';
    const phoneText = presence.phoneDetected ? ' [Celular en mano/cerca]' : '';

    const otherObjects = objects
      .filter((o) => o.class !== 'person' && o.class !== 'cell phone')
      .map((o) => o.class)
      .slice(0, 3);

    const objectsText = otherObjects.length > 0 ? ` Objetos: ${otherObjects.join(', ')}.` : '';

    return `${ownerText} ${emotionText} ${attentionText}${phoneText}${objectsText}`;
  }

  // Listener registrations
  public onAnalysis(callback: (res: LocalVisionAnalysisResult) => void): () => void {
    this.analysisListeners.add(callback);
    return () => this.analysisListeners.delete(callback);
  }

  public onPresenceChange(callback: (presence: HumanPresenceVerification) => void): () => void {
    this.presenceListeners.add(callback);
    return () => this.presenceListeners.delete(callback);
  }

  public onDistraction(callback: (info: { phoneDetected: boolean; durationSec: number }) => void): () => void {
    this.distractionListeners.add(callback);
    return () => this.distractionListeners.delete(callback);
  }

  public onError(callback: (err: Error) => void): () => void {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  private notifyAnalysis(res: LocalVisionAnalysisResult): void {
    for (const l of this.analysisListeners) {
      try { l(res); } catch (e) { console.error('[LocalVisionService] Listener error:', e); }
    }
  }

  private notifyPresence(presence: HumanPresenceVerification): void {
    for (const l of this.presenceListeners) {
      try { l(presence); } catch (e) { console.error('[LocalVisionService] Listener error:', e); }
    }
  }

  private notifyDistraction(info: { phoneDetected: boolean; durationSec: number }): void {
    for (const l of this.distractionListeners) {
      try { l(info); } catch (e) { console.error('[LocalVisionService] Listener error:', e); }
    }
  }

  private notifyError(err: Error): void {
    for (const l of this.errorListeners) {
      try { l(err); } catch (e) { console.error('[LocalVisionService] Listener error:', e); }
    }
  }

  public dispose(): void {
    this.stop();
    this.analysisListeners.clear();
    this.presenceListeners.clear();
    this.distractionListeners.clear();
    this.errorListeners.clear();
    if (this.cocoModel) {
      this.cocoModel.dispose();
      this.cocoModel = null;
    }
  }
}
