/**
 * Cristi AI - Performance & Observability HUD (Spark Timings & Diagnostics)
 * Modern, Draggable, Ultra-Performant Obsidian Design:
 * - Real-Time Framerate, TPS, MSPT & Jitter
 * - System Memory (Heap & OS Working Set / RSS)
 * - Subsystems Execution Profiling (SYS-01 to SYS-06)
 * - Anomaly & Lag Spike Detection
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Zap,
  X,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  GripHorizontal
} from 'lucide-react';
import { performanceProfiler } from '../services/profiler/PerformanceProfilerService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';

export function PerformanceHUD({ isVisible, onClose }) {
  const [snapshot, setSnapshot] = useState(() => performanceProfiler.getSnapshot());
  const [tier, setTier] = useState(1); // 1: Compact, 2: Detailed, 3: Deep
  const [history, setHistory] = useState(() => performanceProfiler.getHistory('60s'));
  const [anomalies, setAnomalies] = useState(() => performanceProfiler.getAnomalies());
  const [isExpanded, setIsExpanded] = useState(true);

  // Position State (Draggable HUD)
  const [hudPos, setHudPos] = useState(() => {
    try {
      const saved = localStorage.getItem('cristi_perf_hud_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth - 340, y: 24 };
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const { interactiveProps } = useClickThrough();
  const updateThrottleRef = useRef(0);

  useEffect(() => {
    if (!isVisible) return;

    const unsub = performanceProfiler.onTelemetry((newSnapshot) => {
      const now = performance.now();
      if (now - updateThrottleRef.current > 450) {
        updateThrottleRef.current = now;
        setSnapshot(newSnapshot);
        setHistory(performanceProfiler.getHistory('60s'));
        setAnomalies(performanceProfiler.getAnomalies());
      }
    });

    const unsubAnomaly = performanceProfiler.onAnomaly(() => {
      setAnomalies(performanceProfiler.getAnomalies());
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        soundFxService.playClick();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsub();
      unsubAnomaly();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  // --- Drag Handlers ---
  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;
    e.preventDefault();
    isDraggingRef.current = true;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: hudPos.x,
      posY: hudPos.y
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const newX = Math.max(10, Math.min(window.innerWidth - 330, dragStartRef.current.posX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 150, dragStartRef.current.posY + deltaY));

    setHudPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
      localStorage.setItem('cristi_perf_hud_pos', JSON.stringify(hudPos));
    } catch (_) {}
  };

  const handleTierChange = (newTier) => {
    soundFxService.playClick();
    setTier(newTier);
    performanceProfiler.setTier(newTier);
  };

  const getFpsColor = (fps) => {
    if (fps >= 55) return '#10b981';
    if (fps >= 35) return '#f59e0b';
    return '#f43f5e';
  };

  const getMemoryColor = (usedMB) => {
    if (usedMB < 250) return '#10b981';
    if (usedMB < 600) return '#38bdf8';
    if (usedMB < 1000) return '#f59e0b';
    return '#f43f5e';
  };

  const hudStyle = {
    position: 'fixed',
    left: `${hudPos.x}px`,
    top: `${hudPos.y}px`,
    transform: 'none'
  };

  return (
    <div
      className="performance-hud-container"
      style={hudStyle}
      {...interactiveProps}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="perf-hud-glass-panel">
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-tr" />
        <span className="hud-corner hud-corner-bl" />
        <span className="hud-corner hud-corner-br" />

        {/* Tactical Draggable Title Bar */}
        <div
          className="perf-hud-header"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ cursor: 'grab', userSelect: 'none' }}
        >
          <div className="perf-hud-title-group">
            <GripHorizontal size={13} color="#94a3b8" />
            <Activity size={14} color="#a855f7" />
            <span className="perf-hud-title">TELEMETRÍA // SPARK</span>
            <span className="perf-hud-badge">PROD</span>
          </div>

          <div className="perf-hud-actions">
            <div className="perf-tier-selector">
              <button
                type="button"
                className={`perf-tier-btn ${tier === 1 ? 'active' : ''}`}
                onClick={() => handleTierChange(1)}
                title="Modo Ligero (Muestreo 1Hz)"
              >
                T1 Lite
              </button>
              <button
                type="button"
                className={`perf-tier-btn ${tier === 2 ? 'active' : ''}`}
                onClick={() => handleTierChange(2)}
                title="Modo Diagnóstico"
              >
                T2 Diag
              </button>
              <button
                type="button"
                className={`perf-tier-btn ${tier === 3 ? 'active' : ''}`}
                onClick={() => handleTierChange(3)}
                title="Modo Profundo"
              >
                T3 Deep
              </button>
            </div>

            <button
              type="button"
              className="perf-hud-action-btn"
              onClick={() => {
                soundFxService.playClick();
                setIsExpanded((prev) => !prev);
              }}
              title={isExpanded ? 'Contraer' : 'Expandir'}
            >
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {onClose && (
              <button
                type="button"
                className="perf-hud-action-btn close"
                onClick={() => {
                  soundFxService.playClick();
                  onClose();
                }}
                title="Cerrar (F3 / Escape)"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="perf-metric-grid">
          {/* 1. FPS & Hardware Pacing */}
          <div className="perf-metric-card">
            <div className="perf-metric-header">
              <Zap size={11} color={getFpsColor(snapshot.fps)} />
              <span>FPS &amp; TIEMPO DE CUADRO</span>
            </div>
            <div className="perf-metric-main-row">
              <span className="perf-metric-value" style={{ color: getFpsColor(snapshot.fps) }}>
                {snapshot.fps} <small style={{ fontSize: '10px', color: '#94a3b8' }}>FPS</small>
              </span>
              <span className="perf-metric-sub">
                {snapshot.tps} TPS ({snapshot.avgFrameTimeMs}ms)
              </span>
            </div>
            <div className="perf-metric-footer">
              <span>99p: {snapshot.p99FrameTimeMs}ms</span>
            </div>
          </div>

          {/* 2. Memory & Working Set */}
          <div className="perf-metric-card">
            <div className="perf-metric-header">
              <HardDrive size={11} color={getMemoryColor(snapshot.memory.jsHeapUsedMB)} />
              <span>MEMORIA RAM // HEAP</span>
            </div>
            <div className="perf-metric-main-row">
              <span
                className="perf-metric-value"
                style={{ color: getMemoryColor(snapshot.memory.processRssMB || snapshot.memory.jsHeapUsedMB) }}
              >
                {snapshot.memory.processRssMB > 0 ? snapshot.memory.processRssMB : snapshot.memory.jsHeapUsedMB}{' '}
                <small style={{ fontSize: '10px', color: '#94a3b8' }}>MB</small>
              </span>
              <span className="perf-metric-sub">
                Heap: {snapshot.memory.jsHeapUsedMB}MB
              </span>
            </div>
            <div className="perf-metric-footer">
              <span>Total: {snapshot.memory.jsHeapTotalMB} MB</span>
            </div>
          </div>
        </div>

        {/* Detailed Subsystems Breakdown (Tier 2 & 3) */}
        {isExpanded && tier >= 2 && (
          <div className="perf-subsystem-section">
            <div className="perf-section-title">
              <Cpu size={12} color="#38bdf8" />
              <span>ATRIBUCIÓN DE COSTES (MS / CUADRO)</span>
            </div>

            <div className="perf-subsystem-bars">
              <div className="perf-subsystem-row">
                <div className="perf-subsystem-header">
                  <span>Live2D Avatar &amp; WebGL</span>
                  <strong>{snapshot.timings.live2d?.avgMs || 0} ms</strong>
                </div>
                <div className="perf-bar-track">
                  <div
                    className="perf-bar-fill live2d"
                    style={{ width: `${Math.min(100, (snapshot.timings.live2d?.avgMs || 0) * 6)}%` }}
                  />
                </div>
              </div>

              <div className="perf-subsystem-row">
                <div className="perf-subsystem-header">
                  <span>Audio DSP &amp; Gemini Live</span>
                  <strong>{snapshot.timings.audioDsp?.avgMs || 0} ms</strong>
                </div>
                <div className="perf-bar-track">
                  <div
                    className="perf-bar-fill audio"
                    style={{ width: `${Math.min(100, (snapshot.timings.audioDsp?.avgMs || 0) * 10)}%` }}
                  />
                </div>
              </div>

              <div className="perf-subsystem-row">
                <div className="perf-subsystem-header">
                  <span>Visión Sensorial &amp; Cámara</span>
                  <strong>{snapshot.timings.visionSensory?.avgMs || 0} ms</strong>
                </div>
                <div className="perf-bar-track">
                  <div
                    className="perf-bar-fill vision"
                    style={{ width: `${Math.min(100, (snapshot.timings.visionSensory?.avgMs || 0) * 6)}%` }}
                  />
                </div>
              </div>

              <div className="perf-subsystem-row">
                <div className="perf-subsystem-header">
                  <span>React 19 Virtual DOM &amp; UI</span>
                  <strong>{snapshot.timings.uiReact?.avgMs || 0} ms</strong>
                </div>
                <div className="perf-bar-track">
                  <div
                    className="perf-bar-fill ui"
                    style={{ width: `${Math.min(100, (snapshot.timings.uiReact?.avgMs || 0) * 10)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Anomaly Detection Alerts */}
        {isExpanded && anomalies.length > 0 && (
          <div className="perf-anomalies-section">
            <div className="perf-section-title">
              <ShieldAlert size={12} color="#f43f5e" />
              <span>ANOMALÍAS ({anomalies.length})</span>
            </div>
            <div className="perf-anomalies-list">
              {anomalies.slice(-2).map((an, idx) => (
                <div key={idx} className={`perf-anomaly-item ${an.severity}`}>
                  <span className="perf-anomaly-badge">{an.type}</span>
                  <span className="perf-anomaly-msg">{an.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(PerformanceHUD);
