/**
 * Cristi Desktop - Live Speaker Recognition Diagnostic HUD
 * Shows real-time speaker identification status, similarity score bar,
 * inference latency, and quick actions to open the enrollment wizard.
 */

import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Activity, User, UserX, Sliders } from 'lucide-react';
import { speakerRecognitionService } from '../services/audio/SpeakerRecognitionService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';

export function SpeakerDiagnosticsHUD({ onOpenEnrollment }) {
  const [telemetry, setTelemetry] = useState(() => ({
    hasProfile: speakerRecognitionService.hasEnrolledProfile(),
    ownerName: speakerRecognitionService.ownerProfile?.name || null,
    sampleCount: speakerRecognitionService.ownerProfile?.samples?.length || 0,
    matchThreshold: speakerRecognitionService.matchThreshold,
    rejectThreshold: speakerRecognitionService.rejectThreshold,
    lastDecision: speakerRecognitionService.lastDecision
  }));

  useEffect(() => {
    const unsubscribe = speakerRecognitionService.onTelemetry((data) => {
      setTelemetry(data);
    });
    return unsubscribe;
  }, []);

  const decision = telemetry.lastDecision;
  const isOwner = decision?.isOwner;
  const score = decision?.score ?? 0;
  const confidence = decision?.confidence ?? 0;

  const { interactiveProps } = useClickThrough();

  return (
    <div className="speaker-hud-container" {...interactiveProps}>
      {/* Tech border crosshairs */}
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />

      {/* Header */}
      <div className="speaker-hud-header">
        <div className="hud-header-title-row">
          {telemetry.hasProfile ? (
            <ShieldCheck size={13} className="text-emerald" />
          ) : (
            <ShieldAlert size={13} className="text-amber" />
          )}
          <span className="speaker-hud-title">VOICE ID // S2S BIOMETRICS</span>
        </div>

        <button
          type="button"
          className="speaker-hud-settings-btn"
          onClick={onOpenEnrollment}
          title="Abrir Asistente de Enrolamiento y Calibración de Voz"
        >
          <Sliders size={12} />
        </button>
      </div>

      {/* Profile summary */}
      <div className="speaker-hud-profile-row">
        <span className="hud-profile-label">
          {telemetry.hasProfile ? `Perfil: ${telemetry.ownerName} (${telemetry.sampleCount} muestras)` : 'Sin perfil enrolado'}
        </span>
        {decision && (
          <span className="hud-latency-tag">{decision.latencyMs}ms</span>
        )}
      </div>

      {/* Live Identification Status */}
      <div className="speaker-hud-status-row">
        {isOwner === true ? (
          <div className="speaker-status-pill owner">
            <User size={12} />
            <span>DUEÑO RECONOCIDO ({confidence}%)</span>
          </div>
        ) : isOwner === false ? (
          <div className="speaker-status-pill stranger">
            <UserX size={12} />
            <span>EXTRAÑO / TERCERO ({confidence}%)</span>
          </div>
        ) : (
          <div className="speaker-status-pill idle">
            <Activity size={12} />
            <span>EN ESPERA DE VOZ</span>
          </div>
        )}
      </div>

      {/* Similarity Score Progress Bar */}
      {decision && (
        <div className="speaker-score-progress-wrap">
          <div className="speaker-score-labels">
            <span>Score Coseno: {score.toFixed(3)}</span>
            <span>Umbral: {telemetry.matchThreshold.toFixed(2)}</span>
          </div>
          <div className="speaker-score-track">
            <div
              className={`speaker-score-fill ${isOwner ? 'owner' : isOwner === false ? 'stranger' : 'neutral'}`}
              style={{ width: `${Math.max(5, Math.min(100, ((score + 1) / 2) * 100))}%` }}
            />
            {/* Threshold Marker */}
            <div
              className="speaker-threshold-marker"
              style={{ left: `${((telemetry.matchThreshold + 1) / 2) * 100}%` }}
              title={`Umbral de aceptación: ${telemetry.matchThreshold}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SpeakerDiagnosticsHUD;
