/**
 * Cristi AI - ScreenRegionOverlay Component
 * Displays a subtle animated border showing exactly what Cristi is seeing on screen.
 */
import React from 'react';

export function ScreenRegionOverlay({ region, isWatchActive }) {
  if (!region && !isWatchActive) return null;

  // If no region set, show a subtle full-screen indicator instead
  if (!region) {
    return (
      <div className="screen-overlay-fullscreen">
        <span className="screen-overlay-label">
          <span className="screen-overlay-eye">👁</span> Cristi ve toda la pantalla
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
      <div className="screen-overlay-corner screen-overlay-corner-tl" />
      <div className="screen-overlay-corner screen-overlay-corner-tr" />
      <div className="screen-overlay-corner screen-overlay-corner-bl" />
      <div className="screen-overlay-corner screen-overlay-corner-br" />
      <span className="screen-overlay-label">
        <span className="screen-overlay-eye">👁</span> Cristi está viendo aquí
      </span>
    </div>
  );
}
