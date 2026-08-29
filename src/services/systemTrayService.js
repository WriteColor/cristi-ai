/**
 * Cristi AI - Desktop System Tray Service (Neutralinojs)
 * Manages tray icon, contextual menu, and window minimize-to-tray lifecycle.
 */

import { logger } from './logger';

export class SystemTrayService {
  constructor({
    onRestoreWindow,
    onToggleMute,
    onToggleViewMode,
    onToggleAlwaysOnTop,
    onExitApp
  }) {
    this.onRestoreWindow = onRestoreWindow || (() => {});
    this.onToggleMute = onToggleMute || (() => {});
    this.onToggleViewMode = onToggleViewMode || (() => {});
    this.onToggleAlwaysOnTop = onToggleAlwaysOnTop || (() => {});
    this.onExitApp = onExitApp || (() => {});
    this.isInitialized = false;
  }

  async setupTray() {
    if (!window.Neutralino?.os?.setTray) return;
    if (this.isInitialized) return;

    try {
      const tray = {
        icon: '/favicon.ico',
        menuItems: [
          { id: 'SHOW_APP', text: 'Mostrar / Restaurar Cristi' },
          { id: 'TOGGLE_VIEW', text: 'Alternar Torso / Cuerpo Completo' },
          { id: 'TOGGLE_MUTE', text: 'Silenciar / Activar Micrófono' },
          { id: 'ALWAYS_ON_TOP', text: 'Alternar Siempre Visible' },
          { text: '-' },
          { id: 'EXIT_APP', text: 'Salir de Cristi AI' }
        ]
      };

      await window.Neutralino.os.setTray(tray);

      // Listen for tray click events
      window.Neutralino.events.on('trayMenuItemClicked', (event) => {
        const menuItem = event.detail;
        logger.info('TRAY', `Menú de bandeja seleccionado: ${menuItem.id}`);

        switch (menuItem.id) {
          case 'SHOW_APP':
            this.showWindow();
            this.onRestoreWindow();
            break;
          case 'TOGGLE_VIEW':
            this.onToggleViewMode();
            break;
          case 'TOGGLE_MUTE':
            this.onToggleMute();
            break;
          case 'ALWAYS_ON_TOP':
            this.onToggleAlwaysOnTop();
            break;
          case 'EXIT_APP':
            this.onExitApp();
            if (window.Neutralino.app) {
              window.Neutralino.app.exit();
            }
            break;
          default:
            break;
        }
      });

      // Intercept window close to minimize to tray
      window.Neutralino.events.on('windowClose', async () => {
        logger.info('TRAY', 'Ventana cerrada por usuario, minimizando al System Tray...');
        await this.minimizeToTray();
      });

      this.isInitialized = true;
      logger.info('TRAY', 'System Tray inicializado con éxito.');
    } catch (err) {
      logger.warn('TRAY', `No se pudo configurar System Tray: ${err.message}`);
    }
  }

  async minimizeToTray() {
    if (!window.Neutralino?.window) return;
    try {
      await window.Neutralino.window.hide();
      if (window.Neutralino.os.showNotification) {
        window.Neutralino.os.showNotification(
          'Cristi AI sigue activa',
          'Cristi está esperándote en la bandeja del sistema.'
        );
      }
    } catch (err) {
      logger.warn('TRAY', `Error al ocultar a bandeja: ${err.message}`);
    }
  }

  async showWindow() {
    if (!window.Neutralino?.window) return;
    try {
      await window.Neutralino.window.show();
      await window.Neutralino.window.focus();
    } catch (err) {
      logger.warn('TRAY', `Error al restaurar ventana: ${err.message}`);
    }
  }
}
