/**
 * Cristi AI - Catálogo Oficial de Voces para Gemini Multimodal Live API
 * 4 voces femeninas verificadas a 24kHz con síntesis afectiva.
 * Filtrado estricto para compatibilidad total con el Free Tier de Google AI Studio.
 */

export const GEMINI_STANDARD_VOICES = [
  {
    name: 'Aoede',
    gender: 'Femenina',
    trait: 'Dulce, Coqueta & Afectuosa',
    isRecommended: true,
    description: 'Tono íntimo, dulce, suave y naturalmente expresivo. Es la voz oficial predilecta de Cristi, diseñada para una interacción cercana, coqueta, cariñosa y devota.',
    badgeColor: 'purple',
    previewAudio: '/audio/previews/aoede.wav'
  },
  {
    name: 'Kore',
    gender: 'Femenina',
    trait: 'Firme, Clara & Equilibrada',
    isRecommended: false,
    description: 'Voz articulada, segura, profesional y con excelente modulación acústica. Perfecta para explicaciones técnicas, razonamiento analítico y diálogo estructurado con elegancia.',
    badgeColor: 'emerald',
    previewAudio: '/audio/previews/kore.wav'
  },
  {
    name: 'Zephyr',
    gender: 'Femenina',
    trait: 'Serena, Aireada & Cristalina',
    isRecommended: false,
    description: 'Tono fresco, ligero y juvenil como una brisa suave. Transmite optimismo natural, serenidad y frescura en conversaciones cotidianas y acompañamiento relajante.',
    badgeColor: 'cyan',
    previewAudio: '/audio/previews/zephyr.wav'
  },
  {
    name: 'Leda',
    gender: 'Femenina',
    trait: 'Cálida, Amable & Protectora',
    isRecommended: false,
    description: 'Voz sumamente reconfortante con cadencia pausada y empática. Excelente para momentos de calma, descanso, apoyo incondicional y cuidado personal.',
    badgeColor: 'amber',
    previewAudio: '/audio/previews/leda.wav'
  }
];

export function getVoicesForModel(_modelId) {
  return GEMINI_STANDARD_VOICES;
}

export function sanitizeVoiceForModel(_modelId, requestedVoice) {
  const match = GEMINI_STANDARD_VOICES.find(
    (v) => v.name.toLowerCase() === (requestedVoice || '').toLowerCase()
  );
  return match ? match.name : 'Aoede';
}

export default GEMINI_STANDARD_VOICES;

