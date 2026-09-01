/**
 * Cristi Desktop - System Tray & Window Lifecycle Service
 * In Electron, the system tray is managed by electron/main.cjs.
 * This service provides window visibility controls for renderer components.
 */

import { logger } from './logger.js';
import { electronBridge } from './desktop/ElectronBridge.js';

export class SystemTrayService {
  constructor({
    onRestoreWindow,
    onToggleMute,
    onToggleViewMode,
    onToggleAlwaysOnTop,
    onOpenVoiceEnrollment,
    onOpenLockSandbox,
    onExitApp
  } = {}) {
    this.onRestoreWindow = onRestoreWindow || (() => {});
    this.onToggleMute = onToggleMute || (() => {});
    this.onToggleViewMode = onToggleViewMode || (() => {});
    this.onToggleAlwaysOnTop = onToggleAlwaysOnTop || (() => {});
    this.onOpenVoiceEnrollment = onOpenVoiceEnrollment || (() => {});
    this.onOpenLockSandbox = onOpenLockSandbox || (() => {});
    this.onExitApp = onExitApp || (() => {});
    this.isInitialized = false;
  }

  async setupTray() {
    this.isInitialized = true;
    logger.info('TRAY', 'Cristi AI Companion System Tray activo y gestionado por Electron.');
  }

  async minimizeToTray() {
    try {
      electronBridge.hideWindow();
      await electronBridge.showNotification(
        'Cristi AI Companion',
        'Cristi permanece activa en la bandeja del sistema (haz doble clic para mostrar).'
      );
    } catch (err) {
      logger.warn('TRAY', `Aviso al minimizar a bandeja: ${err.message}`);
    }
  }

  async showWindow() {
    try {
      electronBridge.showWindow();
    } catch (err) {
      logger.warn('TRAY', `Aviso al mostrar ventana: ${err.message}`);
    }
  }
}

export default SystemTrayService;
