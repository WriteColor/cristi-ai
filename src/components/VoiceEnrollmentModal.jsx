/**
 * Cristi AI - Voice Enrollment & Real-Time Biometric Calibration Modal
 * Modern, Draggable, Multi-Input Obsidian Design:
 * - Live Microphone Guided Recording & Instant Single-Phrase Enrolment
 * - Audio File Drag & Drop (Supports MP3, WAV, M4A, OGG, WEBM, FLAC)
 * - Zero-Re-Render Direct GPU Draggable Window
 * - Persistent Profile Management, Calibration, and Live Similarity Testing
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Upload,
  ShieldCheck,
  RotateCcw,
  Sliders,
  X,
  Volume2,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  GripHorizontal
} from 'lucide-react';
import { speakerRecognitionService } from '../services/audio/SpeakerRecognitionService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';

const CALIBRATION_PHRASES = [
  {
    id: 1,
    title: 'Muestra 1: Saludo Natural',
    quote: '"Hola Cristi, soy tu usuario principal y esta es mi voz natural."',
    hint: 'Habla con tu tono de conversación cotidiano y a distancia normal del micrófono.'
  },
  {
    id: 2,
    title: 'Muestra 2: Instrucción Dinámica',
    quote: '"Cristi, por favor abre el panel de control y revisa el estado del sistema."',
    hint: 'Varía ligeramente la entonación para capturar la acústica y armónicos de tu voz.'
  },
  {
    id: 3,
    title: 'Muestra 3: Pregunta o Petición',
    quote: '"¿Cristi, qué aplicaciones tengo abiertas y cómo está el rendimiento hoy?"',
    hint: 'Mantén un ritmo fluido para enriquecer los descriptores biométricos del modelo.'
  }
];

export const VoiceEnrollmentModal = React.memo(function VoiceEnrollmentModal({
  isOpen,
  onClose
}) {
  const { interactiveProps } = useClickThrough();
  const [activeTab, setActiveTab] = useState('mic'); // 'mic' | 'file' | 'test' | 'profile'
  const [ownerName, setOwnerName] = useState('Mi Dueño');
  const [currentStep, setCurrentStep] = useState(0);
  const [recordedSamples, setRecordedSamples] = useState([]);
  const [isRecordingSample, setIsRecordingSample] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [enrollError, setEnrollError] = useState(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

  // Live Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [matchThreshold, setMatchThreshold] = useState(speakerRecognitionService.matchThreshold);
  const [rejectThreshold, setRejectThreshold] = useState(speakerRecognitionService.rejectThreshold);

  // Zero-Re-Render Drag Engine
  const modalCardRef = useRef(null);
  const isDraggingModalRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });
  const modalPosRef = useRef(() => {
    try {
      const saved = localStorage.getItem('cristi_voice_modal_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: null, y: null };
  });
  const modalRafIdRef = useRef(null);

  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const timerRef = useRef(null);
  const volumeBarRef = useRef(null);
  const testVolumeBarRef = useRef(null);

  const hasProfile = speakerRecognitionService.hasEnrolledProfile();

  // Position initialization via GPU transform
  useEffect(() => {
    if (!isOpen) return;
    const initial = typeof modalPosRef.current === 'function' ? modalPosRef.current() : modalPosRef.current;
    modalPosRef.current = initial;
    if (modalCardRef.current && initial.x !== null) {
      modalCardRef.current.style.position = 'fixed';
      modalCardRef.current.style.left = '0px';
      modalCardRef.current.style.top = '0px';
      modalCardRef.current.style.margin = '0';
      modalCardRef.current.style.transform = `translate3d(${initial.x}px, ${initial.y}px, 0)`;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      soundFxService.playMenuOpen();
      const profile = speakerRecognitionService.getProfileInfo();
      if (profile) {
        setOwnerName(profile.name);
        setMatchThreshold(profile.matchThreshold);
        setRejectThreshold(profile.rejectThreshold);
        if (activeTab === 'mic' && hasProfile) {
          setActiveTab('profile');
        }
      }
    } else {
      cleanupAudioResources();
    }
  }, [isOpen, hasProfile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        soundFxService.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (modalRafIdRef.current) cancelAnimationFrame(modalRafIdRef.current);
      cleanupAudioResources();
    };
  }, [isOpen, onClose]);

  const cleanupAudioResources = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (volumeBarRef.current) volumeBarRef.current.style.width = '0%';
    if (testVolumeBarRef.current) testVolumeBarRef.current.style.width = '0%';
  };

  // --- Zero-Re-Render Dragging Handlers ---
  const handleHeaderPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, select')) return;
    e.preventDefault();
    isDraggingModalRef.current = true;

    const modalEl = modalCardRef.current;
    const rect = modalEl.getBoundingClientRect();

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: rect.left,
      posY: rect.top
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleHeaderPointerMove = (e) => {
    if (!isDraggingModalRef.current || !modalCardRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 200, dragStartRef.current.posY + deltaY));

    modalPosRef.current = { x: newX, y: newY };

    if (!modalRafIdRef.current) {
      modalRafIdRef.current = requestAnimationFrame(() => {
        if (modalCardRef.current) {
          modalCardRef.current.style.position = 'fixed';
          modalCardRef.current.style.left = '0px';
          modalCardRef.current.style.top = '0px';
          modalCardRef.current.style.margin = '0';
          modalCardRef.current.style.transform = `translate3d(${modalPosRef.current.x}px, ${modalPosRef.current.y}px, 0)`;
        }
        modalRafIdRef.current = null;
      });
    }
  };

  const handleHeaderPointerUp = (e) => {
    if (!isDraggingModalRef.current) return;
    isDraggingModalRef.current = false;
    if (modalRafIdRef.current) {
      cancelAnimationFrame(modalRafIdRef.current);
      modalRafIdRef.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (modalPosRef.current.x !== null) {
        localStorage.setItem('cristi_voice_modal_pos', JSON.stringify(modalPosRef.current));
      }
    } catch (_) {}
  };

  // --- Live Recording ---
  const startSampleRecording = async () => {
    try {
      setEnrollError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(input));

        // Ultra-lightweight direct DOM volume meter (0 React re-renders)
        let sum = 0;
        for (let i = 0; i < input.length; i += 8) {
          sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / (input.length / 8));
        const pct = Math.min(100, Math.round(rms * 400));
        if (volumeBarRef.current) {
          volumeBarRef.current.style.width = `${pct}%`;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsRecordingSample(true);
      setRecordingSeconds(0);
      soundFxService.playConnect();

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      soundFxService.playError();
      setEnrollError(`No se pudo acceder al micrófono: ${err.message}`);
    }
  };

  const stopSampleRecording = () => {
    if (!isRecordingSample) return;
    soundFxService.playClick();
    clearInterval(timerRef.current);
    timerRef.current = null;

    cleanupAudioResources();
    setIsRecordingSample(false);

    // Merge audio chunks
    const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    if (totalLength < 16000 * 0.8) {
      soundFxService.playError();
      setEnrollError('Grabación demasiado corta. Por favor habla al menos 1 segundo completo.');
      return;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const newSamples = [...recordedSamples, merged];
    setRecordedSamples(newSamples);

    if (currentStep < 2) {
      setCurrentStep((s) => s + 1);
    } else {
      // Completed all 3 guided steps -> Auto-calibrate & enroll permanently!
      finishEnrollmentFromSamples(newSamples);
    }
  };

  const finishEnrollmentFromSamples = async (samplesToUse = recordedSamples) => {
    if (samplesToUse.length === 0) return;
    setIsEnrolling(true);
    setEnrollError(null);

    try {
      speakerRecognitionService.clearProfile();
      for (let i = 0; i < samplesToUse.length; i++) {
        speakerRecognitionService.enrollSpeakerSample(
          samplesToUse[i],
          ownerName || 'Mi Dueño',
          `Muestra Micrófono #${i + 1}`
        );
      }

      speakerRecognitionService.saveProfile();
      try {
        localStorage.setItem('cristi_voice_enrolled_v1', 'true');
        localStorage.setItem('cristi_voice_enrolled_dismissed_v1', 'true');
      } catch {}

      soundFxService.playConnect();
      setEnrollSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      soundFxService.playError();
      setEnrollError(`Error al calibrar descriptores: ${err.message}`);
    } finally {
      setIsEnrolling(false);
    }
  };

  // --- Audio File Upload Handlers ---
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleProcessAudioFile(file);
  };

  const handleProcessAudioFile = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setIsEnrolling(true);
    setEnrollError(null);

    try {
      soundFxService.playClick();
      const res = await speakerRecognitionService.enrollFromAudioFile(
        file,
        ownerName || 'Mi Dueño',
        `Archivo: ${file.name}`
      );

      try {
        localStorage.setItem('cristi_voice_enrolled_v1', 'true');
        localStorage.setItem('cristi_voice_enrolled_dismissed_v1', 'true');
      } catch {}

      soundFxService.playConnect();
      setEnrollSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      soundFxService.playError();
      setEnrollError(`Error al procesar archivo de audio: ${err.message}`);
    } finally {
      setIsEnrolling(false);
    }
  };

  // --- Live Recognition Test ---
  const startLiveTest = async () => {
    try {
      setTestResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i += 8) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / (input.length / 8));
        const pct = Math.min(100, Math.round(rms * 400));
        if (testVolumeBarRef.current) testVolumeBarRef.current.style.width = `${pct}%`;

        // Check speaker match if voice detected
        if (rms > 0.02) {
          const decision = speakerRecognitionService.identifySpeaker(input);
          setTestResult(decision);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setIsTesting(true);
    } catch (err) {
      setEnrollError(`Error al iniciar prueba: ${err.message}`);
    }
  };

  const stopLiveTest = () => {
    cleanupAudioResources();
    setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="voice-enrollment-backdrop" {...interactiveProps} onClick={onClose}>
      <div
        ref={modalCardRef}
        className="voice-enrollment-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-tr" />
        <span className="hud-corner hud-corner-bl" />
        <span className="hud-corner hud-corner-br" />

        {/* Draggable Header */}
        <div
          className="enrollment-header"
          onPointerDown={handleHeaderPointerDown}
          onPointerMove={handleHeaderPointerMove}
          onPointerUp={handleHeaderPointerUp}
          style={{ cursor: 'grab', userSelect: 'none' }}
        >
          <div className="enrollment-header-left">
            <GripHorizontal size={16} color="#94a3b8" />
            <div className="enrollment-tag">BIOMETRÍA VOCAL // S2S EMBEDDING</div>
            <h3 className="enrollment-title">
              {hasProfile ? 'Reconocimiento de Voz Configurado' : 'Registro de Identidad Vocal'}
            </h3>
          </div>
          <button
            type="button"
            className="enrollment-close-btn"
            onClick={() => {
              try { localStorage.setItem('cristi_voice_enrolled_dismissed_v1', 'true'); } catch {}
              onClose();
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="enrollment-nav-tabs">
          <button
            type="button"
            className={`enroll-tab-btn ${activeTab === 'mic' ? 'active' : ''}`}
            onClick={() => { soundFxService.playClick(); setActiveTab('mic'); }}
          >
            <Mic size={13} />
            <span>Grabar con Micrófono</span>
          </button>
          <button
            type="button"
            className={`enroll-tab-btn ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => { soundFxService.playClick(); setActiveTab('file'); }}
          >
            <Upload size={13} />
            <span>Cargar Archivo de Audio</span>
          </button>
          {hasProfile && (
            <>
              <button
                type="button"
                className={`enroll-tab-btn ${activeTab === 'test' ? 'active' : ''}`}
                onClick={() => { soundFxService.playClick(); setActiveTab('test'); }}
              >
                <ShieldCheck size={13} />
                <span>Probar Reconocimiento</span>
              </button>
              <button
                type="button"
                className={`enroll-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => { soundFxService.playClick(); setActiveTab('profile'); }}
              >
                <Sliders size={13} />
                <span>Perfil y Umbrales</span>
              </button>
            </>
          )}
        </div>

        {/* Notification Banners */}
        {enrollSuccess && (
          <div className="enroll-success-banner">
            <CheckCircle2 size={16} />
            <span>¡Identidad vocal registrada exitosamente! Guardada localmente de forma permanente.</span>
          </div>
        )}
        {enrollError && (
          <div className="enroll-error-banner">
            <AlertCircle size={16} />
            <span>{enrollError}</span>
          </div>
        )}

        {/* TAB 1: GUIDED MIC ENROLLMENT */}
        {activeTab === 'mic' && (
          <div className="enroll-tab-content">
            {/* Stepper */}
            <div className="enrollment-stepper">
              {CALIBRATION_PHRASES.map((p, idx) => (
                <div
                  key={p.id}
                  className={`step-item ${currentStep === idx ? 'current' : ''} ${
                    recordedSamples.length > idx ? 'completed' : ''
                  }`}
                >
                  <div className="step-circle">
                    {recordedSamples.length > idx ? '✓' : idx + 1}
                  </div>
                  <span className="step-label">Muestra {idx + 1}</span>
                </div>
              ))}
            </div>

            {/* Current Phrase Card */}
            <div className="phrase-card">
              <div className="phrase-badge">
                {CALIBRATION_PHRASES[currentStep].title}
              </div>
              <div className="phrase-quote">
                {CALIBRATION_PHRASES[currentStep].quote}
              </div>
              <div className="phrase-hint">
                {CALIBRATION_PHRASES[currentStep].hint}
              </div>
            </div>

            {/* Volume Bar Visualizer */}
            <div className="rec-volume-bar-track">
              <div ref={volumeBarRef} className="rec-volume-bar-fill" style={{ width: '0%' }} />
            </div>

            {/* Controls */}
            <div className="enroll-actions-row">
              {!isRecordingSample ? (
                <button
                  type="button"
                  className="enroll-btn-record start"
                  onClick={startSampleRecording}
                  disabled={isEnrolling}
                >
                  <Mic size={16} />
                  <span>
                    Comenzar a Grabar Frase ({currentStep + 1}/3)
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="enroll-btn-record stop"
                  onClick={stopSampleRecording}
                >
                  <Volume2 size={16} />
                  <span>Detener y Guardar Muestra ({recordingSeconds}s)</span>
                </button>
              )}

              {recordedSamples.length > 0 && !isRecordingSample && (
                <button
                  type="button"
                  className="sm-btn sm-btn-primary"
                  onClick={() => finishEnrollmentFromSamples(recordedSamples)}
                  disabled={isEnrolling}
                >
                  Guardar Perfil ({recordedSamples.length} Muestra{recordedSamples.length !== 1 ? 's' : ''})
                </button>
              )}
            </div>

            {/* Name Input */}
            <div className="enrollment-name-row">
              <span className="enroll-input-label">Tu Nombre de Usuario:</span>
              <input
                type="text"
                className="enroll-text-input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Mi Dueño"
              />
            </div>
          </div>
        )}

        {/* TAB 2: AUDIO FILE UPLOAD */}
        {activeTab === 'file' && (
          <div className="enroll-tab-content">
            <div
              className={`file-dropzone ${isDraggingFile ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleProcessAudioFile(file);
                }}
              />
              <FileAudio size={36} color="#a855f7" />
              <div className="dropzone-text-group">
                <span className="dropzone-title">
                  {selectedFile ? selectedFile.name : 'Haz clic para seleccionar o arrastra tu archivo de audio'}
                </span>
                <span className="dropzone-desc">
                  Formatos soportados: MP3, WAV, M4A, OGG, WEBM, FLAC (con cualquier frase o audio diciendo algo)
                </span>
              </div>
            </div>

            <div className="enrollment-name-row">
              <span className="enroll-input-label">Tu Nombre de Usuario:</span>
              <input
                type="text"
                className="enroll-text-input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Mi Dueño"
              />
            </div>
          </div>
        )}

        {/* TAB 3: LIVE RECOGNITION TEST */}
        {activeTab === 'test' && (
          <div className="enroll-tab-content">
            <p className="test-desc">
              Habla por el micrófono para verificar cómo Cristi reconoce tu voz frente a otras personas en tiempo real.
            </p>

            <div className="rec-volume-bar-track">
              <div ref={testVolumeBarRef} className="rec-volume-bar-fill" style={{ width: '0%' }} />
            </div>

            <div className="enroll-actions-row">
              {!isTesting ? (
                <button type="button" className="enroll-btn-record start" onClick={startLiveTest}>
                  <Mic size={15} />
                  <span>Iniciar Prueba en Vivo</span>
                </button>
              ) : (
                <button type="button" className="enroll-btn-record stop" onClick={stopLiveTest}>
                  <Volume2 size={15} />
                  <span>Detener Prueba</span>
                </button>
              )}
            </div>

            {testResult && (
              <div className={`test-result-card ${testResult.isOwner ? 'match' : 'reject'}`}>
                <div className="test-result-header">
                  {testResult.isOwner ? <CheckCircle2 color="#10b981" /> : <AlertCircle color="#f43f5e" />}
                  <span className="test-result-title">
                    {testResult.isOwner ? `¡Voz Reconocida! (Dueño: ${testResult.speaker})` : 'Hablante Desconocido'}
                  </span>
                </div>
                <div className="test-result-stats">
                  <span>Similitud Coseno: {Math.round(testResult.similarity * 100)}%</span>
                  <span>Confianza: {Math.round(testResult.confidence * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROFILE & THRESHOLDS */}
        {activeTab === 'profile' && (
          <div className="enroll-tab-content">
            <div className="profile-info-card">
              <div className="profile-header-row">
                <span className="profile-owner-name">Usuario Registrado: {ownerName}</span>
                <span className="profile-samples-badge">
                  {speakerRecognitionService.getProfileInfo()?.sampleCount || 1} Muestra(s)
                </span>
              </div>
              <span className="profile-date">
                Registrado: {speakerRecognitionService.getProfileInfo()?.enrolledAt ? new Date(speakerRecognitionService.getProfileInfo().enrolledAt).toLocaleString() : 'N/A'}
              </span>
            </div>

            <div className="thresholds-group">
              <div className="threshold-row">
                <div className="threshold-label-group">
                  <span>Umbral de Aceptación (Match):</span>
                  <strong>{Math.round(matchThreshold * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.01"
                  value={matchThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMatchThreshold(val);
                    speakerRecognitionService.matchThreshold = val;
                    speakerRecognitionService.saveProfile();
                  }}
                />
              </div>

              <div className="threshold-row">
                <div className="threshold-label-group">
                  <span>Umbral de Rechazo (Stranger):</span>
                  <strong>{Math.round(rejectThreshold * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="0.8"
                  step="0.01"
                  value={rejectThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setRejectThreshold(val);
                    speakerRecognitionService.rejectThreshold = val;
                    speakerRecognitionService.saveProfile();
                  }}
                />
              </div>

              <button
                type="button"
                className="enroll-btn-reset"
                onClick={() => {
                  soundFxService.playClick();
                  speakerRecognitionService.clearProfile();
                  try {
                    localStorage.removeItem('cristi_voice_enrolled_v1');
                  } catch {}
                  setActiveTab('mic');
                  setRecordedSamples([]);
                  setCurrentStep(0);
                }}
              >
                <RotateCcw size={13} />
                <span>Borrar Perfil y Volver a Registrar</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="enrollment-footer">
          <span className="samples-status-text">
            {hasProfile ? '✓ Perfil persistente activo' : 'Pendiente de registrar'}
          </span>
          <button
            type="button"
            className="sm-btn sm-btn-secondary"
            onClick={() => {
              try { localStorage.setItem('cristi_voice_enrolled_dismissed_v1', 'true'); } catch {}
              onClose();
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
});

export default VoiceEnrollmentModal;
