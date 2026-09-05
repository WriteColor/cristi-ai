/**
 * Cristi AI - Playwright Browser Automation Service
 * Enables Cristi AI to control entire browser applications, navigate, interact,
 * fill forms, evaluate scripts, and scrape data using Playwright & Brave Browser.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';

export class PlaywrightService {
  constructor() {
    this.currentUrl = null;
    this.currentTitle = null;
    this.isSessionActive = false;
  }

  /**
   * Launch or attach to a browser instance (Brave)
   */
  async launch(options = {}) {
    logger.info('PLAYWRIGHT', 'Iniciando navegador con Playwright...', options);
    const res = await electronBridge.playwrightExecute('launch', options);
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
  async navigate(url, options = {}) {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'URL inválida o vacía.' };
    }
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl) && !/^about:/i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    logger.info('PLAYWRIGHT', `Navegando a: ${targetUrl}`);
    const res = await electronBridge.playwrightExecute('navigate', { url: targetUrl, ...options });
    if (res.success) {
      this.isSessionActive = true;
      this.currentUrl = res.url;
      this.currentTitle = res.title;
    }
    return res;
  }

  /**
   * Click an element identified by CSS selector, text, or XPath
   */
  async click(selector, options = {}) {
    if (!selector) return { success: false, error: 'Selector requerido.' };
    logger.info('PLAYWRIGHT', `Haciendo clic en: "${selector}"`);
    return await electronBridge.playwrightExecute('click', { selector, ...options });
  }

  /**
   * Fill an input or textarea with text
   */
  async fill(selector, value, options = {}) {
    if (!selector) return { success: false, error: 'Selector requerido.' };
    logger.info('PLAYWRIGHT', `Llenando campo "${selector}"`);
    return await electronBridge.playwrightExecute('fill', { selector, value, ...options });
  }

  /**
   * Type text character by character with realistic delay
   */
  async type(selector, text, options = {}) {
    if (!selector) return { success: false, error: 'Selector requerido.' };
    return await electronBridge.playwrightExecute('type', { selector, text, ...options });
  }

  /**
   * Press a keyboard key (e.g. Enter, Escape, Tab, ArrowDown)
   */
  async press(selector, key) {
    return await electronBridge.playwrightExecute('press', { selector: selector || 'body', key });
  }

  /**
   * Capture a screenshot of the current page
   */
  async screenshot(options = {}) {
    logger.info('PLAYWRIGHT', 'Capturando pantalla de la página web...');
    return await electronBridge.playwrightExecute('screenshot', options);
  }

  /**
   * Evaluate arbitrary JavaScript inside page context
   */
  async evaluate(script) {
    if (!script) return { success: false, error: 'Script requerido.' };
    logger.info('PLAYWRIGHT', 'Evaluando script en página...');
    return await electronBridge.playwrightExecute('evaluate', { script });
  }

  /**
   * Extract readable inner text or HTML from the page or a selector
   */
  async getContent(selector = null) {
    logger.info('PLAYWRIGHT', `Obteniendo contenido ${selector ? `de "${selector}"` : 'completo'}...`);
    const res = await electronBridge.playwrightExecute('get_content', { selector });
    if (res.success) {
      this.currentUrl = res.url;
      this.currentTitle = res.title;
    }
    return res;
  }

  /**
   * Wait for a selector to become available/visible
   */
  async waitForSelector(selector, options = {}) {
    return await electronBridge.playwrightExecute('wait_for_selector', { selector, ...options });
  }

  /**
   * Hover over an element
   */
  async hover(selector, options = {}) {
    return await electronBridge.playwrightExecute('hover', { selector, ...options });
  }

  /**
   * Get current browser status
   */
  async getStatus() {
    const res = await electronBridge.playwrightExecute('status');
    if (res.success) {
      this.isSessionActive = res.isRunning;
      this.currentUrl = res.url;
      this.currentTitle = res.title;
    }
    return res;
  }

  /**
   * Close the active browser session
   */
  async close() {
    logger.info('PLAYWRIGHT', 'Cerrando sesión de Playwright...');
    const res = await electronBridge.playwrightExecute('close');
    this.isSessionActive = false;
    this.currentUrl = null;
    this.currentTitle = null;
    return res;
  }
}

export const playwrightService = new PlaywrightService();
export default playwrightService;
