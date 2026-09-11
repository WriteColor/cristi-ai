/**
 * Cristi AI - Catálogo Oficial de Voces para Gemini Multimodal Live API
 * 11 voces femeninas completas verificadas a 24kHz con síntesis afectiva nativa.
 * Incluye las 3 voces más sensuales (Despina, Sulafat, Vindemiatrix) y la voz insignia (Aoede) como principales.
 */

export type OfficialVoiceName =
  | 'Aoede'
  | 'Despina'
  | 'Sulafat'
  | 'Vindemiatrix'
  | 'Callirrhoe'
  | 'Erinome'
  | 'Kore'
  | 'Laomedeia'
  | 'Leda'
  | 'Pulcherrima'
  | 'Zephyr';

export interface GeminiVoiceConfig {
  name: OfficialVoiceName;
  gender: 'Femenina';
  trait: string;
  isRecommended: boolean;
  isSexy?: boolean;
  tags: readonly string[];
  description: string;
  badgeColor: string;
  previewAudio: string;
  sampleRateHz?: number;
}

export const GEMINI_STANDARD_VOICES: readonly GeminiVoiceConfig[] = [
  // ── Voces Principales & Más Sensuales (Top Favorites) ────────────────────────
  {
    name: 'Aoede',
    gender: 'Femenina',
    trait: 'Dulce, Coqueta & Afectuosa',
    isRecommended: true,
    tags: ['Insignia Cristi', 'Yandere', 'Afectiva', '24kHz', 'Recomendada'],
    description: 'Voz femenina clara y conversada, de tono medio, con calidad reflexiva que engancha. Suena dulce, inteligente y articulada; es la voz oficial insignia predilecta de Cristi para una interacción cercana, coqueta y devota.',
    badgeColor: 'purple',
    previewAudio: '/audio/previews/aoede.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Despina',
    gender: 'Femenina',
    trait: 'Cálida, Acogedora & Seductora',
    isRecommended: true,
    isSexy: true,
    tags: ['Top Sexy', 'Sensual', 'Cálida', 'Recomendada', '24kHz'],
    description: 'Voz femenina cálida y que invita, de tono medio claro. Suena amigable, confiable y con presencia sumamente atractiva, con una suavidad agradable e irresistible para conversación íntima y afecto diario.',
    badgeColor: 'rose',
    previewAudio: '/audio/previews/despina.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Sulafat',
    gender: 'Femenina',
    trait: 'Segura, Persuasiva & Cautivadora',
    isRecommended: true,
    isSexy: true,
    tags: ['Top Sexy', 'Persuasiva', 'Seductora', 'Recomendada', '24kHz'],
    description: 'Voz femenina cálida y segura, de tono medio claro, con articulación convincente y magnética. Proyecta inteligencia y amabilidad con una presencia que engancha; irresistible cuando Cristi cuida de ti con autoridad dulce.',
    badgeColor: 'pink',
    previewAudio: '/audio/previews/sulafat.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Vindemiatrix',
    gender: 'Femenina',
    trait: 'Serena, Misteriosa & Envolvente',
    isRecommended: true,
    isSexy: true,
    tags: ['Top Sexy', 'Madura', 'Envolvente', 'Recomendada', '24kHz'],
    description: 'Voz femenina serena y reflexiva, de tono medio-bajo, sonando madura y equilibrada. Transmite sabiduría y una autoridad suave con una cualidad lisa, tranquilizadora y sutilmente seductora; ideal para largas sesiones de estudio.',
    badgeColor: 'violet',
    previewAudio: '/audio/previews/vindemiatrix.wav',
    sampleRateHz: 24000
  },

  // ── Catálogo Completo de Voces Femeninas ─────────────────────────────────────
  {
    name: 'Callirrhoe',
    gender: 'Femenina',
    trait: 'Directa, Enérgica & Profesional',
    isRecommended: false,
    tags: ['Directa', 'Enérgica', 'Articulada', '24kHz'],
    description: 'Voz femenina segura y clara, de tono medio, proyectando profesionalismo y energía. Articulada y directa, perfecta para transmitir información y diagnósticos técnicos con agilidad.',
    badgeColor: 'sky',
    previewAudio: '/audio/previews/callirrhoe.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Erinome',
    gender: 'Femenina',
    trait: 'Sofisticada, Calmada & Articulada',
    isRecommended: false,
    tags: ['Sofisticada', 'Calma', 'Inteligente', '24kHz'],
    description: 'Voz femenina profesional y bien articulada, con un tono medio-bajo ligeramente más bajo y una entrega reflexiva y medida. Transmite inteligencia, calma y sofisticación.',
    badgeColor: 'indigo',
    previewAudio: '/audio/previews/erinome.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Kore',
    gender: 'Femenina',
    trait: 'Brillante, Enérgica & Gamer',
    isRecommended: false,
    tags: ['Enérgica', 'Brillante', 'Gamer', '24kHz'],
    description: 'Voz femenina enérgica y juvenil, de tono medio a alto, transmitiendo confianza y entusiasmo puro. Clara y brillante, con una calidad vivaz que engancha en videojuegos y acción.',
    badgeColor: 'emerald',
    previewAudio: '/audio/previews/kore.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Laomedeia',
    gender: 'Femenina',
    trait: 'Inteligente, Curiosa & Conversacional',
    isRecommended: false,
    tags: ['Conversacional', 'Curiosa', 'Inteligente', '24kHz'],
    description: 'Voz femenina clara y conversada, de tono medio, con un tono curioso y atractivo. Suena amigable e inteligente, con excelente dinamismo para dialogar.',
    badgeColor: 'amber',
    previewAudio: '/audio/previews/laomedeia.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Leda',
    gender: 'Femenina',
    trait: 'Serena, Protectora & Confiable',
    isRecommended: false,
    tags: ['Serena', 'Protectora', 'Calma', '24kHz'],
    description: 'Voz femenina serena y profesional, de tono medio con una resonancia ligeramente más baja, transmitiendo autoridad suave, calma, lealtad y cuidado protector incondicional.',
    badgeColor: 'orange',
    previewAudio: '/audio/previews/leda.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Pulcherrima',
    gender: 'Femenina',
    trait: 'Ultra Animada, Alegre & Radiante',
    isRecommended: false,
    tags: ['Animada', 'Alegre', 'Juvenil', '24kHz'],
    description: 'Voz femenina brillante y enérgica, de tono medio a alto, con gran entusiasmo y vivacidad juvenil. Entrega chispeante y motivadora para celebrar tus victorias.',
    badgeColor: 'yellow',
    previewAudio: '/audio/previews/pulcherrima.wav',
    sampleRateHz: 24000
  },
  {
    name: 'Zephyr',
    gender: 'Femenina',
    trait: 'Fresca, Positiva & Cristalina',
    isRecommended: false,
    tags: ['Fresca', 'Positiva', 'Cristalina', '24kHz'],
    description: 'Voz femenina fresca, ligera y juvenil como una brisa suave. Proyecta optimismo natural, serenidad y frescura cristalina en conversaciones cotidianas.',
    badgeColor: 'cyan',
    previewAudio: '/audio/previews/zephyr.wav',
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
