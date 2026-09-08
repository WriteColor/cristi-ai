/**
 * Cristi AI - Cinematic Background Scenes & Themes Catalog
 * Defines high-performance atmospheric backgrounds for web and desktop app.
 */

export type SceneCategory = 'atmospheric' | 'cinematic' | 'animated' | 'nature' | 'digital' | 'custom';
export type SceneType = 'procedural' | 'canvas' | 'custom';

export interface BackgroundScene {
  id: string;
  name: string;
  category: SceneCategory;
  type: SceneType;
  previewColor: string;
  description: string;
  customUrl?: string;
}

export const BACKGROUND_SCENES: readonly BackgroundScene[] = [
  {
    id: 'deep_nebula',
    name: 'Nebulosa Cósmica & Estrellas',
    category: 'atmospheric',
    type: 'procedural',
    previewColor: '#030712',
    description: 'Espacio profundo con polvo estelar brillante y estrellas parpadeantes.'
  },
  {
    id: 'cyber_loft',
    name: 'Cyberpunk Loft Nocturno',
    category: 'cinematic',
    type: 'procedural',
    previewColor: '#0a0a1a',
    description: 'Ático futurista con rascacielos iluminados, neones y lluvia exterior.'
  },
  {
    id: 'neon_grid',
    name: 'Retrofuturistic Synthwave',
    category: 'animated',
    type: 'procedural',
    previewColor: '#120024',
    description: 'Cuadrícula en perspectiva 3D con horizonte de luz y partículas digitales.'
  },
  {
    id: 'zen_temple',
    name: 'Santuario Zen & Cerezos',
    category: 'nature',
    type: 'procedural',
    previewColor: '#1c0b19',
    description: 'Atardecer cálido con pétalos de sakura flotando suavemente con la brisa.'
  },
  {
    id: 'matrix_rain',
    name: 'Lluvia de Código Matrix',
    category: 'digital',
    type: 'canvas',
    previewColor: '#021208',
    description: 'Torrente de caracteres verdes y glifos cibernéticos en cascada.'
  },
  {
    id: 'custom_wallpaper',
    name: 'Fondo Personalizado (URL / Archivo)',
    category: 'custom',
    type: 'custom',
    previewColor: '#1e293b',
    description: 'Usa tu propia imagen o video cinemático en alta resolución.'
  }
] as const;

export const DEFAULT_SCENE_ID = 'deep_nebula' as const;

export function getSceneById(id: string): BackgroundScene | undefined {
  return BACKGROUND_SCENES.find((scene) => scene.id === id);
}

export default BACKGROUND_SCENES;
