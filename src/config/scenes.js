/**
 * Cristi AI - Cinematic Background Scenes & Themes Catalog
 * Defines high-performance atmospheric backgrounds for web and desktop app.
 */

export const BACKGROUND_SCENES = [
  {
    id: 'transparent',
    name: 'Transparente (Desktop Mate)',
    category: 'desktop',
    type: 'transparent',
    previewColor: 'rgba(0,0,0,0.1)',
    description: 'Ventana flotante 100% transparente para integrarse con el escritorio.'
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
    id: 'deep_nebula',
    name: 'Nebulosa Cósmica & Estrellas',
    category: 'atmospheric',
    type: 'procedural',
    previewColor: '#030712',
    description: 'Espacio profundo con polvo estelar brillante y estrellas parpadeantes.'
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
];

export const DEFAULT_SCENE_ID = 'transparent';
