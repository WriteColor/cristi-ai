// Explicit live probe: uses only synthetic input, never executes model tools.
import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { proactiveScheduler } from '../src/services/proactiveScheduler.js';
import { contextualEmotionOrchestrator } from '../src/services/live2d/ContextualEmotionOrchestrator.js';
import { logger } from '../src/services/logger.js';
logger.log = () => {};
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const apiKey = process.env.VITE_GEMINI_API_KEY || env.match(/^VITE_GEMINI_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
const report = [];
try {
  if (!apiKey) throw new Error('No API key available for the live probe');
  const wav = fs.readFileSync('tests/output/call-probe.wav');
  const dataMarker = wav.indexOf(Buffer.from('data'), 12);
  const pcm = wav.subarray(dataMarker + 8, dataMarker + 8 + wav.readUInt32LE(dataMarker + 4));
  for (const modelId of ['gemini-3.1-flash-live-preview', 'gemini-2.5-flash-native-audio-preview-12-2025']) {
    const result = { modelId, setup: false, audioChunks: 0, pcmBytes: 0, inputTranscript: '', outputTranscript: '', turns: 0 };
    await new Promise(resolve => {
      let timeout;
      let phase = 0;
      const finish = () => { clearTimeout(timeout); client.disconnect(); resolve(); };
      const client = new GeminiLiveSocket({
        apiKey, modelId, maxReconnectAttempts: 0, thinkingConfig: { thinkingBudget: 0 },
        systemPrompt: 'This is an audio transport test. Never call tools. Reply briefly with the phrase requested.',
        onOpen() { result.setup = true; client.sendTextMessage('Di solamente: prueba de audio correcta. No uses herramientas.'); },
        onAudioChunk(chunk) { result.audioChunks++; result.pcmBytes += Buffer.from(chunk, 'base64').length; },
        onInputTranscription(text) { result.inputTranscript = text; },
        onOutputTranscription(text) { result.outputTranscript = text; },
        onError(error) { result.error = error.message; finish(); },
        onClose(event) { result.closeCode = event.code; finish(); },
        onToolCall(calls) {
          result.toolsSkipped = (result.toolsSkipped || 0) + calls.length;
          client.sendToolResponse(calls.map(call => ({ id: call.id, name: call.name, output: { error: 'Tools disabled in synthetic transport test. Just say: audio test completed.' } })));
        },
        onTurnComplete() {
          result.turns++;
          if (phase === 1) { finish(); return; }
          phase = 1;
          void (async () => {
            await delay(500);
            for (let i = 0; i < pcm.length && client.isConnected; i += 640) {
              client.sendAudioChunk(pcm.subarray(i, i + 640).toString('base64'));
              await delay(20);
            }
            for (let i = 0; i < 75 && client.isConnected; i++) {
              client.sendAudioChunk(Buffer.alloc(640).toString('base64'));
              await delay(20);
            }
          })().catch(error => { result.error = error.message; finish(); });
        }
      });
      timeout = setTimeout(() => { result.error = 'Timed out after 45s'; finish(); }, 45000);
      client.connect();
    });
    report.push(result);
    console.log(JSON.stringify(result));
  }
} catch (error) { report.push({ error: error.message }); process.exitCode = 1; }
finally {
  proactiveScheduler.destroy(); contextualEmotionOrchestrator.destroy();
  fs.writeFileSync('tests/output/live-call-probe.json', JSON.stringify(report, null, 2));
  if (report.some(result => result.error || result.turns !== 2 || !result.inputTranscript || !result.audioChunks)) process.exitCode = 1;
}
