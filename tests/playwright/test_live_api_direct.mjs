/**
 * Live WebSocket Connection & Command Verification Probe
 * Tests direct connection to Google Gemini Live API models with API key in .env
 */

import fs from 'fs';
import path from 'path';

// Read API key from .env
function getApiKey() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/VITE_GEMINI_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  return '';
}

const apiKey = getApiKey();
console.log('API Key cargada desde .env:', apiKey ? `${apiKey.substring(0, 8)}... (${apiKey.length} chars)` : 'NO ENCONTRADA');

const testModels = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-live-preview',
  'gemini-live-2.5-flash-native-audio',
  'gemini-2.5-flash-native-audio-preview-12-2025'
];

async function testModelLive(modelId) {
  console.log(`\n====================================================`);
  console.log(`🔍 Probando conexión en vivo con: ${modelId}`);
  console.log(`====================================================`);

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    let ws;
    let timeout = setTimeout(() => {
      console.log(`⏱️ Timeout de 15s alcanzado para ${modelId}`);
      if (ws) ws.close();
      resolve({ modelId, success: false, reason: 'Timeout' });
    }, 15000);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ [WS OPEN] Conectado a Gemini Live API para ${modelId}`);

        const setupMsg = {
          setup: {
            model: `models/${modelId}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0.7
            },
            systemInstruction: {
              parts: [{ text: 'Eres Cristi, una asistente con control total de la computadora. Cuando te pidan ejecutar comandos, usa las herramientas correspondientes.' }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: 'execute_system_command',
                    description: 'Ejecuta un comando en el sistema.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        command: { type: 'STRING', description: 'Comando a ejecutar.' }
                      },
                      required: ['command']
                    }
                  }
                ]
              }
            ]
          }
        };

        ws.send(JSON.stringify(setupMsg));
        console.log(`📤 [SETUP SENT] Enviado setup para ${modelId}`);

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log(`📤 [PROMPT SENT] Enviando prompt: "Por favor ejecuta Get-Process para ver los procesos de mi PC"`);
            ws.send(JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: 'Por favor ejecuta el comando Get-Process para revisar los procesos de mi PC en C:\\React-Nextjs-Projects\\Cristi AI.' }]
                  }
                ],
                turnComplete: true
              }
            }));
          }
        }, 1500);
      };

      ws.onmessage = async (event) => {
        try {
          let textData = '';
          if (typeof event.data === 'string') {
            textData = event.data;
          } else if (event.data instanceof Blob) {
            textData = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            textData = Buffer.from(event.data).toString('utf8');
          } else if (Buffer.isBuffer(event.data)) {
            textData = event.data.toString('utf8');
          }

          const parsed = JSON.parse(textData);
          
          if (parsed.serverContent && parsed.serverContent.modelTurn) {
            const parts = parsed.serverContent.modelTurn.parts || [];
            for (const p of parts) {
              if (p.text) console.log(`🗣️ [TEXT FROM ${modelId}]:`, p.text);
              if (p.inlineData) console.log(`🎵 [AUDIO CHUNK FROM ${modelId}]: ${p.inlineData.mimeType} (${p.inlineData.data?.length || 0} base64 chars)`);
            }
          }

          if (parsed.toolCall) {
            console.log(`🛠️ [TOOL CALL FROM ${modelId}]:`, JSON.stringify(parsed.toolCall, null, 2));
            clearTimeout(timeout);
            ws.close();
            resolve({ modelId, success: true, toolCall: parsed.toolCall });
          }

          if (parsed.serverContent && parsed.serverContent.turnComplete) {
            console.log(`🏁 [TURN COMPLETE FROM ${modelId}]`);
            clearTimeout(timeout);
            ws.close();
            resolve({ modelId, success: true });
          }
        } catch (e) {
          console.log(`📥 [BINARY DATA RECEIVED FROM ${modelId}] (${event.data.byteLength || event.data.size || 0} bytes)`);
        }
      };

      ws.onerror = (err) => {
        console.error(`❌ [ERROR ${modelId}]:`, err.message || err);
      };

      ws.onclose = (event) => {
        console.log(`🔒 [CLOSED ${modelId}] Código: ${event.code}, Razón: "${event.reason || ''}"`);
        clearTimeout(timeout);
        resolve({ modelId, success: event.code === 1000, code: event.code, reason: event.reason });
      };
    } catch (e) {
      clearTimeout(timeout);
      console.error(`❌ Fallo de inicio para ${modelId}:`, e.message);
      resolve({ modelId, success: false, reason: e.message });
    }
  });
}

async function main() {
  for (const m of testModels) {
    await testModelLive(m);
  }
}

main();
