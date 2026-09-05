import React from 'react';
import { Eye, Scan } from 'lucide-react';

/**
 * Cristi AI - ScreenRegionOverlay Component
 * Minimalist Shadcn Dark Gray Style
 */
export const ScreenRegionOverlay = React.memo(function ScreenRegionOverlay({ region, isWatchActive }) {
  if (!region && !isWatchActive) return null;

  // Pantalla completa vigilada
  if (!region) {
    return (
      <div className="fixed inset-0 z-[9998] pointer-events-none border border-zinc-700/40">
        <span className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-950/95 text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-sm shadow-xl backdrop-blur-md text-xs font-mono tracking-wide uppercase">
          <Eye size={13} className="text-zinc-400" />
          <span>Visión: Pantalla Completa</span>
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
    <div className="fixed z-[9998] pointer-events-none border border-zinc-400/80 bg-zinc-500/5 shadow-md" style={style}>
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-zinc-300" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-zinc-300" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-zinc-300" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-zinc-300" />
      <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-zinc-950/95 text-zinc-300 border border-zinc-800 px-2 py-0.5 rounded-sm shadow-xl backdrop-blur-md text-[10px] font-mono tracking-wider whitespace-nowrap">
        <Scan size={11} className="text-zinc-400" />
        <span>ÁREA ({Math.round(region.w_pct)}% × {Math.round(region.h_pct)}%)</span>
      </span>
    </div>
  );
});

export default ScreenRegionOverlay;
