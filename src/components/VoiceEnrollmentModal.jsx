/**
 * Cristi Desktop - Specialized Speaker Voice Enrollment & Biometric Calibration Modal
 * Modern, Draggable, Ultra-Performant Obsidian Design:
 * - Live Microphone Recording (Express 1-Click or 3-Sample Guided)
 * - Pre-Recorded Audio File Import & Drag & Drop (.wav, .mp3, .ogg, .m4a, .webm, .flac)
 * - Permanent Local Persistence (Only prompted once upon initial setup)
 * - Live Test Verification & Threshold Calibration
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Upload,
  CheckCircle,
  Sparkles,
  ShieldCheck,
  X,
  Square,
  Sliders,
  UserCheck,
  UserX,
  HelpCircle,
  FileAudio,
  GripHorizontal,
  RotateCcw,
  Volume2
} from 'lucide-react';
import { speakerRecognitionService } from '../services/audio/SpeakerRecognitionService.js';
import { soundFxService } from '../services/soundFxService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';

const ENROLLMENT_PHRASES = [
  {
    id: 'phrase_1',
    title: 'Muestra 1: Saludo Natural',
    text: 'Hola Cristi, soy tu usuario principal y esta es mi voz natural.',
    hint: 'Habla con tu tono de conversación cotidiano y a distancia normal del micrófono.'
  },
  {
    id: 'phrase_2',
    title: 'Muestra 2: Comando e Instrucción',
    text: 'Cristi, activa los sistemas de escritorio y verifica mi identidad vocal.',
    hint: 'Habla con claridad y firmeza como si estuvieras dictando un comando directo.'
  },
  {
    id: 'phrase_3',
    title: 'Muestra 3: Frase Fluida',
    text: 'Hoy es un día productivo, continuemos trabajando juntos.',
    hint: 'Lee de forma fluida a ritmo natural para capturar tus patrones de entonación.'
  }
];

export const VoiceEnrollmentModal = React.memo(function VoiceEnrollmentModal({
  isOpen,
  onClose,
  onEnrolled
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

  // Drag Position State
  const [modalPos, setModalPos] = useState(() => {
    try {
      const saved = localStorage.getItem('cristi_voice_modal_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: null, y: null }; // null = auto center
  });
  const isDraggingModalRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const timerRef = useRef(null);
  const volumeBarRef = useRef(null);
  const testVolumeBarRef = useRef(null);

  const hasProfile = speakerRecognitionService.hasEnrolledProfile();

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

  // --- Modal Dragging Handlers ---
  const handleHeaderPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, select')) return;
    e.preventDefault();
    isDraggingModalRef.current = true;

    const modalEl = e.currentTarget.closest('.voice-enrollment-modal');
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
    if (!isDraggingModalRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 200, dragStartRef.current.posY + deltaY));

    setModalPos({ x: newX, y: newY });
  };

  const handleHeaderPointerUp = (e) => {
    if (!isDraggingModalRef.current) return;
    isDraggingModalRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (modalPos.x !== null) {
        localStorage.setItem('cristi_voice_modal_pos', JSON.stringify(modalPos));
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
        const copy = new Float32Array(input.length);
        copy.set(input);
        audioChunksRef.current.push(copy);

        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.min(1, Math.sqrt(sum / input.length) * 5);
        if (volumeBarRef.current) {
          volumeBarRef.current.style.width = `${Math.round(rms * 100)}%`;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsRecordingSample(true);
      setRecordingSeconds(0);
      soundFxService.playClick();

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setEnrollError(`No se pudo acceder al micrófono: ${err.message}`);
      cleanupAudioResources();
    }
  };

  const stopSampleRecording = () => {
    soundFxService.playClick();
    setIsRecordingSample(false);

    let totalLength = 0;
    audioChunksRef.current.forEach((c) => (totalLength += c.length));
    const mergedAudio = new Float32Array(totalLength);
    let offset = 0;
    audioChunksRef.current.forEach((c) => {
      mergedAudio.set(c, offset);
      offset += c.length;
    });

    cleanupAudioResources();

    if (totalLength < 16000 * 0.8) {
      setEnrollError('Grabación demasiado corta. Por favor habla al menos 1 segundo.');
      return;
    }

    try {
      const res = speakerRecognitionService.extractEmbedding(mergedAudio);
      if (!res || !res.embedding) {
        setEnrollError('No se pudo extraer la huella acústica. Intenta en un entorno más silencioso.');
        return;
      }

      const sampleData = {
        id: `sample_${currentStep + 1}`,
        label: ENROLLMENT_PHRASES[currentStep]?.title || `Muestra ${currentStep + 1}`,
        embedding: res.embedding,
        durationSeconds: (totalLength / 16000).toFixed(1)
      };

      const updated = [...recordedSamples, sampleData];
      setRecordedSamples(updated);

      if (currentStep < ENROLLMENT_PHRASES.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        finishEnrollment(updated);
      }
    } catch (err) {
      setEnrollError(`Error al procesar muestra: ${err.message}`);
    }
  };

  // --- Single Express Enrollment ---
  const finishEnrollment = async (samplesToUse = recordedSamples) => {
    if (samplesToUse.length < 1) {
      setEnrollError('Graba al menos una muestra para guardar tu perfil.');
      return;
    }

    setIsEnrolling(true);
    setEnrollError(null);

    try {
      const profile = speakerRecognitionService.enrollSamples(ownerName, samplesToUse);
      try {
        localStorage.setItem('cristi_voice_enrolled_v1', 'true');
        localStorage.setItem('cristi_voice_enrolled_dismissed_v1', 'true');
      } catch {}

      soundFxService.playConnect();
      setEnrollSuccess(true);
      onEnrolled?.(profile);

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setEnrollError(err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  // --- File Upload & Drag-and-Drop Enrollment ---
  const handleFileSelected = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setIsEnrolling(true);
    setEnrollError(null);

    try {
      soundFxService.playClick();
      const profile = await speakerRecognitionService.enrollFromAudioFile(
        file,
        ownerName,
        file.name
      );

      try {
        localStorage.setItem('cristi_voice_enrolled_v1', 'true');
        localStorage.setItem('cristi_voice_enrolled_dismissed_v1', 'true');
      } catch {}

      soundFxService.playConnect();
      setEnrollSuccess(true);
      onEnrolled?.(profile);

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setEnrollError(`Error al analizar archivo de audio: ${err.message}`);
    } finally {
      setIsEnrolling(false);
    }
  };

  // --- Live Verification Test ---
  const startLiveTest = async () => {
    try {
      setTestResult(null);
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
        const copy = new Float32Array(input.length);
        copy.set(input);
        audioChunksRef.current.push(copy);

        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.min(1, Math.sqrt(sum / input.length) * 5);
        if (testVolumeBarRef.current) {
          testVolumeBarRef.current.style.width = `${Math.round(rms * 100)}%`;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsTesting(true);
      soundFxService.playClick();
    } catch (err) {
      setEnrollError(`No se pudo iniciar la prueba: ${err.message}`);
      cleanupAudioResources();
    }
  };

  const stopLiveTest = () => {
    soundFxService.playClick();
    setIsTesting(false);

    let totalLength = 0;
    audioChunksRef.current.forEach((c) => (totalLength += c.length));
    const mergedAudio = new Float32Array(totalLength);
    let offset = 0;
    audioChunksRef.current.forEach((c) => {
      mergedAudio.set(c, offset);
      offset += c.length;
    });

    cleanupAudioResources();

    if (totalLength < 16000 * 0.5) {
      setEnrollError('Habla al menos medio segundo para probar tu voz.');
      return;
    }

    const decision = speakerRecognitionService.verifySpeaker(mergedAudio);
    setTestResult(decision);
    if (decision.isOwner) {
      soundFxService.playConnect();
    } else {
      soundFxService.playDisconnect();
    }
  };

  if (!isOpen) return null;

  const currentPhrase = ENROLLMENT_PHRASES[currentStep] || ENROLLMENT_PHRASES[0];

  const modalStyle = modalPos.x !== null ? {
    position: 'fixed',
    left: `${modalPos.x}px`,
    top: `${modalPos.y}px`,
    transform: 'none'
  } : {};

  return (
    <div className="voice-enrollment-backdrop" {...interactiveProps} onClick={onClose}>
      <div
        className="voice-enrollment-modal"
        style={modalStyle}
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

        {/* Success Alert */}
        {enrollSuccess && (
          <div className="enroll-success-banner">
            <CheckCircle size={16} color="#10b981" />
            <span>¡Perfil biométrico guardado con éxito! Cristi solo responderá a tu voz.</span>
          </div>
        )}

        {/* Error Alert */}
        {enrollError && (
          <div className="enroll-error-banner">
            <X size={14} color="#f43f5e" />
            <span>{enrollError}</span>
          </div>
        )}

        {/* TAB 1: LIVE MIC RECORDING */}
        {activeTab === 'mic' && (
          <div className="enroll-tab-content">
            <div className="enrollment-stepper">
              {ENROLLMENT_PHRASES.map((p, idx) => {
                const isCompleted = idx < recordedSamples.length;
                const isCurrent = idx === currentStep;
                return (
                  <div
                    key={p.id}
                    className={`step-item ${isCompleted ? 'completed' : isCurrent ? 'current' : ''}`}
                  >
                    <div className="step-circle">
                      {isCompleted ? <CheckCircle size={12} /> : idx + 1}
                    </div>
                    <span className="step-label">Muestra {idx + 1}</span>
                  </div>
                );
              })}
            </div>

            <div className="phrase-card">
              <span className="phrase-badge">{currentPhrase.title}</span>
              <p className="phrase-quote">"{currentPhrase.text}"</p>
              <p className="phrase-hint">{currentPhrase.hint}</p>
            </div>

            {/* Volume Meter */}
            <div className="rec-volume-bar-track">
              <div ref={volumeBarRef} className="rec-volume-bar-fill" style={{ width: '0%' }} />
            </div>

            {/* Record Action Buttons */}
            <div className="enroll-actions-row">
              {!isRecordingSample ? (
                <button
                  type="button"
                  className="enroll-btn-record start"
                  onClick={startSampleRecording}
                  disabled={isEnrolling}
                >
                  <Mic size={15} />
                  <span>Comenzar a Grabar Frase ({currentStep + 1}/3)</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="enroll-btn-record stop"
                  onClick={stopSampleRecording}
                >
                  <Square size={15} />
                  <span>Detener Grabación ({recordingSeconds}s)</span>
                </button>
              )}

              {recordedSamples.length > 0 && !isRecordingSample && (
                <button
                  type="button"
                  className="enroll-btn-finish"
                  onClick={() => finishEnrollment()}
                  disabled={isEnrolling}
                >
                  <CheckCircle size={14} />
                  <span>Guardar con {recordedSamples.length} muestra(s)</span>
                </button>
              )}
            </div>

            <div className="enrollment-name-row">
              <label className="enroll-input-label">Tu Nombre de Usuario:</label>
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

        {/* TAB 2: AUDIO FILE IMPORT */}
        {activeTab === 'file' && (
          <div className="enroll-tab-content">
            <div
              className={`file-dropzone ${isDraggingFile ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                if (e.dataTransfer.files?.[0]) {
                  handleFileSelected(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm,.flac"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />
              <FileAudio size={36} color="#a855f7" />
              <div className="dropzone-text-group">
                <span className="dropzone-title">Haz clic para seleccionar o arrastra tu archivo de audio</span>
                <span className="dropzone-desc">Formatos soportados: MP3, WAV, M4A, OGG, WEBM, FLAC (con cualquier frase o audio diciendo algo)</span>
              </div>
            </div>

            <div className="enrollment-name-row" style={{ marginTop: '12px' }}>
              <label className="enroll-input-label">Tu Nombre de Usuario:</label>
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

        {/* TAB 3: LIVE VERIFICATION TEST */}
        {activeTab === 'test' && hasProfile && (
          <div className="enroll-tab-content">
            <p className="test-desc">
              Habla por tu micrófono. Cristi calculará la similitud coseno de tu vector de 192 dimensiones con el perfil guardado.
            </p>

            <div className="rec-volume-bar-track">
              <div ref={testVolumeBarRef} className="rec-volume-bar-fill" style={{ width: '0%' }} />
            </div>

            <div className="enroll-actions-row">
              {!isTesting ? (
                <button type="button" className="enroll-btn-record start" onClick={startLiveTest}>
                  <Mic size={15} />
                  <span>Probar Mi Voz Ahora</span>
                </button>
              ) : (
                <button type="button" className="enroll-btn-record stop" onClick={stopLiveTest}>
                  <Square size={15} />
                  <span>Verificar Similitud</span>
                </button>
              )}
            </div>

            {testResult && (
              <div className={`test-result-card ${testResult.isOwner ? 'match' : 'reject'}`}>
                <div className="test-result-header">
                  {testResult.isOwner ? (
                    <UserCheck size={18} color="#10b981" />
                  ) : (
                    <UserX size={18} color="#f43f5e" />
                  )}
                  <span className="test-result-title">
                    {testResult.isOwner ? '¡Voz del Dueño Reconocida!' : 'Voz no autorizada / Desconocida'}
                  </span>
                </div>
                <div className="test-result-stats">
                  <span>Similitud: <strong>{(testResult.score * 100).toFixed(1)}%</strong></span>
                  <span>Confianza: <strong>{testResult.confidence}%</strong></span>
                  <span>Latencia: <strong>{testResult.latencyMs}ms</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROFILE & THRESHOLDS */}
        {activeTab === 'profile' && hasProfile && (
          <div className="enroll-tab-content">
            <div className="profile-info-card">
              <div className="profile-header-row">
                <span className="profile-owner-name">👤 Usuario Registrado: {ownerName}</span>
                <span className="profile-samples-badge">
                  {speakerRecognitionService.getProfileInfo()?.sampleCount || 1} muestra(s) activas
                </span>
              </div>
              <p className="profile-date">
                Registrado el: {new Date(speakerRecognitionService.getProfileInfo()?.enrolledAt || Date.now()).toLocaleString()}
              </p>
            </div>

            <div className="thresholds-group">
              <div className="threshold-row">
                <div className="threshold-label-group">
                  <span>Umbral de Aceptación (Match Threshold):</span>
                  <strong>{matchThreshold.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.9"
                  step="0.02"
                  className="sm-range-slider"
                  value={matchThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMatchThreshold(val);
                    speakerRecognitionService.setThresholds(val, rejectThreshold);
                  }}
                />
              </div>

              <div className="threshold-row">
                <div className="threshold-label-group">
                  <span>Umbral de Rechazo (Reject Threshold):</span>
                  <strong>{rejectThreshold.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="0.7"
                  step="0.02"
                  className="sm-range-slider"
                  value={rejectThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setRejectThreshold(val);
                    speakerRecognitionService.setThresholds(matchThreshold, val);
                  }}
                />
              </div>
            </div>

            <div className="profile-actions-row">
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
