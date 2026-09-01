/**
 * Cristi AI - ScreenRegionOverlay Component
 * Displays a subtle, high-tech obsidian cyberpunk boundary showing exactly what Cristi is seeing on screen.
 * 0% CPU overhead, zero blur keyframe bloat.
 */
import React from 'react';
import { Eye, Scan } from 'lucide-react';

export const ScreenRegionOverlay = React.memo(function ScreenRegionOverlay({ region, isWatchActive }) {
  if (!region && !isWatchActive) return null;

  // If no region set, show a subtle full-screen indicator
  if (!region) {
    return (
      <div className="screen-overlay-fullscreen">
        <span className="screen-overlay-badge">
          <Eye size={12} className="screen-overlay-eye" />
          <span>Cristi observa toda la pantalla</span>
        </span>
      </div>
    );
  }

  const style = {
    left: `${region.x_pct}%`,
    top: `${region.y_pct}%`,
    width: `${region.w_pct}%`,
    height: `${region.h_pct}%`,
  };

  return (
    <div className="screen-overlay-region" style={style}>
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />
      <span className="screen-overlay-badge">
        <Scan size={11} className="screen-overlay-eye" />
        <span>Área Vigilada ({Math.round(region.w_pct)}% × {Math.round(region.h_pct)}%)</span>
      </span>
    </div>
  );
});

export default ScreenRegionOverlay;
