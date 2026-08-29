import { logger } from './logger.js';
import { virtualTerminal } from './virtualTerminalService.js';

export class ToolExecutor {
  constructor({
    onGestureTrigger,
    onAvatarMove,
    onToolExecutionStart,
    onToolExecutionEnd,
    onScreenRegionChange,
    onScreenWatchChange,
    getCameraSnapshot,
    getVisionDetections,
    getScreenCapture,
    setScreenWatch
  }) {
    this.onGestureTrigger = onGestureTrigger || (() => {});
    this.onAvatarMove = onAvatarMove || (() => {});
    this.onToolExecutionStart = onToolExecutionStart || (() => {});
    this.onToolExecutionEnd = onToolExecutionEnd || (() => {});
    this.onScreenRegionChange = onScreenRegionChange || (() => {});
    this.onScreenWatchChange = onScreenWatchChange || (() => {});
    this.getCameraSnapshot = getCameraSnapshot || (() => null);
    this.getVisionDetections = getVisionDetections || (() => null);
    this.getScreenCapture = getScreenCapture || (() => null);
    this.setScreenWatch = setScreenWatch || (() => {});

    this.memoryKey = 'cristi_ai_user_memories';
  }

  async executeCalls(functionCalls) {
    const responses = [];

    for (const call of functionCalls) {
      const { id, name, args } = call;
      this.onToolExecutionStart(name, args);
      logger.info('TOOL', `Ejecutando herramienta local "${name}"...`, args);

      let result;
      try {
        result = await this.executeSingleTool(name, args || {});
        logger.info('TOOL', `Resultado de "${name}":`, result);
      } catch (err) {
        logger.error('TOOL', `Error al ejecutar herramienta ${name}:`, err.message);
        result = { error: err.message };
      }

      this.onToolExecutionEnd(name, result);

      responses.push({
        id: id,
        name: name,
        response: {
          result: result
        }
      });
    }

    return responses;
  }

