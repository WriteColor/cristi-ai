/**
 * Cristi AI - Contextual Emotion & Dynamic Live2D Behavior Orchestrator
 *
 * Analyzes conversational context, vocal sentiment, streaming AI responses,
 * and user interactions in real time to dynamically orchestrate facial expressions,
 * bodily gestures, parametric blend shapes, and motion groups across ANY Live2D model.
 */

import { eventBus, EVENTS } from '../eventBus.js';
import { live2dModelRegistry } from './Live2DModelRegistry.js';
import { logger } from '../logger.js';

export class ContextualEmotionOrchestrator {
  constructor() {
    this.activeModelId = 'yanderegirl';
    this.controller = null;
    this.adapter = null;

    this.currentEmotion = 'idle';
    this.isModelSpeaking = false;
    this.isUserSpeaking = false;
    this.decayTimer = null;
    this.manualOverrideActive = false;
    this.manualOverrideTimeout = null;

    // Pattern for inline emotion/gesture markers in LLM text (e.g. [emotion: happy], [gesto: blush], (emocion: yandere))
    this.tagPattern = /\[(?:emotion|gesto|emocion|pose|mood|expression)\s*:\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)\]|\((?:emotion|gesto|emocion|pose|mood|expression)\s*:\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)\)/gi;

    // Sentiment rules: weighted keyword patterns for real-time natural language sentiment extraction
    this.sentimentRules = [
      {
        emotion: 'love',
        weight: 1.0,
        patterns: [
          /\b(te amo|mi amor|te adoro|te quiero|mi cielo|mi vida|mi rey|mi tesoro|mi dueñ[oa]|mi persona favorita|enamorado?|enamorada|bésame|un beso|muac|lindura|corazón|corazon|sweetheart|love you)\b/i,
          /\b(eres lo mejor|eres perfecto|me vuelves loc[oa] de amor|te pertenezco|siempre a tu lado)\b/i
        ]
      },
      {
        emotion: 'yandere',
        weight: 0.95,
        patterns: [
          /\b(solo mí[oa]|solo mi[oa]|no mires a nadie|no me dejes|no hables con|te vigilo|eres de mi propiedad|nadie te tocará|obsesi[oó]n|obsesionad[oa]|celos[oa]|mátame|matame|moriría|moriria|nunca escaparás|nunca escaparas|sangre|para siempre juntos)\b/i,
          /\b(¿quién es esa\?|¿con quién hablas\?|¿me estás ignorando\?)\b/i
        ]
      },
      {
        emotion: 'crazy',
        weight: 0.9,
        patterns: [
          /\b(jaja[a-z]*|jeje[a-z]*|loc[oa] por ti|demente|manicomio|perder la cabeza|psic[oó]pata|desquiciad[oa]|locura|crazy)\b/i
        ]
      },
      {
        emotion: 'blush',
        weight: 0.85,
        patterns: [
          /\b(vergüenza|verguenza|qué vergüenza|que verguenza|sonrojo|sonrojad[oa]|tontit[oa]|baka|qué cosas dices|que cosas dices|me halagas|no digas eso|me da pena|qué lindo eres|que lindo eres|penita|bob[oa]|shy|blush|flustered)\b/i
        ]
      },
      {
        emotion: 'surprised',
        weight: 0.85,
        patterns: [
          /\b(no puede ser|en serio|de verdad|¡?¿?qué!?!?|¡?¿?que!?!?|guau|wow|increíble|increible|asombroso|asombrada|no me lo creo|dios mío|dios mio|¡oh!|impactante|shock|surprised)\b/i,
          /[¡!¿?]{2,}/
        ]
      },
      {
        emotion: 'wink',
        weight: 0.8,
        patterns: [
          /\b(guiño|guino|secreto|tú y yo|tu y yo|confía en mí|confia en mi|picarona|coqueta|sabes que sí|sabes que si|wink)\b/i
        ]
      },
      {
        emotion: 'angry',
        weight: 0.85,
        patterns: [
          /\b(me molesta|enojad[oa]|estoy furios[oa]|indignad[oa]|cállate|callate|no me ignores|odio que|qué fastidio|que fastidio|tonto|pesado|déjame en paz|dejame en paz|mad|angry|pout)\b/i
        ]
      },
      {
        emotion: 'sad',
        weight: 0.85,
        patterns: [
          /\b(lo siento|qué triste|que triste|qué pena|que pena|perdóname|perdoname|me duele|llorar|lágrimas|lagrimas|pobrecit[oa]|me da tristeza|qué lástima|que lastima|sad|crying|sorry)\b/i
        ]
      },
      {
        emotion: 'thinking',
        weight: 0.75,
        patterns: [
          /\b(déjame (?:ver|revisar|buscar|analizar|checar)|dejame (?:ver|revisar|buscar|analizar|checar)|pensando|analizando|investigando|revisar|revisando|consultando|mmh+|veamos|interesante|curioso|buscando|examinando|thinking)\b/i
        ]
      },
      {
        emotion: 'gamer',
        weight: 0.8,
        patterns: [
          /\b(juego|videojuego|minecraft|partida|vamos a jugar|consola|gamer|mando|boss|nivel|victoria|derrota|ganar|ganamos|gané|gane)\b/i
        ]
      },
      {
        emotion: 'smug',
        weight: 0.75,
        patterns: [
          /\b(te lo dije|obviamente|sabía que|sabia que|era de esperarse|soy la mejor|insuperable|fácil|facil|pan comido|smug)\b/i
        ]
      },
      {
        emotion: 'happy',
        weight: 0.7,
        patterns: [
          /\b(feliz|content[oa]|alegre|sonrisa|sonrío|sonrio|gracias|qué bien|que bien|excelente|maravilloso|divertido|genial|fantástico|fantastico|me encanta|happy|smile|joy)\b/i
        ]
      },
      {
        emotion: 'relaxed',
        weight: 0.65,
        patterns: [
          /\b(buenas noches|descansa|hasta mañana|hasta manana|qué paz|que paz|relajante|tranquilidad|a dormir|dulces sueños|dulces suenos|calma)\b/i
        ]
      }
    ];

    this.bindEvents();
  }

  bindEvents() {
    eventBus.on(EVENTS.MODEL_LOADED, ({ modelId }) => {
      this.setModel(modelId);
    });

    eventBus.on(EVENTS.SPEECH_START, () => {
      this.isModelSpeaking = true;
      if (this.decayTimer) {
        clearTimeout(this.decayTimer);
        this.decayTimer = null;
      }
    });

    eventBus.on(EVENTS.SPEECH_END, () => {
      this.isModelSpeaking = false;
      this.scheduleEmotionDecay(5500);
    });

    eventBus.on(EVENTS.USER_SPEAKING, () => {
      this.isUserSpeaking = true;
      // When user speaks, subtly tilt head and raise brows attentively
      if (this.adapter && !this.manualOverrideActive) {
        this.adapter.setEyebrows(0.2, 0.2, 0.1, 0.1, 0.2, 0.2);
      }
    });

    eventBus.on(EVENTS.USER_STOPPED_SPEAKING, () => {
      this.isUserSpeaking = false;
    });

    eventBus.on(EVENTS.TOOL_EXECUTION_START, (toolName) => {
      if (toolName.includes('system') || toolName.includes('process') || toolName.includes('file') || toolName.includes('command')) {
        this.triggerEmotion('thinking', 'tool');
      } else if (toolName.includes('game')) {
        this.triggerEmotion('gamer', 'tool');
      }
    });
  }

  setContextReferences(controller, adapter, modelId) {
    this.controller = controller;
    this.adapter = adapter;
    if (modelId) this.activeModelId = modelId;
  }

  setModel(modelId) {
    this.activeModelId = modelId;
    this.currentEmotion = 'idle';
    if (this.decayTimer) {
      clearTimeout(this.decayTimer);
      this.decayTimer = null;
    }
  }

  /**
   * Process raw streaming model text from Gemini Live.
   * Extracts inline emotion tags, analyzes contextual sentiment, triggers appropriate Live2D dynamics,
   * and returns the cleaned text without emotion tags for subtitle display.
   * @param {string} rawText 
   * @returns {string} Cleaned text
   */
  processModelText(rawText) {
    if (!rawText) return '';

    let text = rawText;
    let explicitEmotion = null;

    // 1. Extract explicit inline tags like [emotion: happy], [gesto: blush], (emotion: yandere)
    const matches = Array.from(text.matchAll(this.tagPattern));
    if (matches.length > 0) {
      for (const match of matches) {
        explicitEmotion = (match[1] || match[2] || '').toLowerCase().trim();
      }
      // Strip tags from subtitle text
      text = text.replace(this.tagPattern, '').trim();
    }

    // 2. Determine target emotion: explicit tag takes highest precedence, otherwise natural sentiment
    if (explicitEmotion) {
      this.triggerEmotion(explicitEmotion, 'ai_explicit_tag');
    } else {
      const detected = this.detectNaturalSentiment(text);
      if (detected && detected !== 'idle') {
        this.triggerEmotion(detected, 'ai_sentiment');
      }
    }

    return text;
  }

  /**
   * Process incoming user speech transcript to prepare empathetic anticipatory expressions
   * @param {string} userText 
   */
  processUserText(userText) {
    if (!userText || !userText.trim()) return;
    const text = userText.trim().toLowerCase();

    // If user compliments or flirts with Cristi, trigger a subtle blush/smile
    if (/\b(te amo|te quiero|hermosa|linda|guapa|preciosa|mi amor|bonita|lindo|te ves bien)\b/i.test(text)) {
      this.triggerEmotion('blush', 'user_flirt');
    } else if (/\b(hola|buenos días|buenas tardes|buenas noches|cómo estás|hey|cristi)\b/i.test(text)) {
      this.triggerEmotion('happy', 'user_greeting');
    } else if (/\b(otra chica|amiga|novia|conocí a alguien|otra persona)\b/i.test(text)) {
      this.triggerEmotion('yandere', 'user_jealousy_trigger');
    }
  }

  /**
   * Analyze natural language text and score sentiment against rules
   * @param {string} text 
   * @returns {string} Emotion identifier
   */
  detectNaturalSentiment(text) {
    if (!text || text.length < 2) return 'idle';

    let bestEmotion = 'idle';
    let maxScore = 0;

    for (const rule of this.sentimentRules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          const score = rule.weight;
          if (score > maxScore) {
            maxScore = score;
            bestEmotion = rule.emotion;
          }
        }
      }
    }

    return bestEmotion;
  }

  /**
   * Dynamically trigger an emotion across the active Live2D model,
   * combining expressions, motion groups, and parametric adjustments.
   * @param {string} emotionName 
   * @param {string} source - e.g. 'ai_explicit_tag', 'ai_sentiment', 'manual', 'tool'
   */
  triggerEmotion(emotionName, source = 'system') {
    const emotion = (emotionName || 'idle').toLowerCase().trim();
    this.currentEmotion = emotion;

    logger.info('AVATAR', `[Contextual Emotion] Disparando "${emotion}" (Fuente: ${source}, Modelo: ${this.activeModelId})`);

    // 1. Dispatch through Live2DController (which handles expression lock & parameter targets)
    if (this.controller && typeof this.controller.setEmotion === 'function') {
      this.controller.setEmotion(emotion);
    }

    // 2. Dispatch contextual motion if supported and appropriate
    this.triggerContextualMotion(emotion);

    // 3. Emit global event
    eventBus.emit(EVENTS.EMOTION_CHANGED, emotion);

    // 4. Schedule decay if model is not currently speaking
    if (!this.isModelSpeaking && emotion !== 'idle') {
      this.scheduleEmotionDecay(source === 'manual' ? 7000 : 5000);
    }
  }

  /**
   * Intelligently trigger an associated Live2D motion group when contextually fitting
   * @param {string} emotion 
   */
  triggerContextualMotion(emotion) {
    if (!this.adapter || typeof this.adapter.setMotionByGroup !== 'function') return;

    const model = live2dModelRegistry.getModel(this.activeModelId);
    if (!model) return;

    const motionGroups = model.capabilities?.motionGroups || {};
    const motions = model.capabilities?.motions || [];

    // IceGirl special motion associations
    if (this.activeModelId === 'icegirl') {
      if (emotion === 'love' || emotion === 'happy' || emotion === 'wink') {
        this.adapter.setMotionByGroup('MeiYan', 0);
      } else if (emotion === 'surprised' || emotion === 'yandere') {
        this.adapter.setMotionByGroup('HuiShou', 0);
      }
    }
    // Hiyori Momose motion associations
    else if (this.activeModelId === 'hiyori') {
      if (emotion === 'happy' || emotion === 'love') {
        this.adapter.setMotionByGroup('Tap', 0); // Tap head happy
      } else if (emotion === 'surprised' || emotion === 'wink') {
        this.adapter.setMotionByGroup('Flick', 0); // Body turn
      } else if (emotion === 'blush') {
        this.adapter.setMotionByGroup('Tap@Body', 0);
      }
    }
    // Miara elf motion associations
    else if (this.activeModelId === 'miara') {
      if (emotion === 'happy' || emotion === 'surprised') {
        this.adapter.setMotionByGroup('Tap', 0); // Scene2
      } else if (emotion === 'wink' || emotion === 'smug') {
        this.adapter.setMotionByGroup('Flic', 0); // Scene3
      }
    }
  }

  /**
   * Schedule smooth transition back to idle baseline after emotional dwell time
   * @param {number} delayMs 
   */
  scheduleEmotionDecay(delayMs = 5000) {
    if (this.decayTimer) clearTimeout(this.decayTimer);

    this.decayTimer = setTimeout(() => {
      if (!this.isModelSpeaking) {
        if (this.controller) {
          this.controller.setEmotion('idle');
        }
        this.currentEmotion = 'idle';
        eventBus.emit(EVENTS.EMOTION_CHANGED, 'idle');
      }
    }, delayMs);
  }

  destroy() {
    if (this.decayTimer) clearTimeout(this.decayTimer);
    if (this.manualOverrideTimeout) clearTimeout(this.manualOverrideTimeout);
  }
}

// Global Singleton Instance
export const contextualEmotionOrchestrator = new ContextualEmotionOrchestrator();
