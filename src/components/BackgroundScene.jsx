import React, { useEffect, useRef, useState } from 'react';
import { sceneManager } from '../services/sceneManager.js';

export function BackgroundScene() {
  const [sceneState, setSceneState] = useState(sceneManager.getScene());
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    return sceneManager.onSceneChange((newState) => {
      setSceneState(newState);
    });
  }, []);

  const { sceneId, customUrl, isTransparent } = sceneState;

  // ── Matrix Digital Rain Canvas Effect ─────────────────────────────────────
  useEffect(() => {
    if (sceneId !== 'matrix_rain') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const chars = katakana.split('');
    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops = new Array(columns).fill(1);

    let lastDraw = performance.now();

    const draw = (now) => {
      // Throttle to ~30 FPS for minimal CPU/GPU overhead
      if (now - lastDraw < 33) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDraw = now;

      ctx.fillStyle = 'rgba(2, 8, 4, 0.08)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#00ff66';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // White head for glowing leading edge
        if (Math.random() > 0.92) {
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = '#00ff88';
        }

        ctx.fillText(text, x, y);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', onResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [sceneId]);

  if (isTransparent) {
    return null;
  }

  // ── Wallpaper Engine & Custom Media ───────────────────────────────────────
  if ((sceneState.isWpe || sceneId === 'custom_wallpaper') && customUrl) {
    const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(customUrl) || sceneState.sceneType === 'video';
    const isWeb = /\.(html|htm)$/i.test(customUrl) || sceneState.sceneType === 'web';

    return (
      <div className="scene-viewport custom-scene-active">
        {isVideo ? (
          <video
            src={customUrl}
            autoPlay
            loop
            muted
            playsInline
            className="scene-media-element"
          />
        ) : isWeb ? (
          <iframe
            src={customUrl}
            className="scene-iframe-element"
            sandbox="allow-scripts allow-same-origin"
            title="Wallpaper Engine Web Scene"
          />
        ) : (
          <div
            className="scene-custom-image"
            style={{ backgroundImage: `url(${customUrl})` }}
          />
        )}
        <div className="scene-ambient-overlay" />
      </div>
    );
  }

  // ── Matrix Rain Canvas ───────────────────────────────────────────────────
  if (sceneId === 'matrix_rain') {
    return (
      <div className="scene-viewport scene-matrix-viewport">
        <canvas ref={canvasRef} className="scene-matrix-canvas" />
        <div className="scene-ambient-overlay" />
      </div>
    );
  }

  // ── Procedural CSS Cinematic Atmospheric Scenes ───────────────────────────
  return (
    <div className={`scene-viewport scene-${sceneId}`}>
      {/* Dynamic Procedural Background Elements */}
      {sceneId === 'cyber_loft' && (
        <div className="scene-loft-container">
          <div className="scene-skyline-silhouette" />
          <div className="scene-neon-window-glow" />
          <div className="scene-grid-lines" />
          <div className="scene-rain-overlay" />
        </div>
      )}

      {sceneId === 'neon_grid' && (
        <div className="scene-synthwave-container">
          <div className="scene-synthwave-sun" />
          <div className="scene-synthwave-horizon" />
          <div className="scene-synthwave-grid" />
          <div className="scene-stars-twinkle" />
        </div>
      )}

      {sceneId === 'deep_nebula' && (
        <div className="scene-nebula-container">
          <div className="scene-nebula-glow-1" />
          <div className="scene-nebula-glow-2" />
          <div className="scene-stars-dense" />
          <div className="scene-stars-twinkle" />
        </div>
      )}

      {sceneId === 'zen_temple' && (
        <div className="scene-zen-container">
          <div className="scene-sunset-gradient" />
          <div className="scene-temple-silhouette" />
          <div className="scene-sakura-petals" />
        </div>
      )}

      {/* Atmospheric Vignette & Soft Gradient Overlay */}
      <div className="scene-ambient-overlay" />
    </div>
  );
}

export default BackgroundScene;
