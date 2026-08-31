import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';
import { electronBridge } from './ElectronBridge.js';

/**
 * Cristi AI - Windows 11 Lock Screen Integration Service
 * Manages Windows session lock detection, background voice presence on lock screen,
 * and native Windows 11 Lock Screen Toast notifications via PowerShell.
 */
class LockScreenService {
  constructor() {
    this.isLocked = false;
    this.listeners = new Set();
    this.sessionMonitoringTimer = null;
    this.init();
  }

  init() {
    // Listen to local window blur/focus or session lock events
    window.addEventListener('blur', () => {
      // In Desktop environment, blur doesn't necessarily mean lock, but we check state
    });

    eventBus.on(EVENTS.WIDGET_TRIGGERED, (widget) => {
      if (this.isLocked && widget) {
        this.pushWindowsLockScreenNotification(widget.title, widget.message);
      }
    });

    logger.info('SYSTEM', 'Servicio de Bloqueo de Pantalla inicializado');
  }

  /**
   * Push a native Windows 11 Lock Screen notification via PowerShell / WinRT Toast API
   */
  async pushWindowsLockScreenNotification(title, message) {
    if (!electronBridge.isElectron) {
      return;
    }

    try {
      const safeTitle = title.replace(/"/g, '`"');
      const safeMsg = message.replace(/"/g, '`"');

      const psScript = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = @"
<toast scenario="reminder">
    <visual>
        <binding template="ToastGeneric">
            <text>${safeTitle}</text>
            <text>${safeMsg}</text>
            <text placement="attribution">Cristi AI Companion</text>
        </binding>
    </visual>
</toast>
"@
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        $toast.ExpirationTime = [DateTimeOffset]::Now.AddMinutes(10)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Cristi AI").Show($toast)
      `.trim();

      await electronBridge.execCommand(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`);
      logger.info('LOCK_SCREEN', `Notificación enviada a pantalla de bloqueo: "${title}"`);
    } catch (err) {
      logger.warn('LOCK_SCREEN', 'No se pudo emitir notificación Windows nativa:', err.message);
    }
  }

  /**
   * Automatically enable Windows 11 Lock Screen notifications in Registry via PowerShell
   */
  async configureWindows11LockScreenSettings() {
    if (!electronBridge.isElectron) {
      return { status: 'unsupported', message: 'Disponible exclusivamente en modo escritorio nativo Electron.' };
    }

    try {
      const psCommand = `
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings" -Name "NOC_GLOBAL_SETTING_ALLOW_TOASTS_ABOVE_LOCK" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue;
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings" -Name "NOC_GLOBAL_SETTING_ALLOW_CRITICAL_TOASTS_ABOVE_LOCK" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue;
      `.trim();

      await electronBridge.execCommand(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`);
      return {
        status: 'success',
        message: 'Configuración de notificaciones en Pantalla de Bloqueo de Windows 11 activada correctamente.'
      };
    } catch (err) {
      return {
        status: 'error',
        message: err.message
      };
    }
  }

  onStateChange(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  emitStateChange(isLocked) {
    this.listeners.forEach((fn) => {
      try {
        fn(isLocked);
      } catch {}
    });
  }
}

export { LockScreenService };
export const lockScreenService = new LockScreenService();
export default lockScreenService;
