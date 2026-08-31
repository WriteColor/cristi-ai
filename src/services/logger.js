/**
 * Cristi Desktop - Terminal & Diagnostics Logger
 * Bridges frontend logs directly to the user's running terminal (Vite / Electron stdout)
 * and browser console with timestamped, colorized tags.
 */

class LoggerService {
  constructor() {
    this.buffer = [];
    this.isFlushing = false;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitToListeners(entry) {
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (e) {}
    });
  }

  log(level, tag, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp,
      level,
      tag: tag || 'SYSTEM',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      data
    };

    // 1. Browser Console Logging with stylish CSS
    const tagColors = {
      GEMINI: '#c084fc',
      AUDIO: '#38bdf8',
      VISION: '#f43f5e',
      ASR: '#4ade80',
      TOOL: '#fbbf24',
      SYSTEM: '#94a3b8'
    };
    const color = tagColors[entry.tag] || '#a855f7';
    console.log(
      `%c[${entry.timestamp}]%c [${entry.tag}] %c${entry.message}`,
      'color: #64748b; font-weight: normal;',
      `color: ${color}; font-weight: bold;`,
      'color: #f8fafc;',
      data || ''
    );

    // 2. Notify in-app subscribers (UI Debug HUD)
    this.emitToListeners(entry);

    // 3. Forward to Vite terminal server endpoint (/__log)
    this.sendToTerminal(entry);
  }

  async sendToTerminal(entry) {
    try {
      if (typeof window !== 'undefined' && window.fetch) {
        fetch('/__log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
          mode: 'no-cors'
        }).catch(() => {});
      }
    } catch (e) {}
  }

  info(tag, message, data) {
    this.log('info', tag, message, data);
  }

  voice(tag, message, data) {
    this.log('voice', tag, message, data);
  }

  warn(tag, message, data) {
    this.log('warn', tag, message, data);
  }

  error(tag, message, data) {
    this.log('error', tag, message, data);
  }
}

export const logger = new LoggerService();
