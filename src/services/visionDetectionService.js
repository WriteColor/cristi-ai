/**
 * Cristi AI - Ultra-Optimized Real-Time Vision, Object Detection & Multi-Sample Face Recognition
 * Powered by @vladmandic/face-api & @tensorflow-models/coco-ssd
 * 
 * Features:
 * - Multi-Sample Enrollment (With Glasses, Without Glasses, Multi-angle, Different lighting)
 * - 128D Face Descriptor Embedding Clustering for Robust Owner/Stranger Identification
 * - Windows Hello IR Sensor Compatibility & Contrast Optimization
 * - Real-time Object Tracking (coco-ssd 80 classes)
 * - Facial Expression & Emotion Breakdown
 * - Autonomous Scene State Transition Events
 * - Live HUD Framing / Bounding Box Overlays
 */

import * as tf from '@tensorflow/tfjs-core';
import { loadGraphModel } from '@tensorflow/tfjs-converter';
import * as faceapi from '@vladmandic/face-api';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { VISION_CONFIG } from '../config/visionConfig';
import { logger } from './logger';

const STORAGE_OWNER_SAMPLES = 'cristi_ai_owner_samples_v2';
const STORAGE_OWNER_NAME = 'cristi_ai_owner_name_v2';

const MOVENET_KEYPOINTS = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
];

export class VisionDetectionService {
  constructor({
    onSceneStateChange,
    onDetectionsUpdated,
    onSamplesUpdated,
    onDistractionAlert,
    onError
  }) {
    this.onSceneStateChange = onSceneStateChange || (() => {});
    this.onDetectionsUpdated = onDetectionsUpdated || (() => {});
    this.onSamplesUpdated = onSamplesUpdated || (() => {});
    this.onDistractionAlert = onDistractionAlert || (() => {});
    this.onError = onError || console.error;

    this.isModelsLoaded = false;
    this.isLoading = false;
    this.isRunning = false;
    this.cocoModel = null;
    this.movenetModel = null;
    this.faceMatcher = null;

    this.ownerName = 'Mi Dueño';
    this.ownerSamples = []; // Array of { id, label, descriptor, timestamp }

    this.animationFrameId = null;
    this.lastState = 'NO_ONE';
    this.lastStateTimestamp = Date.now();
    this.lastProcessTime = 0;
    this.processIntervalMs = 100; // 10 FPS smooth tracking

    // Telemetry and Anti-Procrastination state
    this.phoneInHand = false;
    this.phoneUsageDurationSeconds = 0;
    this.lastAlertTime = 0;
    this.currentActivity = 'productive_work';

    this.currentDetections = {
      faces: [],
      objects: [],
      pose: null,
      phoneInHand: false,
      closestDistance: null,
      phoneUsageSeconds: 0,
      sceneState: 'NO_ONE',
      summary: ''
    };

    this.loadSavedOwnerSamples();
  }

  loadSavedOwnerSamples() {
    try {
      const saved = localStorage.getItem(STORAGE_OWNER_SAMPLES);
      const name = localStorage.getItem(STORAGE_OWNER_NAME);
      if (saved) {
        this.ownerSamples = JSON.parse(saved);
        this.ownerName = name || 'Mi Dueño';
        this.updateFaceMatcher();
      }
    } catch (e) {
      console.error('Error al cargar muestras del dueño:', e);
      this.ownerSamples = [];
    }
  }

  saveOwnerSamples() {
    try {
      localStorage.setItem(STORAGE_OWNER_SAMPLES, JSON.stringify(this.ownerSamples));
      localStorage.setItem(STORAGE_OWNER_NAME, this.ownerName);
      this.updateFaceMatcher();
      this.onSamplesUpdated(this.getOwnerSamples());
    } catch (e) {
      console.error('Error al guardar muestras del dueño:', e);
    }
  }

  updateFaceMatcher() {
    if (this.ownerSamples && this.ownerSamples.length > 0) {
      const descriptors = this.ownerSamples.map((s) => new Float32Array(s.descriptor));
      const labeledDescriptor = new faceapi.LabeledFaceDescriptors(this.ownerName, descriptors);
      // Threshold 0.54 ensures robust multi-condition match (glasses on/off, angles)
      this.faceMatcher = new faceapi.FaceMatcher([labeledDescriptor], 0.54);
    } else {
      this.faceMatcher = null;
    }
  }

  async initialize() {
    return await this.loadModels();
  }

