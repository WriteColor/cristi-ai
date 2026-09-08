/**
 * Cristi AI - Playwright Browser Automation Service (Domain Layer)
 * 
 * Provides autonomous control of the Brave Browser: page navigation, element clicks,
 * form input filling, realistic keystroke typing, JavaScript evaluation in page context,
 * and high-resolution full-page screenshots.
 */

import type {
  PlaywrightClickOptions,
  PlaywrightContentResult,
  PlaywrightFillOptions,
  PlaywrightHoverOptions,
  PlaywrightLaunchOptions,
  PlaywrightNavigateOptions,
  PlaywrightResult,
  PlaywrightScreenshotOptions,
  PlaywrightScreenshotResult,
  PlaywrightStatusResult,
  PlaywrightTypeOptions,
  PlaywrightWaitOptions
} from '@/types';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { logger } from '@/services/logger.js';

export interface IPlaywrightService {
  readonly currentUrl: string | null;
  readonly currentTitle: string | null;
  readonly isSessionActive: boolean;

  launch(options?: PlaywrightLaunchOptions): Promise<PlaywrightResult>;
  navigate(url: string, options?: PlaywrightNavigateOptions): Promise<PlaywrightResult>;
  click(selector: string, options?: PlaywrightClickOptions): Promise<PlaywrightResult>;
  fill(selector: string, value: string, options?: PlaywrightFillOptions): Promise<PlaywrightResult>;
  type(selector: string, text: string, options?: PlaywrightTypeOptions): Promise<PlaywrightResult>;
  press(selector: string, key: string): Promise<PlaywrightResult>;
  screenshot(options?: PlaywrightScreenshotOptions): Promise<PlaywrightScreenshotResult>;
  evaluate<T = unknown>(script: string): Promise<PlaywrightResult<T>>;
  getContent(selector?: string | null): Promise<PlaywrightContentResult>;
  waitForSelector(selector: string, options?: PlaywrightWaitOptions): Promise<PlaywrightResult>;
  hover(selector: string, options?: PlaywrightHoverOptions): Promise<PlaywrightResult>;
  getStatus(): Promise<PlaywrightStatusResult>;
  close(): Promise<PlaywrightResult>;
}

export class PlaywrightService implements IPlaywrightService {
  private readonly bridge: typeof electronBridge;

  public currentUrl: string | null = null;
  public currentTitle: string | null = null;
  public isSessionActive = false;

  constructor({ bridge = electronBridge } = {}) {
    this.bridge = bridge;
  }

  /**
   * Launch or attach to a Brave browser instance
   */
  public async launch(options: PlaywrightLaunchOptions = {}): Promise<PlaywrightResult> {
    logger.info?.('PLAYWRIGHT', 'Iniciando sesión de Brave Browser con Playwright...', options);
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('launch', options as Record<string, unknown>);
        if (res && res.success) {
          this.isSessionActive = true;
          this.currentUrl = res.url || null;
          this.currentTitle = res.title || null;
        }
        return {
          success: Boolean(res?.success),
          message: res?.message || (res?.success ? 'Navegador Brave iniciado exitosamente.' : undefined),
          error: res?.error,
          url: this.currentUrl,
          title: this.currentTitle
        };
      }

