import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { GeminiLiveSocket } from '../src/services/geminiLiveSocket.js';
import { proactiveScheduler } from '../src/services/proactiveScheduler.js';
import { contextualEmotionOrchestrator } from '../src/services/live2d/ContextualEmotionOrchestrator.js';

const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const apiKey = process.env.VITE_GEMINI_API_KEY || env.match(/^VITE_GEMINI_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
const images = ['tests/output/vision-probe-full.jpg', 'tests/output/vision-probe-region.jpg']
  .filter(file => fs.existsSync(file)).map(file => ({ file, data: fs.readFileSync(file).toString('base64') }));
const report = [];

try {
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is required');
  if (!images.length) throw new Error('No screenshot artifact available');
  for (const modelId of ['gemini-3.1-flash-live-preview', 'gemini-2.5-flash-native-audio-preview-12-2025']) {
    const result = { modelId, setup: false, framesSent: 0, chunks: 0, pcmBytes: 0, transcript: '', turns: 0 };
    await new Promise(resolve => {
      let timeout;
      const finish = () => { clearTimeout(timeout); client.disconnect(); resolve(); };
      const client = new GeminiLiveSocket({
        apiKey, modelId, maxReconnectAttempts: 0,
        systemPrompt: 'This is a visual transport test. Never call tools. Look at every image and describe the visible avatar and any subtitle text briefly.',
        thinkingConfig: { thinkingBudget: 0 },
        onOpen() {
          result.setup = true;
          for (const image of images) {
            if (client.sendRealtimeMedia(image.data, 'image/jpeg')) result.framesSent++;
          }
          client.sendTextMessage('Analiza las imágenes recibidas. Di qué avatar aparece y transcribe cualquier subtítulo visible. No inventes acciones ni uses herramientas.');
        },
        onAudioChunk(chunk) { result.chunks++; result.pcmBytes += Buffer.from(chunk, 'base64').length; },
        onOutputTranscription(text) { result.transcript = text; },
        onToolCall(calls) { result.toolsSkipped = (result.toolsSkipped || 0) + calls.length; client.sendToolResponse(calls.map(call => ({ id: call.id, name: call.name, output: { error: 'Tools disabled in visual transport test.' } }))); },
        onError(error) { result.error = error.message; finish(); },
        onTurnComplete() { result.turns++; finish(); },
        onClose(event) { result.closeCode = event.code; finish(); }
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
  fs.writeFileSync('tests/output/live-vision-probe.json', JSON.stringify(report, null, 2));
  if (report.some(result => result.error || result.framesSent < 1 || result.chunks < 1 || !result.transcript)) process.exitCode = 1;
}
