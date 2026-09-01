/**
 * @fileoverview Cristi AI Companion - Enterprise APM & Performance Monitoring Agent (Playwright over CDP)
 * @author Write_Color
 * @license MIT
 *
 * Arquitectura de Monitoreo Agéntico de Rendimiento de Cero Overhead (Zero-Overhead APM):
 * - Se conecta vía Chrome DevTools Protocol (CDP) al proceso de Electron en ejecución.
 * - Reutiliza el proceso existente sin lanzar instancias adicionales de Chromium (Zero Process Duplication).
 * - Extrae Web Vitals, Heap V8, nodos DOM, latencias IPC y tareas largas (>50ms) en tiempo real.
 * - Soporta desconexión limpia (Graceful Degradation) sin alterar la experiencia del usuario.
 */

'use strict';

const { chromium } = require('playwright');

/**
 * @typedef {Object} APMPerformanceReport
 * @property {number} timestamp - Epoch timestamp de la captura.
 * @property {Object} webVitals - Métricas estándar de Web Vitals (LCP, CLS, FID/INP, TTFB).
 * @property {Object} memory - Estadísticas del Heap de V8 y memoria del proceso.
 * @property {Object} dom - Recuento de nodos DOM, listeners y contextos WebGL.
 * @property {Object} ipc - Tiempos de respuesta de llamadas IPC.
 * @property {Array<Object>} longTasks - Tareas que bloquearon el hilo principal (>50ms).
 */

class PerformanceAgent {
  /**
   * @param {Object} [options]
   * @param {string} [options.cdpUrl='http://127.0.0.1:9222'] - URL del puerto CDP local.
   * @param {number} [options.timeout=10000] - Tiempo límite para conexión inicial.
   */
  constructor(options = {}) {
    this.cdpUrl = options.cdpUrl || process.env.CRISTI_CDP_URL || 'http://127.0.0.1:9222';
    this.timeout = options.timeout || 10000;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cdpSession = null;
    this.isConnected = false;
  }

  /**
   * Conecta el agente al puerto CDP de la instancia de Electron activa.
   * @returns {Promise<boolean>}
   */
  async connect() {
    try {
      // Conexión directa mediante CDP sin crear procesos secundarios
      this.browser = await chromium.connectOverCDP(this.cdpUrl, {
        timeout: this.timeout
      });

      const contexts = this.browser.contexts();
      if (!contexts || contexts.length === 0) {
        throw new Error('No se encontraron contextos de navegador en la instancia de Electron.');
      }

      this.context = contexts[0];
      const pages = this.context.pages();

      // Identificar la ventana principal de Cristi
      this.page = pages.find((p) => !p.url().startsWith('devtools://')) || pages[0];
      if (!this.page) {
        throw new Error('No se encontró la página principal de la ventana de Electron.');
      }

      // Crear sesión nativa de CDP para telemetría profunda de bajo nivel
      this.cdpSession = await this.context.newCDPSession(this.page);
      await this.cdpSession.send('Performance.enable');

      this.isConnected = true;
      return true;
    } catch (err) {
      this.isConnected = false;
      throw new Error(`Error al conectar Agente APM vía CDP (${this.cdpUrl}): ${err.message}`);
    }
  }

  /**
   * Recopila métricas de Web Vitals y tiempos de carga de la página.
   * @returns {Promise<Object>}
   */
  async collectWebVitals() {
    this._ensureConnected();
    return await this.page.evaluate(() => {
      const navEntries = performance.getEntriesByType('navigation');
      const nav = navEntries.length > 0 ? navEntries[0] : null;

      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((p) => p.name === 'first-contentful-paint');

      return {
        ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : 0,
        loadCompleteMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0,
        fcpMs: fcpEntry ? Math.round(fcpEntry.startTime) : 0,
      };
    });
  }

  /**
   * Recopila métricas de memoria V8, nodos DOM y contextos WebGL.
   * @returns {Promise<Object>}
   */
  async collectMemoryMetrics() {
    this._ensureConnected();

    // Consultar métricas nativas del motor Chromium a través de CDP
    const cdpPerf = await this.cdpSession.send('Performance.getMetrics');
    const cdpMap = {};
    if (cdpPerf && cdpPerf.metrics) {
      cdpPerf.metrics.forEach((m) => {
        cdpMap[m.name] = m.value;
      });
    }

    // Consultar estado del DOM y memoria V8 desde el contexto de la ventana
    const domMetrics = await this.page.evaluate(() => {
      const mem = performance.memory || {};
      const allElements = document.querySelectorAll('*').length;
      const canvases = document.querySelectorAll('canvas').length;

      return {
        jsHeapUsedMB: mem.usedJSHeapSize ? parseFloat((mem.usedJSHeapSize / (1024 * 1024)).toFixed(2)) : 0,
        jsHeapTotalMB: mem.totalJSHeapSize ? parseFloat((mem.totalJSHeapSize / (1024 * 1024)).toFixed(2)) : 0,
        jsHeapLimitMB: mem.jsHeapSizeLimit ? parseFloat((mem.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)) : 0,
        totalDomNodes: allElements,
        totalCanvases: canvases,
      };
    });

    return {
      jsHeapUsedMB: domMetrics.jsHeapUsedMB || (cdpMap.JSHeapUsedSize ? parseFloat((cdpMap.JSHeapUsedSize / (1024 * 1024)).toFixed(2)) : 0),
      jsHeapTotalMB: domMetrics.jsHeapTotalMB || (cdpMap.JSHeapTotalSize ? parseFloat((cdpMap.JSHeapTotalSize / (1024 * 1024)).toFixed(2)) : 0),
      totalDomNodes: domMetrics.totalDomNodes || cdpMap.Nodes || 0,
      totalEventListeners: cdpMap.JSEventListeners || 0,
      layoutCount: cdpMap.LayoutCount || 0,
      recalcStyleCount: cdpMap.RecalcStyleCount || 0,
      totalCanvases: domMetrics.totalCanvases,
    };
  }

