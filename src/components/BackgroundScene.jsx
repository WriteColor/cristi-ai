import React, { useEffect, useRef, useState } from 'react';
import { sceneManager } from '../services/sceneManager.js';

export const BackgroundScene = React.memo(function BackgroundScene() {
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
    if (sceneId !== 'matrix_rain' || isTransparent) {
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
  }, [sceneId, isTransparent]);

  if (isTransparent) {
    return null;
  }

  // ── Custom Imported Media (Local Video / Local Image / Web URL) ───────────
  const isCustomScene = (sceneId === 'custom_wallpaper' || (sceneId && sceneId.startsWith('custom_'))) && customUrl;
  if (isCustomScene) {
    const isVideo = (/\.(mp4|webm|ogg|mov|mkv)/i.test(customUrl) || sceneState.sceneType === 'video') && !/\.(gif|png|jpg|jpeg|webp)/i.test(customUrl);
    const isWeb = /\.(html|htm)/i.test(customUrl) || sceneState.sceneType === 'web';

    return (
      <div className="fixed inset-0 pointer-events-none z-0 w-full h-full overflow-hidden select-none">
        {/* Dynamic Ambient Aura Backdrop */}
        {!isWeb && (
          <div
            className="absolute inset-0 w-full h-full scale-105 blur-md opacity-50"
            style={{
              backgroundImage: `url("${customUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        {/* Main Media */}
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
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : isWeb ? (
          <iframe
            key={customUrl}
            src={customUrl}
            className="absolute inset-0 w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Custom Web Scene"
          />
        ) : (
          <img
            key={customUrl}
            src={customUrl}
            alt="Custom Scene"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-zinc-950/30" />
      </div>
    );
  }

  // ── Matrix Rain Canvas ───────────────────────────────────────────────────
  if (sceneId === 'matrix_rain') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 w-full h-full overflow-hidden select-none bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-zinc-950/40" />
      </div>
    );
  }

  // ── Procedural Built-In Shaders / CSS Scenes ──────────────────────────────
  return (
    <div className="fixed inset-0 pointer-events-none z-0 w-full h-full overflow-hidden select-none">
      {/* Cyber Loft Room */}
      {sceneId === 'cyber_loft' && (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-zinc-950 to-purple-950">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/30 via-transparent to-black" />
          <div className="absolute bottom-10 left-10 text-[10px] font-mono tracking-widest text-purple-400/40 uppercase">CRISTI // 2077 // CYBER LOFT</div>
        </div>
      )}

      {/* Neon Grid / Synthwave */}
      {sceneId === 'neon_grid' && (
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950 via-zinc-950 to-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_rgba(236,72,153,0.25),_transparent_60%)]" />
          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-[linear-gradient(to_right,#38bdf815_1px,transparent_1px),linear-gradient(to_bottom,#38bdf815_1px,transparent_1px)] bg-[size:4rem_2rem] [transform:perspective(500px)_rotateX(60deg)] [transform-origin:bottom]" />
        </div>
      )}

      {/* Deep Nebula Space */}
      {sceneId === 'deep_nebula' && (
        <div className="absolute inset-0 bg-zinc-950">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-purple-950/20 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(168,85,247,0.2),_transparent_40%)]" />
        </div>
      )}

      {/* Zen Cyber Temple */}
      {sceneId === 'zen_temple' && (
        <div className="absolute inset-0 bg-gradient-to-t from-rose-950/40 via-zinc-950 to-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,_rgba(244,63,94,0.2),_transparent_50%)]" />
        </div>
      )}

      {/* Ambient Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30" />
    </div>
  );
});

export default BackgroundScene;

