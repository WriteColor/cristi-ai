import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  Mic,
  Volume2,
  Lock as LockIcon,
  Sparkles
} from 'lucide-react';
import { lockScreenService } from '../services/desktop/LockScreenService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';

/**
 * Cristi AI - Specialized Windows 11 Lock Screen Tactical Widget
 * Displays high-contrast tactical companion state, active Cristi alarms/reminders,
 * and background voice status when Windows 11 lock screen is active.
 */
export function LockScreenWidget({ isLocked = false, isListening = false, isSpeaking = false, activeModelName = 'Cristi AI' }) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [configStatus, setConfigStatus] = useState(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEnableWindowsLockScreenToast = async () => {
    const res = await lockScreenService.configureWindows11LockScreenSettings();
    setConfigStatus(res.message);
    setTimeout(() => setConfigStatus(null), 6000);
  };

  const { interactiveProps } = useClickThrough();

  if (!isLocked) return null;

  return (
    <div className="lockscreen-overlay-container" {...interactiveProps}>
      <div className="lockscreen-tactical-card">
        {/* Tech Corner Crosshairs */}
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-tr" />
        <span className="hud-corner hud-corner-bl" />
        <span className="hud-corner hud-corner-br" />

        {/* Lock Screen Header */}
        <div className="lockscreen-header">
          <div className="lockscreen-header-left">
            <LockIcon size={13} className="lockscreen-icon-lock" />
            <span className="lockscreen-title">CRISTI // LOCK SCREEN COMPANION</span>
          </div>
          <span className="lockscreen-badge">WIN 11 ACTIVE</span>
        </div>

        {/* Big Digital Clock */}
        <div className="lockscreen-clock-row">
          <span className="lockscreen-time">{time}</span>
          <span className="lockscreen-date">{date}</span>
        </div>

        {/* Voice Presence Live Wave */}
        <div className="lockscreen-presence-status">
          <div className="lockscreen-presence-indicator">
            {isSpeaking ? (
              <Volume2 size={14} className="icon-pulse text-purple" />
            ) : isListening ? (
              <Mic size={14} className="icon-pulse text-cyan" />
            ) : (
              <Sparkles size={14} className="text-emerald" />
            )}
            <span className="lockscreen-presence-text">
              {isSpeaking ? 'Cristi está hablando...' : isListening ? 'Escuchando tu voz en segundo plano' : 'Voz en espera (Di tu comando)'}
            </span>
          </div>
          <span className="lockscreen-model-name">{activeModelName}</span>
        </div>

        {/* Windows 11 Lock Screen Settings Helper */}
        <div className="lockscreen-footer-helper">
          <button
            type="button"
            className="lockscreen-config-btn"
            onClick={handleEnableWindowsLockScreenToast}
          >
            <ShieldCheck size={12} />
            <span>Verificar Permisos de Pantalla de Bloqueo Win11</span>
          </button>
          {configStatus && <p className="lockscreen-status-msg">{configStatus}</p>}
        </div>
      </div>
    </div>
  );
}

export default React.memo(LockScreenWidget);
