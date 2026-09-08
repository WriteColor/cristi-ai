import type { IToolHandler } from '../IToolHandler';
import {
  desktopLoopbackService,
  desktopLoopbackService as desktopLoopbackCaptureService,
  translationService,
  virtualAudioOutputService
} from '@/domain/audio';


export const startDesktopAudioCaptureHandler: IToolHandler = {
  name: 'start_desktop_audio_capture',
  declaration: {
    name: 'start_desktop_audio_capture',
    description: 'Inicia la captura etiquetada del audio de una pantalla o ventana compartida para análisis o traducción. Solicita el selector nativo de Chromium y no mezcla ese audio con el micrófono.',
    parameters: {
      type: 'OBJECT',
      properties: {
        source_id: {
          type: 'STRING',
          description: 'Etiqueta estable del origen, por ejemplo game_loopback, spotify o system_loopback.'
        },
        keep_video_track: {
          type: 'BOOLEAN',
          description: 'Conserva la pista de vídeo del selector cuando también se necesita visión.'
        },
        translate: {
          type: 'BOOLEAN',
          description: 'Activa el procesamiento de traducción por lotes para este origen de audio.'
        },
        target_language: {
          type: 'STRING',
          description: 'Idioma destino ISO (por ejemplo es, en, ja).'
        },
        aggregate_ms: {
          type: 'NUMBER',
          description: 'Duración aproximada del lote de audio, entre 200 y 1200 ms.'
        }
      }
    }
  },
  async execute(args: {
    source_id?: string;
    keep_video_track?: boolean;
    translate?: boolean;
    target_language?: string;
    aggregate_ms?: number;
  }) {
    const sourceId = typeof args?.source_id === 'string' && args.source_id.trim()
      ? args.source_id.trim()
      : 'system_loopback';

    if (args?.translate === true && !translationService.isEnabled()) {
      return {
        status: 'translation_disabled',
        sourceId,
        message: 'La traducción externa está desactivada en Ajustes; activa la opción antes de iniciar una fuente traducida.'
      };
    }

    if (args?.translate !== true) {
      translationService.detachSource(desktopLoopbackCaptureService);
    }

    const result = await desktopLoopbackCaptureService.start({
      sourceId,
      includeVideo: args?.keep_video_track === true
    });

    if (result?.success && args?.translate === true) {
      const attached = translationService.attachSource(desktopLoopbackCaptureService, {
        targetLanguage: typeof args?.target_language === 'string' ? args.target_language : 'es',
        aggregateMs: Number(args?.aggregate_ms) || 400,
        relevanceGate: true
      });
      return {
        ...result,
        sourceId,
        translation: { enabled: true, attached, outputRoute: 'local' }
      };
    }

    return { ...result, sourceId, translation: { enabled: false } };
  }
};

export const stopDesktopAudioCaptureHandler: IToolHandler = {
  name: 'stop_desktop_audio_capture',
  declaration: {
    name: 'stop_desktop_audio_capture',
    description: 'Detiene la captura de audio externo y libera inmediatamente sus pistas y AudioWorklet.'
  },
  async execute() {
    translationService.detachSource(desktopLoopbackCaptureService);
    desktopLoopbackCaptureService.stop();
    return { status: 'success', ...desktopLoopbackCaptureService.getStatus() };
  }
};

export const desktopAudioCaptureStatusHandler: IToolHandler = {
  name: 'desktop_audio_capture_status',
  declaration: {
    name: 'desktop_audio_capture_status',
    description: 'Devuelve el estado de la captura de audio de escritorio o bucle local.'
  },
  async execute() {
    return { status: 'success', ...desktopLoopbackCaptureService.getStatus() };
  }
};

export const sendGameVoiceTranslationHandler: IToolHandler = {
  name: 'send_game_voice_translation',
  declaration: {
    name: 'send_game_voice_translation',
    description: 'Envía una frase traducida por Cristi directamente hacia el canal de voz/micrófono virtual del juego.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description: 'Texto que Cristi debe traducir y pronunciar hacia el juego.'
        },
        target_language: {
          type: 'STRING',
          description: 'Idioma destino ISO (por defecto "en").'
        }
      },
      required: ['text']
    }
  },
  async execute(args: { text?: string; target_language?: string }) {
    const text = typeof args?.text === 'string' ? args.text.trim() : '';
    if (!text) {
      return { status: 'invalid_input', message: 'Indica el texto que Cristi debe traducir para el juego.' };
    }

    if (!translationService.isEnabled()) {
      return {
        status: 'translation_disabled',
        message: 'La traducción externa está desactivada en Ajustes.'
      };
    }

    const outputStatus = virtualAudioOutputService.getStatus();
    if (!outputStatus.configured) {
      return {
        status: 'game_output_not_configured',
        output: outputStatus,
        message: 'Selecciona una salida de cable virtual en Ajustes > Traducción de voz antes de enviar voz al juego.'
      };
    }

    const result: any = await (translationService as any).translateText({
      text,
      targetLanguage: typeof args?.target_language === 'string' ? args.target_language : 'en',
      outputRoute: 'game_voice',
      sourceId: 'user_game_voice'
    });

    if (!result?.success) return { status: 'translation_failed', ...result };

    return {
      status: 'success',
      translation: result.translation,
      sourceLanguage: result.sourceLanguage,
      outputRoute: 'game_voice',
      queuedForVirtualOutput: Boolean(result.audio?.data)
    };
  }
};

export const translateAndSpeakInGameHandler: IToolHandler = {
  name: 'translate_and_speak_in_game',
  declaration: {
    name: 'translate_and_speak_in_game',
    description: 'Traduce una frase que tú o el usuario deseen comunicar y sintetiza el audio directamente hacia el canal de voz/micrófono virtual del videojuego para que otros jugadores lo escuchen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: {
          type: 'STRING',
          description: 'El texto exacto que se desea traducir y pronunciar hacia el juego.'
        },
        target_language: {
          type: 'STRING',
          description: 'Código de idioma destino ISO (ej: "en" para inglés, "ja" para japonés, "pt" para portugués, "fr" para francés).'
        },
        output_route: {
          type: 'STRING',
          enum: ['game_voice', 'local'],
          description: 'Canal de salida: "game_voice" para emitir hacia el micrófono virtual del juego, "local" para altavoces locales.'
        }
      },
      required: ['message', 'target_language']
    }
  },
  async execute(args: { message?: string; target_language?: string; output_route?: string }) {
    const { message, target_language, output_route } = args || {};
    const textMsg = message || '';
    const result: any = await (translationService as any).translateText({
      text: textMsg,
      targetLanguage: target_language || 'en',
      sourceId: 'user_translation_command',
      outputRoute: output_route === 'local' ? 'local' : 'game_voice'
    });

    return {
      status: result?.success ? 'success' : (result?.disabled ? 'disabled' : 'error'),
      message: result?.success
        ? `Traducción sintetizada hacia ${output_route || 'game_voice'}: "${result.translation || textMsg}"`
        : (result?.error || 'No se pudo emitir la traducción hacia el juego.'),
      translation: result?.translation || null,
      target_language: target_language || 'en'
    };
  }
};

export const audioTools: IToolHandler[] = [
  startDesktopAudioCaptureHandler,
  stopDesktopAudioCaptureHandler,
  desktopAudioCaptureStatusHandler,
  sendGameVoiceTranslationHandler,
  translateAndSpeakInGameHandler
];
