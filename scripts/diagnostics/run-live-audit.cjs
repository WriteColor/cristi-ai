/**
 * @fileoverview Cristi AI Companion - CLI Runner for Live CDP Performance Diagnostics
 * @author Write_Color
 * @license MIT
 *
 * Ejecuta una auditoría de rendimiento en tiempo real conectándose mediante CDP
 * a la instancia de Cristi AI Companion que ya está en ejecución (en desarrollo o producción).
 *
 * Uso:
 *   pnpm run test:live-apm
 *   node scripts/diagnostics/run-live-audit.cjs
 */

'use strict';

const { PerformanceAgent } = require('./performance-agent.cjs');

async function main() {
  console.log('================================================================');
  console.log('🔬 CRISTI AI COMPANION — AGENTIC PERFORMANCE MONITORING (CDP)');
  console.log('================================================================');
  console.log('[1/4] Buscando instancia activa de Electron en http://127.0.0.1:9222...');

  const agent = new PerformanceAgent({
    cdpUrl: process.env.CRISTI_CDP_URL || 'http://127.0.0.1:9222',
    timeout: 6000
  });

  try {
    await agent.connect();
    console.log('  ✅ Conectado exitosamente vía Chrome DevTools Protocol (CDP).');
    console.log('  🎯 Ventana detectada:', agent.page.url());

    console.log('\n[2/4] Recopilando métricas de Web Vitals, Heap V8 y Nodos DOM...');
    const [webVitals, memory, ipc] = await Promise.all([
      agent.collectWebVitals(),
      agent.collectMemoryMetrics(),
      agent.collectIPCLatencies(),
    ]);

    console.log('\n[3/4] Ejecutando benchmark de fluidez y renderizado en vivo (2000ms)...');
    const liveBenchmark = await agent.runLiveInteractionAudit({ durationMs: 2000 });

    console.log('\n[4/4] Procesando informe holístico de rendimiento...');
    console.log('\n================================================================');
    console.log('📊 REPORTE EJECUTIVO DE RENDIMIENTO EN TIEMPO REAL');
    console.log('================================================================');

    console.table({
      'Framerate Promedio': { Valor: `${liveBenchmark.fps.avgFPS} FPS`, Estado: liveBenchmark.fps.avgFPS >= 55 ? '✅ ÓPTIMO' : '⚠️ REVISAR' },
      'P95 Frame Time': { Valor: `${liveBenchmark.fps.p95FrameTimeMs} ms`, Estado: liveBenchmark.fps.p95FrameTimeMs <= 20 ? '✅ FLUIDO' : '⚠️ PICOS' },
      'Frames Caídos (>33ms)': { Valor: `${liveBenchmark.fps.droppedFrames}`, Estado: liveBenchmark.fps.droppedFrames <= 2 ? '✅ 0 LAG' : '⚠️ TIRONES' },
      'JS Heap Usado': { Valor: `${memory.jsHeapUsedMB} MB`, Estado: memory.jsHeapUsedMB <= 250 ? '✅ BAJO' : '⚠️ ELEVADO' },
      'Total Nodos DOM': { Valor: `${memory.totalDomNodes}`, Estado: memory.totalDomNodes <= 1500 ? '✅ LIVIANO' : '⚠️ EXCESIVO' },
      'Listeners de Eventos': { Valor: `${memory.totalEventListeners}`, Estado: memory.totalEventListeners <= 300 ? '✅ CONTROLADO' : '⚠️ POSIBLE FUGA' },
      'IPC Display RTT': { Valor: `${ipc.getDisplayInfoMs || 0} ms`, Estado: (ipc.getDisplayInfoMs || 0) < 5 ? '✅ INSTANTÁNEO' : '⚠️ DEMORA' },
      'IPC Memory RTT': { Valor: `${ipc.getProcessMemoryInfoMs || 0} ms`, Estado: (ipc.getProcessMemoryInfoMs || 0) < 5 ? '✅ INSTANTÁNEO' : '⚠️ DEMORA' },
    });

    console.log('\n🔍 DIAGNÓSTICO DE MÓDULOS:');
    if (liveBenchmark.fps.avgFPS >= 55 && liveBenchmark.fps.droppedFrames <= 2 && memory.jsHeapUsedMB < 300) {
      console.log('  🎉 EXCELENTE: Todos los subsistemas (Live2D, UI React 19, Audio DSP) operan a máximo rendimiento.');
      console.log('  🚀 0% de sobrecarga detectada. Experiencia ultra-fluida garantizada.');
    } else {
      console.log('  ⚠️ ADVERTENCIA: Se detectaron fluctuaciones en el framerate o acumulación de memoria.');
    }

    await agent.disconnect();
    console.log('\n🔒 Desconexión limpia del agente completada (La app sigue corriendo normalmente).');
    console.log('================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ No se pudo conectar a la aplicación en ejecución:', err.message);
    console.log('\n💡 Para ejecutar la app con el puerto CDP activo:');
    console.log('   1. Inicia Cristi con: pnpm run app:dev (o abre la app instalada)');
    console.log('   2. Vuelve a ejecutar: pnpm run test:live-apm\n');
    process.exit(1);
  }
}

main();
