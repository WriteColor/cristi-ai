import React, { useMemo } from 'react';
import { Smile, Sliders, Move } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { live2dModelRegistry } from '../../domain/live2d/Live2DModelRegistry.js';
import { soundFxService } from '../../domain/audio/SoundFxService.js';
import { ModelPreviewCanvas } from '../components/ModelPreviewCanvas';

export const ModelsTab: React.FC = () => {
  const live2dModelId = useSettingsStore((s) => s.live2dModelId);
  const viewMode = useSettingsStore((s) => s.viewMode);
  const inspectedLive2DId = useSettingsStore((s) => s.inspectedLive2DId);
  const modelScale = useSettingsStore((s) => s.modelScale);
  const modelPosition = useSettingsStore((s) => s.modelPosition);
  const setField = useSettingsStore((s) => s.setField);
  const switchLive2DModel = useSettingsStore((s) => s.switchLive2DModel);

  const live2dModels = useMemo(() => {
    try {
      return live2dModelRegistry.getAllModels();
    } catch (_) {
      return [];
    }
  }, []);

  const inspectedLive2D = live2dModelRegistry.getModel(inspectedLive2DId) as any;

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100 flex items-center gap-2">
            <Smile size={16} className="text-zinc-400" />
            Catálogo de Avatares Live2D (13 Modelos Oficiales)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Inspecciona la cinemática, expresiones y apariencia de cada avatar Live2D oficial antes de activarlo.
          </p>
        </div>
      </div>

      {/* Grid de 2 Columnas: Lista a la izquierda (7 cols), Previsualizador a la derecha (5 cols) */}
      <div className="grid grid-cols-12 gap-5 pt-1">
        {/* Columna Izquierda: Lista de Avatares y Parámetros */}
        <div className="col-span-7 space-y-3 max-h-[620px] overflow-y-auto pr-1">
          {/* Controles de Encuadre, Escala y Posición */}
          <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-sm space-y-3">
            {/* Selector de Encuadre */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-300">Encuadre de Cámara:</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    soundFxService.playClick();
                    setField('viewMode', 'torso');
                  }}
                  className={`px-2.5 py-1 text-[11px] border rounded-sm transition-colors ${
                    viewMode === 'torso'
                      ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Torso (Medio)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFxService.playClick();
                    setField('viewMode', 'full');
                  }}
                  className={`px-2.5 py-1 text-[11px] border rounded-sm transition-colors ${
                    viewMode === 'full'
                      ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Cuerpo Completo
                </button>
              </div>
            </div>

            {/* Selector de Escala y Posición Predeterminada */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Sliders size={11} /> Escala: {modelScale.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={modelScale}
                  onChange={(e) => setField('modelScale', parseFloat(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Move size={11} /> Posición Inicial
                  </span>
                </div>
                <select
                  value={modelPosition}
                  onChange={(e) => setField('modelPosition', e.target.value)}
                  className="w-full px-2 py-1 text-[11px] font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="center">Centro</option>
                  <option value="bottom-right">Inferior Derecha</option>
                  <option value="bottom-center">Inferior Centro</option>
                  <option value="bottom-left">Inferior Izquierda</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tarjetas de los 13 Modelos Live2D */}
          <div className="space-y-2">
            {live2dModels.map((m: any) => {
              const isActive = live2dModelId === m.id;
              const isInspected = inspectedLive2DId === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    soundFxService.playClick();
                    switchLive2DModel(m.id);
                  }}
                  className={`p-3 border rounded-sm cursor-pointer transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-zinc-900 border-zinc-500 text-white shadow-sm'
                      : isInspected
                      ? 'bg-zinc-900/60 border-zinc-700 text-zinc-200'
                      : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold">{m.name}</span>
                      {isActive && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-emerald-300 rounded-none border border-emerald-800">
                          Activo
                        </span>
                      )}
                      {m.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-none border border-zinc-700/60">
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">
                      ID: {m.id} • {m.theme || 'Cubism 4.2'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Previsualizador del Avatar */}
        <div className="col-span-5 border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-mono uppercase text-zinc-400">Inspección de Avatar</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-none">
                Cubism 4.2 WebGL2
              </span>
            </div>

            {inspectedLive2D && (
              <div className="space-y-3 pt-3">
                <div className="aspect-[3/4] bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden relative group">
                  <ModelPreviewCanvas
                    modelId={inspectedLive2DId}
                    className="w-full h-full"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/40 to-transparent px-2.5 pb-2 pt-6 pointer-events-none">
                    <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedLive2D.name}</div>
                    {inspectedLive2D.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-none mt-0.5 inline-block">
                        {inspectedLive2D.badge}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Tema Visual:</span>
                    <span className="text-zinc-200">{inspectedLive2D.theme || 'Anime Live2D'}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Expresiones:</span>
                    <span className="text-zinc-200">
                      {inspectedLive2D.expressions?.length || inspectedLive2D.capabilities?.customExpressions?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Física Cinética:</span>
                    <span className="text-emerald-400">Physics 2.0</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Seguimiento Visual:</span>
                    <span className="text-emerald-400">Interactivo</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-800/60 leading-relaxed">
                  {inspectedLive2D.description || 'Avatar Live2D oficial de alta fidelidad con cinemática procedural y microexpresiones.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelsTab;
