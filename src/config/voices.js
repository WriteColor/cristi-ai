/**
 * Cristi AI - Official Voices Catalog for Gemini Multimodal Live API
 * 
 * Curated specifically for free & standard tiers:
 * - Aoede: Default Cristi voice (Sweet, coquettish, melodic)
 * - Kore: Confident & balanced
 * - Puck: Energetic & quick
 * - Charon: Calm & analytical
 * - Fenrir: Deep & dynamic
 */

export const GEMINI_STANDARD_VOICES = [
  {
    name: 'Aoede',
    gender: 'Femenina',
    trait: 'Dulce, Coqueta & Envolvente',
    isRecommended: true,
    description: 'Tono ligero, natural, seductor y muy agradable. La voz oficial predilecta para la personalidad de Cristi.',
    badgeColor: 'purple'
  },
  {
    name: 'Kore',
    gender: 'Femenina',
    trait: 'Firme, Clara & Equilibrada',
    isRecommended: false,
    description: 'Voz articulada, profesional, segura y confiable con un timbre equilibrado.',
    badgeColor: 'emerald'
  },
  {
    name: 'Puck',
    gender: 'Masculina',
    trait: 'Animada, Jovial & Rápida',
    isRecommended: false,
    description: 'Tono juvenil, entusiasta y veloz, ideal para respuestas dinámicas.',
    badgeColor: 'amber'
  },
  {
    name: 'Charon',
    gender: 'Masculina',
    trait: 'Informativa, Sobria & Calma',
    isRecommended: false,
    description: 'Tono pausado, sereno, reflexivo y analítico con excelente gravedad.',
    badgeColor: 'sky'
  },
  {
    name: 'Fenrir',
    gender: 'Masculina',
    trait: 'Enérgica, Directa & Fuerte',
    isRecommended: false,
    description: 'Voz con alta energía, ímpetu y proyección firme.',
    badgeColor: 'rose'
  }
];

export function getVoicesForModel(_modelId) {
  // Returns standard guaranteed voices for all live models
  return GEMINI_STANDARD_VOICES;
}

export function sanitizeVoiceForModel(_modelId, requestedVoice) {
  const exists = GEMINI_STANDARD_VOICES.some(
    (v) => v.name.toLowerCase() === (requestedVoice || '').toLowerCase()
  );
  return exists ? requestedVoice : 'Aoede';
}
