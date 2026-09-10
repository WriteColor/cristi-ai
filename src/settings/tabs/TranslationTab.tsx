import React, { useState, useEffect } from 'react';
import { Globe, Radio, Volume2, Cpu } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { virtualAudioOutputService } from '../../domain/audio/VirtualAudioOutputService.js';

export const TranslationTab: React.FC = () => {
  const externalTranslationEnabled = useSettingsStore((s) => s.externalTranslationEnabled);
  const translationSourceLanguage = useSettingsStore((s) => s.translationSourceLanguage);
  const translationTargetLanguage = useSettingsStore((s) => s.translationTargetLanguage);
  const translationAggregateMs = useSettingsStore((s) => s.translationAggregateMs);
  const translationGameAudioDeviceId = useSettingsStore((s) => s.translationGameAudioDeviceId);
  const wasapiLoopbackEnabled = useSettingsStore((s) => s.wasapiLoopbackEnabled);
  const setField = useSettingsStore((s) => s.setField);

  const [outputDevices, setOutputDevices] = useState<Array<{ deviceId: string; label: string }>>([]);

  useEffect(() => {
    let active = true;
    virtualAudioOutputService.listOutputDevices()
      .then((devices: any[]) => {
        if (!active) return;
        setOutputDevices(devices || []);
        const selected = devices?.find((d) => d.deviceId === translationGameAudioDeviceId);
        if (selected?.label) {
          setField('translationGameAudioDeviceLabel', selected.label);
        }
      })
      .catch(() => {
        if (active) setOutputDevices([]);
      });
    return () => {
      active = false;
    };
  }, [translationGameAudioDeviceId, setField]);

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pr-1">
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100 flex items-center gap-2">
          <Globe size={16} className="text-cyan-400" /> Traducción de voz externa & Audio In-Game
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Traduce audio de una pantalla compartida o de participantes de Discord sin mezclarlo con tu micrófono ni con la voz de Cristi.
        </p>
      </div>

      <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-4">
        {/* Toggle principal */}
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span>
            <span className="block text-xs font-mono text-zinc-200">Activar traducción externa</span>
            <span className="block text-[11px] text-zinc-500 mt-1">
              El modelo procesa sólo las fuentes que se inicien con traducción.
            </span>
          </span>
          <input
            type="checkbox"
            checked={externalTranslationEnabled}
            onChange={(e) => setField('externalTranslationEnabled', e.target.checked)}
            className="h-4 w-4 accent-cyan-500 rounded"
          />
        </label>

        {/* Idioma Origen & Idioma Destino */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="block text-[11px] font-mono text-zinc-400">Idioma origen</span>
            <select
              value={translationSourceLanguage}
              onChange={(e) => setField('translationSourceLanguage', e.target.value)}
              className="w-full px-2.5 py-2 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="auto">Autodetectar (Automático)</option>
              <option value="en">English (Inglés)</option>
              <option value="ja">日本語 (Japonés)</option>
              <option value="fr">Français (Francés)</option>
              <option value="de">Deutsch (Alemán)</option>
              <option value="pt">Português (Portugués)</option>
              <option value="ko">한국어 (Coreano)</option>
              <option value="zh">中文 (Chino)</option>
              <option value="ru">Русский (Ruso)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="block text-[11px] font-mono text-zinc-400">Idioma destino</span>
            <select
              value={translationTargetLanguage}
              onChange={(e) => setField('translationTargetLanguage', e.target.value)}
              className="w-full px-2.5 py-2 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="pt">Português</option>
              <option value="ko">한국어</option>
              <option value="zh">中文</option>
              <option value="ru">Русский</option>
            </select>
          </label>
        </div>

        {/* Lote de audio */}
        <div>
          <label className="space-y-1 block">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-300">Lote de agregación de audio: {translationAggregateMs} ms</span>
              <span className="text-[11px] text-zinc-500">
                {translationAggregateMs <= 300 ? 'Baja Latencia' : translationAggregateMs >= 800 ? 'Máxima Precisión' : 'Equilibrado'}
              </span>
            </div>
            <input
              type="range"
              min="200"
              max="1200"
              step="50"
              value={translationAggregateMs}
              onChange={(e) => setField('translationAggregateMs', Number(e.target.value))}
              className="w-full accent-cyan-500 mt-2 cursor-pointer"
            />
            <span className="block text-[10px] text-zinc-500 mt-1">
              Menor valor reduce latencia; mayor valor permite frases y oraciones más completas antes de traducir.
            </span>
          </label>
        </div>

        {/* Salida Virtual para Voz en el Juego */}
        <div className="space-y-1 pt-2 border-t border-zinc-800/80">
          <label className="block space-y-1">
            <span className="block text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
              <Volume2 size={13} className="text-zinc-400" />
              Salida virtual para voz del juego
            </span>
            <select
              value={translationGameAudioDeviceId}
              onChange={(e) => {
                const deviceId = e.target.value;
                setField('translationGameAudioDeviceId', deviceId);
                const match = outputDevices.find((device) => device.deviceId === deviceId);
                setField('translationGameAudioDeviceLabel', match?.label || '');
              }}
              className="w-full px-2.5 py-2 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">No enviar voz al juego</option>
              {outputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Dispositivo ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <span className="block text-[10px] text-zinc-500 mt-1">
              Selecciona la salida de reproducción del cable virtual (ej. “CABLE Input”). En el juego usa su micrófono emparejado (“CABLE Output”).
            </span>
          </label>
        </div>

        {/* Captura WASAPI Loopback */}
        <div className="pt-2 border-t border-zinc-800/80">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <span className="text-xs font-mono text-zinc-200 flex items-center gap-1.5">
                <Radio size={13} className="text-cyan-400" />
                Captura de Audio por Loopback WASAPI (Windows)
              </span>
              <span className="block text-[11px] text-zinc-500 mt-0.5">
                Captura directamente el stream de sonido del videojuego o Discord desde la tarjeta de sonido nativa de Windows con latencia cero.
              </span>
            </div>
            <input
              type="checkbox"
              checked={wasapiLoopbackEnabled}
              onChange={(e) => setField('wasapiLoopbackEnabled', e.target.checked)}
              className="h-4 w-4 accent-cyan-500 rounded"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default TranslationTab;