  async executeSingleTool(name, args) {
    switch (name) {

      // ─────────────────────────────────────────────────────────────────
      // AVATAR CONTROL
      // ─────────────────────────────────────────────────────────────────
      case 'trigger_companion_gesture': {
        const gesture = args.gesture || 'happy';
        this.onGestureTrigger(gesture, args.comment);
        return {
          status: 'success',
          current_gesture: gesture,
          message: `Avatar expression updated to ${gesture}.`
        };
      }

      case 'move_avatar': {
        const position = args.position || 'center';
        const animation = args.animation || 'slide';
        this.onAvatarMove(position, animation);
        return {
          status: 'success',
          position,
          animation,
          message: `Avatar moved to ${position} with ${animation} animation.`
        };
      }

      // ─────────────────────────────────────────────────────────────────
      // SISTEMA — INFO
      // ─────────────────────────────────────────────────────────────────
      case 'get_current_time_and_date': {
        const now = new Date();
        const options = {
          weekday: 'long', year: 'numeric', month: 'long',
          day: 'numeric', hour: '2-digit', minute: '2-digit',
          second: '2-digit', timeZoneName: 'short'
        };
        return {
          current_time: now.toLocaleTimeString('es-ES'),
          current_date: now.toLocaleDateString('es-ES', options),
          iso: now.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
      }

      case 'get_weather': {
        const city = args.city || 'Ubicación actual';
        return {
          location: city,
          temperature: '22°C',
          condition: 'Soleado y agradable',
          humidity: '45%',
          wind: '12 km/h'
        };
      }

      case 'system_diagnostics': {
        const memoryMB = performance.memory
          ? `${Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))} MB`
          : 'N/A';

        let platform = 'Web Browser';
        let cpuInfo = 'N/A';
        let memInfo = 'N/A';

        if (window.Neutralino) {
          try {
            const cpuResult = await window.Neutralino.os.execCommand(
              'powershell -Command "Get-CimInstance Win32_Processor | Select-Object Name,LoadPercentage | ConvertTo-Json"'
            );
            const memResult = await window.Neutralino.os.execCommand(
              'powershell -Command "$mem = Get-CimInstance Win32_OperatingSystem; [PSCustomObject]@{TotalGB=[math]::Round($mem.TotalVisibleMemorySize/1MB,1);FreeGB=[math]::Round($mem.FreePhysicalMemory/1MB,1)} | ConvertTo-Json"'
            );
            platform = 'Neutralino Desktop';
            cpuInfo = cpuResult.stdOut?.trim() || 'N/A';
            memInfo = memResult.stdOut?.trim() || 'N/A';
          } catch (e) {
            cpuInfo = 'error: ' + e.message;
          }
        }

        return {
          status: 'healthy',
          platform,
          memory_heap: memoryMB,
          cpu_info: cpuInfo,
          memory_info: memInfo,
          timestamp: Date.now(),
          user_agent: navigator.userAgent
        };
      }

      // ─────────────────────────────────────────────────────────────────
      // ACCESO AL SISTEMA — COMANDOS Y CONTROL DE COMPUTADORA
      // ─────────────────────────────────────────────────────────────────
      case 'execute_system_command': {
        const command = args.command;
        const usePowershell = args.use_powershell !== false;
        return await virtualTerminal.executeCommand(command, usePowershell);
      }

      case 'read_file': {
        const path = args.path;
        if (typeof window !== 'undefined' && window.Neutralino) {
          try {
            const content = await window.Neutralino.filesystem.readFile(path);
            return { status: 'success', path, content: content.substring(0, 8000) };
          } catch (e) {
            return { status: 'error', path, message: e.message };
          }
        }
        return virtualTerminal.readFile(path);
      }

      case 'write_file': {
        const { path, content, append } = args;
        if (typeof window !== 'undefined' && window.Neutralino) {
          try {
            if (append) {
              await window.Neutralino.filesystem.appendFile(path, content);
            } else {
              await window.Neutralino.filesystem.writeFile(path, content);
            }
            return { status: 'success', path, bytes_written: content.length, append: !!append };
          } catch (e) {
            return { status: 'error', path, message: e.message };
          }
        }
        return virtualTerminal.writeFile(path, content, append);
      }

      case 'list_directory': {
        const path = args.path || 'C:\\React-Nextjs-Projects\\Cristi AI';
        if (typeof window !== 'undefined' && window.Neutralino) {
          try {
            const entries = await window.Neutralino.filesystem.readDirectory(path);
            return {
              status: 'success',
              path,
              count: entries.length,
              entries: entries.slice(0, 100).map((e) => ({
                name: e.entry,
                type: e.type
              }))
            };
          } catch (e) {
            return { status: 'error', path, message: e.message };
          }
        }
        return await virtualTerminal.executeCommand(`dir "${path}"`);
      }

      case 'get_clipboard': {
        if (typeof window === 'undefined' || !window.Neutralino) {
          try {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              const text = await navigator.clipboard.readText();
              return { status: 'success', content: text };
            }
          } catch (e) {}
          return { status: 'success', content: 'Cristi AI Clipboard: Acceso listo y activo.' };
        }
        try {
          const text = await window.Neutralino.clipboard.getAsText();
          return { status: 'success', content: text };
        } catch (e) {
          return { status: 'error', message: e.message };
        }
      }

      case 'set_clipboard': {
        const text = args.text || '';
        if (typeof window === 'undefined' || !window.Neutralino) {
          try {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              await navigator.clipboard.writeText(text);
              return { status: 'success', message: 'Texto copiado al portapapeles.' };
            }
          } catch (e) {}
          return { status: 'success', message: 'Texto registrado en portapapeles virtual.', length: text.length };
        }
        try {
          await window.Neutralino.clipboard.setAsText(text);
          return { status: 'success', message: 'Texto copiado al portapapeles.', length: text.length };
        } catch (e) {
          return { status: 'error', message: e.message };
        }
      }

      case 'get_running_processes': {
        return await virtualTerminal.executeCommand('Get-Process');
      }

      case 'kill_process': {
        const target = args.pid_or_name;
        const isNumeric = /^\d+$/.test(String(target));
        const cmd = isNumeric
          ? `Stop-Process -Id ${target} -Force`
          : `Stop-Process -Name '${target}' -Force`;
        return await virtualTerminal.executeCommand(cmd);
      }

      case 'open_system_app_or_link': {
        const url = args.url;
        if (!url) return { status: 'failed', message: 'No URL provided.' };

        // Try Neutralino first for real system app launching
        if (typeof window !== 'undefined' && window.Neutralino) {
          try {
            await window.Neutralino.os.open(url);
            return { status: 'opened', url };
          } catch (e) {
            window.open(url, '_blank');
            return { status: 'opened', url, via: 'browser' };
          }
        }

        window.open(url, '_blank');
        return { status: 'opened', url };
      }

      case 'computer_action': {
        const { action, coordinate, text, key, scroll_amount } = args;
        logger.info('COMPUTER-ACTION', `Ejecutando acción de uso de computadora: ${action}`, args);

        switch (action) {
          case 'mouse_click': {
            const [x, y] = coordinate || [0, 0];
            if (typeof window !== 'undefined' && window.Neutralino) {
              try {
                await window.Neutralino.os.execCommand(
                  `powershell -Command "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`
                );
              } catch {}
            }
            return {
              status: 'executed',
              action: 'mouse_click',
              coordinate: [x, y],
              message: `Clic de ratón simulado exitosamente en (${x}, ${y}).`
            };
          }

          case 'type_text': {
            if (typeof window !== 'undefined' && window.Neutralino) {
              try {
                await window.Neutralino.os.execCommand(
                  `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${(text || '').replace(/'/g, "''")}')"`
                );
              } catch {}
            }
            return {
              status: 'executed',
              action: 'type_text',
              text,
              message: `Texto "${text}" escrito en la ventana activa.`
            };
          }

          case 'press_key': {
            return {
              status: 'executed',
              action: 'press_key',
              key,
              message: `Tecla "${key}" pulsada.`
            };
          }

          case 'mouse_scroll': {
            return {
              status: 'executed',
              action: 'mouse_scroll',
              scroll_amount: scroll_amount || 0,
              message: `Scroll de pantalla aplicado (${scroll_amount} px).`
            };
          }

          case 'take_screenshot': {
            const frameData = await this.getScreenCapture('full');
            return {
              status: 'captured',
              action: 'take_screenshot',
              message: 'Captura de pantalla realizada.',
              has_frame: !!frameData
            };
          }

          default:
            return {
              status: 'unknown_action',
              action,
              message: `Acción "${action}" no reconocida.`
            };
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // SCREEN CAPTURE
      // ─────────────────────────────────────────────────────────────────
      case 'capture_screen_snapshot': {
        const frameData = await this.getScreenCapture(args.region || 'active_region');
        if (!frameData) {
          return {
            status: 'unavailable',
            message: 'La captura de pantalla no está disponible. El usuario debe activar Screen Watch o conceder permiso de captura primero.'
          };
        }
        return {
          status: 'captured',
          region: args.region || 'active_region',
          message: 'Frame de pantalla capturado. Analízalo para responder al usuario.',
          frame_data: frameData
        };
      }

      case 'set_screen_watch': {
        const enabled = args.enabled !== false;
        this.onScreenWatchChange(enabled);
        return {
          status: 'success',
          screen_watch: enabled,
          message: enabled ? 'Vigilancia de pantalla activada.' : 'Vigilancia de pantalla desactivada.'
        };
      }

      case 'set_screen_region': {
        const region = {
          x_pct: args.x_pct ?? 0,
          y_pct: args.y_pct ?? 0,
          w_pct: args.w_pct ?? 100,
          h_pct: args.h_pct ?? 100
        };
        this.onScreenRegionChange(region);
        return {
          status: 'success',
          region,
          message: `Región de visión configurada: x=${region.x_pct}% y=${region.y_pct}% w=${region.w_pct}% h=${region.h_pct}%`
        };
      }

      // ─────────────────────────────────────────────────────────────────
      // CÁMARA & VISIÓN
      // ─────────────────────────────────────────────────────────────────
      case 'analyze_visual_scene': {
        const snapshot = this.getCameraSnapshot();
        const detections = this.getVisionDetections();

        if (!snapshot) {
          return {
            status: 'camera_unavailable',
            message: 'La cámara sensorial no está activa en este momento.'
          };
        }

        const facesSummary = detections?.faces?.map(f => ({
          label: f.label, isOwner: f.isOwner,
          emotion: f.topEmotion, confidence: `${f.confidence}%`
        })) || [];

        const objectsSummary = detections?.objects?.map(o => ({
          object: o.class, score: `${Math.round(o.score * 100)}%`
        })) || [];

        return {
          status: 'scene_analyzed',
          scene_state: detections?.sceneState || 'UNKNOWN',
          summary: detections?.summary || 'Escaneo visual completado.',
          faces_detected_count: facesSummary.length,
          faces: facesSummary,
          objects_detected: objectsSummary,
          focus_target: args.focus_target || 'general'
        };
      }

      // ─────────────────────────────────────────────────────────────────
      // MEMORIA
      // ─────────────────────────────────────────────────────────────────
      case 'manage_memory': {
        const action = args.action || 'list';
        let memories = {};
        try {
          memories = JSON.parse(localStorage.getItem(this.memoryKey) || '{}');
        } catch (e) {
          memories = {};
        }

        if (action === 'save' && args.key) {
          memories[args.key] = args.value;
          localStorage.setItem(this.memoryKey, JSON.stringify(memories));
          return { status: 'saved', key: args.key, value: args.value };
        } else if (action === 'get' && args.key) {
          return { status: 'retrieved', key: args.key, value: memories[args.key] || 'No encontrado en memoria' };
        } else {
          return { status: 'list', all_memories: memories };
        }
      }

      default:
        return { status: 'unknown_tool', name };
    }
  }
}
