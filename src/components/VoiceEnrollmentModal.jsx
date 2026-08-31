/**
 * Cristi Desktop - Multi-Sample Speaker Voice Enrollment & Biometric Calibration Modal
 * Allows the primary user to record multiple acoustic samples under normal speaking conditions,
 * verify intra-sample consistency, build the centroid speaker embedding, and calibrate thresholds.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Volume2,
  X,
  Play,
  Square,
  Sliders,
  UserCheck,
  UserX,
  HelpCircle
} from 'lucide-react';
import { speakerRecognitionService } from '../services/audio/SpeakerRecognitionService';
import { logger } from '../services/logger';
import { useClickThrough } from '../hooks/useClickThrough';
import { soundFxService } from '../services/soundFxService';

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

export function VoiceEnrollmentModal({ isOpen, onClose, onEnrolled }) {
  const [activeTab, setActiveTab] = useState('enroll'); // 'enroll' | 'test' | 'settings'
  const [ownerName, setOwnerName] = useState('Mi Dueño');
  const [currentStep, setCurrentStep] = useState(0);
  const [recordedSamples, setRecordedSamples] = useState([]);
  const [isRecordingSample, setIsRecordingSample] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [enrollError, setEnrollError] = useState(null);

  // Live Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [matchThreshold, setMatchThreshold] = useState(speakerRecognitionService.matchThreshold);
  const [rejectThreshold, setRejectThreshold] = useState(speakerRecognitionService.rejectThreshold);

  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const timerRef = useRef(null);
  const modalCardRef = useRef(null);

  const { interactiveProps } = useClickThrough();

  useEffect(() => {
    if (isOpen) {
      soundFxService.playMenuOpen();
      const profile = speakerRecognitionService.getProfileInfo();
      if (profile) {
        setOwnerName(profile.name);
        setMatchThreshold(profile.matchThreshold);
        setRejectThreshold(profile.rejectThreshold);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        soundFxService.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

        // Volume meter
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        setVolumeLevel(Math.min(1, Math.sqrt(sum / input.length) * 5));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsRecordingSample(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setEnrollError(`No se pudo acceder al micrófono: ${err.message}`);
    }
  };

  const stopSampleRecording = () => {
    setIsRecordingSample(false);
    clearInterval(timerRef.current);

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setVolumeLevel(0);

    // Merge audio chunks
    const totalLength = audioChunksRef.current.reduce((acc, c) => acc + c.length, 0);
    if (totalLength < 16000 * 1.0) { // Require at least 1 second
      setEnrollError('La grabación fue demasiado corta. Habla durante al menos 2 segundos.');
      return;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Extract 192D embedding
    const res = speakerRecognitionService.extractEmbedding(merged);
    if (!res || !res.embedding) {
      setEnrollError('No se pudieron extraer características acústicas de la muestra. Intenta hablar más claro.');
      return;
    }

    const newSample = {
      id: ENROLLMENT_PHRASES[currentStep].id,
      label: ENROLLMENT_PHRASES[currentStep].title,
      embedding: res.embedding,
      audioSamples: merged,
      durationSec: (totalLength / 16000).toFixed(1)
    };

    const updated = [...recordedSamples];
    updated[currentStep] = newSample;
    setRecordedSamples(updated);

    if (currentStep < ENROLLMENT_PHRASES.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleFinishEnrollment = () => {
    try {
      setIsEnrolling(true);
      setEnrollError(null);

      speakerRecognitionService.enrollSamples(ownerName, recordedSamples);
      setEnrollSuccess(true);
      setIsEnrolling(false);

      if (onEnrolled) onEnrolled(speakerRecognitionService.getProfileInfo());
      setTimeout(() => {
        setEnrollSuccess(false);
        setActiveTab('test');
      }, 1200);
    } catch (err) {
      setIsEnrolling(false);
      setEnrollError(err.message);
    }
  };

  // Test Speaking Live Verification
  const startLiveTest = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
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
        setVolumeLevel(Math.min(1, Math.sqrt(sum / input.length) * 5));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err) {
      setEnrollError(err.message);
      setIsTesting(false);
    }
  };

  const stopLiveTest = () => {
    setIsTesting(false);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setVolumeLevel(0);

    const totalLength = audioChunksRef.current.reduce((acc, c) => acc + c.length, 0);
    if (totalLength < 16000 * 0.8) {
      setTestResult({ error: 'Grabación de prueba muy corta para verificar.' });
      return;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const decision = speakerRecognitionService.verifySpeaker(merged);
    setTestResult(decision);
  };

  const handleSaveThresholds = () => {
    speakerRecognitionService.setThresholds(matchThreshold, rejectThreshold);
  };

  if (!isOpen) return null;

  return (
    <div className="voice-enrollment-backdrop" {...interactiveProps}>
      <div className="voice-enrollment-modal">
        {/* Tech Corner Crosshairs */}
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-tr" />
        <span className="hud-corner hud-corner-bl" />
        <span className="hud-corner hud-corner-br" />

        {/* Modal Header */}
        <div className="enrollment-header">
          <div className="enrollment-header-left">
            <ShieldCheck size={16} className="text-purple" />
            <div className="enrollment-title-box">
              <span className="enrollment-tag">BIOMETRÍA VOCAL LOCAL</span>
              <h3 className="enrollment-title">Enrolamiento de Identidad Vocal</h3>
            </div>
          </div>
          <button type="button" className="enrollment-close-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="enrollment-nav-tabs">
          <button
            type="button"
            className={`enroll-tab-btn ${activeTab === 'enroll' ? 'active' : ''}`}
            onClick={() => setActiveTab('enroll')}
          >
            <Mic size={13} />
            <span>Registro Multi-Muestra</span>
          </button>
          <button
            type="button"
            className={`enroll-tab-btn ${activeTab === 'test' ? 'active' : ''}`}
            onClick={() => setActiveTab('test')}
          >
            <Sparkles size={13} />
            <span>Probar Verificación</span>
          </button>
          <button
            type="button"
            className={`enroll-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Sliders size={13} />
            <span>Calibración de Umbral</span>
          </button>
        </div>

        {/* TAB 1: Multi-Sample Enrollment Wizard */}
        {activeTab === 'enroll' && (
          <div className="enrollment-body">
            <div className="enrollment-intro">
              <p>
                Cristi registrará tu perfil vocal a partir de <strong>3 muestras de audio</strong> para reconocer
                tu voz con alta precisión y permanecer en silencio cuando hablen terceras personas.
              </p>
            </div>

            {/* Owner Name Input */}
            <div className="enrollment-name-row">
              <label className="enroll-input-label">Nombre del Usuario Principal:</label>
              <input
                type="text"
                className="enroll-text-input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ej. Jeremy"
              />
            </div>

            {/* Stepper Progress */}
            <div className="enrollment-stepper">
              {ENROLLMENT_PHRASES.map((phrase, idx) => (
                <div
                  key={phrase.id}
                  className={`step-item ${currentStep === idx ? 'current' : ''} ${recordedSamples[idx] ? 'completed' : ''}`}
                  onClick={() => !isRecordingSample && setCurrentStep(idx)}
                >
                  <div className="step-circle">
                    {recordedSamples[idx] ? <CheckCircle size={12} /> : idx + 1}
                  </div>
                  <span className="step-label">Paso {idx + 1}</span>
                </div>
              ))}
            </div>

            {/* Current Active Phrase Card */}
            <div className="phrase-card">
              <div className="phrase-card-header">
                <span className="phrase-number">{ENROLLMENT_PHRASES[currentStep].title}</span>
                {recordedSamples[currentStep] && (
                  <span className="phrase-recorded-badge">✓ Muestra Registrada ({recordedSamples[currentStep].durationSec}s)</span>
                )}
              </div>
              <p className="phrase-quote">"{ENROLLMENT_PHRASES[currentStep].text}"</p>
              <span className="phrase-hint">{ENROLLMENT_PHRASES[currentStep].hint}</span>
            </div>

            {/* Recording Controls & Visualizer */}
            <div className="enroll-record-section">
              {isRecordingSample && (
                <div className="recording-wave-indicator">
                  <span className="rec-pulse-dot" />
                  <span className="rec-time-text">Grabando... {recordingSeconds}s</span>
                  <div className="rec-volume-bar-track">
                    <div className="rec-volume-bar-fill" style={{ width: `${volumeLevel * 100}%` }} />
                  </div>
                </div>
              )}

              <div className="record-actions-row">
                {!isRecordingSample ? (
                  <button
                    type="button"
                    className="enroll-btn-record start"
                    onClick={startSampleRecording}
                  >
                    <Mic size={14} />
                    <span>{recordedSamples[currentStep] ? 'Volver a Grabar Muestra' : 'Iniciar Grabación'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="enroll-btn-record stop"
                    onClick={stopSampleRecording}
                  >
                    <Square size={14} />
                    <span>Detener y Procesar Muestra</span>
                  </button>
                )}
              </div>
            </div>

            {enrollError && <div className="enroll-alert-box error">{enrollError}</div>}
            {enrollSuccess && <div className="enroll-alert-box success">¡Perfil biométrico guardado con éxito!</div>}

            {/* Finalize Enrollment Button */}
            <div className="enrollment-footer">
              <span className="samples-status-text">
                {recordedSamples.filter(Boolean).length} de {ENROLLMENT_PHRASES.length} muestras capturadas
              </span>

              <button
                type="button"
                className="enroll-btn-finish"
                disabled={recordedSamples.filter(Boolean).length < 2 || isEnrolling}
                onClick={handleFinishEnrollment}
              >
                <ShieldCheck size={14} />
                <span>{isEnrolling ? 'Generando Vector...' : 'Guardar y Activar Perfil'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Live Speaker Verification Test */}
        {activeTab === 'test' && (
          <div className="enrollment-body">
            <div className="enrollment-intro">
              <p>
                Habla frente al micrófono para verificar en tiempo real si Cristi te reconoce como el dueño
                o si clasifica el audio como voz extraña.
              </p>
            </div>

            <div className="test-record-box">
              {!isTesting ? (
                <button type="button" className="test-mic-btn" onClick={startLiveTest}>
                  <Mic size={16} />
                  <span>Probar Reconocimiento de Voz</span>
                </button>
              ) : (
                <button type="button" className="test-mic-btn active" onClick={stopLiveTest}>
                  <Square size={16} />
                  <span>Detener y Comparar Embeddings</span>
                </button>
              )}

              {isTesting && (
                <div className="test-volume-meter">
                  <div className="test-meter-fill" style={{ width: `${volumeLevel * 100}%` }} />
                </div>
              )}
            </div>

            {/* Test Decision Card */}
            {testResult && (
              <div className={`test-decision-card ${testResult.isOwner ? 'owner-match' : testResult.isOwner === false ? 'stranger-match' : 'uncertain-match'}`}>
                <div className="decision-header">
                  {testResult.isOwner ? (
                    <div className="decision-badge owner">
                      <UserCheck size={14} />
                      <span>DUEÑO CONFIRMADO</span>
                    </div>
                  ) : testResult.isOwner === false ? (
                    <div className="decision-badge stranger">
                      <UserX size={14} />
                      <span>EXTRAÑO / OTRA PERSONA</span>
                    </div>
                  ) : (
                    <div className="decision-badge uncertain">
                      <HelpCircle size={14} />
                      <span>INCIERTO (AMBIGUO)</span>
                    </div>
                  )}
                  <span className="decision-latency">{testResult.latencyMs} ms</span>
                </div>

                <div className="decision-metrics-grid">
                  <div className="metric-box">
                    <span className="metric-label">Similitud Coseno</span>
                    <span className="metric-value">{testResult.score}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Nivel de Confianza</span>
                    <span className="metric-value">{testResult.confidence}%</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Umbral de Aceptación</span>
                    <span className="metric-value">{testResult.matchThreshold}</span>
                  </div>
                </div>

                <p className="decision-explanation">
                  {testResult.isOwner
                    ? 'Cristi procesará tus instrucciones normalmente porque tu voz coincide con el perfil registrado.'
                    : testResult.isOwner === false
                    ? 'Cristi permanecerá en silencio para ignorar la conversación de terceros.'
                    : 'La puntuación está en zona límite. Ajusta el umbral de calibración si es necesario.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Threshold Calibration Settings */}
        {activeTab === 'settings' && (
          <div className="enrollment-body">
            <div className="enrollment-intro">
              <p>
                Ajusta los umbrales de decisión para reducir falsos positivos (aceptar a terceros) o
                falsos negativos (rechazar al dueño por ruido de fondo).
              </p>
            </div>

            <div className="threshold-setting-group">
              <div className="threshold-label-row">
                <span className="thresh-title">Umbral de Aceptación (Match Threshold):</span>
                <span className="thresh-val">{matchThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.55"
                max="0.85"
                step="0.01"
                className="thresh-slider"
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(parseFloat(e.target.value))}
              />
              <span className="thresh-desc">
                Valores más altos (0.75+) exigen mayor exactitud biométrica. Valores estándar (0.68 - 0.72).
              </span>
            </div>

            <div className="threshold-setting-group">
              <div className="threshold-label-row">
                <span className="thresh-title">Umbral de Rechazo de Terceros (Reject Threshold):</span>
                <span className="thresh-val">{rejectThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.40"
                max="0.65"
                step="0.01"
                className="thresh-slider"
                value={rejectThreshold}
                onChange={(e) => setRejectThreshold(parseFloat(e.target.value))}
              />
              <span className="thresh-desc">
                Cualquier audio con similitud inferior a este valor se descartará inmediatamente como extraño.
              </span>
            </div>

            <div className="threshold-footer-actions">
              <button
                type="button"
                className="thresh-btn-reset"
                onClick={() => {
                  setMatchThreshold(0.70);
                  setRejectThreshold(0.52);
                }}
              >
                Restablecer Valores Recomendados
              </button>

              <button
                type="button"
                className="thresh-btn-save"
                onClick={handleSaveThresholds}
              >
                Guardar Calibración
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceEnrollmentModal;
