import React, { useState } from 'react';
import {
  Eye,
  X,
  UserCheck,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Trash2,
  Camera,
  Glasses,
  Smile,
  Zap,
  Sliders
} from 'lucide-react';
import { useClickThrough } from '../hooks/useClickThrough';

/**
 * Cristi AI - Sensory Camera Preview with Windows Hello IR support & Multi-Sample Face Enrollment
 */
export function CameraPreview({
  videoRef,
  overlayCanvasRef,
  isStreaming,
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
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [customLabel, setCustomLabel] = useState('Con Lentes');
  const [enrollFeedback, setEnrollFeedback] = useState(null);
  const [showManager, setShowManager] = useState(false);

  if (!isStreaming) return null;

  const handleEnrollSample = async (presetLabel = null) => {
    const labelToUse = presetLabel || customLabel || 'Muestra';
    setIsEnrolling(true);
    setEnrollFeedback(null);

    try {
      await onAddSample(labelToUse);
      setEnrollFeedback({
        success: true,
        message: `¡Muestra "${labelToUse}" guardada! (${ownerSamples.length + 1} en total).`
      });
    } catch (err) {
      setEnrollFeedback({
        success: false,
        message: err.message || 'Error al capturar muestra facial.'
      });
    } finally {
      setIsEnrolling(false);
      setTimeout(() => setEnrollFeedback(null), 3500);
    }
  };

  const facesCount = detections?.faces?.length || 0;
  const objectsCount = detections?.objects?.length || 0;
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

  const { interactiveProps } = useClickThrough();

  return (
    <div className={`camera-pip expanded ${showManager ? 'with-manager' : ''}`} {...interactiveProps}>
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />

      {/* Video Feed */}
      <video ref={videoRef} autoPlay playsInline muted className="camera-video-feed" />

      {/* AI HUD Canvas Overlay */}
      <canvas ref={overlayCanvasRef} className="camera-hud-canvas" />

      {/* Header Bar */}
      <div className="camera-header-bar">
        <div className="camera-status-pill" style={{ background: statusBadge.bg, color: statusBadge.color }}>
          <div className="camera-rec-dot" />
          <span>{statusBadge.text}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className={`camera-icon-mini-btn ${showManager ? 'active' : ''}`}
            onClick={() => setShowManager(!showManager)}
            title="Administrador de Muestras (Con/Sin Lentes)"
          >
            <Sliders size={12} />
          </button>
          <button className="camera-close-btn" onClick={onClose}>
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Enrollment Feedback Toast */}
      {enrollFeedback && (
        <div
          className="enrollment-toast"
          style={{
            background: enrollFeedback.success ? 'rgba(88, 28, 135, 0.95)' : 'rgba(159, 18, 57, 0.95)',
            border: `1px solid ${enrollFeedback.success ? '#c084fc' : '#f43f5e'}`
          }}
        >
          {enrollFeedback.success ? <Sparkles size={13} color="#c084fc" /> : <ShieldAlert size={13} color="#f43f5e" />}
          <span>{enrollFeedback.message}</span>
        </div>
      )}

      {/* Manager Drawer (Multi-Sample & Windows Hello IR Settings) */}
      {showManager && (
        <div className="camera-manager-drawer">
          <div className="manager-title">
            <span>Sensores & Muestras Biométricas</span>
            <span style={{ color: 'var(--color-primary)' }}>{ownerSamples.length} guardadas</span>
          </div>

          {/* Device Selector (with Windows Hello / IR tag) */}
          {availableDevices.length > 1 && (
            <div className="manager-section">
              <label>Seleccionar Cámara:</label>
              <select
                className="manager-select"
                value={currentDeviceId || ''}
                onChange={(e) => onSwitchCamera(e.target.value)}
              >
                {availableDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.isIR ? '👁 [IR Windows Hello] ' : '📹 '}
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preset Buttons for Quick Capture */}
          <div className="manager-section">
            <label>Añadir Muestra de Rostro:</label>
            <div className="quick-presets-grid">
              <button
                className="preset-btn"
                onClick={() => handleEnrollSample('Con Lentes')}
                disabled={isEnrolling}
              >
                <Glasses size={11} />
                <span>+ Con Lentes</span>
              </button>
              <button
                className="preset-btn"
                onClick={() => handleEnrollSample('Sin Lentes')}
                disabled={isEnrolling}
              >
                <Eye size={11} />
                <span>+ Sin Lentes</span>
              </button>
              <button
                className="preset-btn"
                onClick={() => handleEnrollSample('Sonriendo')}
                disabled={isEnrolling}
              >
                <Smile size={11} />
                <span>+ Sonriendo</span>
              </button>
              <button
                className="preset-btn"
                onClick={() => handleEnrollSample('Perfil / Inclinado')}
                disabled={isEnrolling}
              >
                <Zap size={11} />
                <span>+ Perfil</span>
              </button>
            </div>
          </div>

          {/* Enrolled Samples List */}
          {ownerSamples.length > 0 && (
            <div className="manager-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label>Muestras Activas:</label>
                <button className="clear-all-btn" onClick={onClearAllSamples}>
                  Borrar Todo
                </button>
              </div>
              <div className="samples-chip-list">
                {ownerSamples.map((s) => (
                  <div key={s.id} className="sample-chip">
                    <span>{s.label}</span>
                    <button onClick={() => onDeleteSample(s.id)}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IR Optimization Switch */}
          <div className="manager-switch-row">
            <span>Optimizar Sensor IR / Poca Luz:</span>
            <input
              type="checkbox"
              checked={isIREnhanced}
              onChange={onToggleIREnhancement}
              style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
          </div>
        </div>
      )}

      {/* Footer Bar */}
      <div className="camera-footer-bar">
        <span className="camera-stats-label">
          {facesCount} Rostro(s) • {objectsCount} Objeto(s)
        </span>

        {ownerSamples.length === 0 ? (
          <button
            className="enroll-btn"
            onClick={() => handleEnrollSample('Con Lentes')}
            disabled={isEnrolling}
          >
            <UserPlus size={11} />
            <span>{isEnrolling ? 'Capturando...' : 'Registrar Dueño'}</span>
          </button>
        ) : (
          <button
            className="enroll-btn"
            onClick={() => setShowManager(true)}
            title="Administrar muestras con/sin lentes"
          >
            <Sparkles size={11} />
            <span>+ Muestra</span>
          </button>
        )}
      </div>
    </div>
  );
}
