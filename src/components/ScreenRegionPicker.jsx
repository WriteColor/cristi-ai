/**
 * Cristi AI - ScreenRegionPicker Component
 * A fullscreen drag-to-select overlay for defining Cristi's vision region.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useClickThrough } from '../hooks/useClickThrough.js';

export function ScreenRegionPicker({ onRegionSelected, onCancel }) {
  const overlayRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [current, setCurrent] = useState({ x: 0, y: 0 });

  const getRect = useCallback(() => {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    return { x, y, w, h };
  }, [start, current]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setCurrent({ x: e.clientX, y: e.clientY });
  }, [isDragging]);

  const handleMouseUp = useCallback((e) => {
    if (!isDragging) return;
    setIsDragging(false);
    const { x, y, w, h } = getRect();

    // Minimum size threshold (50x50px)
    if (w < 50 || h < 50) return;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    onRegionSelected({
      x_pct: parseFloat(((x / screenW) * 100).toFixed(1)),
      y_pct: parseFloat(((y / screenH) * 100).toFixed(1)),
      w_pct: parseFloat(((w / screenW) * 100).toFixed(1)),
      h_pct: parseFloat(((h / screenH) * 100).toFixed(1))
    });
  }, [isDragging, getRect, onRegionSelected]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const { interactiveProps } = useClickThrough();
  const rect = isDragging ? getRect() : null;

  return (
    <div
      ref={overlayRef}
      className="screen-picker-overlay"
      {...interactiveProps}
      onMouseDown={handleMouseDown}
    >
      {/* Instruction */}
      <div className="screen-picker-instruction">
        <span className="screen-picker-icon">🎯</span>
        <span>Arrastra para definir el área de visión de Cristi</span>
        <button className="screen-picker-cancel-btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      {/* Selection rectangle */}
      {rect && rect.w > 10 && rect.h > 10 && (
        <div
          className="screen-picker-selection"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h
          }}
        >
          <div className="screen-picker-sel-corner screen-picker-sel-tl" />
          <div className="screen-picker-sel-corner screen-picker-sel-tr" />
          <div className="screen-picker-sel-corner screen-picker-sel-bl" />
          <div className="screen-picker-sel-corner screen-picker-sel-br" />
          <span className="screen-picker-size-label">
            {Math.round(rect.w)} × {Math.round(rect.h)}
          </span>
        </div>
      )}
    </div>
  );
}
