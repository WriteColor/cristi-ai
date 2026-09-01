/**
 * Cristi AI - Futuristic HUD Toast Notification Service
 * Emits reactive HUD toasts with custom severity, icons, micro-animations, and sound cues.
 */

import { eventBus, EVENTS } from './eventBus.js';

export class ToastService {
  constructor() {
    this.toasts = [];
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener([...this.toasts]);
    }
  }

  /**
   * Dispatch a new toast notification
   * @param {Object} options
   * @param {string} options.title - Header text
   * @param {string} options.description - Detailed body text
   * @param {'info'|'success'|'warning'|'error'|'emotion'|'tool'|'ai'} [options.type='info'] - Notification theme
   * @param {number} [options.duration=4000] - Duration in milliseconds
   * @param {string} [options.icon] - Optional custom icon key or emoji
   * @param {string} [options.badge] - Optional micro tag (e.g. 'LIVE2D', 'SYSTEM', 'GEMINI')
   */
  show({
    title,
    description = '',
    type = 'info',
    duration = 4000,
    icon = null,
    badge = null
  }) {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const toast = {
      id,
      title,
      description,
      type,
      duration,
      icon,
      badge,
      createdAt: Date.now()
    };

    // Keep max 5 concurrent toasts
    this.toasts = [toast, ...this.toasts.slice(0, 4)];
    this.notify();

    eventBus.emit(EVENTS.TOAST_TRIGGERED, toast);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  dismiss(id) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  clearAll() {
    this.toasts = [];
    this.notify();
  }

  info(title, description, options = {}) {
    return this.show({ title, description, type: 'info', ...options });
  }

  success(title, description, options = {}) {
    return this.show({ title, description, type: 'success', ...options });
  }

  warning(title, description, options = {}) {
    return this.show({ title, description, type: 'warning', ...options });
  }

  warn(title, description, options = {}) {
    return this.warning(title, description, options);
  }

  warn(title, description, options = {}) {
    return this.warning(title, description, options);
  }

  error(title, description, options = {}) {
    return this.show({ title, description, type: 'error', duration: 6000, ...options });
  }

  tool(toolName, description, options = {}) {
    return this.show({
      title: `Ejecutando: ${toolName}`,
      description: description || 'Acción del sistema en progreso...',
      type: 'tool',
      badge: 'TOOL',
      ...options
    });
  }

  ai(title, description, options = {}) {
    return this.show({
      title,
      description,
      type: 'ai',
      badge: 'GEMINI',
      ...options
    });
  }
}

export const toastService = new ToastService();
export const toast = toastService;
