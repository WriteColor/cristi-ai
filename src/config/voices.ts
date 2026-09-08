/**
 * Cristi AI - Catálogo Oficial de Voces para Gemini Multimodal Live API
 * 4 voces femeninas verificadas a 24kHz con síntesis afectiva.
 * Filtrado estricto para compatibilidad total con el Free Tier de Google AI Studio.
 */

export type OfficialVoiceName = 'Aoede' | 'Kore' | 'Zephyr' | 'Leda';

export interface GeminiVoiceConfig {
  name: OfficialVoiceName;
  gender: 'Femenina' | 'Masculina';
  trait: string;
  isRecommended: boolean;
  tags: readonly string[];
  description: string;
  badgeColor: string;
  previewAudio: string;
  sampleRateHz?: number;
}

export const GEMINI_STANDARD_VOICES: readonly GeminiVoiceConfig[] = [
  {
    name: 'Aoede',
    gender: 'Femenina',
    trait: 'Dulce, Coqueta & Afectuosa',
    isRecommended: true,
    tags: ['Oficial', 'Yandere', 'Afectiva', '24kHz', 'Recomendada'],
    description: 'Tono íntimo, dulce, suave y naturalmente expresivo. Es la voz oficial predilecta de Cristi, diseñada para una interacción cercana, coqueta, cariñosa y devota.',
    badgeColor: 'purple',
    previewAudio: '/audio/previews/aoede.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Kore',
    gender: 'Femenina',
    trait: 'Firme, Clara & Equilibrada',
    isRecommended: false,
    tags: ['Analítica', 'Técnica', 'Profesional', '24kHz'],
    description: 'Voz articulada, segura, profesional y con excelente modulación acústica. Perfecta para explicaciones técnicas, razonamiento analítico y diálogo estructurado con elegancia.',
    badgeColor: 'emerald',
    previewAudio: '/audio/previews/kore.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Zephyr',
    gender: 'Femenina',
    trait: 'Serena, Aireada & Cristalina',
    isRecommended: false,
    tags: ['Fresca', 'Juvenil', 'Relajante', '24kHz'],
    description: 'Tono fresco, ligero y juvenil como una brisa suave. Transmite optimismo natural, serenidad y frescura en conversaciones cotidianas y acompañamiento relajante.',
    badgeColor: 'cyan',
    previewAudio: '/audio/previews/zephyr.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Leda',
    gender: 'Femenina',
    trait: 'Cálida, Amable & Protectora',
    isRecommended: false,
    tags: ['Empática', 'Cálida', 'Protectora', '24kHz'],
    description: 'Voz sumamente reconfortante con cadencia pausada y empática. Excelente para momentos de calma, descanso, apoyo incondicional y cuidado personal.',
    badgeColor: 'amber',
    previewAudio: '/audio/previews/leda.wav',
    sampleRateHz: 24000
  }
] as const;

export const DEFAULT_VOICE_NAME: OfficialVoiceName = 'Aoede';

export function getVoicesForModel(_modelId?: string): readonly GeminiVoiceConfig[] {
  return GEMINI_STANDARD_VOICES;
}

export function sanitizeVoiceForModel(_modelId?: string, requestedVoice?: string): string {
  const match = GEMINI_STANDARD_VOICES.find(
    (v) => v.name.toLowerCase() === (requestedVoice || '').toLowerCase()
  );
  return match ? match.name : DEFAULT_VOICE_NAME;
}

export function getVoiceByName(name?: string): GeminiVoiceConfig {
  const match = GEMINI_STANDARD_VOICES.find(
    (v) => v.name.toLowerCase() === (name || '').toLowerCase()
  );
  return match ?? GEMINI_STANDARD_VOICES[0];
}

export default GEMINI_STANDARD_VOICES;