      // Browser mock
      this.isSessionActive = true;
      this.currentUrl = options.url || 'about:blank';
      this.currentTitle = 'Brave Browser (Simulado)';
      return {
        success: true,
        message: 'Modo simulado de Playwright activo (sin Electron).',
        url: this.currentUrl,
        title: this.currentTitle
      };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', 'Error al iniciar navegador:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Navigate to a target URL in the browser
   */
  public async navigate(url: string, options: PlaywrightNavigateOptions = {}): Promise<PlaywrightResult> {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'URL inválida o vacía.' };
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl) && !/^about:/i.test(targetUrl) && !/^file:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    logger.info?.('PLAYWRIGHT', `Navegando a: ${targetUrl}`);

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('navigate', { url: targetUrl, ...options });
        if (res && res.success) {
          this.isSessionActive = true;
          this.currentUrl = res.url || targetUrl;
          this.currentTitle = res.title || null;
        }
        return {
          success: Boolean(res?.success),
          message: res?.message || `Navegado a ${targetUrl}`,
          error: res?.error,
          url: this.currentUrl,
          title: this.currentTitle
        };
      }

      this.isSessionActive = true;
      this.currentUrl = targetUrl;
      return { success: true, url: targetUrl, title: targetUrl };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', `Error navegando a ${targetUrl}:`, err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Click an element identified by CSS selector, text, or XPath
   */
  public async click(selector: string, options: PlaywrightClickOptions = {}): Promise<PlaywrightResult> {
    if (!selector || typeof selector !== 'string') {
      return { success: false, error: 'Selector de elemento requerido.' };
    }

    logger.info?.('PLAYWRIGHT', `Haciendo clic en: "${selector}"`);

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('click', { selector, ...options });
        return {
          success: Boolean(res?.success),
          message: res?.message || `Clic ejecutado en "${selector}".`,
          error: res?.error
        };
      }
      return { success: true, message: `Clic simulado en "${selector}".` };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', `Error en clic para "${selector}":`, err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Fill an input or textarea with text
   */
  public async fill(selector: string, value: string, options: PlaywrightFillOptions = {}): Promise<PlaywrightResult> {
    if (!selector || typeof selector !== 'string') {
      return { success: false, error: 'Selector de campo requerido.' };
    }

    logger.info?.('PLAYWRIGHT', `Completando campo "${selector}" con "${value.slice(0, 30)}..."`);

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('fill', { selector, value, ...options });
        return {
          success: Boolean(res?.success),
          message: res?.message || `Campo "${selector}" completado.`,
          error: res?.error
        };
      }
      return { success: true, message: `Campo simulado "${selector}" completado.` };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', `Error llenando campo "${selector}":`, err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Type text character by character with realistic keystroke delay
   */
  public async type(selector: string, text: string, options: PlaywrightTypeOptions = {}): Promise<PlaywrightResult> {
    if (!selector || typeof selector !== 'string') {
      return { success: false, error: 'Selector de campo requerido.' };
    }

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('type', { selector, text, ...options });
        return {
          success: Boolean(res?.success),
          message: res?.message || `Texto tecleado en "${selector}".`,
          error: res?.error
        };
      }
      return { success: true, message: `Texto tecleado simulado en "${selector}".` };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', `Error al teclear en "${selector}":`, err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Press a keyboard key (e.g. Enter, Escape, Tab, ArrowDown, Backspace)
   */
  public async press(selector: string, key: string): Promise<PlaywrightResult> {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Tecla requerida.' };
    }

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('press', { selector: selector || 'body', key });
        return {
          success: Boolean(res?.success),
          message: res?.message || `Tecla "${key}" pulsada.`,
          error: res?.error
        };
      }
      return { success: true, message: `Tecla "${key}" pulsada simulada.` };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', `Error pulsando tecla "${key}":`, err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Capture a full-page or viewport screenshot of the current page
   */
  public async screenshot(options: PlaywrightScreenshotOptions = {}): Promise<PlaywrightScreenshotResult> {
    logger.info?.('PLAYWRIGHT', 'Capturando pantalla de la página web...');

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('screenshot', options as Record<string, unknown>);
        return {
          success: Boolean(res?.success),
          base64: res?.base64,
          size: res?.size,
          error: res?.error,
          message: res?.success ? 'Captura de pantalla completada exitosamente.' : undefined
        };
      }
      return {
        success: true,
        base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        size: 68,
        message: 'Captura de pantalla simulada.'
      };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', 'Error al capturar pantalla:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Evaluate arbitrary JavaScript expression or function in the page context
   */
  public async evaluate<T = unknown>(script: string): Promise<PlaywrightResult<T>> {
    if (!script || typeof script !== 'string') {
      return { success: false, error: 'Script requerido para evaluación.' };
    }

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('evaluate', { script });
        return {
          success: Boolean(res?.success),
          result: res?.result as T,
          error: res?.error
        };
      }
      return { success: true, result: undefined as unknown as T };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', 'Error evaluando script en página:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Extract readable inner text from the document or specific selector
   */
  public async getContent(selector: string | null = null): Promise<PlaywrightContentResult> {
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('get_content', { selector });
        if (res && res.success) {
          this.currentUrl = res.url || this.currentUrl;
          this.currentTitle = res.title || this.currentTitle;
        }
        return {
          success: Boolean(res?.success),
          content: res?.content,
          url: res?.url || this.currentUrl,
          title: res?.title || this.currentTitle,
          error: res?.error
        };
      }
      return {
        success: true,
        content: 'Contenido web simulado (entorno sin Electron).',
        url: this.currentUrl,
        title: this.currentTitle
      };
    } catch (err: any) {
      logger.error?.('PLAYWRIGHT', 'Error extrayendo contenido de página:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Wait for an element to appear or change visibility state
   */
  public async waitForSelector(selector: string, options: PlaywrightWaitOptions = {}): Promise<PlaywrightResult> {
    if (!selector || typeof selector !== 'string') {
      return { success: false, error: 'Selector requerido.' };
    }

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('wait_for_selector', { selector, ...options });
        return {
          success: Boolean(res?.success),
          message: res?.message,
          error: res?.error
        };
      }
      return { success: true, message: `Selector "${selector}" presente.` };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Position mouse cursor over an element
   */
  public async hover(selector: string, options: PlaywrightHoverOptions = {}): Promise<PlaywrightResult> {
    if (!selector || typeof selector !== 'string') {
      return { success: false, error: 'Selector requerido.' };
    }

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('hover', { selector, ...options });
        return {
          success: Boolean(res?.success),
          message: res?.message,
          error: res?.error
        };
      }
      return { success: true, message: `Hover en "${selector}".` };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Query status of the active browser session
   */
  public async getStatus(): Promise<PlaywrightStatusResult> {
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('status');
        const isRunning = Boolean(res?.isRunning);
        this.isSessionActive = isRunning;
        if (res?.url) this.currentUrl = res.url;
        if (res?.title) this.currentTitle = res.title;

        return {
          success: true,
          isRunning,
          url: this.currentUrl,
          title: this.currentTitle
        };
      }

      return {
        success: true,
        isRunning: this.isSessionActive,
        url: this.currentUrl,
        title: this.currentTitle
      };
    } catch (err: any) {
      return {
        success: false,
        isRunning: false,
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Close the active browser session
   */
  public async close(): Promise<PlaywrightResult> {
    logger.info?.('PLAYWRIGHT', 'Cerrando sesión de Playwright...');
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.playwrightExecute('close');
        this.isSessionActive = false;
        this.currentUrl = null;
        this.currentTitle = null;
        return {
          success: Boolean(res?.success ?? true),
          message: res?.message || 'Navegador cerrado.'
        };
      }

      this.isSessionActive = false;
      this.currentUrl = null;
      this.currentTitle = null;
      return { success: true, message: 'Navegador simulado cerrado.' };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}

export const playwrightService = new PlaywrightService();
export default playwrightService;
