import React from 'react';

/**
 * Cristi AI - Dual Live Subtitle Overlay & Tactical Decision Micro-Toast
 * Displays real-time spoken transcripts (User & Cristi) and active AI decisions.
 * Completely pointer-events-none to prevent any gaming mouse interference.
 */
export function SubtitleOverlay({
  userTranscript = '',
  modelTranscript = '',
  activeDecision = null,
  isVisible = true
}) {
  if (!isVisible) return null;

  const cleanUser = userTranscript
    ? userTranscript
        .replace(/\[[a-zA-Z_\s-]+\]/g, '')
        .replace(/\([a-zA-Z_\s-]+\)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    : '';

  const cleanModel = modelTranscript
    ? modelTranscript
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .replace(/\[thought[\s\S]*?\]/gi, '')
        .replace(/\*pensando[\s\S]*?\*/gi, '')
        .replace(/\*pensamiento[\s\S]*?\*/gi, '')
        .replace(/\[action:[\s\S]*?\]/gi, '')
        .replace(/\[tool:[\s\S]*?\]/gi, '')
        .replace(/\[decision:[\s\S]*?\]/gi, '')
        .replace(/\[(?:emotion|gesto|emocion|pose|mood|expression|modelo|model|tag|etiqueta):\s*[a-zA-Z0-9_-]+\]/gi, '')
        .replace(/\[(?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\]/gi, '')
        .replace(/\((?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\)/gi, '')
        .replace(/\b(?:yandere|tsundere|yanderegirl)\s*:\s*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    : '';

  const hasContent = Boolean(cleanUser || cleanModel);
  if (!hasContent) return null;

  return (
    <aside
      aria-label="Subtítulos en vivo"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[95] pointer-events-none select-none flex flex-col items-center gap-2 max-w-5xl w-full px-4"
    >
      {/* Subtítulo de Cristi (Respuesta de voz IA) */}
      {cleanModel && (
        <div className="flex items-start gap-2.5 px-3.5 py-2 rounded-lg bg-zinc-950/90 border border-purple-500/30 shadow-2xl w-full">
          <span className="px-1.5 py-0.5 bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-mono font-bold rounded shrink-0 shadow-[0_0_8px_rgba(168,85,247,0.25)]">
            CRISTI
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-zinc-100 font-sans leading-relaxed text-base max-h-56 overflow-y-auto">
            {cleanModel}
          </span>
        </div>
      )}

      {/* 3. Subtítulo del Usuario (Entrada de voz captada por micrófono) */}
      {cleanUser && (
        <div className="flex items-start gap-2.5 px-3.5 py-2 rounded-lg bg-zinc-950/90 border border-zinc-800 shadow-lg w-full">
          <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-semibold rounded shrink-0">
            TÚ
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-zinc-100 font-sans leading-relaxed text-base max-h-56 overflow-y-auto">
            {cleanUser}
          </span>
        </div>
      )}
    </aside>
  );
}

export default React.memo(SubtitleOverlay);
