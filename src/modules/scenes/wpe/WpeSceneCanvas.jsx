/**
 * Cristi AI - WpeSceneCanvas React Component
 * Mounts a full-screen WebGL shader canvas and drives the real-time animation loop
 */

import React, { useEffect, useRef } from 'react';
import { WpeShaderEngine } from './wpeShaderEngine.js';

export function WpeSceneCanvas({ imageUrl, isVisible = true }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const engine = new WpeShaderEngine(canvas);
    engineRef.current = engine;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      if (engineRef.current) {
        engine.resize(window.innerWidth, window.innerHeight);
        engine.loadTexture('main', img);
        engine.start();
      }
    };

    const handleResize = () => {
      if (engineRef.current) {
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [imageUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="scene-media-element scene-webgl-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100vw',
        height: '100vh',
        objectFit: 'cover',
        pointerEvents: 'none',
        zIndex: 1,
        display: isVisible ? 'block' : 'none'
      }}
    />
  );
}

export default WpeSceneCanvas;
