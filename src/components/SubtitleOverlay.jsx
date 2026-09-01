import React from 'react';

/**
 * Cristi AI - User Speech Transcription Pill (Shadcn Dark Minimalist)
 * Displays ONLY what the user speaks, clean, floating, non-blocking.
 */
export function SubtitleOverlay({ userTranscript }) {
  if (!userTranscript || !userTranscript.trim()) return null;

  const cleanUser = userTranscript
    .replace(/\[[a-zA-Z_\s-]+\]/g, '')
    .replace(/\([a-zA-Z_\s-]+\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleanUser) return null;

  return (
    <div className="shadcn-user-transcript-wrapper">
      <div className="shadcn-user-transcript-pill">
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-br" />
        <span className="user-indicator">TÚ // USER</span>
        <span className="user-text">{cleanUser}</span>
      </div>
    </div>
  );
}
export default React.memo(SubtitleOverlay);
