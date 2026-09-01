/**
 * Cristi Desktop - Spark Profiler & Low-Level Timings Test Suite
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { SparkProfiler, SUBSYSTEMS, CONFIG } = require('../scripts/diagnostics/spark-profiler.cjs');

console.log('🧪 Iniciando prueba de Suite de Spark Profiler & Timings Subsystem Attribution...');

// 1. Validar definición de los 6 subsistemas
const expectedSubsystems = ['SYS-01', 'SYS-02', 'SYS-03', 'SYS-04', 'SYS-05', 'SYS-06'];
for (const sysId of expectedSubsystems) {
  if (!SUBSYSTEMS[sysId]) {
    throw new Error(`Subsistema esperado no encontrado en la definición: ${sysId}`);
  }
  if (!SUBSYSTEMS[sysId].name || !SUBSYSTEMS[sysId].subcategories || SUBSYSTEMS[sysId].subcategories.length === 0) {
    throw new Error(`El subsistema ${sysId} carece de subcategorías o metadatos válidos.`);
  }
}
console.log(`  ✓ Los 6 subsistemas [SYS-01] a [SYS-06] están correctamente definidos.`);

// 2. Ejecutar instancia de prueba en modo autónomo
const profiler = new SparkProfiler({
  sampleDurationMs: 1500,
  targetTps: 60.0,
  forceStandalone: true,
  silent: true
});

const report = await profiler.run();

if (!report || !report.timingSummary || !report.subsystems) {
  throw new Error('El reporte generado por SparkProfiler es nulo o inválido.');
}

console.log(`  ✓ Muestreo completado en modo: ${report.mode}`);
console.log(`  ✓ TPS Registrado: ${report.timingSummary.tps.current} / Nominal: ${report.timingSummary.nominalTps}`);
console.log(`  ✓ MSPT Min: ${report.timingSummary.mspt.min}ms | Avg: ${report.timingSummary.mspt.avg}ms | p95: ${report.timingSummary.mspt.p95}ms | p99: ${report.timingSummary.mspt.p99}ms | Max: ${report.timingSummary.mspt.max}ms`);

// 3. Validar métricas de percentiles MSPT
if (report.timingSummary.mspt.min < 0 || report.timingSummary.mspt.max < report.timingSummary.mspt.min) {
  throw new Error('Inconsistencia en los percentiles MSPT calculados.');
}

// 4. Validar atribución a los 6 subsistemas
for (const sysId of expectedSubsystems) {
  const sub = report.subsystems[sysId];
  if (!sub || typeof sub.avgCostMs !== 'number' || sub.avgCostMs <= 0) {
    throw new Error(`Atribución inválida para subsistema ${sysId}`);
  }
}
console.log(`  ✓ Atribución de costes verificada para los 6 subsistemas.`);

// 5. Validar archivos de salida JSON y Markdown
if (!fs.existsSync(CONFIG.OUTPUT_JSON_PATH)) {
  throw new Error(`Archivo de salida JSON no existe: ${CONFIG.OUTPUT_JSON_PATH}`);
}
if (!fs.existsSync(CONFIG.OUTPUT_MD_PATH)) {
  throw new Error(`Archivo de salida Markdown no existe: ${CONFIG.OUTPUT_MD_PATH}`);
}

const jsonContent = JSON.parse(fs.readFileSync(CONFIG.OUTPUT_JSON_PATH, 'utf8'));
if (!jsonContent.timingSummary || !jsonContent.subsystems['SYS-01']) {
  throw new Error('El contenido del archivo JSON de Spark Profiler está incompleto o corrupto.');
}

const mdContent = fs.readFileSync(CONFIG.OUTPUT_MD_PATH, 'utf8');
if (!mdContent.includes('Subsystem Attribution') || !mdContent.includes('SYS-01') || !mdContent.includes('SYS-06')) {
  throw new Error('El reporte Markdown no contiene la estructura de subsistemas esperada.');
}

console.log(`  ✓ Archivos de salida JSON y Markdown verificados.`);
console.log('🎉 [PASS] Suite de Spark Profiler & Low-Level Timings completada con éxito.');
process.exit(0);
