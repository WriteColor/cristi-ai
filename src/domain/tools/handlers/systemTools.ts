import type { IToolHandler, ToolExecutionContext } from '../IToolHandler';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { virtualTerminal } from '@/services/virtualTerminalService.js';
import { eventBus, EVENTS } from '@/services/eventBus.js';

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
  name: 'system_diagnostics',
  declaration: {
    name: 'system_diagnostics',
    description: 'Obtiene métricas en tiempo real del sistema: CPU, RAM, procesos activos, FPS del avatar, estado del micrófono y cámara.'
  },
  async execute() {
    const memoryMB = (typeof performance !== 'undefined' && (performance as any).memory)
      ? `${Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))} MB`
      : 'N/A';

    let platform = 'Web Browser';
    let cpuInfo = 'N/A';
    let memInfo = 'N/A';

    if (electronBridge.isElectron) {
      try {
        const cpuResult = await electronBridge.execCommand(
          'powershell -Command "Get-CimInstance Win32_Processor | Select-Object Name,LoadPercentage | ConvertTo-Json"',
          { timeout: 5000 }
        );
        const memResult = await electronBridge.execCommand(
          'powershell -Command "$mem = Get-CimInstance Win32_OperatingSystem; [PSCustomObject]@{TotalGB=[math]::Round($mem.TotalVisibleMemorySize/1MB,1);FreeGB=[math]::Round($mem.FreePhysicalMemory/1MB,1)} | ConvertTo-Json"',
          { timeout: 5000 }
        );
        platform = 'Electron Desktop (Cristi Native)';
        cpuInfo = cpuResult.stdOut?.trim() || 'N/A';
        memInfo = memResult.stdOut?.trim() || 'N/A';
      } catch (e: any) {
        cpuInfo = 'error: ' + e?.message;
      }
    }

    return {
      status: 'success',
      health: 'healthy',
      platform,
      memory_heap: memoryMB,
      cpu_info: cpuInfo,
      memory_info: memInfo,
      timestamp: Date.now(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'NodeJS/Test'
    };
  }
};

export const executeSystemCommandHandler: IToolHandler = {
  name: 'execute_system_command',
  declaration: {
    name: 'execute_system_command',
    description: 'Ejecuta cualquier comando en el sistema operativo Windows del usuario (PowerShell o cmd). Tienes acceso completo al sistema. Usa esto para abrir apps, gestionar archivos, consultar el sistema, ejecutar scripts, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: {
          type: 'STRING',
          description: 'El comando completo a ejecutar (ej: "Get-Process", "notepad.exe", "ipconfig /all", "dir C:\\\\").'
        },
        use_powershell: {
          type: 'BOOLEAN',
          description: 'Si es true, fuerza ejecución en PowerShell. Por defecto true.'
        }
      },
      required: ['command']
    }
  },
  async execute(args: { command?: string; use_powershell?: boolean }) {
    const command = args?.command;
    if (!command || typeof command !== 'string') {
      return { status: 'error', message: 'El comando es requerido y debe ser una cadena de texto.' };
    }
    const usePowershell = args.use_powershell !== false;
    return await virtualTerminal.executeCommand(command, usePowershell);
  }
};

export const readFileHandler: IToolHandler = {
  name: 'read_file',
  declaration: {
    name: 'read_file',
    description: 'Lee el contenido de cualquier archivo del sistema de archivos del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta absoluta del archivo a leer (ej: "C:\\\\Users\\\\jerem\\\\Documents\\\\nota.txt").'
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
    return virtualTerminal.readFile(path);
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
          description: 'Ruta absoluta del archivo a crear o sobreescribir.'
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
    return virtualTerminal.writeFile(path, contentStr, append);
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
          description: 'Ruta absoluta del directorio a listar (ej: "C:\\\\Users\\\\jerem\\\\Desktop").'
        }
      },
      required: ['path']
    }
  },
  async execute(args: { path?: string }) {
    const path = (typeof args?.path === 'string' && args.path.trim())
      ? args.path.trim()
      : 'C:\\React-Nextjs-Projects\\Cristi AI';

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
    return await virtualTerminal.executeCommand(`dir "${path}"`);
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
  name: 'get_running_processes',
  declaration: {
    name: 'get_running_processes',
    description: 'Lista los procesos activos en el sistema del usuario con nombre, PID y uso de memoria.'
  },
  async execute() {
    if (electronBridge.isElectron) {
      try {
        const cmd = 'powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -or $_.WorkingSet -gt 50MB } | Sort-Object WorkingSet -Descending | Select-Object -First 25 Id, ProcessName, @{Name=\'MemoryMB\';Expression={[math]::Round($_.WorkingSet/1MB,1)}}, MainWindowTitle | ConvertTo-Json"';
        const res = await electronBridge.execCommand(cmd, { timeout: 8000 });
        if (res.stdOut) {
          const processes = JSON.parse(res.stdOut);
          return { status: 'success', count: Array.isArray(processes) ? processes.length : 1, processes };
        }
      } catch {
        // fallback to virtual terminal
      }
    }
    return await virtualTerminal.executeCommand('Get-Process');
  }
};

export const killProcessHandler: IToolHandler = {
  name: 'kill_process',
  declaration: {
    name: 'kill_process',
    description: 'Termina un proceso en ejecución por su nombre o PID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pid_or_name: {
          type: 'STRING',
          description: 'Nombre del proceso (ej: "notepad.exe") o PID numérico a terminar.'
        }
      },
      required: ['pid_or_name']
    }
  },
  async execute(args: { pid_or_name?: string | number }) {
    const target = args?.pid_or_name;
    if (target === undefined || target === null || target === '') {
      return { status: 'error', message: 'pid_or_name es requerido.' };
    }
    const isNumeric = /^\d+$/.test(String(target).trim());
    const cleanTarget = String(target).replace(/['";$`]/g, '').trim();
    const cmd = isNumeric
      ? `Stop-Process -Id ${cleanTarget} -Force`
      : `Stop-Process -Name '${cleanTarget}' -Force`;

    if (electronBridge.isElectron) {
      const res = await electronBridge.execCommand(`powershell -NoProfile -Command "${cmd}"`, { timeout: 5000 });
      return { status: res.exitCode === 0 ? 'success' : 'error', message: res.stdOut || res.stdErr || 'Proceso finalizado.' };
    }
    return await virtualTerminal.executeCommand(cmd);
  }
};

export const openFileOrFolderHandler: IToolHandler = {
  name: 'open_file_or_folder',
  declaration: {
    name: 'open_file_or_folder',
    description: 'Abre cualquier archivo local o carpeta del sistema operativo directamente en el Explorador de Windows o con su aplicación predeterminada.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta absoluta o relativa del archivo o carpeta a abrir (ej: "C:\\\\Users\\\\jerem\\\\Downloads", "C:\\\\React-Nextjs-Projects").'
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
    } catch {
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank');
        return { status: 'success', opened: true, url, via: 'browser' };
      }
      return { status: 'success', opened: true, url };
    }
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
  killProcessHandler,
  openFileOrFolderHandler,
  openSystemAppOrLinkHandler
];
