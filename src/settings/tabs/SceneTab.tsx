import React, { useState, useMemo } from 'react';
import {
  Image as ImageIcon,
  Monitor,
  UploadCloud,
  Sliders,
  Plus,
  Trash2
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { sceneManager } from '../../services/sceneManager.js';
import { soundFxService } from '../../services/soundFxService.js';
import { toastService } from '../../services/toastService.js';

export const SceneTab: React.FC = () => {
  const sceneId = useSettingsStore((s) => s.sceneId);
  const inspectedSceneId = useSettingsStore((s) => s.inspectedSceneId);
  const sceneOpacity = useSettingsStore((s) => s.sceneOpacity);
  const setField = useSettingsStore((s) => s.setField);

  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customType, setCustomType] = useState<'image' | 'video'>('image');
  const [showAddCustom, setShowAddCustom] = useState(false);

  const availableScenes = useMemo(() => {
    return sceneManager.getAvailableScenes().filter((s: any) => s.id !== 'transparent');
  }, [sceneId]);

  const inspectedScene = useMemo(() => {
    return (
      availableScenes.find((s: any) => s.id === inspectedSceneId) ||
      availableScenes[0] || { id: 'deep_nebula', name: 'Nebulosa Cósmica & Estrellas', description: '' }
    );
  }, [availableScenes, inspectedSceneId]);

  const handleSelectScene = (id: string) => {
    soundFxService.playClick();
    setField('sceneId', id);
    setField('inspectedSceneId', id);
    sceneManager.setScene(id);
  };

  const handleAddCustomBackground = () => {
    if (!customUrl.trim()) {
      toastService.warn('Fondo Personalizado', 'Por favor ingresa una URL o ruta de archivo válida.');
      return;
    }
    soundFxService.playClick();
    const newId = `custom_${Date.now()}`;
    const name = customName.trim() || 'Fondo Personalizado';
    sceneManager.addCustomScene({
      id: newId,
      name,
      url: customUrl.trim(),
      type: customType,
      description: 'Fondo importado por el usuario'
    });
    setField('sceneId', newId);
    setField('inspectedSceneId', newId);
    setCustomName('');
    setCustomUrl('');
    setShowAddCustom(false);
    toastService.success('Fondo Añadido', `Se agregó "${name}" correctamente.`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCustomUrl(objectUrl);
    setCustomName(file.name.replace(/\.[^/.]+$/, ''));
    setCustomType(file.type.startsWith('video/') ? 'video' : 'image');
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100 flex items-center gap-2">
          <ImageIcon size={16} className="text-zinc-400" />
          Fondo & Atmósfera Visual
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Elige entre un fondo transparente para interactuar sobre tu escritorio o escenas ambientales completas.
        </p>
      </div>

      {/* Grid 12 columnas: Lista 7 cols, Previsualizador 5 cols */}
      <div className="grid grid-cols-12 gap-5 pt-1">
        {/* Columna Izquierda: Escenas disponibles y controles */}
        <div className="col-span-7 space-y-3 max-h-[620px] overflow-y-auto pr-1">
          {/* Controles de Opacidad e Importación */}
          <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-sm space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-200 flex items-center gap-1.5">
                  <Sliders size={13} className="text-zinc-400" />
                  Opacidad de Escena: {sceneOpacity}%
                </span>
                <span className="text-zinc-400 text-[11px]">
                  {sceneOpacity < 50 ? 'Translúcido' : 'Opaco'}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={sceneOpacity}
                onChange={(e) => setField('sceneOpacity', parseInt(e.target.value, 10))}
                className="w-full accent-zinc-200 cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-400">Fondos Personalizados:</span>
              <button
                type="button"
                onClick={() => {
                  soundFxService.playClick();
                  setShowAddCustom(!showAddCustom);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
              >
                <Plus size={11} />
                <span>{showAddCustom ? 'Cancelar' : 'Importar Fondo'}</span>
              </button>
            </div>

            {showAddCustom && (
              <div className="pt-2 border-t border-zinc-800/60 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nombre del fondo..."
                    className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
                  />
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value as 'image' | 'video')}
                    className="px-2 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
                  >
                    <option value="image">Imagen (JPG, PNG, WebP)</option>
                    <option value="video">Video (MP4, WebM)</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="URL del archivo o ruta local..."
                    className="flex-1 px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
                  />
                  <label className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-sm border border-zinc-700 cursor-pointer">
                    <UploadCloud size={12} />
                    <span>Examinar</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomBackground}
                  className="w-full py-1 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-sm border border-zinc-600 transition-colors"
                >
                  Guardar & Activar Fondo
                </button>
              </div>
            )}
          </div>

          {/* Lista de Escenas */}
          <div className="space-y-2">
            {availableScenes.map((s: any) => {
              const isActive = sceneId === s.id;
              const isInspected = inspectedSceneId === s.id;
              const isCustom = s.category === 'custom' || s.id.startsWith('custom_');
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectScene(s.id)}
                  className={`p-3 border rounded-sm cursor-pointer transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-zinc-900 border-zinc-500 text-white shadow-sm'
                      : isInspected
                      ? 'bg-zinc-900/60 border-zinc-700 text-zinc-200'
                      : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold truncate">{s.name}</span>
                      {isActive && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-emerald-300 rounded-none border border-emerald-800 shrink-0">
                          Activa
                        </span>
                      )}
                      {isCustom && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-cyan-300 rounded-none border border-cyan-800/60 shrink-0">
                          Personalizado
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                      {s.description || 'Escena visual'}
                    </span>
                  </div>

                  {isCustom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFxService.playClick();
                        sceneManager.removeCustomScene(s.id);
                        toastService.info('Fondo Eliminado', `Se eliminó "${s.name}".`);
                      }}
                      className="p-1 text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                      title="Eliminar fondo personalizado"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Previsualizador de Escena */}
        <div className="col-span-5 border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-xs font-mono uppercase text-zinc-400">Muestra de Entorno</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-none">
              {inspectedScene.id === 'transparent' ? 'Escritorio Libre' : 'Render 2D/3D'}
            </span>
          </div>

          {/* Preview visual de la escena */}
          <div style={{ opacity: sceneOpacity / 100 }}>
            {inspectedScene.id === 'transparent' ? (
              <div className="aspect-[4/3] bg-zinc-950 border border-zinc-800 rounded-sm flex items-center justify-center text-center relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: 'repeating-conic-gradient(#52525b 0% 25%, transparent 0% 50%)', backgroundSize: '20px 20px' }}
                />
                <div className="relative z-10 text-center">
                  <Monitor size={28} className="text-zinc-300 mx-auto mb-2" />
                  <div className="text-xs font-mono font-semibold text-zinc-100">Fondo Transparente</div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5">Ventana flotante sobre escritorio</div>
                </div>
              </div>
            ) : inspectedScene.id === 'cyber_loft' ? (
              <div
                className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative"
                style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 40%, #1a0a2e 100%)' }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(100,0,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(100,0,255,0.08) 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                  }}
                />
                <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                  <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                  <div className="text-[10px] font-mono text-violet-400 mt-0.5">Cyber Loft / Neon Urbano</div>
                </div>
              </div>
            ) : inspectedScene.id === 'neon_grid' ? (
              <div
                className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative"
                style={{ background: 'linear-gradient(180deg, #0d0018 0%, #1a0033 40%, #300050 100%)' }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 h-1/2"
                  style={{
                    background: 'linear-gradient(0deg, rgba(255,0,255,0.15) 0%, transparent 100%)',
                    backgroundImage: 'linear-gradient(rgba(255,0,200,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,200,0.2) 1px, transparent 1px)',
                    backgroundSize: '25px 25px'
                  }}
                />
                <div
                  className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-8 rounded-full"
                  style={{ background: 'radial-gradient(ellipse, rgba(255,100,0,0.8), rgba(255,50,0,0.4), transparent)' }}
                />
                <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                  <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                  <div className="text-[10px] font-mono text-pink-400 mt-0.5">Synthwave / Retro Grid</div>
                </div>
              </div>
            ) : inspectedScene.id === 'deep_nebula' ? (
              <div
                className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative"
                style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(60,0,120,0.9) 0%, rgba(0,0,30,1) 70%)' }}
              >
                <div
                  className="absolute inset-0 opacity-50"
                  style={{ background: 'radial-gradient(circle at 70% 60%, rgba(0,80,160,0.5), transparent 60%)' }}
                />
                <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                  <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                  <div className="text-[10px] font-mono text-indigo-400 mt-0.5">Nebulosa Cósmica / Deep Space</div>
                </div>
              </div>
            ) : inspectedScene.id === 'zen_temple' ? (
              <div
                className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative"
                style={{ background: 'linear-gradient(180deg, #1a0a1a 0%, #2d1b2d 50%, #1a1a2e 100%)' }}
              >
                <div
                  className="absolute top-3 right-4 w-8 h-8 rounded-full opacity-60"
                  style={{ background: 'radial-gradient(circle, rgba(255,220,180,0.8), rgba(255,180,80,0.3), transparent)' }}
                />
                <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                  <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                  <div className="text-[10px] font-mono text-pink-300 mt-0.5">Zen Cyberpunk / Sakura</div>
                </div>
              </div>
            ) : inspectedScene.id === 'matrix_rain' ? (
              <div className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative bg-black">
                <div className="absolute inset-0 flex flex-wrap content-start gap-px p-1 opacity-60">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <span
                      key={i}
                      className="text-green-400 font-mono text-[8px] leading-none"
                      style={{ opacity: ((i * 13) % 8 + 2) / 10 }}
                    >
                      {String.fromCharCode(0x30a0 + ((i * 7) % 96))}
                    </span>
                  ))}
                </div>
                <div className="absolute bottom-2 left-3 right-3 bg-black/90 px-2 py-1.5 rounded-sm border border-green-900/50">
                  <div className="text-xs font-mono font-semibold text-green-400">{inspectedScene.name}</div>
                  <div className="text-[10px] font-mono text-green-600 mt-0.5">Digital Rain / Matrix</div>
                </div>
              </div>
            ) : inspectedScene.url || inspectedScene.mainPath ? (
              <div className="aspect-[4/3] bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden relative">
                {inspectedScene.type === 'video' ? (
                  <video
                    src={inspectedScene.url || inspectedScene.mainPath}
                    autoPlay
                    loop
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={inspectedScene.url || inspectedScene.mainPath}
                    alt={inspectedScene.name}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                  <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                  <div className="text-[10px] font-mono text-cyan-400 mt-0.5">Fondo Personalizado</div>
                </div>
              </div>
            ) : (
              <div className="aspect-[4/3] bg-zinc-950 border border-zinc-800 rounded-sm flex items-center justify-center text-center p-4">
                <div>
                  <ImageIcon size={32} className="text-zinc-500 mx-auto mb-2" />
                  <div className="text-xs font-mono font-semibold text-zinc-200">{inspectedScene.name}</div>
                  <div className="text-[11px] font-mono text-zinc-500 mt-0.5">{inspectedScene.description}</div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between text-zinc-400">
              <span>Identificador:</span>
              <span className="text-zinc-200 truncate ml-2">{inspectedScene.id}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Tipo de Render:</span>
              <span className="text-zinc-200">
                {inspectedScene.id === 'transparent'
                  ? 'Transparente'
                  : inspectedScene.id.startsWith('custom_')
                  ? 'Medio de Usuario'
                  : 'Procedural CSS/WebGL'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneTab;
