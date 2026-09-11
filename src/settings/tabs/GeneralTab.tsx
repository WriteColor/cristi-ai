import { electronBridge } from '../../services/desktop/ElectronBridge';
import { toastService } from '../../infrastructure/notifications/toastService';
import React from 'react';
import {
  Key,
  Cpu,
  Sliders,
  RotateCcw,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  FileCode
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { GEMINI_MODELS_LIST, SYSTEM_PERSONA_PROMPT } from '../../config/models.js';
import { soundFxService } from '../../domain/audio/SoundFxService.js';

export const GeneralTab: React.FC = () => {
  const hasCredential = useSettingsStore(s => s.config.hasGeminiCredential);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const showApiKey = useSettingsStore((s) => s.showApiKey);
  const modelId = useSettingsStore((s) => s.modelId);
  const temperature = useSettingsStore((s) => s.temperature);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const setField = useSettingsStore((s) => s.setField);

  const isDefaultPrompt = systemPrompt.trim() === SYSTEM_PERSONA_PROMPT.trim();

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Encabezado */}
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
          Cerebro & Modelo de Inteligencia Artificial
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Conexión directa con Google Gemini Multimodal Live API en tiempo real y prompt maestro unificado.
        </p>
      </div>

      <div className="border border-zinc-800 p-3 rounded-sm text-xs text-zinc-300">
        <button
          type="button"
          className="border border-zinc-600 px-3 py-2 rounded hover:bg-zinc-800/60 transition-colors"
          onClick={async () => {
            try {
              if (await electronBridge.approveWorkspace()) toastService.info('Carpeta autorizada para esta sesión.');
            } catch (error) {
              toastService.error(String(error));
            }
          }}
        >
          Seleccionar carpeta para herramientas
        </button>
        <p className="mt-2 text-zinc-400">
          Cristi podrá leer y escribir archivos dentro de la carpeta seleccionada. La autorización termina al cerrar la aplicación.
        </p>
      </div>

      {/* Controles Principales en 3 Columnas Horizontales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* API Key */}
        <div className="space-y-1.5 border border-zinc-800 bg-zinc-900/40 p-3.5 rounded-sm">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-1.5">
              <Key size={13} className="text-zinc-400" />
              Clave API de Gemini
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1"
            >
              Obtener clave <ExternalLink size={10} />
            </a>
          </div>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setField('apiKey', e.target.value)}
              placeholder={hasCredential ? 'Credencial guardada. Pega otra para reemplazarla.' : 'Pega aquí tu API Key y guarda...'}
              className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
            <button
              type="button"
              onClick={() => setField('showApiKey', !showApiKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              title={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
            >
              {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        {/* Modelo de IA */}
        <div className="space-y-1.5 border border-zinc-800 bg-zinc-900/40 p-3.5 rounded-sm">
          <label className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-1.5">
            <Cpu size={13} className="text-zinc-400" />
            Modelo Activo de Gemini Live
          </label>
          <select
            value={modelId}
            onChange={(e) => setField('modelId', e.target.value)}
            className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
          >
            {GEMINI_MODELS_LIST.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.displayName || m.name} ({m.id})
              </option>
            ))}
          </select>
        </div>

        {/* Temperatura */}
        <div className="space-y-2 border border-zinc-800 bg-zinc-900/40 p-3.5 rounded-sm">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-200 flex items-center gap-1.5">
              <Sliders size={13} className="text-zinc-400" />
              Temperatura: {temperature}
            </span>
            <span className="text-zinc-400 text-[11px]">
              {temperature < 0.4 ? 'Analítico' : temperature > 0.8 ? 'Afectuoso' : 'Equilibrado'}
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.2"
            step="0.05"
            value={temperature}
            onChange={(e) => setField('temperature', parseFloat(e.target.value))}
            className="w-full accent-zinc-200 cursor-pointer"
          />
        </div>
      </div>

      {/* Único Prompt Maestro del Sistema (Totalmente Customizable y Persistente) */}
      <div className="flex flex-col flex-1 min-h-0 gap-2.5 border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileCode size={14} className="text-rose-400" />
            <label className="text-xs font-mono font-semibold text-zinc-100 uppercase tracking-wide">
              Prompt Maestro del Sistema (Directiva Única)
            </label>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isDefaultPrompt
                ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
            }`}>
              {isDefaultPrompt ? <Sparkles size={10} /> : <CheckCircle2 size={10} />}
              {isDefaultPrompt ? 'Cadencia Auditada (Predeterminado)' : 'Personalizado'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-500">
              {systemPrompt.length} caracteres
            </span>
            <button
              type="button"
              onClick={() => {
                soundFxService.playClick();
                setField('systemPrompt', SYSTEM_PERSONA_PROMPT);
                toastService.info('Prompt Maestro', 'Restaurado al prompt oficial predeterminado.');
              }}
              className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-700/60 hover:border-zinc-600 bg-zinc-950 px-2.5 py-1 rounded transition-colors"
              title="Restaurar prompt maestro oficial predeterminado"
            >
              <RotateCcw size={11} />
              <span>Restablecer Maestro</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 shrink-0 leading-relaxed">
          Este es el único prompt maestro que gobierna a Cristi en todas las llamadas y modelos. Define su tono sensual y cariñoso, cadencia continua, herramientas y normas. Cualquier cambio que realices aquí se guarda automáticamente y persiste entre reinicios.
        </p>

        <div className="flex flex-col flex-1 min-h-0">
          <textarea
            value={systemPrompt}
            onChange={(e) => setField('systemPrompt', e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-0 w-full p-3 text-xs font-mono bg-zinc-950/90 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-rose-500/70 leading-relaxed resize-none shadow-inner"
            placeholder="Escribe aquí las directivas del Prompt Maestro de Cristi..."
          />
        </div>
      </div>
    </div>
  );
};

export default GeneralTab;
