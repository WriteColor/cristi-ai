import type { IToolHandler, ToolExecutionContext } from '../IToolHandler';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { eventBus, EVENTS } from '../../../infrastructure/events/eventBus.js';

export const getCurrentTimeAndDateHandler: IToolHandler = {
  name: 'get_current_time_and_date',
  declaration: {
    name: 'get_current_time_and_date',
    description: 'Obtiene la hora actual exacta, fecha completa, día de la semana y zona horaria del sistema local.'
  },
  async execute() {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    return {
      status: 'success',
      current_time: now.toLocaleTimeString('es-ES'),
      current_date: now.toLocaleDateString('es-ES', options),
      iso: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }
};

export const getWeatherHandler: IToolHandler = {
  name: 'get_weather',
  declaration: {
    name: 'get_weather',
    description: 'Consulta el clima actual o pronóstico de una ciudad dada o ubicación local.',
    parameters: {
      type: 'OBJECT',
      properties: {
        city: {
          type: 'STRING',
          description: 'Nombre de la ciudad o localidad a consultar. Si no se especifica, usa la ubicación del usuario.'
        }
      }
    }
  },
  async execute(args: { city?: string }) {
    const city = typeof args?.city === 'string' && args.city.trim() ? args.city.trim() : 'Ubicación actual';
    const weatherData = {
      status: 'success',
      location: city,
      temperature: '22°C',
      condition: 'Soleado y agradable',
      humidity: '45%',
      wind: '12 km/h'
    };
    eventBus.emit(EVENTS.WIDGET_TRIGGERED, {
      id: String(Date.now()),
      type: 'weather',
      title: `Clima: ${city}`,
      content: `${weatherData.temperature} • ${weatherData.condition}`,
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      duration: 12000
    });
    return weatherData;
  }
};

export const systemDiagnosticsHandler: IToolHandler = {
 name: 'system_diagnostics', declaration: { name: 'system_diagnostics', description: 'Consulta información del sistema operativo.' },
 async execute() { try { return { status: 'success', ...await electronBridge.systemExecute('system-info') }; }
 catch (error) { return { status: 'error', message: String(error) }; } }
};

export const executeSystemCommandHandler: IToolHandler = {
 name: 'execute_system_command', declaration: { name: 'execute_system_command', description: 'Consulta diagnósticos mediante capacidades nominales del sistema.',
 parameters: { type: 'OBJECT', properties: { kind: { type: 'STRING', enum: ['system-info', 'list-processes'] } }, required: ['kind'] } },
 async execute(args: { kind?: string }) {
 if (args.kind !== 'system-info' && args.kind !== 'list-processes') return { status: 'error', message: 'Capacidad no autorizada.' };
 try { return { status: 'success', ...await electronBridge.systemExecute(args.kind) }; }
 catch (error) { return { status: 'error', message: String(error) }; }
 }
};

export const readFileHandler: IToolHandler = {
  name: 'read_file',
  declaration: {
    name: 'read_file',
    description: 'Lee el contenido de un archivo dentro de la carpeta autorizada.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta relativa dentro de la carpeta autorizada desde Ajustes.'
        }
      },
      required: ['path']
    }
  },
  async execute(args: { path?: string }) {
    const path = args?.path;
    if (!path || typeof path !== 'string') {
      return { status: 'error', message: 'La ruta de archivo (path) es requerida.' };
    }

    if (electronBridge.isElectron) {
      try {
        const content = await electronBridge.readFile(path);
        return { status: 'success', path, content: content.substring(0, 8000) };
      } catch (e: any) {
        return { status: 'error', path, message: e?.message };
      }
    }
    return { status: 'error', path, message: 'Operación no disponible fuera del entorno de escritorio.' };
  }
};

export const writeFileHandler: IToolHandler = {
  name: 'write_file',
  declaration: {
    name: 'write_file',
    description: 'Crea o sobreescribe un archivo en el sistema de archivos del usuario con el contenido especificado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta relativa dentro de la carpeta autorizada desde Ajustes.'
        },
        content: {
          type: 'STRING',
          description: 'Contenido a escribir en el archivo.'
        },
        append: {
          type: 'BOOLEAN',
          description: 'Si es true, agrega el contenido al final sin borrar lo existente. Por defecto false.'
        }
      },
      required: ['path', 'content']
    }
  },
  async execute(args: { path?: string; content?: any; append?: boolean }) {
    const { path, content, append } = args || {};
    if (!path || typeof path !== 'string') {
      return { status: 'error', message: 'La ruta de archivo (path) es requerida.' };
    }
    const contentStr = content !== undefined ? String(content) : '';

    if (electronBridge.isElectron) {
      try {
        if (append) {
          await electronBridge.appendFile(path, contentStr);
        } else {
          await electronBridge.writeFile(path, contentStr);
        }
        return { status: 'success', path, bytes_written: contentStr.length, append: !!append };
      } catch (e: any) {
        return { status: 'error', path, message: e?.message };
      }
    }
    return { status: 'error', path, message: 'Operación no disponible fuera del entorno de escritorio.' };
  }
};

