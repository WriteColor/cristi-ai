/**
 * Cristi AI - Standalone Optical Camera Application Window
 * 100% Shadcn Minimalist Dark Zinc UI
 * Runs in its own dedicated Electron BrowserWindow with hardware-accelerated WebRTC,
 * live device selection, real-time FPS & resolution telemetry, and zero-lag rendering.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Camera, RefreshCw, X, Eye, EyeOff,
  Maximize2, Minimize2, Check, ChevronDown, Sparkles, Terminal
} from 'lucide-react';
import { electronBridge } from '../services/desktop/ElectronBridge.js';
import { soundFxService } from '../services/soundFxService.js';

export function CameraApp() {
  const videoRef = useRef(null);
  const canvasOverlayRef = useRef(null);
  const streamRef = useRef(null);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  // Telemetry
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const [fps, setFps] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  // BroadcastChannel to stream frames to Cristi AI core
  const broadcastChannelRef = useRef(null);
  useEffect(() => {
    try {
      broadcastChannelRef.current = new BroadcastChannel('cristi_camera_stream');
    } catch (_) {}
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  // Enumerate video devices
  const refreshDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Error al enumerar dispositivos de video:', err);
    }
  }, [selectedDeviceId]);

  // Start Camera Stream
  const startCamera = useCallback(async (devId) => {
    try {
      setError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints = {
        video: devId ? { deviceId: { exact: devId } } : true,
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);
      await refreshDevices();
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError(`No se pudo iniciar la cámara: ${err.message}`);
      setIsStreaming(false);
    }
  }, [refreshDevices]);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setFps(0);
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startCamera(selectedDeviceId);
    return () => {
      stopCamera();
    };
  }, []);

  // Handle device change
  const handleDeviceChange = (e) => {
    const newId = e.target.value;
    setSelectedDeviceId(newId);
    startCamera(newId);
  };

  // FPS & Resolution Telemetry loop with smooth 0.5 FPS streaming to Gemini Live
  useEffect(() => {
    if (!isStreaming) return;
    let frameCount = 0;
    let lastTime = performance.now();
    let lastStreamTime = 0;
    let animId = null;
    let offscreenCanvas = null;

    const measureLoop = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }

      if (videoRef.current && videoRef.current.videoWidth) {
        setResolution({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });
      }

      // Stream lightweight frame to broadcast channel for Gemini Live vision at 0.5 FPS (every 2000ms)
      if (broadcastChannelRef.current && videoRef.current && (now - lastStreamTime >= 2000)) {
        lastStreamTime = now;
        try {
          if (!offscreenCanvas) {
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = 480;
            offscreenCanvas.height = 270;
          }
          const ctx = offscreenCanvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, 480, 270);
          const base64 = offscreenCanvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          if (base64) {
            broadcastChannelRef.current.postMessage({ type: 'camera_frame', base64 });
          }
        } catch (_) {}
      }

      animId = requestAnimationFrame(measureLoop);
    };

    animId = requestAnimationFrame(measureLoop);
    return () => cancelAnimationFrame(animId);
  }, [isStreaming]);

  // Capture Snapshot
  const handleSnapshot = () => {
    soundFxService.playClick();
    if (!videoRef.current) return;
    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = videoRef.current.videoWidth || 1280;
      snapCanvas.height = videoRef.current.videoHeight || 720;
      const ctx = snapCanvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);

      snapCanvas.toBlob((blob) => {
        if (!blob) return;
        try {
          navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setSnapshotSuccess(true);
          setTimeout(() => setSnapshotSuccess(false), 2000);
        } catch (_) {}
      });

      // Send high-priority snapshot frame directly to Cristi AI's Gemini session
      const base64 = snapCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      if (base64 && broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'camera_snapshot', base64 });
      }
    } catch (_) {}
  };

  // Close Window
  const handleClose = () => {
    soundFxService.playClick();
    if (electronBridge?.closeCameraWindow) {
      electronBridge.closeCameraWindow();
    } else {
      window.close();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 font-sans select-none overflow-hidden border border-zinc-800">
      
      {/* ── Top Header Toolbar (Shadcn Dark Zinc) ─────────────────────────── */}
      <header className="flex items-center justify-between px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <h1 className="text-xs font-semibold tracking-wider uppercase font-mono text-zinc-100">
            Cristi AI • Monitor Óptico
          </h1>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700/60 rounded">
            {isStreaming ? 'ACTIVA' : 'INACTIVA'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Device Selector */}
          <div className="relative flex items-center">
            <select
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              className="appearance-none bg-zinc-950 hover:bg-zinc-800/80 text-zinc-300 text-xs font-mono px-2.5 py-1 pr-6 border border-zinc-700/80 rounded-md focus:outline-none focus:border-zinc-500 transition-colors max-w-[180px] truncate"
            >
              {devices.length === 0 ? (
                <option value="">Cámara Predeterminada</option>
              ) : (
                devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Cámara ${i + 1}`}
                  </option>
                ))
              )}
            </select>
            <ChevronDown size={12} className="absolute right-2 text-zinc-500 pointer-events-none" />
          </div>

          {/* Telemetry Badge */}
          {isStreaming && resolution.width > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] font-mono text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{resolution.width}x{resolution.height}</span>
              <span className="text-zinc-600">•</span>
              <span>{fps} FPS</span>
            </div>
          )}

          {/* Snapshot Button (Interlinked with Cristi AI Brain) */}
          <button
            type="button"
            onClick={handleSnapshot}
            disabled={!isStreaming}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-md text-zinc-300 hover:text-white transition-colors disabled:opacity-40 text-xs font-mono"
            title="Capturar fotograma y enviar a Cristi AI (Copiar imagen)"
          >
            {snapshotSuccess ? <Check size={13} className="text-emerald-400" /> : <Camera size={13} />}
            <span>Capturar</span>
          </button>
        </div>
      </header>

      {/* ── Main Viewport Area ────────────────────────────────────────────── */}
      <div className="relative flex-1 bg-zinc-950 overflow-hidden flex items-center justify-center">
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />

        {/* Snapshot Notification Toast */}
        {snapshotSuccess && (
          <div className="absolute top-4 right-4 bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs font-mono px-3 py-1.5 rounded shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <Check size={14} className="text-emerald-400" />
            <span>Fotograma copiado al portapapeles</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center gap-3">
            <div className="w-10 h-10 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <VideoOff size={20} />
            </div>
            <div className="max-w-sm">
              <h3 className="text-xs font-semibold text-zinc-200">Error de Dispositivo de Video</h3>
              <p className="text-[11px] font-mono text-zinc-400 mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => startCamera(selectedDeviceId)}
              className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={12} />
              <span>Reintentar</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

export default CameraApp;
