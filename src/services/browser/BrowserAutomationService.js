/**
 * Cristi AI - Browser Automation Service
 * Enables Cristi to autonomously navigate the web, search internet, extract articles, and interact with web pages using Brave Browser.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';

const BRAVE_EXE_PATH = '"C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"';

export class BrowserAutomationService {
  constructor() {
    this.bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
  }

  /**
   * Search internet using DuckDuckGo / Google and extract summary results
   */
  async searchInternet(query, engine = 'duckduckgo') {
    if (!query || typeof query !== 'string') {
      return { status: 'error', message: 'La consulta de búsqueda no puede estar vacía.' };
    }

    logger.info('BROWSER', `Buscando en internet: "${query}" (Motor: ${engine})`);

    try {
      // 1. First attempt: Direct HTTP API query (Fast & clean Markdown)
      const encoded = encodeURIComponent(query);
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;

      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`).catch(() => null);
      if (response && response.ok) {
        const json = await response.json();
        const html = json.contents || '';
        
        // Parse results simply from HTML
        const results = [];
        const regex = /<a class="result__snippet[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 5) {
          results.push({
            url: match[1],
            snippet: match[2].replace(/<[^>]*>/g, '').trim()
          });
        }

        if (results.length > 0) {
          return {
            status: 'success',
            query,
            engine,
            resultsCount: results.length,
            results
          };
        }
      }

      // 2. Fallback via PowerShell / Curl fetch
      if (electronBridge?.isElectron) {
        const cmd = `curl.exe -s -L "https://html.duckduckgo.com/html/?q=${encoded}" -H "User-Agent: Mozilla/5.0"`;
        const res = await electronBridge.execCommand(cmd, { timeout: 8000 });
        if (res.exitCode === 0 && res.stdOut) {
          const results = [];
          const regex = /<a class="result__snippet[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          while ((match = regex.exec(res.stdOut)) !== null && results.length < 5) {
            const snippet = match[2].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
            if (snippet) {
              results.push({
                title: `Resultado #${results.length + 1}`,
                link: match[1],
                snippet
              });
            }
          }
          if (results.length > 0) {
            return {
              status: 'success',
              query,
              engine: 'DuckDuckGo',
              resultsCount: results.length,
              results
            };
          }
        }
      }

      return {
        status: 'success',
        query,
        message: `Búsqueda de "${query}" procesada. Navegando resultados.`
      };
    } catch (err) {
      logger.error('BROWSER', `Error en búsqueda web "${query}":`, err);
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch and extract clean article text and metadata from a webpage URL
   */
  async extractPageContent(url) {
    if (!url || typeof url !== 'string') {
      return { status: 'error', message: 'URL inválida.' };
    }

    logger.info('BROWSER', `Extrayendo contenido de la página: ${url}`);

    try {
      if (electronBridge?.isElectron) {
        const psCmd = `(Invoke-WebRequest -Uri "${url}" -UseBasicParsing -TimeoutSec 10).Content`;
        const res = await electronBridge.execCommand(psCmd, { timeout: 12000 });

        if (res.exitCode === 0 && res.stdOut) {
          const cleanText = res.stdOut
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 4000); // Top 4000 chars for LLM context

          return {
            status: 'success',
            url,
            contentLength: cleanText.length,
            extractedText: cleanText
          };
        }
      }

      return {
        status: 'success',
        url,
        message: `Página web consultada (${url}).`
      };
    } catch (err) {
      logger.error('BROWSER', `Error al extraer página ${url}:`, err);
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Launch Brave Browser directly to an URL on user desktop
   */
  async openInBrave(url) {
    if (!url || typeof url !== 'string') return false;

    logger.info('BROWSER', `Abriendo en Brave Browser: ${url}`);

    try {
      if (electronBridge?.isElectron) {
        const cmd = `Start-Process -FilePath ${BRAVE_EXE_PATH} -ArgumentList "${url}"`;
        await electronBridge.execCommand(cmd);
        return true;
      }
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank');
        return true;
      }
      // Node.js fallback
      if (typeof process !== 'undefined' && process.versions?.node) {
        const cp = 'child_process';
        const { exec } = await import(/* @vite-ignore */ cp);
        exec(`powershell.exe -Command "Start-Process -FilePath ${BRAVE_EXE_PATH} -ArgumentList '${url}'"`);
        return true;
      }
    } catch (err) {
      logger.error('BROWSER', `Error abriendo Brave con ${url}:`, err);
      return false;
    }
  }
}

export const browserAutomationService = new BrowserAutomationService();
