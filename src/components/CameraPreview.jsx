/**
 * Cristi AI - Sensory Camera Preview with Windows Hello IR support & Multi-Sample Face Enrollment
 * Modern, Draggable, Ultra-Performant Obsidian Design:
 * - Direct Hardware MediaStream Binding (Zero black-screen guarantee)
 * - Zero-Re-Render Direct GPU Draggable PiP Window
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

  // Zero-Re-Render Drag Engine References
  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });
  const posRef = useRef(() => {
    try {
      const saved = localStorage.getItem('cristi_camera_pip_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: Math.max(10, window.innerWidth - 310), y: 24 };
  });
  const rafIdRef = useRef(null);

  // Position initialization via GPU transform
  useEffect(() => {
    if (!isStreaming) return;
    const initialPos = typeof posRef.current === 'function' ? posRef.current() : posRef.current;
    posRef.current = initialPos;
    if (containerRef.current) {
      containerRef.current.style.transform = `translate3d(${initialPos.x}px, ${initialPos.y}px, 0)`;
    }
  }, [isStreaming]);

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
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
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

  // --- High Performance Zero-Re-Render Drag Handlers ---
  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, select, input')) return;
    e.preventDefault();
    isDraggingRef.current = true;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: posRef.current.x,
      posY: posRef.current.y
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 230, dragStartRef.current.posY + deltaY));

    posRef.current = { x: newX, y: newY };

    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
        }
        rafIdRef.current = null;
      });
    }
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
      localStorage.setItem('cristi_camera_pip_pos', JSON.stringify(posRef.current));
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
      soundFxService.playError();
      setEnrollFeedback({
        success: false,
        message: `Error al registrar: ${err.message}`
      });
    } finally {
      setIsEnrolling(false);
      feedbackTimeoutRef.current = setTimeout(() => {
        setEnrollFeedback(null);
      }, 4000);
    }
  };

  const isOwnerIdentified = detections?.isOwnerPresent;
  const isStranger = detections?.isStrangerAlert;

  const getStatusBadge = () => {
    if (isOwnerIdentified) {
      return { text: 'DUEÑO RECONOCIDO', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' };
    }
    if (isStranger) {
      return { text: 'DESCONOCIDO', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.2)' };
    }
    if (detections?.faceDetected) {
      return { text: 'ROSTRO DETECTADO', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.2)' };
    }
    return { text: 'ESCANEANDO...', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div
      ref={containerRef}
      className={`camera-pip expanded ${showManager ? 'with-manager' : ''}`}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        margin: 0
      }}
      {...interactiveProps}
      onClick={(e) => e.stopPropagation()}
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
          <button
            type="button"
            className={`camera-icon-mini-btn ${isIREnhanced ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              soundFxService.playClick();
              onToggleIREnhancement?.();
            }}
            title="Sensor IR / Windows Hello"
          >
            <SunMedium size={12} />
          </button>

          <button
            type="button"
            className={`camera-icon-mini-btn ${showManager ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              soundFxService.playClick();
              setShowManager((prev) => !prev);
            }}
            title="Administrar Muestras Faciales"
          >
            <Sliders size={12} />
          </button>

          <button
            type="button"
            className="camera-close-mini-btn"
            onClick={(e) => {
              e.stopPropagation();
              soundFxService.playClick();
              onClose?.();
            }}
            title="Cerrar Cámara"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {enrollFeedback && (
        <div className={`camera-feedback-toast ${enrollFeedback.success ? 'success' : 'error'}`}>
          {enrollFeedback.message}
        </div>
      )}

      {/* Collapsible Sample Manager Drawer */}
      {showManager && (
        <div className="camera-manager-drawer">
          {/* Device Switcher */}
          {availableDevices.length > 1 && (
            <div className="camera-device-select-row">
              <span className="camera-mini-label">Dispositivo:</span>
              <select
                className="camera-mini-select"
                value={currentDeviceId || ''}
                onChange={(e) => onSwitchCamera?.(e.target.value)}
              >
                {availableDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label || `Cámara ${dev.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preset Buttons */}
          <div className="camera-preset-buttons-row">
            <button
              type="button"
              className="camera-preset-btn"
              disabled={isEnrolling}
              onClick={() => handleEnrollSample('Con Lentes')}
            >
              <Glasses size={11} />
              <span>Con Lentes</span>
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              disabled={isEnrolling}
              onClick={() => handleEnrollSample('Sin Lentes')}
            >
              <Smile size={11} />
              <span>Sin Lentes</span>
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              disabled={isEnrolling}
              onClick={() => handleEnrollSample('De Perfil')}
            >
              <Camera size={11} />
              <span>De Perfil</span>
            </button>
          </div>

          {/* Samples Counter & Clear Action */}
          <div className="camera-samples-footer">
            <span className="camera-samples-count">
              {ownerSamples.length} muestra{ownerSamples.length !== 1 ? 's' : ''} biométrica{ownerSamples.length !== 1 ? 's' : ''}
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
                Borrar todas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default CameraPreview;
