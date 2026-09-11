import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const allTestFiles = [
  'core',
  'live.contract',
  'playback',
  'audio.playout',
  'capture',
  'memory',
  'bridge',
  'tool-executor',
  'tools.validation',
  'spotify.resilience',
  'proactive.scheduler',
  'security.redaction',
  'domain.live2d',
  'domain.memory',
  'domain.audio',
  'domain.interaction',
  'screen.worker',
  'prompt.audit'
];

const args = process.argv.slice(2);
const filter = args.find(arg => !arg.startsWith('-'))?.toLowerCase();
const keepArtifacts = args.includes('--keep-build');

const testFiles = filter
  ? allTestFiles.filter(f => f.toLowerCase().includes(filter))
  : allTestFiles;

if (testFiles.length === 0) {
  console.error(`[TestRunner] Error: No test suite matches filter "${filter}". Available: ${allTestFiles.join(', ')}`);
  process.exit(1);
}

const buildDir = path.resolve('.test-build');
await fs.mkdir(buildDir, { recursive: true });

try {
  await build({
    entryPoints: ['electron/src/utility/memory.worker.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(buildDir, 'memory.worker.cjs')
  });

  await build({
    entryPoints: ['electron/src/utility/screen.worker.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(buildDir, 'screen.worker.cjs')
  });

  const browserHardwareMock = `
export class AudioAnalysisService { connectSource(){} start(){} stop(){} destroy(){} }
const noop = () => {};
export const logger = { info: noop, warn: noop, error: noop, debug: noop };
export const memoryService = { getSystemPromptContext: () => '', hasSession: () => true, recordTurn: noop, startSession: noop, endSession: noop };
export const proactiveScheduler = { getPromptContext: () => '' };
export const contextualEmotionOrchestrator = { processModelText: noop };
export const mcpClientManager = { getGeminiFunctionDeclarations: () => [] };
export const getLiveToolsConfig = () => [];
export const electronBridge = { requestLiveToken: async () => 'auth_tokens/test' };
export const DEFAULT_MODEL_ID = 'gemini-2.5-flash-native-audio-latest';
export const resolveLiveModelId = (id) => id || DEFAULT_MODEL_ID;
export const SYSTEM_PERSONA_PROMPT = 'Eres Cristi... Habla con ritmo conversacional natural, fluido y continuo.';
export const GEMINI_MODELS = {};
`;

  for (const file of testFiles) {
    const isRealDomainTest = file.startsWith('domain.') ||
      file.startsWith('tools.') ||
      file.startsWith('spotify.') ||
      file.startsWith('proactive.') ||
      file.startsWith('security.') ||
      file.startsWith('prompt.') ||
      file === 'bridge' ||
      file === 'memory' ||
      file === 'tool-executor' ||
      file === 'screen.worker';

    await build({
      entryPoints: [`tests/${file}.test.ts`],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: path.join(buildDir, `${file}.test.mjs`),
      external: ['electron'],
      plugins: [{
        name: 'test-dependency-resolver',
        setup(builder) {
          builder.onResolve({ filter: /capture\.worklet\?worker&url$/ }, () => ({
            path: 'capture-url',
            namespace: 'worklet-url'
          }));
          builder.onLoad({ filter: /.*/, namespace: 'worklet-url' }, () => ({
            contents: `export default 'capture-test.js'`,
            loader: 'js'
          }));

          if (!isRealDomainTest) {
            builder.onResolve({
              filter: /(?:AudioAnalysisService|logger|MemoryService|ProactiveScheduler|ContextualEmotionOrchestrator|MCPClientManager|ElectronBridge|config\/tools|config\/models)(?:\.[jt]s)?$/
            }, (args) => {
              return { path: args.path, namespace: 'test-mock' };
            });
            builder.onLoad({ filter: /.*/, namespace: 'test-mock' }, () => ({
              contents: browserHardwareMock,
              loader: 'js'
            }));
          }
        }
      }]
    });
  }

  const testTargets = testFiles.map(f => path.join(buildDir, `${f}.test.mjs`));
  const result = spawnSync(process.execPath, ['--test', ...testTargets], {
    stdio: 'inherit'
  });

  process.exitCode = result.status ?? 1;
} finally {
  if (!keepArtifacts) {
    try {
      await fs.rm(buildDir, { recursive: true, force: true });
    } catch (_) {
      // Ignore cleanup error
    }
  }
}
