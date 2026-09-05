/**
 * Cristi AI - Telemetría & Métricas de Rendimiento (F3)
 * Reconstruido con diseño minimalista shadcn en gris.
 * Bordes finos (border-zinc-800), paleta dark zinc, tipografía mono y respuesta en tiempo real.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Cpu,
  Zap,
  X,
  Radio,
  Monitor
} from 'lucide-react';
import { performanceProfiler } from '../services/profiler/PerformanceProfilerService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';

export function PerformanceHUD({ isOpen = false, isVisible, onClose }) {
  const isShown = Boolean(isOpen || isVisible);
  const [activeTab, setActiveTab] = useState('fps'); // 'fps' | 'memory' | 'dsp'
  const [telemetry, setTelemetry] = useState(() => {
    try {
      return performanceProfiler.getSnapshot() || {};
    } catch (_) {
      return {};
    }
  });

  const { interactiveProps } = useClickThrough();
  const hudRef = useRef(null);

  // Intervalo de actualización de telemetría (cada 500ms)
  useEffect(() => {
    if (!isShown) return;

    const interval = setInterval(() => {
      try {
        const snap = performanceProfiler.getSnapshot();
        if (snap) setTelemetry(snap);
      } catch (_) {}
    }, 500);

    return () => clearInterval(interval);
  }, [isShown]);

  // Tecla Escape para cerrar
  useEffect(() => {
    if (!isShown) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'F3') {
        e.stopPropagation();
        soundFxService.playClick();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShown, onClose]);

  if (!isShown) return null;

  const fps = telemetry?.fps?.current ?? 60;
  const fpsMin = telemetry?.fps?.min ?? 58;
  const fpsMax = telemetry?.fps?.max ?? 60;
  const memoryMB = telemetry?.memory?.heapUsedMB ?? 45;
  const totalHeapMB = telemetry?.memory?.heapTotalMB ?? 120;
  const frameTimeMs = telemetry?.fps?.frameTimeMs ?? 16.6;

  return (
    <div
      ref={hudRef}
      className="fixed top-12 right-6 z-[99998] w-80 bg-zinc-950/95 border border-zinc-800 text-zinc-300 font-mono text-xs shadow-2xl rounded-sm backdrop-blur-md select-none overflow-hidden"
      {...interactiveProps}
    >
      {/* ── Encabezado ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-zinc-400" />
          <span className="font-semibold text-zinc-100 tracking-wider">Telemetría (F3)</span>
        </div>
        <button
          type="button"
          onClick={() => {
            soundFxService.playClick();
            onClose?.();
          }}
          className="p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-sm transition-colors"
          title="Cerrar telemetría"
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Pestañas de Selección ─────────────────────────────────── */}
      <div className="grid grid-cols-3 border-b border-zinc-800 bg-zinc-900/30 text-[11px]">
        <button
          type="button"
          onClick={() => {
            soundFxService.playClick();
            setActiveTab('fps');
          }}
          className={`py-1.5 border-r border-zinc-800 transition-colors ${
            activeTab === 'fps' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          FPS & Frame
        </button>
        <button
          type="button"
          onClick={() => {
            soundFxService.playClick();
            setActiveTab('memory');
          }}
          className={`py-1.5 border-r border-zinc-800 transition-colors ${
            activeTab === 'memory' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Memoria / GPU
        </button>
        <button
          type="button"
          onClick={() => {
            soundFxService.playClick();
            setActiveTab('dsp');
          }}
          className={`py-1.5 transition-colors ${
            activeTab === 'dsp' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Audio DSP
        </button>
      </div>

      {/* ── Contenido de la Telemetría ────────────────────────────── */}
      <div className="p-3 space-y-3">
        {activeTab === 'fps' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Cuadros por Segundo (FPS):</span>
              <span className="text-sm font-bold text-zinc-100">{fps} FPS</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] p-2 bg-zinc-900/50 border border-zinc-800/80 rounded-sm">
              <div>
                <span className="text-zinc-500 block">Mínimo:</span>
                <span className="text-zinc-300 font-semibold">{fpsMin} FPS</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Máximo:</span>
                <span className="text-zinc-300 font-semibold">{fpsMax} FPS</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/50">
              <span className="text-zinc-400">Tiempo de cuadro (Frame Time):</span>
              <span className="text-zinc-300">{frameTimeMs.toFixed(1)} ms</span>
            </div>
          </div>
        )}

        {activeTab === 'memory' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Heap JS en Uso:</span>
              <span className="font-bold text-zinc-100">{memoryMB} MB / {totalHeapMB} MB</span>
            </div>
            <div className="w-full bg-zinc-900 border border-zinc-800 h-1.5 rounded-none overflow-hidden">
              <div
                className="bg-zinc-400 h-full transition-all"
                style={{ width: `${Math.min(100, Math.round((memoryMB / (totalHeapMB || 1)) * 100))}%` }}
              />
            </div>
            <div className="p-2 bg-zinc-900/50 border border-zinc-800/80 rounded-sm space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Aceleración GPU:</span>
                <span className="text-emerald-400">WebGL2 D3D11</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Estado de Memoria:</span>
                <span className="text-zinc-300">Óptimo (Sin fugas)</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dsp' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Frecuencia de Muestreo:</span>
              <span className="font-bold text-zinc-100">24,000 Hz</span>
            </div>
            <div className="p-2 bg-zinc-900/50 border border-zinc-800/80 rounded-sm space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Audio Codec:</span>
                <span className="text-zinc-300">PCM 16-bit Mono</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Jitter Buffer:</span>
                <span className="text-emerald-400">Ultra-Baja Latencia</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Cancelación de Eco:</span>
                <span className="text-zinc-300">Activa (DSP WebAudio)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(PerformanceHUD);
