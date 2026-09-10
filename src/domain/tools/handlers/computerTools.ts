import type { IToolHandler, ToolExecutionContext } from '../IToolHandler';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { logger } from '../../../infrastructure/logging/logger.js';

export const computerActionHandler: IToolHandler = {
  name: 'computer_action',
  declaration: {
    name: 'computer_action',
    description: 'Captura la pantalla mediante la capacidad de captura autorizada.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['take_screenshot'],
          description: 'La acción de interfaz a realizar.'
        },
        coordinate: {
          type: 'ARRAY',
          items: { type: 'INTEGER' },
          description: '[x, y] coordenadas en píxeles de la pantalla para mouse_click.'
        },
        text: {
          type: 'STRING',
          description: 'Texto a escribir si la acción es "type_text".'
        },
        key: {
          type: 'STRING',
          description: 'Tecla a presionar (ej: "Enter", "Tab", "Escape", "Control+s") si action es "press_key".'
        },
        scroll_amount: {
          type: 'INTEGER',
          description: 'Cantidad de scroll vertical (positivo hacia abajo, negativo hacia arriba).'
        }
      },
      required: ['action']
    }
  },
  async execute(
    args: {
      action?: string;
      coordinate?: [number, number] | number[];
      text?: string;
      key?: string;
      scroll_amount?: number;
    },
    context: ToolExecutionContext
  ) {
    const { action, coordinate, text, key, scroll_amount } = args || {};
    logger.info('COMPUTER-ACTION', `Ejecutando acción de uso de computadora: ${action}`, args);

    switch (action) {
      case 'take_screenshot': {
        let frameData: string | null = null;
        if (electronBridge.isElectron) {
          frameData = await electronBridge.captureScreenNative();
        }
        if (!frameData && context.getScreenCapture) {
          frameData = await context.getScreenCapture('full');
        } else if (!frameData && context.takeScreenshot) {
          frameData = await context.takeScreenshot('full');
        }
        return {
          status: frameData ? 'captured' : 'error',
          action: 'take_screenshot',
          message: frameData ? 'Captura de pantalla realizada.' : 'No se pudo capturar la pantalla.',
          has_frame: !!frameData,
          frame_data: frameData
        };
      }

      default:
        return {
          status: 'error',
          action,
          message: `Acción de computadora "${action}" no reconocida.`
        };
    }
  }
};

export const computerTools: IToolHandler[] = [
  computerActionHandler
];
