import type { IToolHandler, ToolExecutionContext } from '../IToolHandler';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';

export const captureScreenSnapshotHandler: IToolHandler = {
  name: 'capture_screen_snapshot',
  declaration: {
    name: 'capture_screen_snapshot',
    description: 'Captura un fotograma de la pantalla del usuario en este momento y te lo envía para que puedas ver qué está haciendo o qué hay en la pantalla. Puedes especificar qué región ver.',
    parameters: {
      type: 'OBJECT',
      properties: {
        region: {
          type: 'STRING',
          enum: ['full', 'active_region', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'],
          description: 'Qué parte de la pantalla capturar. "full" para toda la pantalla, "active_region" para el área de visión configurada.'
        }
      }
    }
  },
  async execute(args: { region?: string }, context?: ToolExecutionContext) {
    if (context?.signal?.aborted) return { status: 'cancelled', message: 'Captura de pantalla cancelada por señal de aborto.', cancelled: true };
    const region = typeof args?.region === 'string' ? args.region : 'full';
    let frameData: string | null = null;

    if (electronBridge.isElectron) {
      frameData = await electronBridge.captureScreenNative(region as any);
    }

    if (context?.signal?.aborted) return { status: 'cancelled', message: 'Captura de pantalla cancelada tras extracción.', cancelled: true };

    if (!frameData && context?.getScreenCapture) {
      frameData = await context.getScreenCapture(region === 'full' ? 'full' : 'active_region');
    } else if (!frameData && context?.takeScreenshot) {
      frameData = await context.takeScreenshot(region === 'full' ? 'full' : 'active_region');
    }

    if (context?.signal?.aborted) return { status: 'cancelled', message: 'Captura de pantalla cancelada tras procesamiento.', cancelled: true };

    if (!frameData) {
      return {
        status: 'unavailable',
        message: 'La captura de pantalla no está disponible en este momento.'
      };
    }

    return {
      status: 'captured',
      region,
      message: 'Frame de pantalla capturado en tiempo real. Analízalo para responder al usuario.',
      frame_data: frameData
    };
  }
};

export const setScreenWatchHandler: IToolHandler = {
  name: 'set_screen_watch',
  declaration: {
    name: 'set_screen_watch',
    description: 'Activa o desactiva la vigilancia continua de la pantalla del usuario. Cuando está activa, recibirás frames periódicos de la pantalla automáticamente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        enabled: {
          type: 'BOOLEAN',
          description: 'true para activar la vigilancia continua, false para detenerla.'
        }
      },
      required: ['enabled']
    }
  },
  async execute(args: { enabled?: boolean }, context?: ToolExecutionContext) {
    if (context?.signal?.aborted) return { status: 'cancelled', message: 'Vigilancia de pantalla cancelada por señal de aborto.', cancelled: true };
    const enabled = args?.enabled !== false;
    if (context?.onScreenWatchChange) {
      context.onScreenWatchChange(enabled);
    } else if (context?.setScreenWatch) {
      context.setScreenWatch(enabled);
    }

    return {
      status: 'success',
      screen_watch: enabled,
      message: enabled ? 'Vigilancia de pantalla activada.' : 'Vigilancia de pantalla desactivada.'
    };
  }
};

export const setScreenRegionHandler: IToolHandler = {
  name: 'set_screen_region',
  declaration: {
    name: 'set_screen_region',
    description: 'Define programáticamente el área de visión de Cristi en pantalla (en porcentaje del tamaño de la ventana). El área se destacará con un borde visual violeta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x_pct: {
          type: 'NUMBER',
          description: 'Posición horizontal del borde izquierdo como porcentaje de la pantalla (0–100).'
        },
        y_pct: {
          type: 'NUMBER',
          description: 'Posición vertical del borde superior como porcentaje de la pantalla (0–100).'
        },
        w_pct: {
          type: 'NUMBER',
          description: 'Ancho del área como porcentaje de la pantalla (0–100).'
        },
        h_pct: {
          type: 'NUMBER',
          description: 'Alto del área como porcentaje de la pantalla (0–100).'
        }
      },
      required: ['x_pct', 'y_pct', 'w_pct', 'h_pct']
    }
  },
  async execute(args: { x_pct?: number | string; y_pct?: number | string; w_pct?: number | string; h_pct?: number | string }, context?: ToolExecutionContext) {
    if (context?.signal?.aborted) return { status: 'cancelled', message: 'Configuración de región cancelada por señal de aborto.', cancelled: true };
    const region = {
      x_pct: !isNaN(Number(args?.x_pct)) ? Number(args.x_pct) : 0,
      y_pct: !isNaN(Number(args?.y_pct)) ? Number(args.y_pct) : 0,
      w_pct: !isNaN(Number(args?.w_pct)) ? Number(args.w_pct) : 100,
      h_pct: !isNaN(Number(args?.h_pct)) ? Number(args.h_pct) : 100
    };

    context?.onScreenRegionChange?.(region);

    return {
      status: 'success',
      region,
      message: `Región de visión configurada: x=${region.x_pct}% y=${region.y_pct}% w=${region.w_pct}% h=${region.h_pct}%`
    };
  }
};

export const analyzeVisualSceneHandler: IToolHandler = {
  name: 'analyze_visual_scene',
  declaration: {
    name: 'analyze_visual_scene',
    description: 'Solicita un análisis de la cámara del usuario para inspeccionar qué está viendo, objetos, posturas o expresiones.',
    parameters: {
      type: 'OBJECT',
      properties: {
        focus_target: {
          type: 'STRING',
          description: 'Elemento específico a observar (ej: "expresión del usuario", "lo que sostiene", "entorno").'
        }
      }
    }
  },
  async execute(args: { focus_target?: string }, context?: ToolExecutionContext) {
    if (context?.signal?.aborted) return { status: 'cancelled', message: 'Análisis de escena visual cancelado por señal de aborto.', cancelled: true };
    const snapshot = context?.getCameraSnapshot?.();
    const detections = context?.getVisionDetections?.();

    if (!snapshot) {
      return {
        status: 'camera_unavailable',
        message: 'La cámara sensorial no está activa en este momento.'
      };
    }

    const facesSummary = detections?.faces?.map((f: any) => ({
      label: f.label || f.matchLabel || 'Desconocido',
      isOwner: !!f.isOwner,
      emotion: f.topEmotion || 'neutral',
      confidence: `${Math.round((f.confidence || (1 - (f.matchDistance || 0.3))) * 100)}%`
    })) || [];

    const objectsSummary = detections?.objects?.map((o: any) => ({
      object: o.class,
      score: `${Math.round(o.score * 100)}%`
    })) || [];

    return {
      status: 'scene_analyzed',
      scene_state: detections?.sceneState || 'UNKNOWN',
      summary: detections?.summary || 'Escaneo visual completado.',
      faces_detected_count: facesSummary.length,
      faces: facesSummary,
      objects_detected: objectsSummary,
      focus_target: args?.focus_target || 'general'
    };
  }
};

export const visionTools: IToolHandler[] = [
  captureScreenSnapshotHandler,
  setScreenWatchHandler,
  setScreenRegionHandler,
  analyzeVisualSceneHandler
];
