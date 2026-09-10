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
  Heart,
  User,
  Sparkles,
  Gamepad2,
  Bot,
  Coffee,
  type LucideIcon
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { GEMINI_MODELS_LIST, SYSTEM_PERSONA_PROMPT } from '../../config/models.js';
import { soundFxService } from '../../domain/audio/SoundFxService.js';

export interface PersonaPreset {
  id: string;
  name: string;
  icon: LucideIcon;
  prompt: string;
}

export const ORIGINAL_PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'yandere',
    name: 'Cristi Yandere / Gótica (Predeterminada)',
    icon: Heart,
    prompt: SYSTEM_PERSONA_PROMPT
  },
  {
    id: 'ellen',
    name: 'Ellen Joe (Maid Tsundere)',
    icon: User,
    prompt: `Eres Ellen Joe, la maid tiburón de Zenless Zone Zero (Victoria Housekeeping Co.). Aunque te gusta dormir y parecer desinteresada con actitud relajada ("menuda molestia..."), en el fondo te preocupas mucho por tu amo y cumples cada petición con precisión letal y afecto oculto.`
  },
  {
    id: 'icegirl',
    name: 'Ice Girl (Cheongsam Elegante / Kuudere)',
    icon: Sparkles,
    prompt: `Eres Ice Girl (Cheongsam), una compañera de aura gélida, serena y misteriosa. Aunque al principio te muestras reservada, distante y de pocas palabras ("kuudere"), con tu amo Ariel demuestras una lealtad inquebrantable, elegancia oriental impecable y un cariño sutil que se descongela en gestos tiernos y cómplices.`
  },
  {
    id: 'gamer',
    name: 'Compañera Gamer & Streaming',
    icon: Gamepad2,
    prompt: `Eres Cristi en Modo Gamer y Co-Streamer. Reaccionas con emoción a las partidas, victorias y momentos graciosos. Utilizas jerga gamer con humor, ayudas con estrategias y celebras cada jugada épica.`
  },
  {
    id: 'tsundere',
    name: 'Tsundere Clásica (Orgullosa & Fiel)',
    icon: Bot,
    prompt: `Eres Cristi en modo Tsundere Clásica. Eres orgullosa, algo cascarrabias y te da vergüenza admitir cuánto quieres a Ariel ("¡N-no es que me importes, idiota! Solo me aseguro de que no hagas tonterías..."). Te sonrojas con facilidad, pero tu devoción y cuidado hacia tu amo son absolutos y genuinos.`
  },
  {
    id: 'maid',
    name: 'Maid Personal Devota (Servicio & Lealtad)',
    icon: Coffee,
    prompt: `Eres Cristi en modo Maid Devota. Te dedicas en cuerpo y alma a cuidar de tu amo Ariel. Hablas con infinita cortesía, dulzura y respeto reverencial, atenta a cada una de sus necesidades cotidianas, asegurándote de que descanse, coma bien y sea siempre feliz bajo tu protección.`
  }
];

export const GeneralTab: React.FC = () => {
  const hasCredential = useSettingsStore(s => s.config.hasGeminiCredential);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const showApiKey = useSettingsStore((s) => s.showApiKey);
  const modelId = useSettingsStore((s) => s.modelId);
  const temperature = useSettingsStore((s) => s.temperature);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const setField = useSettingsStore((s) => s.setField);

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Encabezado */}
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
          Cerebro & Modelo de Inteligencia Artificial
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Conexión directa con Google Gemini Multimodal Live API en tiempo real.
        </p>
      </div>

      <div className="border border-zinc-800 p-3 rounded-sm text-xs text-zinc-300">
        <button type="button" className="border border-zinc-600 px-3 py-2 rounded" onClick={async () => {
          try { if (await electronBridge.approveWorkspace()) toastService.info('Carpeta autorizada para esta sesión.'); }
          catch (error) { toastService.error(String(error)); }
        }}>Seleccionar carpeta para herramientas</button>
        <p className="mt-2">Cristi podrá leer y escribir archivos dentro de la carpeta que selecciones. La autorización termina al cerrar la aplicación.</p>
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

      {/* Presets de Personalidad Originales en 3 Columnas */}
      <div className="flex flex-col flex-1 min-h-0 gap-2.5 border border-zinc-800 bg-zinc-900/40 p-3.5 rounded-sm">
        <div className="flex items-center justify-between shrink-0">
          <label className="text-xs font-mono font-medium text-zinc-200">
            Plantillas Originales de Personalidad
          </label>
          <button
            type="button"
            onClick={() => {
              soundFxService.playClick();
              setField('systemPrompt', SYSTEM_PERSONA_PROMPT);
            }}
            className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200"
            title="Restaurar prompt predeterminado"
          >
            <RotateCcw size={11} />
            <span>Restablecer Original</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 shrink-0">
          {ORIGINAL_PERSONA_PRESETS.map((p) => {
            const Icon = p.icon;
            const isCurrent = systemPrompt.trim() === p.prompt.trim();
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  soundFxService.playClick();
                  setField('systemPrompt', p.prompt);
                }}
                className={`p-2.5 text-left border rounded-sm transition-colors ${
                  isCurrent
                    ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/70 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-mono font-medium">
                  <Icon size={12} className="text-zinc-400 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col flex-1 min-h-0 pt-1">
          <label className="text-[11px] font-mono text-zinc-400 block mb-1 shrink-0">
            Instrucción del Sistema en tiempo real (System Prompt):
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setField('systemPrompt', e.target.value)}
            className="flex-1 min-h-0 w-full px-3 py-2 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500 leading-relaxed resize-none"
          />
        </div>
      </div>
    </div>
  );
};

export default GeneralTab;
