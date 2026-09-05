import fs from 'fs';
import path from 'path';

function getApiKey() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/VITE_GEMINI_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  return process.env.VITE_GEMINI_API_KEY || '';
}

const key = getApiKey();

const modelsToTest = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-latest',
  'gemini-3.1-flash-live-preview'
];

async function probeModel(modelId) {
  console.log(`\n======================================================`);
  console.log(`🔍 Probando modelo: ${modelId} (Sin modo pensamiento)`);
  console.log(`======================================================`);

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;

  return new Promise((resolve) => {
    let ws;
    let audioBytes = 0;
    let textResponse = '';
    const timer = setTimeout(() => {
      console.log(`⏱️ Timeout de 15s alcanzado para ${modelId}`);
      if (ws) ws.close();
      resolve({ modelId, ok: false, reason: 'Timeout' });
    }, 15000);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`  ✅ Conexión WebSocket establecida para ${modelId}`);
        const setupPayload = {
          setup: {
            model: `models/${modelId}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0.7,
              thinkingConfig: {
                thinkingBudget: 0
              }
            }
          }
        };

        ws.send(JSON.stringify(setupPayload));

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              clientContent: {
                turns: [{ role: 'user', parts: [{ text: 'Hola Cristi, confírmame tu nombre y que estás lista para ayudarme.' }] }],
                turnComplete: true
              }
            }));
          }
        }, 800);
      };

      ws.onmessage = async (e) => {
        let raw = typeof e.data === 'string' ? e.data : await e.data.text();
        const msg = JSON.parse(raw);
        if (msg.serverContent?.modelTurn?.parts) {
          for (const p of msg.serverContent.modelTurn.parts) {
            if (p.text) textResponse += p.text;
            if (p.inlineData?.data) {
              audioBytes += Buffer.from(p.inlineData.data, 'base64').length;
            }
          }
        }
        if (msg.serverContent?.turnComplete) {
          clearTimeout(timer);
          console.log(`  🗣️ Respuesta recibida de ${modelId}`);
          console.log(`  🎵 Audio PCM 24kHz recibido: ${audioBytes} bytes (${(audioBytes / (24000 * 2)).toFixed(2)}s de voz)`);
          if (textResponse) console.log(`  📝 Texto: ${textResponse}`);
          ws.close();
          resolve({ modelId, ok: true, audioBytes, textResponse });
        }
      };

      ws.onerror = (err) => {
        console.error(`  ❌ Error WS: ${err.message || err}`);
      };

      ws.onclose = (e) => {
        clearTimeout(timer);
        if (e.code !== 1000) {
          console.log(`  🔒 Cerrado con código ${e.code}: ${e.reason || 'Normal'}`);
          resolve({ modelId, ok: false, code: e.code, reason: e.reason });
        }
      };
    } catch (err) {
      clearTimeout(timer);
      resolve({ modelId, ok: false, error: err.message });
    }
  });
}

for (const m of modelsToTest) {
  await probeModel(m);
}
console.log('\n🏁 Sondeo completado.');
