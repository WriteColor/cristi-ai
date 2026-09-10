import React from 'react';
import { useSessionStore } from '../stores/useSessionStore.js';
import { useCompanionStore } from '../stores/useCompanionStore.js';

export interface SubtitleOverlayProps {
  userTranscript?: string;
  modelTranscript?: string;
  translationTranscript?: string;
  activeDecision?: unknown;
  isVisible?: boolean;
}

/**
 * Cristi AI - Dual Live Subtitle Overlay & Tactical Decision Micro-Toast
 * Displays real-time spoken transcripts (User & Cristi) and active AI decisions.
 * Completely pointer-events-none to prevent any gaming mouse interference.
 */
export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = React.memo(function SubtitleOverlay(props = {}) {
  const inputProvisional = useSessionStore(s => Boolean(s.inputInterim));
  const outputProvisional = useSessionStore(s => Boolean(s.outputInterim));
  const storeUser = useSessionStore((s) => s.userTranscript);
  const storeModel = useSessionStore((s) => s.modelTranscript);
  const storeTranslation = useSessionStore((s) => s.translationTranscript);
  const storeIsVisible = useCompanionStore((s) => s.isUiVisible && !s.isZenMode);

  const userTranscript = props.userTranscript !== undefined ? props.userTranscript : storeUser;
  const modelTranscript = props.modelTranscript !== undefined ? props.modelTranscript : storeModel;
  const translationTranscript =
    props.translationTranscript !== undefined ? props.translationTranscript : storeTranslation;
  const isVisible = props.isVisible !== undefined ? props.isVisible : storeIsVisible;

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

  const cleanTranslation = translationTranscript
    ? translationTranscript
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    : '';

  const hasContent = Boolean(cleanUser || cleanModel || cleanTranslation);
  if (!hasContent) return null;

  return (
    <aside
      aria-label="Subtítulos en vivo"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[95] pointer-events-none select-none flex flex-col items-center gap-2 max-w-7xl w-full px-4"
    >
      {/* Subtítulo de Cristi (Respuesta de voz IA) */}
      {cleanModel && (
        <div className="flex items-start gap-2.5 px-3.5 py-2 rounded-lg bg-zinc-950/90 border border-purple-500/30 shadow-2xl w-full">
          <span className="px-1.5 py-0.5 bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-mono font-bold rounded shrink-0 shadow-[0_0_8px_rgba(168,85,247,0.25)]">
            CRISTI
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-zinc-100 font-sans leading-relaxed text-base max-h-56 max-h-[min(70vh,40rem)] overflow-y-auto">
            <span data-provisional={outputProvisional}>{cleanModel}</span>
          </span>
        </div>
      )}

      {/* Traducción externa */}
      {cleanTranslation && (
        <div className="flex items-start gap-2.5 px-3.5 py-2 rounded-lg bg-cyan-950/90 border border-cyan-400/35 shadow-2xl w-full">
          <span className="px-1.5 py-0.5 bg-cyan-950 border border-cyan-400/40 text-cyan-200 text-[10px] font-mono font-bold rounded shrink-0">
            TRADUCCIÓN
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-zinc-100 font-sans leading-relaxed text-base max-h-56 max-h-[min(70vh,40rem)] overflow-y-auto">
            {cleanTranslation}
          </span>
        </div>
      )}

      {/* Subtítulo del Usuario */}
      {cleanUser && (
        <div className="flex items-start gap-2.5 px-3.5 py-2 rounded-lg bg-zinc-950/90 border border-zinc-800 shadow-lg w-full">
          <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-semibold rounded shrink-0">
            TÚ
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-zinc-100 font-sans leading-relaxed text-base max-h-56 max-h-[min(70vh,40rem)] overflow-y-auto">
            <span data-provisional={inputProvisional}>{cleanUser}</span>
          </span>
        </div>
      )}
    </aside>
  );
});

export default SubtitleOverlay;