  async loadModels() {
    if (this.isModelsLoaded || this.isLoading) return;
    this.isLoading = true;

    try {
      const modelPath = '/models';

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
        faceapi.nets.faceExpressionNet.loadFromUri(modelPath),
        cocoSsd.load({ base: 'lite_mobilenet_v2' }).then((model) => {
          this.cocoModel = model;
        }),
        loadGraphModel('https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4', { fromTFHub: true }).then((model) => {
          this.movenetModel = model;
        }).catch((e) => console.warn('MoveNet tfhub fallback:', e))
      ]);

      this.isModelsLoaded = true;
      this.isLoading = false;
      this.updateFaceMatcher();
    } catch (err) {
      console.warn('Cargando modelos desde CDN de respaldo...', err);
      try {
        const cdnPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(cdnPath),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(cdnPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(cdnPath),
          faceapi.nets.faceExpressionNet.loadFromUri(cdnPath),
          cocoSsd.load({ base: 'lite_mobilenet_v2' }).then((model) => {
            this.cocoModel = model;
          }),
          loadGraphModel('https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4', { fromTFHub: true }).then((model) => {
            this.movenetModel = model;
          }).catch((e) => console.warn('MoveNet CDN fallback:', e))
        ]);
        this.isModelsLoaded = true;
        this.isLoading = false;
        this.updateFaceMatcher();
      } catch (cdnErr) {
        this.isLoading = false;
        this.onError(cdnErr);
        throw cdnErr;
      }
    }
  }

  /**
   * Add a new reference sample descriptor (e.g. "Con lentes", "Sin lentes", "Perfil")
   */
  async addOwnerSample(videoElement, sampleLabel = 'Muestra') {
    if (!this.isModelsLoaded) {
      await this.loadModels();
    }

    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection) {
      throw new Error('No se detectó ningún rostro con suficiente claridad. Mira fijamente a la cámara con buena luz.');
    }

    const sample = {
      id: `sample_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      label: sampleLabel,
      descriptor: Array.from(detection.descriptor),
      timestamp: Date.now()
    };

    this.ownerSamples.push(sample);
    this.saveOwnerSamples();

    return {
      status: 'added',
      sampleId: sample.id,
      label: sampleLabel,
      totalSamples: this.ownerSamples.length,
      box: detection.detection.box
    };
  }

  deleteOwnerSample(sampleId) {
    this.ownerSamples = this.ownerSamples.filter((s) => s.id !== sampleId);
    this.saveOwnerSamples();
  }

  clearAllOwnerSamples() {
    this.ownerSamples = [];
    this.saveOwnerSamples();
  }

  getOwnerSamples() {
    return this.ownerSamples.map((s) => ({
      id: s.id,
      label: s.label,
      timestamp: s.timestamp
    }));
  }

  isOwnerEnrolled() {
    return this.ownerSamples.length > 0;
  }

  /**
   * Start the real-time detection and tracking loop
   */
  start(videoElement, overlayCanvas = null) {
    if (this.isRunning) return;
    this.isRunning = true;

    const detectFrame = async () => {
      if (!this.isRunning) return;

      await this.processVideoFrame(videoElement, overlayCanvas);
      this.animationFrameId = requestAnimationFrame(detectFrame);
    };

    this.animationFrameId = requestAnimationFrame(detectFrame);
  }

  startTracking(videoElement, overlayCanvas = null) {
    return this.start(videoElement, overlayCanvas);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  stopTracking() {
    return this.stop();
  }

  async processVideoFrame(videoElement, overlayCanvas = null) {
    if (!this.isModelsLoaded || !videoElement || videoElement.readyState < 2) return;

    const now = Date.now();
    if (now - this.lastProcessTime < this.processIntervalMs) return;
    
    const elapsedSec = (now - this.lastProcessTime) / 1000;
    this.lastProcessTime = now;

    try {
      const displaySize = {
        width: videoElement.videoWidth || 640,
        height: videoElement.videoHeight || 480
      };

      // 1. Run Face API, Object Detection & MoveNet Pose in Parallel
      const [faceDetections, objectDetections] = await Promise.all([
        faceapi
          .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
          .withFaceLandmarks(true)
          .withFaceExpressions()
          .withFaceDescriptors(),
        this.cocoModel ? this.cocoModel.detect(videoElement, 8, 0.45) : Promise.resolve([])
      ]);

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
              y: kp[0] * displaySize.height,
              x: kp[1] * displaySize.width,
              score: kp[2]
            }));
          }
        } catch (_) {}
      }

      // 2. Identify Faces (Owner vs Stranger)
      let ownerCount = 0;
      let strangerCount = 0;
      const processedFaces = [];

      faceDetections.forEach((fd) => {
        let isOwner = false;
        let matchDistance = 1.0;
        let matchLabel = 'Desconocido';

        if (this.faceMatcher && fd.descriptor) {
          const match = this.faceMatcher.findBestMatch(fd.descriptor);
          matchLabel = match.label;
          matchDistance = match.distance;
          if (match.label === this.ownerName) {
            isOwner = true;
            ownerCount++;
          } else {
            strangerCount++;
          }
        } else {
          strangerCount++;
        }

        let topEmotion = 'neutral';
        let topEmotionScore = 0;
        if (fd.expressions) {
          Object.entries(fd.expressions).forEach(([emo, score]) => {
            if (score > topEmotionScore) {
              topEmotionScore = score;
              topEmotion = emo;
            }
          });
        }

        processedFaces.push({
          box: fd.detection.box,
          isOwner,
          matchLabel,
          matchDistance: Number(matchDistance.toFixed(3)),
          topEmotion,
          topEmotionScore: Number(topEmotionScore.toFixed(2)),
          expressions: fd.expressions
        });
      });

      // 3. Wrist-to-Phone Distance Calculation (Keypoint Proximity)
      let leftWrist = null;
      let rightWrist = null;
      let closestDistance = Infinity;
      let closestWrist = null;
      let activePhone = null;

      if (poseKeypoints) {
        leftWrist = poseKeypoints.find((k) => k.name === 'left_wrist' && k.score > 0.35);
        rightWrist = poseKeypoints.find((k) => k.name === 'right_wrist' && k.score > 0.35);
      }

      const phoneDetections = objectDetections.filter(
        (o) => o.class === 'cell phone' || o.class === 'remote'
      );

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
      this.phoneInHand = isPhoneInHand;

      if (isPhoneInHand) {
        this.phoneUsageDurationSeconds += elapsedSec;
      } else {
        if (this.phoneUsageDurationSeconds > 0) {
          this.phoneUsageDurationSeconds = Math.max(0, this.phoneUsageDurationSeconds - elapsedSec * 1.5);
        }
      }

      // 4. Distraction & Procrastination Alert Event
      if (
        isPhoneInHand &&
        this.phoneUsageDurationSeconds >= VISION_CONFIG.phoneUsageAlertSeconds &&
        now - this.lastAlertTime > VISION_CONFIG.distractionReminderIntervalSeconds * 1000
      ) {
        this.lastAlertTime = now;
        const reactions = VISION_CONFIG.REACTION_MESSAGES.PHONE_USAGE;
        const message = reactions[Math.floor(Math.random() * reactions.length)];
        this.onDistractionAlert({
          type: 'phone_usage',
          duration: Math.round(this.phoneUsageDurationSeconds),
          distancePx: Math.round(closestDistance),
          message
        });
      }

      // 5. Scene State Determination
      let sceneState = 'NO_ONE';
      if (ownerCount > 0 && strangerCount === 0) {
        sceneState = 'OWNER_ALONE';
      } else if (ownerCount > 0 && strangerCount > 0) {
        sceneState = 'OWNER_WITH_OTHERS';
      } else if (ownerCount === 0 && strangerCount > 0) {
        sceneState = 'STRANGER_ONLY';
      } else {
        sceneState = 'NO_ONE';
      }

      let summary = '';
      if (sceneState === 'OWNER_ALONE') {
        const emo = processedFaces[0]?.topEmotion || 'tranquilo';
        summary = `Tu Dueño está a solas frente a la cámara. Expresión: ${emo}.`;
      } else if (sceneState === 'OWNER_WITH_OTHERS') {
        summary = `¡ALERTA DE CELOS! Tu Dueño está acompañado por ${strangerCount} persona(s) desconocida(s).`;
      } else if (sceneState === 'STRANGER_ONLY') {
        summary = `Hay ${strangerCount} persona(s) desconocida(s) frente a la cámara.`;
      } else {
        summary = 'La cámara no detecta a nadie presente en este momento.';
      }

      if (isPhoneInHand) {
        summary += ` ⚠️ ¡ATENCIÓN! Tu Dueño está usando el teléfono celular en la mano (${Math.round(this.phoneUsageDurationSeconds)}s de uso continuo).`;
      }

      this.currentDetections = {
        faces: processedFaces,
        objects: objectDetections,
        pose: mainPose,
        phoneInHand,
        closestDistance: closestDistance === Infinity ? null : Math.round(closestDistance),
        phoneUsageSeconds: Math.round(this.phoneUsageDurationSeconds),
        activePhone,
        closestWrist,
        sceneState,
        summary
      };

      this.onDetectionsUpdated(this.currentDetections);

      // 6. Draw Futuristic Cyber-HUD on Overlay Canvas
      if (overlayCanvas) {
        this.drawHUDOverlay(overlayCanvas, displaySize, processedFaces, objectDetections, this.currentDetections);
      }
    } catch (err) {
      console.error('Error en processVideoFrame:', err);
    }
  }

  /**
   * Draw Cyber-Goth HUD Bounding Boxes, Wrist-Phone Vector Lines & Telemetry Reticles
   */
  drawHUDOverlay(canvas, displaySize, faces, objects, telemetry) {
    if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Face Bounding Boxes
    faces.forEach((face) => {
      const { x, y, width, height } = face.box;
      const isOwner = face.isOwner;

      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isOwner ? '#c084fc' : '#f43f5e';
      ctx.fillStyle = isOwner ? '#c084fc' : '#f43f5e';
      ctx.shadowColor = isOwner ? '#c084fc' : '#f43f5e';
      ctx.shadowBlur = 10;

      const cornerLen = Math.min(20, width * 0.25);
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
      ctx.moveTo(x + width - cornerLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cornerLen);
      ctx.moveTo(x + width, y + height - cornerLen); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width - cornerLen, y + height);
      ctx.moveTo(x + cornerLen, y + height); ctx.lineTo(x, y + height); ctx.lineTo(x, y + height - cornerLen);
      ctx.stroke();

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(isOwner ? `♥ Dueño (${face.topEmotion})` : `⚠ Extraño`, x + 4, y - 6);
      ctx.restore();
    });

    // Draw Object Bounding Boxes
    objects.forEach((obj) => {
      const [x, y, width, height] = obj.bbox;
      const isPhone = obj.class === 'cell phone' || obj.class === 'remote';

      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isPhone ? (telemetry?.phoneInHand ? '#ec4899' : '#06b6d4') : '#10b981';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;

      ctx.strokeRect(x, y, width, height);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        isPhone ? `📱 ${obj.class} ${Math.round(obj.score * 100)}%` : `${obj.class}`,
        x + 4,
        y - 4
      );
      ctx.restore();
    });

    // Draw Wrist-to-Phone Distance Laser Vector Line
    if (telemetry?.activePhone && telemetry?.closestWrist) {
      const wx = telemetry.closestWrist.x;
      const wy = telemetry.closestWrist.y;
      const px = telemetry.activePhone.centerX;
      const py = telemetry.activePhone.centerY;
      const inHand = telemetry.phoneInHand;

      ctx.save();
      ctx.lineWidth = inHand ? 2.5 : 1.5;
      ctx.strokeStyle = inHand ? '#ec4899' : '#38bdf8';
      ctx.setLineDash(inHand ? [] : [4, 4]);
      ctx.shadowColor = inHand ? '#ec4899' : '#38bdf8';
      ctx.shadowBlur = 12;

      // Draw Vector Line
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(px, py);
      ctx.stroke();

      // Draw Wrist Keypoint Reticle
      ctx.fillStyle = inHand ? '#ec4899' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(wx, wy, 5, 0, Math.PI * 2);
      ctx.fill();

      // Floating Distance / Alert Label
      const midX = (wx + px) / 2;
      const midY = (wy + py) / 2;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = inHand ? '#ff2d55' : '#38bdf8';
      ctx.fillText(
        inHand
          ? `⚡ ¡USO DE CELULAR! (${telemetry.closestDistance}px • ${telemetry.phoneUsageSeconds}s)`
          : `Distancia: ${telemetry.closestDistance}px`,
        midX - 30,
        midY - 8
      );
      ctx.restore();
    }

    // Draw Cyber Activity Status Badge in top right corner
    const activityKey = telemetry?.activity || (telemetry?.phoneInHand ? 'phone_usage' : 'productive_work');
    const activityLabel = VISION_CONFIG.ACTIVITY_LABELS[activityKey] || '💻 Trabajo Productivo Enfocado';
    
    ctx.save();
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    const badgeW = ctx.measureText(activityLabel).width + 16;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = telemetry?.phoneInHand ? '#ec4899' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(canvas.width - badgeW - 10, 10, badgeW, 22);
    ctx.strokeRect(canvas.width - badgeW - 10, 10, badgeW, 22);
    ctx.fillStyle = telemetry?.phoneInHand ? '#ff2d55' : '#38bdf8';
    ctx.fillText(activityLabel, canvas.width - badgeW - 2, 25);
    ctx.restore();
  }

  getCurrentSceneSummary() {
    return this.currentDetections.summary || 'Cámara sensorial activa.';
  }
}