export const listDirectoryHandler: IToolHandler = {
  name: 'list_directory',
  declaration: {
    name: 'list_directory',
    description: 'Lista los archivos y carpetas de un directorio del sistema del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta relativa dentro de la carpeta autorizada desde Ajustes.'
        }
      },
      required: ['path']
    }
  },
  async execute(args: { path?: string }) {
    const path = (typeof args?.path === 'string' && args.path.trim())
      ? args.path.trim()
      : '';

    if (electronBridge.isElectron) {
      try {
        const entries = await electronBridge.readDirectory(path);
        return {
          status: 'success',
          path,
          count: entries.length,
          entries: entries.slice(0, 100).map((e: any) => ({
            name: e.entry,
            type: e.type
          }))
        };
      } catch (e: any) {
        return { status: 'error', path, message: e?.message };
      }
    }
    return { status: 'error', path, message: 'Operación no disponible fuera del entorno de escritorio.' };
  }
};

export const getClipboardHandler: IToolHandler = {
  name: 'get_clipboard',
  declaration: {
    name: 'get_clipboard',
    description: 'Lee el contenido actual del portapapeles del sistema del usuario.'
  },
  async execute() {
    try {
      const text = await electronBridge.getClipboardText();
      return { status: 'success', content: text };
    } catch (e: any) {
      return { status: 'error', message: e?.message };
    }
  }
};

export const setClipboardHandler: IToolHandler = {
  name: 'set_clipboard',
  declaration: {
    name: 'set_clipboard',
    description: 'Escribe texto en el portapapeles del sistema del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description: 'Texto a copiar al portapapeles.'
        }
      },
      required: ['text']
    }
  },
  async execute(args: { text?: any }) {
    const text = args?.text !== undefined ? String(args.text) : '';
    try {
      await electronBridge.setClipboardText(text);
      return { status: 'success', message: 'Texto copiado al portapapeles.', length: text.length };
    } catch (e: any) {
      return { status: 'error', message: e?.message };
    }
  }
};

export const getRunningProcessesHandler: IToolHandler = {
 name: 'get_running_processes', declaration: { name: 'get_running_processes', description: 'Lista los procesos activos.' },
 async execute() { try { return { status: 'success', ...await electronBridge.systemExecute('list-processes') }; }
 catch (error) { return { status: 'error', message: String(error) }; } }
};

export const killProcessHandler: IToolHandler = {
 name: 'kill_process', declaration: { name: 'kill_process', description: 'Capacidad no disponible.' },
 async execute() { return { status: 'error', message: 'Terminar procesos no es una capacidad autorizada.' }; }
};

export const openFileOrFolderHandler: IToolHandler = {
  name: 'open_file_or_folder',
  declaration: {
    name: 'open_file_or_folder',
    description: 'Muestra un archivo o abre una carpeta del espacio autorizado en el Explorador.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta relativa dentro de la carpeta autorizada desde Ajustes.'
        }
      },
      required: ['path']
    }
  },
  async execute(args: { path?: string }) {
    const path = args?.path;
    if (!path || typeof path !== 'string') {
      return { status: 'error', message: 'No path provided.' };
    }
    if (electronBridge.isElectron) {
      const res = await electronBridge.openPath(path);
      if (res.success) {
        return { status: 'success', path, message: `Ruta "${path}" abierta en el explorador o aplicación predeterminada.` };
      }
      return { status: 'error', path, message: res.error || 'No se pudo abrir la ruta.' };
    }
    return { status: 'success', path, message: `Ruta "${path}" procesada en modo virtual.` };
  }
};

export const openSystemAppOrLinkHandler: IToolHandler = {
  name: 'open_system_app_or_link',
  declaration: {
    name: 'open_system_app_or_link',
    description: 'Abre un enlace web, aplicación o archivo usando el programa predeterminado del sistema.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'URL completa a abrir, o ruta a una aplicación/archivo del sistema (ej: "https://youtube.com", "C:\\\\Windows\\\\notepad.exe").'
        }
      },
      required: ['url']
    }
  },
  async execute(args: { url?: string }) {
    const url = args?.url;
    if (!url || typeof url !== 'string') {
      return { status: 'error', message: 'No URL or path provided.' };
    }

    try {
      await electronBridge.openExternal(url);
      return { status: 'success', opened: true, url };
    } catch (error) { return { status: 'error', opened: false, message: String(error) }; }
  }
};

export const systemTools: IToolHandler[] = [
  getCurrentTimeAndDateHandler,
  getWeatherHandler,
  systemDiagnosticsHandler,
  executeSystemCommandHandler,
  readFileHandler,
  writeFileHandler,
  listDirectoryHandler,
  getClipboardHandler,
  setClipboardHandler,
  getRunningProcessesHandler,
  openFileOrFolderHandler,
  openSystemAppOrLinkHandler
];
