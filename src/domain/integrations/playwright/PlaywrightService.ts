/**
 * Cristi AI - Playwright Browser Automation Service
 * Enables Cristi AI to control entire browser applications, navigate, interact,
 * fill forms, evaluate scripts, and scrape data using Playwright & Brave Browser.
 */

import { electronBridge } from '../../../services/desktop/ElectronBridge';
import { logger } from '../../../infrastructure/logging/logger';

export interface PlaywrightResult {
  success: boolean;
  error?: string;
  url?: string;
  title?: string;
  isRunning?: boolean;
  [key: string]: unknown;
}

export class PlaywrightService {
  public currentUrl: string | null = null;
  public currentTitle: string | null = null;
  public isSessionActive = false;

  /**
   * Launch or attach to a browser instance (Brave)
   */
  async launch(options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    logger.info('PLAYWRIGHT', 'Iniciando navegador con Playwright...', options);
    const res = (await electronBridge.playwrightExecute('launch', options)) as PlaywrightResult;
    if (res.success) {
      this.isSessionActive = true;
      this.currentUrl = res.url || null;
      this.currentTitle = res.title || null;
    }
    return res;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string, options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'URL inválida o vacía.' };
    }
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl) && !/^about:/i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    logger.info('PLAYWRIGHT', `Navegando a: ${targetUrl}`);
    const res = (await electronBridge.playwrightExecute('navigate', { url: targetUrl, ...options })) as PlaywrightResult;
    if (res.success) {
      this.isSessionActive = true;
      this.currentUrl = res.url || null;
      this.currentTitle = res.title || null;
    }
    return res;
  }

  /**
   * Click an element identified by CSS selector, text, or XPath
   */
  async click(selector: string, options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    if (!selector) return { success: false, error: 'Selector requerido.' };
    logger.info('PLAYWRIGHT', `Haciendo clic en: "${selector}"`);
    return (await electronBridge.playwrightExecute('click', { selector, ...options })) as PlaywrightResult;
  }

  /**
   * Evaluate arbitrary JavaScript inside page context
   */
  async evaluate(script: string, options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    return (await electronBridge.playwrightExecute('evaluate', { script, ...options })) as PlaywrightResult;
  }

  /**
   * Fill an input or textarea with text
   */
  async fill(selector: string, value: string, options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    if (!selector) return { success: false, error: 'Selector requerido.' };
    logger.info('PLAYWRIGHT', `Llenando campo "${selector}"`);
    return (await electronBridge.playwrightExecute('fill', { selector, value, ...options })) as PlaywrightResult;
  }

  /**
   * Type text character by character with realistic delay
   */
  async type(selector: string, text: string, options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    if (!selector) return { success: false, error: 'Selector requerido.' };
    return (await electronBridge.playwrightExecute('type', { selector, text, ...options })) as PlaywrightResult;
  }

  /**
   * Press a keyboard key (e.g. Enter, Escape, Tab, ArrowDown)
   */
  async press(selector: string, key: string): Promise<PlaywrightResult> {
    return (await electronBridge.playwrightExecute('press', { selector: selector || 'body', key })) as PlaywrightResult;
  }

  /**
   * Capture a screenshot of the current page
   */
  async screenshot(options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    logger.info('PLAYWRIGHT', 'Capturando pantalla de la página web...');
    return (await electronBridge.playwrightExecute('screenshot', options)) as PlaywrightResult;
  }

  /**
   * Extract readable inner text or HTML from the page or a selector
   */
  async getContent(selector: string | null = null): Promise<PlaywrightResult> {
    logger.info('PLAYWRIGHT', `Obteniendo contenido ${selector ? `de "${selector}"` : 'completo'}...`);
    const res = (await electronBridge.playwrightExecute('get_content', { selector: selector || undefined })) as PlaywrightResult;
    if (res.success) {
      this.currentUrl = res.url || null;
      this.currentTitle = res.title || null;
    }
    return res;
  }

  /**
   * Wait for a selector to become available/visible
   */
  async waitForSelector(selector: string, options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    return (await electronBridge.playwrightExecute('wait_for_selector', { selector, ...options })) as PlaywrightResult;
  }

  /**
   * Hover over an element
   */
  async hover(selector: string, options: Record<string, unknown> = {}): Promise<PlaywrightResult> {
    return (await electronBridge.playwrightExecute('hover', { selector, ...options })) as PlaywrightResult;
  }

  /**
   * Get current browser status
   */
  async getStatus(): Promise<PlaywrightResult> {
    const res = (await electronBridge.playwrightExecute('status')) as PlaywrightResult;
    if (res.success) {
      this.isSessionActive = Boolean(res.isRunning);
      this.currentUrl = res.url || null;
      this.currentTitle = res.title || null;
    }
    return res;
  }

  /**
   * Close the active browser session
   */
  async close(): Promise<PlaywrightResult> {
    logger.info('PLAYWRIGHT', 'Cerrando sesión de Playwright...');
    const res = (await electronBridge.playwrightExecute('close')) as PlaywrightResult;
    this.isSessionActive = false;
    this.currentUrl = null;
    this.currentTitle = null;
    return res;
  }
}

export const playwrightService = new PlaywrightService();
export default playwrightService;
