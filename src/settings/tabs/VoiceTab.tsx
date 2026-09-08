import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Square,
  Mic,
  Sliders,
  VolumeX,
  Volume1,
  Sparkles,
  Bot
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { GEMINI_STANDARD_VOICES } from '../../config/voices.js';
import { soundFxService } from '../../services/soundFxService.js';
import { toastService } from '../../services/toastService.js';

export const VoiceTab: React.FC = () => {
  const voiceName = useSettingsStore((s) => s.voiceName);
  const voiceVolume = useSettingsStore((s) => s.voiceVolume);
  const silenceThreshold = useSettingsStore((s) => s.silenceThreshold);
  const ttsFallbackVoice = useSettingsStore((s) => s.ttsFallbackVoice);
  const ttsFallbackEnabled = useSettingsStore((s) => s.ttsFallbackEnabled);
  const setField = useSettingsStore((s) => s.setField);

  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [availableSystemVoices, setAvailableSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          setAvailableSystemVoices(voices);
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const handlePlayVoicePreview = (voice: any) => {
    soundFxService.playClick();
    if (playingVoice === voice.name) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setPlayingVoice(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audioUrl = voice.previewAudio || `/audio/previews/${voice.name.toLowerCase()}.wav`;
    const audio = new Audio(audioUrl);
    audio.volume = Math.max(0, Math.min(1, voiceVolume / 100));
    audioPlayerRef.current = audio;
    setPlayingVoice(voice.name);

    audio.onended = () => {
      setPlayingVoice(null);
      audioPlayerRef.current = null;
    };
    audio.onerror = () => {
      setPlayingVoice(null);
      audioPlayerRef.current = null;
      toastService.info('Muestra de voz', `No se pudo reproducir la muestra de ${voice.name}`);
    };
    audio.play().catch(() => setPlayingVoice(null));
  };

  const handleTestVoice = () => {
    soundFxService.playClick();
    const currentVoiceObj = GEMINI_STANDARD_VOICES.find((v) => v.name === voiceName) || GEMINI_STANDARD_VOICES[0];
    
    if (isTestingVoice) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setIsTestingVoice(false);
      return;
    }

    setIsTestingVoice(true);
    const audioUrl = currentVoiceObj.previewAudio || `/audio/previews/${currentVoiceObj.name.toLowerCase()}.wav`;
    const audio = new Audio(audioUrl);
    audio.volume = Math.max(0, Math.min(1, voiceVolume / 100));
    audioPlayerRef.current = audio;

    audio.onended = () => {
      setIsTestingVoice(false);
      audioPlayerRef.current = null;
    };
    audio.onerror = () => {
      setIsTestingVoice(false);
      audioPlayerRef.current = null;
      toastService.info('Prueba de voz', `Voz activa: ${voiceName}`);
    };
    audio.play().catch(() => setIsTestingVoice(false));
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pr-1">
      {/* Encabezado */}
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
          Voces Oficiales Verificadas (Free Tier)
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Escucha y selecciona entre las voces nativas de Google Gemini compatibles con tu cuenta.
        </p>
      </div>

      {/* Grid de Voces Oficiales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {GEMINI_STANDARD_VOICES.map((v) => {
          const isSelected = voiceName === v.name;
          const isPlaying = playingVoice === v.name;
          return (
            <div
              key={v.name}
              onClick={() => {
                soundFxService.playClick();
                setField('voiceName', v.name);
              }}
              className={`p-3.5 border rounded-sm cursor-pointer transition-colors flex items-start justify-between gap-4 ${
                isSelected
                  ? 'bg-zinc-900 border-zinc-500 text-white shadow-sm'
                  : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-zinc-100">{v.name}</span>
                  {isSelected && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-emerald-300 rounded-none border border-emerald-800">
                      Activa
                    </span>
                  )}
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-none border border-zinc-700/60">
                    {v.gender}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 truncate">
                    • {v.trait}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  {v.description}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayVoicePreview(v);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors ${
                    isPlaying
                      ? 'bg-zinc-100 text-zinc-950 font-semibold border-white'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                  title="Reproducir muestra de voz con la personalidad de Cristi"
                >
                  {isPlaying ? <Square size={11} className="fill-current" /> : <Play size={11} />}
                  <span>{isPlaying ? 'Detener' : 'Escuchar Muestra'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controles Avanzados de Audio y Parámetros */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-200 flex items-center gap-2">
            <Sliders size={14} className="text-zinc-400" />
            Parámetros Acústicos & Detección de Voz
          </span>
          <button
            type="button"
            onClick={handleTestVoice}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-sm border transition-colors ${
              isTestingVoice
                ? 'bg-emerald-600 border-emerald-500 text-white font-medium animate-pulse'
                : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            {isTestingVoice ? <Square size={12} className="fill-current" /> : <Sparkles size={12} />}
            <span>{isTestingVoice ? 'Detener Prueba' : 'Probar Voz de Cristi'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Volumen Maestro */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-200 flex items-center gap-1.5">
                {voiceVolume === 0 ? <VolumeX size={13} className="text-zinc-400" /> : <Volume1 size={13} className="text-zinc-400" />}
                Volumen de Respuesta: {voiceVolume}%
              </span>
              <span className="text-zinc-400 text-[11px]">
                {voiceVolume > 80 ? 'Alto' : voiceVolume > 40 ? 'Normal' : 'Atenuado'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={voiceVolume}
              onChange={(e) => setField('voiceVolume', parseInt(e.target.value, 10))}
              className="w-full accent-zinc-200 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-zinc-500 block">
              Ajusta la ganancia de salida de audio generada por la síntesis neuronal.
            </span>
          </div>

          {/* Umbral de Silencio (VAD) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-200 flex items-center gap-1.5">
                <Mic size={13} className="text-zinc-400" />
                Sensibilidad de Silencio (VAD): {Math.round(silenceThreshold * 1000)} ms
              </span>
              <span className="text-zinc-400 text-[11px]">
                {silenceThreshold <= 0.015 ? 'Alta Sensibilidad' : 'Filtro Moderado'}
              </span>
            </div>
            <input
              type="range"
              min="0.005"
              max="0.050"
              step="0.005"
              value={silenceThreshold}
              onChange={(e) => setField('silenceThreshold', parseFloat(e.target.value))}
              className="w-full accent-zinc-200 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-zinc-500 block">
              Umbral acústico para detectar cuando terminas de hablar y enviar el turno.
            </span>
          </div>
        </div>

        {/* Fallback TTS Voice */}
        <div className="pt-3 border-t border-zinc-800/60 space-y-3">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <span className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-2">
                <Bot size={13} className="text-zinc-400" />
                Voz de Respaldo Sintética (TTS Fallback)
              </span>
              <span className="block text-[11px] text-zinc-400 mt-0.5">
                Se utiliza únicamente si Gemini Live devuelve texto mudo sin stream de audio PCM.
              </span>
            </div>
            <input
              type="checkbox"
              checked={ttsFallbackEnabled}
              onChange={(e) => setField('ttsFallbackEnabled', e.target.checked)}
              className="h-4 w-4 accent-zinc-200 rounded"
            />
          </label>

          {ttsFallbackEnabled && (
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-mono text-zinc-400 block">
                Selección de Voz del Sistema Operativo:
              </label>
              <select
                value={ttsFallbackVoice}
                onChange={(e) => setField('ttsFallbackVoice', e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
              >
                {availableSystemVoices.length > 0 ? (
                  availableSystemVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Microsoft Helena - Spanish (Spain)">Microsoft Helena - Spanish (Spain)</option>
                    <option value="Microsoft Laura - Spanish (Spain)">Microsoft Laura - Spanish (Spain)</option>
                    <option value="Google español">Google español</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceTab;
