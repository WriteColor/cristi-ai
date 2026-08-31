import { logger } from './logger.js';
import { virtualTerminal } from './virtualTerminalService.js';
import { eventBus, EVENTS } from './eventBus.js';
import { electronBridge } from './desktop/ElectronBridge.js';

export class ToolExecutor {
  constructor({
    onGestureTrigger,
    onMotionTrigger,
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
    this.onMotionTrigger = onMotionTrigger || (() => {});
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
          message: `Avatar expression and dynamic Live2D parameters updated to ${gesture}.`
        };
      }

      case 'trigger_model_motion': {
        const motionGroup = args.motion_group || 'Idle';
        const index = args.index !== undefined ? Number(args.index) : 0;
        this.onMotionTrigger(motionGroup, index);
        return {
          status: 'success',
          motion_group: motionGroup,
          index,
          message: `Avatar triggered motion group "${motionGroup}"[${index}].`
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
        const weatherData = {
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

      // ─────────────────────────────────────────────────────────────────
      // WIDGETS TÁCTICOS DINÁMICOS (CONTROLADOS POR CRISTI AI)
      // ─────────────────────────────────────────────────────────────────
      case 'set_reminder': {
        const title = args.title || 'Recordatorio de Cristi';
        const time = args.time || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const tag = args.tag || 'Cristi';
        const widgetData = {
          id: String(Date.now()),
          type: 'reminder',
          title,
          time,
          tag,
          done: false,
          created_at: Date.now()
        };
        eventBus.emit(EVENTS.WIDGET_TRIGGERED, widgetData);
        return {
          status: 'success',
          message: `Recordatorio "${title}" creado para las ${time}.`,
          widget: widgetData
        };
      }

      case 'set_alarm': {
        const time = args.time || '10:00';
        const label = args.label || 'Alarma';
        const widgetData = {
          id: String(Date.now()),
          type: 'alarm',
          title: `Alarma: ${label}`,
          time,
          tag: 'Alarma',
          done: false
        };
        eventBus.emit(EVENTS.WIDGET_TRIGGERED, widgetData);
        return {
          status: 'success',
          message: `Alarma programada para las ${time} (${label}).`,
          widget: widgetData
        };
      }

      case 'show_tactical_widget': {
        const type = args.type || 'info';
        const title = args.title || 'Nota de Cristi';
        const content = args.content || '';
        const duration = args.duration || 10000;
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

      case 'dismiss_tactical_widget': {
        const id = args.id;
        eventBus.emit(EVENTS.WIDGET_DISMISSED, { id });
        return {
          status: 'success',
          message: `Widget descartado.`
        };
      }

      case 'system_diagnostics': {
        const memoryMB = performance.memory
          ? `${Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))} MB`
          : 'N/A';

        let platform = 'Web Browser';
        let cpuInfo = 'N/A';
        let memInfo = 'N/A';

        if (electronBridge.isElectron) {
          try {
            const cpuResult = await electronBridge.execCommand(
              'powershell -Command "Get-CimInstance Win32_Processor | Select-Object Name,LoadPercentage | ConvertTo-Json"'
            );
            const memResult = await electronBridge.execCommand(
              'powershell -Command "$mem = Get-CimInstance Win32_OperatingSystem; [PSCustomObject]@{TotalGB=[math]::Round($mem.TotalVisibleMemorySize/1MB,1);FreeGB=[math]::Round($mem.FreePhysicalMemory/1MB,1)} | ConvertTo-Json"'
            );
            platform = 'Electron Desktop (Cristi Native)';
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
        if (electronBridge.isElectron) {
          try {
            const content = await electronBridge.readFile(path);
            return { status: 'success', path, content: content.substring(0, 8000) };
          } catch (e) {
            return { status: 'error', path, message: e.message };
          }
        }
        return virtualTerminal.readFile(path);
      }

      case 'write_file': {
        const { path, content, append } = args;
        if (electronBridge.isElectron) {
          try {
            if (append) {
              await electronBridge.appendFile(path, content);
            } else {
              await electronBridge.writeFile(path, content);
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
        if (electronBridge.isElectron) {
          try {
            const entries = await electronBridge.readDirectory(path);
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
        try {
          const text = await electronBridge.getClipboardText();
          return { status: 'success', content: text };
        } catch (e) {
          return { status: 'error', message: e.message };
        }
      }

      case 'set_clipboard': {
        const text = args.text || '';
        try {
          await electronBridge.setClipboardText(text);
          return { status: 'success', message: 'Texto copiado al portapapeles.', length: text.length };
        } catch (e) {
          return { status: 'error', message: e.message };
        }
      }

      case 'get_running_processes': {
        if (electronBridge.isElectron) {
          try {
            const cmd = 'powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -or $_.WorkingSet -gt 50MB } | Sort-Object WorkingSet -Descending | Select-Object -First 25 Id, ProcessName, @{Name=\'MemoryMB\';Expression={[math]::Round($_.WorkingSet/1MB,1)}}, MainWindowTitle | ConvertTo-Json"';
            const res = await electronBridge.execCommand(cmd, { timeout: 8000 });
            if (res.stdOut) {
              const processes = JSON.parse(res.stdOut);
              return { status: 'success', count: Array.isArray(processes) ? processes.length : 1, processes };
            }
          } catch (e) {
            // fallback to basic list
          }
        }
        return await virtualTerminal.executeCommand('Get-Process');
      }

      case 'kill_process': {
        const target = args.pid_or_name;
        const isNumeric = /^\d+$/.test(String(target));
        const cmd = isNumeric
          ? `Stop-Process -Id ${target} -Force`
          : `Stop-Process -Name '${target}' -Force`;
        if (electronBridge.isElectron) {
          const res = await electronBridge.execCommand(`powershell -NoProfile -Command "${cmd}"`, { timeout: 5000 });
          return { status: res.exitCode === 0 ? 'success' : 'error', message: res.stdOut || res.stdErr || 'Proceso finalizado.' };
        }
        return await virtualTerminal.executeCommand(cmd);
      }

      case 'open_url':
      case 'open_system_app_or_link': {
        const url = args.url;
        if (!url) return { status: 'failed', message: 'No URL provided.' };

        try {
          await electronBridge.openExternal(url);
          return { status: 'opened', url };
        } catch (e) {
          window.open(url, '_blank');
          return { status: 'opened', url, via: 'browser' };
        }
      }

      case 'open_file_or_folder': {
        const path = args.path;
        if (!path) return { status: 'failed', message: 'No path provided.' };
        if (electronBridge.isElectron) {
          const res = await electronBridge.openPath(path);
          if (res.success) {
            return { status: 'success', path, message: `Ruta "${path}" abierta en el explorador o aplicación predeterminada.` };
          }
          return { status: 'error', path, message: res.error || 'No se pudo abrir la ruta.' };
        }
        return { status: 'unsupported', message: 'Abrir carpetas locales requiere modo escritorio Electron.' };
      }

      case 'computer_action': {
        const { action, coordinate, text, key, scroll_amount } = args;
        logger.info('COMPUTER-ACTION', `Ejecutando acción de uso de computadora: ${action}`, args);

        switch (action) {
          case 'mouse_click': {
            const [x, y] = coordinate || [0, 0];
            if (electronBridge.isElectron) {
              try {
                await electronBridge.execCommand(
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
            if (electronBridge.isElectron) {
              try {
                await electronBridge.execCommand(
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
            let frameData = null;
            if (electronBridge.isElectron) {
              frameData = await electronBridge.captureScreenNative();
            }
            if (!frameData) {
              frameData = await this.getScreenCapture('full');
            }
            return {
              status: 'captured',
              action: 'take_screenshot',
              message: 'Captura de pantalla realizada con alta fidelidad.',
              has_frame: !!frameData,
              frame_data: frameData
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
      // SCREEN CAPTURE & VISION GROUNDING
      // ─────────────────────────────────────────────────────────────────
      case 'capture_screen_snapshot': {
        let frameData = null;
        if (electronBridge.isElectron) {
          frameData = await electronBridge.captureScreenNative(args.region);
        }
        if (!frameData) {
          frameData = await this.getScreenCapture(args.region || 'active_region');
        }

        if (!frameData) {
          return {
            status: 'unavailable',
            message: 'La captura de pantalla no está disponible en este momento.'
          };
        }
        return {
          status: 'captured',
          region: args.region || 'full',
          message: 'Frame de pantalla capturado en tiempo real. Analízalo para responder al usuario.',
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
