import React, { useState, useEffect, useRef } from 'react';
import { Activity, Cpu, HardDrive, Zap, X, ShieldAlert, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { performanceProfiler } from '../services/profiler/PerformanceProfilerService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';

export function PerformanceHUD({ isVisible, onClose }) {
  const [snapshot, setSnapshot] = useState(() => performanceProfiler.getSnapshot());
  const [tier, setTier] = useState(1); // 1: Compact, 2: Detailed, 3: Deep
  const [history, setHistory] = useState(() => performanceProfiler.getHistory('60s'));
  const [anomalies, setAnomalies] = useState(() => performanceProfiler.getAnomalies());
  const [isExpanded, setIsExpanded] = useState(true);

  const { interactiveProps } = useClickThrough();
  const updateThrottleRef = useRef(0);

  useEffect(() => {
    if (!isVisible) return;

    // Listen to telemetry updates (sampled at 1-2 Hz to maintain 0% overhead)
    const unsub = performanceProfiler.onTelemetry((newSnapshot) => {
      const now = performance.now();
      if (now - updateThrottleRef.current > 450) { // Throttled UI refresh ~2Hz
        updateThrottleRef.current = now;
        setSnapshot(newSnapshot);
        setHistory(performanceProfiler.getHistory('60s'));
        setAnomalies(performanceProfiler.getAnomalies());
      }
    });

    const unsubAnomaly = performanceProfiler.onAnomaly((anomaly) => {
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

  const handleTierChange = (newTier) => {
    setTier(newTier);
    performanceProfiler.setTier(newTier);
  };

  const getFpsColor = (fps) => {
    if (fps >= 55) return '#10b981'; // Emerald Green
    if (fps >= 35) return '#f59e0b'; // Amber Yellow
    return '#f43f5e'; // Rose Red
  };

  const getMemoryColor = (usedMB) => {
    if (usedMB < 250) return '#10b981';
    if (usedMB < 600) return '#38bdf8';
    if (usedMB < 1000) return '#f59e0b';
    return '#f43f5e';
  };

  return (
    <div
      className="performance-hud-container"
      {...interactiveProps}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="perf-hud-glass-panel">
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-tr" />
        <span className="hud-corner hud-corner-bl" />
        <span className="hud-corner hud-corner-br" />

        {/* Tactical Title Bar */}
        <div className="perf-hud-header">
          <div className="perf-hud-title-group">
            <Activity size={15} color="#a855f7" className="perf-hud-icon-pulse" />
            <span className="perf-hud-title">CRISTI TELEMETRY // OBSERVABILITY ENGINE</span>
            <span className="perf-hud-badge">PROD V2.0</span>
          </div>

          <div className="perf-hud-actions">
            <div className="perf-tier-selector">
              <button
                className={`perf-tier-btn ${tier === 1 ? 'active' : ''}`}
                onClick={() => handleTierChange(1)}
                title="Modo Ligero (Muestreo 1Hz)"
              >
                T1 Lite
              </button>
              <button
                className={`perf-tier-btn ${tier === 2 ? 'active' : ''}`}
                onClick={() => handleTierChange(2)}
                title="Modo Diagnóstico (Atribución por Subsistema)"
              >
                T2 Diag
              </button>
              <button
                className={`perf-tier-btn ${tier === 3 ? 'active' : ''}`}
                onClick={() => handleTierChange(3)}
                title="Modo Profundo (Timings precisos & GC)"
              >
                T3 Deep
              </button>
            </div>

            <button
              className="perf-hud-action-btn"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Contraer' : 'Expandir'}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {onClose && (
              <button className="perf-hud-action-btn close" onClick={onClose} title="Cerrar (F3)">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="perf-metrics-grid">
          {/* 1. FPS & Frame Pacing */}
          <div className="perf-metric-card">
            <div className="perf-metric-label">
              <Zap size={13} color={getFpsColor(snapshot.fps)} />
              <span>FRAMES &amp; HARDWARE PACING</span>
            </div>
            <div className="perf-metric-main-row">
              <span className="perf-metric-big-value" style={{ color: getFpsColor(snapshot.fps) }}>
                {snapshot.fps}
              </span>
              <span className="perf-metric-unit">FPS</span>
              <span className="perf-metric-sub">
                ({snapshot.tps} TPS / {snapshot.avgFrameTimeMs}ms)
              </span>
            </div>
            <div className="perf-metric-footer">
              <span>99p: {snapshot.p99FrameTimeMs}ms</span>
              <span>GPU: {performanceProfiler.gpuInfo?.name ? (performanceProfiler.gpuInfo.name.length > 22 ? performanceProfiler.gpuInfo.name.slice(0, 22) + '...' : performanceProfiler.gpuInfo.name) : 'NVIDIA RTX'}</span>
            </div>
          </div>

          {/* 2. Memory & Resident Set (Task Manager Working Set) */}
          <div className="perf-metric-card">
            <div className="perf-metric-label">
              <HardDrive size={13} color={getMemoryColor(snapshot.memory.jsHeapUsedMB)} />
              <span>TOTAL RAM // TASK MANAGER</span>
            </div>
            <div className="perf-metric-main-row">
              <span
                className="perf-metric-big-value"
                style={{ color: getMemoryColor(snapshot.memory.processRssMB || snapshot.memory.jsHeapUsedMB) }}
              >
                {snapshot.memory.processRssMB > 0 ? snapshot.memory.processRssMB : snapshot.memory.jsHeapUsedMB}
              </span>
              <span className="perf-metric-unit">MB RAM</span>
              <span className="perf-metric-sub">
                ({snapshot.memory.jsHeapUsedMB}M Heap)
              </span>
            </div>
            <div className="perf-metric-footer">
              {snapshot.memory.processBreakdown?.gpu !== undefined ? (
                <span>GPU: {snapshot.memory.processBreakdown.gpu}M | Win: {snapshot.memory.processBreakdown.renderer}M</span>
              ) : (
                <span>Heap Total: {snapshot.memory.jsHeapTotalMB} MB</span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Component Breakdown & Timings (Tier 2 & 3) */}
        {isExpanded && tier >= 2 && (
          <div className="perf-subsystem-section">
            <div className="perf-section-title">
              <Cpu size={13} color="#38bdf8" />
              <span>ATRIBUCIÓN DE COSTES POR SUBSISTEMA (CPU / GPU)</span>
            </div>

            <div className="perf-subsystem-bars">
              {/* Live2D Engine */}
              <div className="perf-subsystem-row">
                <div className="perf-subsystem-header">
                  <span className="perf-subsystem-name">Live2D Avatar &amp; Físicas 2.0</span>
                  <span className="perf-subsystem-val">{snapshot.timings.live2d?.avgMs || 0} ms</span>
                </div>
                <div className="perf-bar-track">
                  <div
                    className="perf-bar-fill live2d"
                    style={{ width: `${Math.min(100, (snapshot.timings.live2d?.avgMs || 0) * 6)}%` }}
                  />
                </div>
              </div>

              {/* Audio DSP & Speech */}
              <div className="perf-subsystem-row">
                <div className="perf-subsystem-header">
                  <span className="perf-subsystem-name">Audio DSP &amp; S2S Voice Stream</span>
                  <span className="perf-subsystem-val">{snapshot.timings.audioDsp?.avgMs || 0} ms</span>
                </div>
                <div className="perf-bar-track">
                  <div
                    className="perf-bar-fill audio"
                    style={{ width: `${Math.min(100, (snapshot.timings.audioDsp?.avgMs || 0) * 10)}%` }}
                  />
                </div>
              </div>

              {/* Vision & Sensory */}
              <div className="perf-subsystem-row">
                <div className="perf-subsystem-header">
                  <span className="perf-subsystem-name">Visión Sensorial &amp; Face-API</span>
                  <span className="perf-subsystem-val">{snapshot.timings.visionSensory?.avgMs || 0} ms</span>
                </div>
                <div className="perf-bar-track">
                  <div
                    className="perf-bar-fill vision"
                    style={{ width: `${Math.min(100, (snapshot.timings.visionSensory?.avgMs || 0) * 6)}%` }}
                  />
                </div>
              </div>

              {/* UI & React */}
              <div className="perf-subsystem-row">
                <div className="perf-subsystem-header">
                  <span className="perf-subsystem-name">React 19 UI &amp; Hit-Testing</span>
                  <span className="perf-subsystem-val">{snapshot.timings.uiReact?.avgMs || 0} ms</span>
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

        {/* Historical Mini Sparkline Timeline */}
        {isExpanded && history.length > 2 && (
          <div className="perf-history-sparkline-container">
            <div className="perf-section-title">
              <Sparkles size={12} color="#a855f7" />
              <span>HISTORIAL DE FPS &amp; ESTABILIDAD (ÚLTIMOS 60s)</span>
            </div>
            <div className="perf-sparkline-track">
              {history.map((pt, idx) => {
                const heightPct = Math.min(100, Math.max(10, (pt.fps / 60) * 100));
                const barColor = getFpsColor(pt.fps);
                return (
                  <div
                    key={idx}
                    className="perf-sparkline-bar"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: barColor
                    }}
                    title={`${pt.fps} FPS | Heap: ${pt.memory?.jsHeapUsedMB || 0}MB`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Anomaly Detection Alerts Log */}
        {isExpanded && anomalies.length > 0 && (
          <div className="perf-anomalies-section">
            <div className="perf-section-title">
              <ShieldAlert size={13} color="#f43f5e" />
              <span>REGISTRO DE ANOMALÍAS DETECTADAS ({anomalies.length})</span>
            </div>
            <div className="perf-anomalies-list">
              {anomalies.slice(-3).map((an, idx) => (
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

export default PerformanceHUD;
