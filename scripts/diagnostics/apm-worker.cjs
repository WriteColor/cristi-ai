/**
 * @fileoverview Cristi AI Companion - Dedicated Worker Thread for Background APM Diagnostics
 * @author Write_Color
 * @license MIT
 *
 * Corre en un hilo de sistema operativo independiente (Node.js Worker Thread)
 * para garantizar que la recopilación y análisis de métricas no bloquee el Main Process
 * ni el hilo de renderizado (UI Thread).
 */

'use strict';

const { parentPort, workerData } = require('worker_threads');
const { PerformanceAgent } = require('./performance-agent.cjs');

const cdpUrl = workerData?.cdpUrl || process.env.CRISTI_CDP_URL || 'http://127.0.0.1:9222';
const agent = new PerformanceAgent({ cdpUrl });

async function runPeriodicMonitor() {
  try {
    await agent.connect();
    parentPort.postMessage({ type: 'STATUS', status: 'CONNECTED', cdpUrl });

    // Enviar snapshot inicial
    const report = await agent.generateFullReport();
    parentPort.postMessage({ type: 'METRICS_SNAPSHOT', data: report });

    // Desconectar suavemente para liberar sockets hasta el siguiente ciclo
    await agent.disconnect();
  } catch (err) {
    parentPort.postMessage({ type: 'ERROR', error: err.message });
    await agent.disconnect().catch(() => {});
  }
}

// Escuchar comandos del hilo principal
if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg === 'COLLECT_NOW' || msg?.type === 'COLLECT_NOW') {
      await runPeriodicMonitor();
    } else if (msg === 'STOP' || msg?.type === 'STOP') {
      await agent.disconnect();
      process.exit(0);
    }
  });

  // Ejecución inmediata inicial
  runPeriodicMonitor();
}
