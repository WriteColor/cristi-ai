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

    const ctx = canvas.getContext('2d', { alpha: true });
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const characters = 'アカサタナハマヤラワ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<>{}[]=+/\\';
    const fontSize = 16;
    const columns = Math.floor(width / fontSize);
    const drops = new Array(columns).fill(1);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    let lastTime = 0;
    const interval = 33; // ~30-60 FPS matrix draw

    const draw = (currentTime) => {
      animFrameRef.current = requestAnimationFrame(draw);
      const delta = currentTime - lastTime;
      if (delta < interval) return;
      lastTime = currentTime;

      ctx.fillStyle = 'rgba(4, 5, 7, 0.08)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#a855f7';
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        if (Math.random() > 0.95) {
          ctx.fillStyle = '#f8fafc';
        } else {
          ctx.fillStyle = i % 3 === 0 ? '#38bdf8' : '#a855f7';
        }

        ctx.fillText(text, x, y);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [sceneId]);

  if (isTransparent) {
    return null;
  }

  // ── Custom Imported Media (Local Video / Local Image / Web URL) ───────────
  const isCustomScene = (sceneId === 'custom_wallpaper' || (sceneId && sceneId.startsWith('custom_'))) && customUrl;
  if (isCustomScene) {
    const isVideo = (/\.(mp4|webm|ogg|mov|mkv)/i.test(customUrl) || sceneState.sceneType === 'video') && !/\.(gif|png|jpg|jpeg|webp)/i.test(customUrl);
    const isWeb = /\.(html|htm)/i.test(customUrl) || sceneState.sceneType === 'web';

    return (
      <div className="scene-viewport custom-scene-active">
        {/* Dynamic Ambient Aura Backdrop */}
        {!isWeb && (
          <div
            className="scene-ambient-backdrop"
            style={{
              backgroundImage: `url("${customUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        {/* Main Media - Perfectly fitted to screen aspect ratio without stretching or distortion */}
        {isVideo ? (
          <video
            key={customUrl}
            src={customUrl}
            autoPlay
            loop
            muted
            playsInline
            ref={(el) => {
              if (el) {
                el.muted = true;
                el.volume = 0;
                el.play().catch(() => {});
              }
            }}
            className="scene-media-element scene-media-contain"
          />
        ) : isWeb ? (
          <iframe
            key={customUrl}
            src={customUrl}
            className="scene-iframe-element"
            sandbox="allow-scripts allow-same-origin"
            title="Custom Web Scene"
          />
        ) : (
          <img
            key={customUrl}
            src={customUrl}
            alt="Custom Scene"
            className="scene-media-element scene-media-contain scene-image-element"
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

  // ── Procedural Built-In Shaders / CSS Scenes ──────────────────────────────
  return (
    <div className={`scene-viewport scene-${sceneId}`}>
      {/* Cyber Loft Room */}
      {sceneId === 'cyber_loft' && (
        <div className="scene-layer scene-cyber-loft">
          <div className="scene-window-grid" />
          <div className="scene-rain-drops" />
          <div className="scene-neon-sign">CRISTI // 2077</div>
          <div className="scene-hologram-glow" />
        </div>
      )}

      {/* Neon Grid / Synthwave */}
      {sceneId === 'neon_grid' && (
        <div className="scene-layer scene-neon-grid">
          <div className="scene-sun" />
          <div className="scene-horizon-grid" />
          <div className="scene-grid-lines" />
        </div>
      )}

      {/* Deep Nebula Space */}
      {sceneId === 'deep_nebula' && (
        <div className="scene-layer scene-deep-nebula">
          <div className="scene-starfield-1" />
          <div className="scene-starfield-2" />
          <div className="scene-nebula-clouds" />
        </div>
      )}

      {/* Zen Cyber Temple */}
      {sceneId === 'zen_temple' && (
        <div className="scene-layer scene-zen-temple">
          <div className="scene-sakura-petals" />
          <div className="scene-moon-glow" />
          <div className="scene-torii-silhouette" />
        </div>
      )}

      {/* Ambient Vignette & Scanline Overlay */}
      <div className="scene-ambient-overlay" />
    </div>
  );
}

export default BackgroundScene;