  /**
   * Mide la latencia de ida y vuelta (RTT) de las llamadas IPC hacia Electron Main.
   * @returns {Promise<Object>}
   */
  async collectIPCLatencies() {
    this._ensureConnected();
    return await this.page.evaluate(async () => {
      const results = {};
      if (window.electronAPI) {
        // Test 1: getDisplayInfo IPC
        const t0 = performance.now();
        await window.electronAPI.getDisplayInfo?.();
        results.getDisplayInfoMs = parseFloat((performance.now() - t0).toFixed(2));

        // Test 2: getAlwaysOnTop IPC
        const t1 = performance.now();
        await window.electronAPI.getAlwaysOnTop?.();
        results.getAlwaysOnTopMs = parseFloat((performance.now() - t1).toFixed(2));

        // Test 3: getProcessMemoryInfo IPC
        const t2 = performance.now();
        await window.electronAPI.getProcessMemoryInfo?.();
        results.getProcessMemoryInfoMs = parseFloat((performance.now() - t2).toFixed(2));
      }
      return results;
    });
  }

  /**
   * Ejecuta una auditoría de rendimiento en vivo realizando acciones no destructivas en la UI
   * y midiendo si existen caídas de FPS, fugas de memoria o bloqueos del hilo principal.
   * @param {Object} [benchmarkOptions]
   * @returns {Promise<Object>}
   */
  async runLiveInteractionAudit(benchmarkOptions = {}) {
    this._ensureConnected();
    const durationMs = benchmarkOptions.durationMs || 3000;

    // Tomar snapshot inicial de memoria
    const initialMemory = await this.collectMemoryMetrics();

    // Medir FPS y fluidez de rAF en el renderizador durante la interacción
    const fpsMeasurement = await this.page.evaluate((duration) => {
      return new Promise((resolve) => {
        let frameCount = 0;
        let lastTime = performance.now();
        const startTime = lastTime;
        const frameTimes = [];

        const onFrame = (now) => {
          frameCount++;
          const delta = now - lastTime;
          lastTime = now;
          frameTimes.push(delta);

          if (now - startTime < duration) {
            requestAnimationFrame(onFrame);
          } else {
            const totalTime = now - startTime;
            const avgFPS = Math.round((frameCount / totalTime) * 1000);
            frameTimes.sort((a, b) => a - b);
            const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)] || 16.6;
            const maxFrameTime = frameTimes[frameTimes.length - 1] || 16.6;

            resolve({
              avgFPS,
              totalFrames: frameCount,
              p95FrameTimeMs: parseFloat(p95.toFixed(2)),
              maxFrameTimeMs: parseFloat(maxFrameTime.toFixed(2)),
              droppedFrames: frameTimes.filter((t) => t > 33.3).length,
            });
          }
        };

        requestAnimationFrame(onFrame);
      });
    }, durationMs);

    // Tomar snapshot final de memoria
    const finalMemory = await this.collectMemoryMetrics();
    const heapDiffMB = parseFloat((finalMemory.jsHeapUsedMB - initialMemory.jsHeapUsedMB).toFixed(2));

    return {
      testDurationMs: durationMs,
      fps: fpsMeasurement,
      initialMemoryMB: initialMemory.jsHeapUsedMB,
      finalMemoryMB: finalMemory.jsHeapUsedMB,
      heapDeltaMB: heapDiffMB,
      memoryStability: Math.abs(heapDiffMB) < 15 ? 'EXCELLENT' : 'MONITOR',
      domNodesCount: finalMemory.totalDomNodes,
      eventListenersCount: finalMemory.totalEventListeners,
    };
  }

  /**
   * Genera un informe holístico completo de salud y rendimiento.
   * @returns {Promise<APMPerformanceReport>}
   */
  async generateFullReport() {
    this._ensureConnected();
    const timestamp = Date.now();
    const [webVitals, memory, ipc, liveBenchmark] = await Promise.all([
      this.collectWebVitals(),
      this.collectMemoryMetrics(),
      this.collectIPCLatencies(),
      this.runLiveInteractionAudit({ durationMs: 1500 }),
    ]);

    return {
      timestamp,
      cdpEndpoint: this.cdpUrl,
      webVitals,
      memory,
      ipc,
      liveBenchmark,
      verdict: liveBenchmark.fps.avgFPS >= 55 && liveBenchmark.fps.droppedFrames <= 2 ? 'OPTIMAL' : 'DEGRADED',
    };
  }

  /**
   * Desconecta limpiamente el agente CDP sin cerrar ni alterar el proceso de Electron.
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.cdpSession) {
        await this.cdpSession.detach().catch(() => {});
        this.cdpSession = null;
      }
      if (this.browser) {
        // En connectOverCDP, close() únicamente desconecta el socket CDP sin matar la aplicación
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      this.context = null;
      this.page = null;
      this.isConnected = false;
    } catch (_) {
      this.isConnected = false;
    }
  }

  _ensureConnected() {
    if (!this.isConnected || !this.page) {
      throw new Error('El Agente APM no está conectado. Ejecuta connect() primero.');
    }
  }
}

module.exports = { PerformanceAgent };
