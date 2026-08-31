/**
 * Cristi Desktop - Clean Terminal & Diagnostics Logger
 * Bridges frontend logs directly to the user's running terminal (Vite / Electron stdout)
 * and browser console with timestamped, colorized tags and deduplication.
 */

class LoggerService {
  constructor() {
    this.listeners = new Set();
    this.lastLogKey = '';
    this.lastLogTime = 0;
    this.repeatCount = 0;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitToListeners(entry) {
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (_) {}
    });
  }

  normalizeArgs(arg1, arg2, arg3) {
    // If called with only 1 argument: logger.info("System loaded")
    if (arg2 === undefined) {
      return { tag: 'SYSTEM', message: arg1, data: null };
    }
    // If called with 2 arguments: logger.info("AUDIO", "Worklet connected")
    if (arg3 === undefined) {
      return { tag: arg1 || 'SYSTEM', message: arg2, data: null };
    }
    // If called with 3 arguments: logger.info("AUDIO", "Captured", { size: 1024 })
    return { tag: arg1 || 'SYSTEM', message: arg2, data: arg3 };
  }

  log(level, arg1, arg2, arg3) {
    const { tag, message, data } = this.normalizeArgs(arg1, arg2, arg3);
    const msgStr = typeof message === 'object' ? JSON.stringify(message) : String(message ?? '');

    // Deduplication filter (avoids log flooding within 1.5s for identical tag & message)
    const logKey = `${level}:${tag}:${msgStr}`;
    const now = Date.now();
    if (logKey === this.lastLogKey && now - this.lastLogTime < 1500) {
      this.repeatCount++;
      return;
    }
    this.lastLogKey = logKey;
    this.lastLogTime = now;
    this.repeatCount = 0;

    const timestamp = new Date().toLocaleTimeString('es-ES');
    const entry = {
      id: `${now}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp,
      level,
      tag: tag.toUpperCase(),
      message: msgStr,
      data: data || null
    };

    // 1. Browser Console Logging with clean CSS tags
    const tagColors = {
      GEMINI: '#c084fc',
      AUDIO: '#38bdf8',
      VISION: '#f43f5e',
      ASR: '#4ade80',
      TOOL: '#fbbf24',
      SYSTEM: '#94a3b8',
      SCENE: '#a855f7',
      ELECTRON: '#06b6d4'
    };
    const color = tagColors[entry.tag] || '#a855f7';

    if (data !== null && data !== undefined) {
      console.log(
        `%c[${entry.timestamp}]%c [${entry.tag}] %c${entry.message}`,
        'color: #64748b; font-weight: normal;',
        `color: ${color}; font-weight: bold;`,
        'color: #f8fafc;',
        data
      );
    } else {
      console.log(
        `%c[${entry.timestamp}]%c [${entry.tag}] %c${entry.message}`,
        'color: #64748b; font-weight: normal;',
        `color: ${color}; font-weight: bold;`,
        'color: #f8fafc;'
      );
    }

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
    } catch (_) {}
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
export default logger;
