import type { IToolHandler } from '../IToolHandler';
import { eventBus, EVENTS } from '../../../infrastructure/events/eventBus.js';
import { proactiveScheduler } from '../../interaction/ProactiveScheduler.js';

export const setReminderHandler: IToolHandler = {
  name: 'set_reminder',
  declaration: {
    name: 'set_reminder',
    description: 'Crea y fija un recordatorio interactivo táctico en la pantalla para el usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Título o contenido del recordatorio.'
        },
        time: {
          type: 'STRING',
          description: 'Hora programada (ej: "14:30"). Si se omite, se usa la hora actual.'
        },
        tag: {
          type: 'STRING',
          description: 'Etiqueta de categoría (ej: "Trabajo", "Salud", "Cristi").'
        }
      },
      required: ['title']
    }
  },
  async execute(args: { title?: string; time?: string; tag?: string }) {
    const title = typeof args?.title === 'string' ? args.title : 'Recordatorio de Cristi';
    const time = typeof args?.time === 'string'
      ? args.time
      : new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const tag = typeof args?.tag === 'string' ? args.tag : 'Cristi';
    const id = `reminder_${Date.now()}`;

    const widgetData = {
      id,
      type: 'reminder',
      title,
      time,
      tag,
      done: false,
      created_at: Date.now()
    };

    proactiveScheduler.scheduleReminder({ id, time, title, tag });
    eventBus.emit(EVENTS.WIDGET_TRIGGERED, widgetData);

    return {
      status: 'success',
      message: `Recordatorio "${title}" programado para las ${time}. Cristi estará atenta para avisarte cuando se acerque.`,
      widget: widgetData
    };
  }
};

export const setAlarmHandler: IToolHandler = {
  name: 'set_alarm',
  declaration: {
    name: 'set_alarm',
    description: 'Programa una alarma o alerta temporizada visual y sonora en el escritorio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        time: {
          type: 'STRING',
          description: 'Hora de la alarma en formato HH:mm (ej: "08:30").'
        },
        label: {
          type: 'STRING',
          description: 'Etiqueta o razón de la alarma.'
        }
      },
      required: ['time']
    }
  },
  async execute(args: { time?: string; label?: string }) {
    const time = typeof args?.time === 'string' ? args.time : '10:00';
    const label = typeof args?.label === 'string' ? args.label : 'Alarma';
    const id = `alarm_${Date.now()}`;

    const widgetData = {
      id,
      type: 'alarm',
      title: `Alarma: ${label}`,
      time,
      tag: 'Alarma',
      done: false
    };

    proactiveScheduler.scheduleAlarm({ id, time, label });
    eventBus.emit(EVENTS.WIDGET_TRIGGERED, widgetData);

    return {
      status: 'success',
      message: `Alarma "${label}" programada para las ${time}. Cristi estará al tanto y te avisará cuando falte poco tiempo y cuando suene.`,
      widget: widgetData
    };
  }
};

export const showTacticalWidgetHandler: IToolHandler = {
  name: 'show_tactical_widget',
  declaration: {
    name: 'show_tactical_widget',
    description: 'Muestra una tarjeta táctica HUD flotante en pantalla con información, datos o alertas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
          enum: ['info', 'warning', 'reminder', 'status', 'weather'],
          description: 'Tipo de widget táctico.'
        },
        title: {
          type: 'STRING',
          description: 'Título principal del widget.'
        },
        content: {
          type: 'STRING',
          description: 'Contenido o texto detallado.'
        },
        duration: {
          type: 'INTEGER',
          description: 'Duración en pantalla en milisegundos (por defecto 10000).'
        }
      },
      required: ['title']
    }
  },
  async execute(args: { type?: string; title?: string; content?: string; duration?: number | string }) {
    const type = typeof args?.type === 'string' ? args.type : 'info';
    const title = typeof args?.title === 'string' ? args.title : 'Nota de Cristi';
    const content = typeof args?.content === 'string' ? args.content : '';
    const duration = !isNaN(Number(args?.duration)) ? Number(args.duration) : 10000;

    const widgetData = {
      id: String(Date.now()),
      type,
      title,
      content,
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      duration
    };

    eventBus.emit(EVENTS.WIDGET_TRIGGERED, widgetData);

    return {
      status: 'success',
      message: `Widget "${title}" mostrado en pantalla.`,
      widget: widgetData
    };
  }
};

export const dismissTacticalWidgetHandler: IToolHandler = {
  name: 'dismiss_tactical_widget',
  declaration: {
    name: 'dismiss_tactical_widget',
    description: 'Descarta u oculta un widget táctico específico mostrado en pantalla por su identificador.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Identificador del widget a descartar.'
        }
      },
      required: ['id']
    }
  },
  async execute(args: { id?: string | number }) {
    const id = args?.id ? String(args.id) : '';
    eventBus.emit(EVENTS.WIDGET_DISMISSED, { id });
    return {
      status: 'success',
      id,
      message: 'Widget descartado.'
    };
  }
};

export const widgetTools: IToolHandler[] = [
  setReminderHandler,
  setAlarmHandler,
  showTacticalWidgetHandler,
  dismissTacticalWidgetHandler
];
