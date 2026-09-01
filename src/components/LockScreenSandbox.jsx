import React, { useState, useEffect, useRef } from 'react';
import {
  Lock as LockIcon,
  Unlock,
  Bell,
  Clock,
  Mic,
  Volume2,
  Sparkles,
  ExternalLink,
  X,
  Wifi,
  BatteryCharging,
  Power,
  ChevronUp,
  Layout,
  MessageSquare,
  Sliders
} from 'lucide-react';
import { lockScreenService } from '../services/desktop/LockScreenService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';

const WALLPAPERS = [
  { id: 'aurora', name: 'Win11 Aurora Bloom', gradient: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 45%, #020617 100%)' },
  { id: 'cyber', name: 'Cyberpunk Purple', gradient: 'radial-gradient(circle at 50% 30%, #3b0764 0%, #18022e 50%, #05010d 100%)' },
  { id: 'spotlight', name: 'Windows Spotlight', gradient: 'radial-gradient(ellipse at bottom, #064e3b 0%, #022c22 40%, #030712 100%)' },
  { id: 'dark', name: 'Minimalist Obsidian', gradient: 'radial-gradient(circle at center, #111827 0%, #030712 100%)' }
];

export const LockScreenSandbox = React.memo(function LockScreenSandbox({
  isOpen = false,
  onClose,
  activeModelName = 'Cristi Gótica (Yandere Girl)'
}) {
  const [isLocked, setIsLocked] = useState(true);
  const [selectedWallpaper, setSelectedWallpaper] = useState(WALLPAPERS[0]);
  const [companionLayout, setCompanionLayout] = useState('corner'); // 'corner', 'center', 'bottom'
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  // Voice Simulation State
  const [voiceState, setVoiceState] = useState('idle'); // 'idle', 'listening', 'speaking'
  const [simulatedTranscript, setSimulatedTranscript] = useState('');
  const [cristiReply, setCristiReply] = useState('');
  const [audioWaves, setAudioWaves] = useState([12, 24, 18, 32, 14, 28, 40, 20, 16, 26, 35, 15]);

  // Escape key handler & sound effect on open
  useEffect(() => {
    if (!isOpen) return;
    soundFxService.playMenuOpen();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        soundFxService.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  // Interactive Lock Screen Toasts
  const [toasts, setToasts] = useState([
    {
      id: 't-1',
      title: 'Alarma: Sesión de Enfoque',
      body: 'Cristi AI ha activado el temporizador de alta productividad.',
      time: 'Ahora',
      tag: '#Alarma',
      scenario: 'alarm'
    }
  ]);

  // Telemetry Log
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [realToastStatus, setRealToastStatus] = useState(null);

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    setTelemetryLogs((prev) => [{ time: timestamp, msg }, ...prev.slice(0, 15)]);
  };

  // Clock Ticker
  useEffect(() => {
    if (!isOpen) return;
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Waveform animation when speaking / listening
  useEffect(() => {
    if (voiceState === 'idle' || !isOpen) return;
    const interval = setInterval(() => {
      setAudioWaves(Array.from({ length: 12 }, () => Math.floor(Math.random() * 42) + 8));
    }, 120);
    return () => clearInterval(interval);
  }, [voiceState, isOpen]);

  // Handle Voice Command Simulation
  const handleSimulateVoiceCommand = (commandText, replyText) => {
    setVoiceState('listening');
    setSimulatedTranscript(commandText);
    setCristiReply('');
    addLog(`Micrófono activo en Lock Screen: "${commandText}"`);

    setTimeout(() => {
      setVoiceState('speaking');
      setCristiReply(replyText);
      addLog(`Cristi respondiendo por voz: "${replyText.substring(0, 45)}..."`);

      // Optionally speak using SpeechSynthesis if available
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          const utter = new SpeechSynthesisUtterance(replyText);
          utter.lang = 'es-ES';
          utter.rate = 1.05;
          utter.pitch = 1.15;
          utter.onend = () => {
            setVoiceState('idle');
            addLog('Voz de Cristi completada. Regresando a escucha pasiva.');
          };
          window.speechSynthesis.speak(utter);
        } catch (_) {
          setTimeout(() => setVoiceState('idle'), 3500);
        }
      } else {
        setTimeout(() => setVoiceState('idle'), 3500);
      }
    }, 1600);
  };

  // Add Simulated Lock Screen Toast
  const handleAddSimulatedToast = (title, body, tag, scenario) => {
    const newToast = {
      id: `toast-${Date.now()}`,
      title,
      body,
      time: 'Ahora',
      tag,
      scenario
    };
    setToasts((prev) => [newToast, ...prev]);
    addLog(`Nuevo Toast WinRT generado en Pantalla de Bloqueo: ${title}`);
  };

  // Dispatch Real Win11 Toast Notification via PowerShell
  const handleDispatchRealWin11Toast = async () => {
    addLog('Enviando Toast nativo WinRT a Windows 11 vía PowerShell...');
    const res = await lockScreenService.sendLockScreenToast(
      'Cristi AI // Recordatorio de Pantalla de Bloqueo',
      'Tu sesión de trabajo con Cristi está activa. Di "Cristi" para continuar.',
      'reminder'
    );
    setRealToastStatus(res.message);
    addLog(`Resultado WinRT: ${res.status} - ${res.message}`);
    setTimeout(() => setRealToastStatus(null), 5000);
  };

  const handleDismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    addLog(`Toast [${id}] descartado por el usuario.`);
  };

  const handleSnoozeToast = (id) => {
    addLog(`Toast [${id}] pospuesto por 5 minutos.`);
    handleDismissToast(id);
  };

  const { interactiveProps } = useClickThrough();

  if (!isOpen) return null;

  return (
    <div className="lockscreen-sandbox-root" {...interactiveProps} style={{ background: selectedWallpaper.gradient }}>
      {/* 1. TOP SANDBOX CONTROL BAR */}
      <div className="sandbox-top-control-bar">
        <div className="sandbox-control-left">
          <span className="sandbox-tag">SANDBOX SIMULATOR</span>
          <span className="sandbox-title">Windows 11 Lock Screen & Companion Hub</span>
        </div>

        <div className="sandbox-control-center">
          <div className="sandbox-btn-group">
            <span className="sandbox-label">Wallpaper:</span>
            {WALLPAPERS.map((wp) => (
              <button
                key={wp.id}
                type="button"
                className={`sandbox-chip-btn ${selectedWallpaper.id === wp.id ? 'active' : ''}`}
                onClick={() => setSelectedWallpaper(wp)}
              >
                {wp.name.split(' ')[1] || wp.name}
              </button>
            ))}
          </div>

          <div className="sandbox-btn-group">
            <span className="sandbox-label">Widget Layout:</span>
            <button
              type="button"
              className={`sandbox-chip-btn ${companionLayout === 'corner' ? 'active' : ''}`}
              onClick={() => setCompanionLayout('corner')}
            >
              Esquina
            </button>
            <button
              type="button"
              className={`sandbox-chip-btn ${companionLayout === 'center' ? 'active' : ''}`}
              onClick={() => setCompanionLayout('center')}
            >
              Centro
            </button>
            <button
              type="button"
              className={`sandbox-chip-btn ${companionLayout === 'bottom' ? 'active' : ''}`}
              onClick={() => setCompanionLayout('bottom')}
            >
              Barra
            </button>
          </div>
        </div>

        <div className="sandbox-control-right">
          <button
            type="button"
            className="sandbox-lock-toggle-btn"
            onClick={() => {
              setIsLocked(!isLocked);
              addLog(isLocked ? 'Sesión simulada desbloqueada.' : 'Sesión simulada bloqueada (Win+L).');
            }}
          >
            {isLocked ? <LockIcon size={13} /> : <Unlock size={13} />}
            <span>{isLocked ? 'Bloqueada (Win+L)' : 'Desbloqueada'}</span>
          </button>

          <button
            type="button"
            className="sandbox-close-btn"
            onClick={onClose}
            title="Cerrar Sandbox y volver a Cristi AI"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 2. MAIN SIMULATED LOCK SCREEN ENVIRONMENT */}
      <div className={`sandbox-lock-viewport ${!isLocked ? 'unlocked-mode' : ''}`}>
        
        {/* Large Windows 11 Digital Clock */}
        <div className="win11-lock-clock-container">
          <div className="win11-clock-time">{time || '12:00'}</div>
          <div className="win11-clock-date">{date || 'Domingo, 30 de agosto'}</div>
        </div>

        {/* 3. CRISTI AI SPECIALIZED LOCK SCREEN COMPANION */}
        <div className={`cristi-lockscreen-companion layout-${companionLayout}`}>
          <div className="companion-glass-panel">
            {/* Tech Corners */}
            <span className="hud-corner hud-corner-tl" />
            <span className="hud-corner hud-corner-tr" />
            <span className="hud-corner hud-corner-bl" />
            <span className="hud-corner hud-corner-br" />

            <div className="companion-panel-header">
              <div className="companion-status-indicator">
                <div className={`pulse-dot ${voiceState !== 'idle' ? 'pulse-active' : ''}`} />
                <span className="companion-model-title">CRISTI // {activeModelName}</span>
              </div>
              <span className="companion-pill-badge">COMPANION LOCK V2</span>
            </div>

            {/* Voice presence wave animation */}
            <div className="companion-voice-wave-row">
              <div className="voice-icon-box">
                {voiceState === 'speaking' ? (
                  <Volume2 size={16} className="text-purple animate-bounce" />
                ) : voiceState === 'listening' ? (
                  <Mic size={16} className="text-cyan animate-pulse" />
                ) : (
                  <Sparkles size={16} className="text-emerald" />
                )}
              </div>

              <div className="wave-bars-track">
                {audioWaves.map((h, i) => (
                  <span
                    key={i}
                    className={`wave-bar ${voiceState === 'speaking' ? 'bar-speaking' : voiceState === 'listening' ? 'bar-listening' : 'bar-idle'}`}
                    style={{ height: `${voiceState === 'idle' ? 4 : h}px` }}
                  />
                ))}
              </div>

              <span className="voice-state-text">
                {voiceState === 'speaking'
                  ? 'Hablando...'
                  : voiceState === 'listening'
                  ? 'Escuchando comando...'
                  : 'Escucha en Espera'}
              </span>
            </div>

            {/* Speech Dialogue Bubble if simulated voice active */}
            {simulatedTranscript && (
              <div className="companion-dialogue-box">
                <div className="dialogue-user">
                  <span className="dialogue-role">TÚ (Voz):</span>
                  <span className="dialogue-text">"{simulatedTranscript}"</span>
                </div>
                {cristiReply && (
                  <div className="dialogue-cristi">
                    <span className="dialogue-role">CRISTI:</span>
                    <span className="dialogue-text">{cristiReply}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. INTERACTIVE WIN11 LOCK SCREEN TOASTS */}
        <div className="win11-lock-toasts-container">
          {toasts.map((toast) => (
            <div key={toast.id} className="win11-lock-toast-card">
              <div className="win11-toast-header">
                <div className="win11-toast-app">
                  <span className="toast-app-icon">🤖</span>
                  <span className="toast-app-name">CRISTI AI</span>
                  <span className="toast-tag">{toast.tag}</span>
                </div>
                <span className="toast-time">{toast.time}</span>
              </div>

              <div className="win11-toast-body">
                <div className="toast-title">{toast.title}</div>
                <div className="toast-message">{toast.body}</div>
              </div>

              <div className="win11-toast-actions">
                <button
                  type="button"
                  className="toast-act-btn primary"
                  onClick={() => handleSimulateVoiceCommand('Cristi, atiende la notificación', `Entendido. He procesado la alerta "${toast.title}".`)}
                >
                  <Mic size={11} />
                  <span>Responder con Voz</span>
                </button>
                <button
                  type="button"
                  className="toast-act-btn secondary"
                  onClick={() => handleSnoozeToast(toast.id)}
                >
                  <span>Posponer 5m</span>
                </button>
                <button
                  type="button"
                  className="toast-act-btn dismiss"
                  onClick={() => handleDismissToast(toast.id)}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 5. BOTTOM SYSTEM TRAY OF WINDOWS 11 */}
        <div className="win11-lock-bottom-bar">
          <div className="win11-unlock-hint">
            <ChevronUp size={16} className="hint-arrow" />
            <span>Haz clic o desliza hacia arriba para desbloquear</span>
          </div>

          <div className="win11-lock-sys-icons">
            <Wifi size={14} title="Internet conectado" />
            <BatteryCharging size={14} title="Batería 100% (Cargando)" />
            <Power size={14} title="Opciones de apagado" />
          </div>
        </div>
      </div>

      {/* 6. BOTTOM INTERACTIVE TEST SIMULATION DOCK */}
      <div className="sandbox-test-dock">
        <div className="test-dock-title">
          <Sliders size={13} />
          <span>SIMULADOR DE EVENTOS Y TELEMETRÍA</span>
        </div>

        <div className="test-dock-grid">
          {/* Column A: Voice Commands Simulator */}
          <div className="dock-column">
            <span className="dock-col-header">Simular Comandos de Voz:</span>
            <div className="dock-buttons-row">
              <button
                type="button"
                className="dock-action-btn"
                onClick={() => handleSimulateVoiceCommand('¿Cristi, qué pendientes tengo hoy?', 'Tienes una reunión de revisión a las 18:30 y 2 notas urgentes registradas.')}
              >
                <MessageSquare size={12} />
                <span>"¿Qué pendientes tengo?"</span>
              </button>

              <button
                type="button"
                className="dock-action-btn"
                onClick={() => handleSimulateVoiceCommand('Pon una alarma en 10 minutos', 'Alarma programada en 10 minutos para Sesión de Enfoque.')}
              >
                <Clock size={12} />
                <span>"Pon alarma en 10 min"</span>
              </button>

              <button
                type="button"
                className="dock-action-btn"
                onClick={() => handleSimulateVoiceCommand('¿Cuál es el estado del clima afuera?', 'Hay 24 grados Celsius con cielo despejado y viento ligero.')}
              >
                <Sparkles size={12} />
                <span>"¿Cómo está el clima?"</span>
              </button>
            </div>
          </div>

          {/* Column B: Toast & Notification Generator */}
          <div className="dock-column">
            <span className="dock-col-header">Generar Notificaciones WinRT:</span>
            <div className="dock-buttons-row">
              <button
                type="button"
                className="dock-action-btn"
                onClick={() => handleAddSimulatedToast('Recordatorio: Terminar Shaders Live2D', 'Optimización de filtros anisotrópicos y textura HD requerida.', '#Urgente', 'reminder')}
              >
                <Bell size={12} />
                <span>+ Toast Recordatorio</span>
              </button>

              <button
                type="button"
                className="dock-action-btn"
                onClick={() => handleAddSimulatedToast('Alarma: Pausa Activa', 'Cristi te recuerda descansar la vista 5 minutos.', '#Salud', 'alarm')}
              >
                <Clock size={12} />
                <span>+ Toast Alarma</span>
              </button>

              <button
                type="button"
                className="dock-action-btn highlight"
                onClick={handleDispatchRealWin11Toast}
              >
                <ExternalLink size={12} />
                <span>Disparar Toast Real en Win11</span>
              </button>
            </div>
            {realToastStatus && <p className="dock-status-msg">{realToastStatus}</p>}
          </div>

          {/* Column C: Telemetry Log */}
          <div className="dock-column log-column">
            <span className="dock-col-header">Telemetría de Sesión:</span>
            <div className="telemetry-log-box">
              {telemetryLogs.length === 0 ? (
                <span className="log-empty">Esperando eventos en el sandbox...</span>
              ) : (
                telemetryLogs.map((item, idx) => (
                  <div key={idx} className="log-row">
                    <span className="log-time">[{item.time}]</span>
                    <span className="log-msg">{item.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LockScreenSandbox;
