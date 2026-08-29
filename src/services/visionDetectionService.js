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

import * as faceapi from '@vladmandic/face-api';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { logger } from './logger';

const STORAGE_OWNER_SAMPLES = 'cristi_ai_owner_samples_v2';
const STORAGE_OWNER_NAME = 'cristi_ai_owner_name_v2';

export class VisionDetectionService {
  constructor({
    onSceneStateChange,
    onDetectionsUpdated,
    onSamplesUpdated,
    onError
  }) {
    this.onSceneStateChange = onSceneStateChange || (() => {});
    this.onDetectionsUpdated = onDetectionsUpdated || (() => {});
    this.onSamplesUpdated = onSamplesUpdated || (() => {});
    this.onError = onError || console.error;

    this.isModelsLoaded = false;
    this.isLoading = false;
    this.isRunning = false;
    this.cocoModel = null;
    this.faceMatcher = null;

    this.ownerName = 'Mi Dueño';
    this.ownerSamples = []; // Array of { id, label, descriptor, timestamp }

    this.animationFrameId = null;
    this.lastState = 'NO_ONE';
    this.lastStateTimestamp = Date.now();
    this.lastProcessTime = 0;
    this.processIntervalMs = 110; // ~9 FPS for smooth tracking and low CPU load

    this.currentDetections = {
      faces: [],
      objects: [],
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
        })
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
          })
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
      throw new Error('No se detectó ningún rostro con suficiente claridad. Mira fijamente a la cámara con buena luz o sensor IR.');
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
  startTracking(videoElement, overlayCanvas = null) {
    if (this.isRunning) return;
    this.isRunning = true;

    const detectFrame = async () => {
      if (!this.isRunning) return;

      const now = performance.now();
      if (now - this.lastProcessTime >= this.processIntervalMs && videoElement && videoElement.readyState >= 2) {
        this.lastProcessTime = now;
        await this.processVideoFrame(videoElement, overlayCanvas);
      }

      this.animationFrameId = requestAnimationFrame(detectFrame);
    };

    this.animationFrameId = requestAnimationFrame(detectFrame);
  }

  stopTracking() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  async processVideoFrame(videoElement, overlayCanvas = null) {
    if (!this.isModelsLoaded || !videoElement) return;

    try {
      const displaySize = {
        width: videoElement.videoWidth || 640,
        height: videoElement.videoHeight || 480
      };

      // 1. Detect Faces + Landmarks + Descriptors + Expressions
      const faceDetections = await faceapi
        .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.42 }))
        .withFaceLandmarks(true)
        .withFaceExpressions()
        .withFaceDescriptors();

      const resizedFaces = faceapi.resizeResults(faceDetections, displaySize);

      // 2. Detect Objects (phone, cup, bottle, laptop, etc.)
      let objectDetections = [];
      if (this.cocoModel) {
        const rawObjects = await this.cocoModel.detect(videoElement, 6, 0.45);
        objectDetections = rawObjects.filter((obj) => obj.class !== 'person');
      }

      // 3. Match Faces (Owner with multi-descriptors vs Strangers)
      let ownerCount = 0;
      let strangerCount = 0;
      const processedFaces = resizedFaces.map((f, index) => {
        let matchLabel = 'Desconocido';
        let matchDistance = 1.0;
        let isOwner = false;

        if (this.faceMatcher && f.descriptor) {
          const match = this.faceMatcher.findBestMatch(f.descriptor);
          matchLabel = match.label;
          matchDistance = match.distance;
          isOwner = match.label === this.ownerName;
        }

        if (isOwner) {
          ownerCount++;
        } else {
          strangerCount++;
        }

        // Top emotion
        const expressions = f.expressions || {};
        let topEmotion = 'neutral';
        let topScore = 0;
        for (const [em, score] of Object.entries(expressions)) {
          if (score > topScore) {
            topScore = score;
            topEmotion = em;
          }
        }

        return {
          id: `face_${index}`,
          box: f.detection.box,
          isOwner,
          label: isOwner ? this.ownerName : `Persona #${index + 1}`,
          confidence: Math.round(f.detection.score * 100),
          matchDistance,
          topEmotion,
          emotionScore: Math.round(topScore * 100),
          landmarks: f.landmarks
        };
      });

      // 4. Classify Current Scene State
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

      // Format summary for Gemini
      let summary = '';
      if (sceneState === 'OWNER_ALONE') {
        const emo = processedFaces[0]?.topEmotion || 'tranquilo';
        summary = `Tu Dueño está a solas frente a la cámara (${this.ownerSamples.length} muestras biométricas registradas). Expresión: ${emo}.`;
      } else if (sceneState === 'OWNER_WITH_OTHERS') {
        summary = `¡ALERTA DE CELOS! Tu Dueño está acompañado por ${strangerCount} persona(s) desconocida(s). Total: ${processedFaces.length} personas en el encuadre.`;
      } else if (sceneState === 'STRANGER_ONLY') {
        summary = `Hay ${strangerCount} persona(s) desconocida(s) frente a la cámara, pero tu Dueño NO está presente.`;
      } else {
        summary = 'La cámara no detecta a nadie presente en este momento.';
      }

      if (objectDetections.length > 0) {
        const objNames = objectDetections.map((o) => o.class).join(', ');
        summary += ` Objetos detectados: ${objNames}.`;
      }

      this.currentDetections = {
        faces: processedFaces,
        objects: objectDetections,
        sceneState,
        summary
      };

      this.onDetectionsUpdated(this.currentDetections);

      // 5. Trigger Scene State Change Event if state has stabilized
      if (sceneState !== this.lastState && now - this.lastStateTimestamp > 3000) {
        this.lastState = sceneState;
        this.lastStateTimestamp = now;
        this.onSceneStateChange({
          sceneState,
          ownerCount,
          strangerCount,
          objects: objectDetections.map((o) => o.class),
          summary
        });
      }

      // 6. Draw HUD Framing / Bounding Boxes on Overlay Canvas
      if (overlayCanvas) {
        this.drawHUDOverlay(overlayCanvas, displaySize, processedFaces, objectDetections);
      }
    } catch (err) {
      console.error('Error en processVideoFrame:', err);
    }
  }

  /**
   * Draw Cyber-Goth HUD Bounding Boxes & Facial Target Reticles
   */
  drawHUDOverlay(canvas, displaySize, faces, objects) {
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

      if (isOwner) {
        ctx.strokeStyle = '#c084fc';
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = '#f43f5e';
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 12;
      }

      // Corner Brackets Framing
      const cornerLen = Math.min(20, width * 0.25);
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + width - cornerLen, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerLen);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerLen, y + height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + width - cornerLen, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerLen);
      ctx.stroke();

      // Label Badge
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      const badgeText = isOwner
        ? `♥ ${face.label} [${face.topEmotion}]`
        : `⚠ ${face.label} [EXTRAÑO]`;
      const textWidth = ctx.measureText(badgeText).width;

      ctx.fillStyle = isOwner ? 'rgba(88, 28, 135, 0.85)' : 'rgba(159, 18, 57, 0.85)';
      ctx.fillRect(x, Math.max(0, y - 20), textWidth + 12, 18);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(badgeText, x + 6, Math.max(13, y - 7));

      ctx.restore();
    });

    // Draw Object Bounding Boxes
    objects.forEach((obj) => {
      const [x, y, width, height] = obj.bbox;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = 'rgba(12, 74, 110, 0.85)';
      const label = `⚙ ${obj.class} ${Math.round(obj.score * 100)}%`;
      ctx.font = '10px JetBrains Mono, monospace';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x, Math.max(0, y - 16), textWidth + 8, 16);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText(label, x + 4, Math.max(11, y - 4));
      ctx.restore();
    });
  }

  getCurrentSceneSummary() {
    return this.currentDetections.summary || 'Cámara sensorial activa.';
  }
}
