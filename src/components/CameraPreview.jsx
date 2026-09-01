/**
 * Cristi AI - Sensory Camera Preview with Windows Hello IR support & Multi-Sample Face Enrollment
 * Modern, Draggable, Ultra-Performant Obsidian Design:
 * - Direct Hardware MediaStream Binding (Zero black-screen guarantee)
 * - Draggable PiP Window with Saved Persistent Position
 * - Real-Time AI Canvas Overlays (Face & Object Bounding Boxes)
 * - Device Switcher Dropdown & Windows Hello IR Sensor Enhancements
 * - Multi-Sample Face Enrollment (With/Without Glasses, Angles)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  X,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Camera,
  Glasses,
  Smile,
  Zap,
  Sliders,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  SunMedium
} from 'lucide-react';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';

export const CameraPreview = React.memo(function CameraPreview({
  videoRef,
  overlayCanvasRef,
  isStreaming,
  mediaStream,
  cameraService,
  detections,
  ownerSamples = [],
  availableDevices = [],
  currentDeviceId,
  onSwitchCamera,
  isIREnhanced,
  onToggleIREnhancement,
  onAddSample,
  onDeleteSample,
  onClearAllSamples,
  onClose
}) {
  const { interactiveProps } = useClickThrough();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [customLabel, setCustomLabel] = useState('Con Lentes');
  const [enrollFeedback, setEnrollFeedback] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const feedbackTimeoutRef = useRef(null);

  // Position State (Draggable PiP)
  const [pipPos, setPipPos] = useState(() => {
    try {
      const saved = localStorage.getItem('cristi_camera_pip_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth - 300, y: 24 };
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  // Direct video stream synchronization to guarantee no black screen
  useEffect(() => {
    if (!isStreaming) return;

    const stream = mediaStream || cameraService?.getMediaStream();
    if (videoRef?.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => {
        console.warn('CameraPreview video play notice:', err);
      });
    }
  }, [isStreaming, mediaStream, cameraService, videoRef]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (overlayCanvasRef?.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
        }
      }
    };
  }, [overlayCanvasRef]);

  if (!isStreaming) return null;

  // --- Drag Handlers ---
  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, select, input')) return;
    e.preventDefault();
    isDraggingRef.current = true;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: pipPos.x,
      posY: pipPos.y
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const newX = Math.max(10, Math.min(window.innerWidth - 290, dragStartRef.current.posX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 220, dragStartRef.current.posY + deltaY));

    setPipPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
      localStorage.setItem('cristi_camera_pip_pos', JSON.stringify(pipPos));
    } catch (_) {}
  };

  const handleEnrollSample = async (presetLabel = null) => {
    const labelToUse = presetLabel || customLabel || 'Muestra';
    setIsEnrolling(true);
    setEnrollFeedback(null);
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    try {
      soundFxService.playClick();
      await onAddSample(labelToUse);
      soundFxService.playConnect();
      setEnrollFeedback({
        success: true,
        message: `¡Muestra "${labelToUse}" guardada! (${ownerSamples.length + 1} en total).`
      });
    } catch (err) {
      soundFxService.playDisconnect();
      setEnrollFeedback({
        success: false,
        message: err.message || 'Error al capturar muestra facial.'
      });
    } finally {
      setIsEnrolling(false);
      feedbackTimeoutRef.current = setTimeout(() => setEnrollFeedback(null), 3500);
    }
  };

  const facesCount = detections?.faces?.length || 0;
  const sceneState = detections?.sceneState || 'NO_ONE';

  let statusBadge = {
    text: 'Buscando...',
    color: '#94a3b8',
    bg: 'rgba(15, 23, 42, 0.85)'
  };

  if (sceneState === 'OWNER_ALONE') {
    statusBadge = {
      text: `♥ Dueño (${ownerSamples.length} muestras)`,
      color: '#c084fc',
      bg: 'rgba(88, 28, 135, 0.88)'
    };
  } else if (sceneState === 'OWNER_WITH_OTHERS') {
    statusBadge = {
      text: `⚠ Dueño + ${facesCount - 1} Extraño(s)`,
      color: '#f43f5e',
      bg: 'rgba(159, 18, 57, 0.92)'
    };
  } else if (sceneState === 'STRANGER_ONLY') {
    statusBadge = {
      text: `⚠ ${facesCount} Desconocido(s)`,
      color: '#fbbf24',
      bg: 'rgba(180, 83, 9, 0.9)'
    };
  }

  const pipStyle = {
    position: 'fixed',
    left: `${pipPos.x}px`,
    top: `${pipPos.y}px`,
    transform: 'none'
  };

  return (
    <div
      className={`camera-pip expanded ${showManager ? 'with-manager' : ''}`}
      style={pipStyle}
      {...interactiveProps}
    >
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />

      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-video-feed"
        onLoadedMetadata={(e) => {
          if (overlayCanvasRef?.current) {
            overlayCanvasRef.current.width = e.target.videoWidth || 640;
            overlayCanvasRef.current.height = e.target.videoHeight || 480;
          }
        }}
      />

      {/* AI HUD Canvas Overlay */}
      <canvas ref={overlayCanvasRef} className="camera-hud-canvas" />

      {/* Draggable Header Bar */}
      <div
        className="camera-header-bar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: 'grab', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GripHorizontal size={13} color="#94a3b8" />
          <div className="camera-status-pill" style={{ background: statusBadge.bg, color: statusBadge.color }}>
            <div className="camera-rec-dot" />
            <span>{statusBadge.text}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* IR Filter Toggle */}
          <button
            type="button"
            className={`camera-icon-mini-btn ${isIREnhanced ? 'active' : ''}`}
            onClick={() => {
              soundFxService.playClick();
              onToggleIREnhancement?.();
            }}
            title={isIREnhanced ? 'Desactivar Filtro IR' : 'Activar Filtro Infrarrojo / Windows Hello'}
          >
            <SunMedium size={11} />
          </button>

          {/* Sample Manager Toggle */}
          <button
            type="button"
            className={`camera-icon-mini-btn ${showManager ? 'active' : ''}`}
            onClick={() => {
              soundFxService.playClick();
              setShowManager(!showManager);
            }}
            title="Administrador de Muestras Faciales"
          >
            <Sliders size={11} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            className="camera-close-mini-btn"
            onClick={() => {
              soundFxService.playClick();
              onClose?.();
            }}
            title="Cerrar Cámara"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {enrollFeedback && (
        <div className={`camera-feedback-toast ${enrollFeedback.success ? 'success' : 'error'}`}>
          <span>{enrollFeedback.message}</span>
        </div>
      )}

      {/* Expandable Device & Face Sample Manager */}
      {showManager && (
        <div className="camera-manager-drawer">
          {/* Device Selector */}
          {availableDevices.length > 1 && (
            <div className="camera-device-select-row">
              <label className="camera-mini-label">Dispositivo:</label>
              <select
                className="camera-mini-select"
                value={currentDeviceId}
                onChange={(e) => {
                  soundFxService.playClick();
                  onSwitchCamera?.(e.target.value);
                }}
              >
                {availableDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.isIR ? '👁 IR: ' : '📷 '}{d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div className="camera-preset-buttons-row">
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => handleEnrollSample('Con Lentes')}
              disabled={isEnrolling}
            >
              <Glasses size={11} />
              <span>Con Lentes</span>
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => handleEnrollSample('Sin Lentes')}
              disabled={isEnrolling}
            >
              <Smile size={11} />
              <span>Sin Lentes</span>
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => handleEnrollSample('Perfil / Ángulo')}
              disabled={isEnrolling}
            >
              <UserPlus size={11} />
              <span>De Perfil</span>
            </button>
          </div>

          {/* Existing Samples Count & Clear */}
          <div className="camera-samples-footer">
            <span className="camera-samples-count">
              {ownerSamples.length} muestra(s) biométricas
            </span>
            {ownerSamples.length > 0 && (
              <button
                type="button"
                className="camera-clear-samples-btn"
                onClick={() => {
                  soundFxService.playClick();
                  onClearAllSamples?.();
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
