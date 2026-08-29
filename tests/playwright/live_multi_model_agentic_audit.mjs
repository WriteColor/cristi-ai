/**
 * Cristi AI - Live Multi-Model Agentic & Computer Control Interception Audit
 * Executes real bi-directional WebSocket conversation turns with Google Gemini Live API models,
 * intercepts tool calls, executes real system commands / computer actions, and validates the feedback loop.
 */

import fs from 'fs';
import path from 'path';
import { VirtualTerminalService } from '../../src/services/virtualTerminalService.js';
import { ToolExecutor } from '../../src/services/toolExecutor.js';
import { getLiveToolsConfig } from '../../src/config/tools.js';

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
const virtualTerminal = new VirtualTerminalService();
const toolExecutor = new ToolExecutor({
  getScreenCapture: async () => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...'
});

async function runLiveAgenticTest(modelId) {
  console.log(`\n================================================================`);
  console.log(`🤖 INICIANDO AUDITORÍA EN VIVO CON: ${modelId}`);
  console.log(`================================================================`);

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    let ws;
    let turnCount = 0;
    const interceptedTools = [];
    const receivedTexts = [];

    const timeout = setTimeout(() => {
      console.log(`⏱️ Finalizando sesión en vivo para ${modelId} tras 25s de pruebas.`);
      if (ws) ws.close();
      resolve({ modelId, success: interceptedTools.length > 0, interceptedTools, receivedTexts });
    }, 25000);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ [WS OPEN] Conectado a Gemini Live API (${modelId})`);

        // Send initial setup
        const setupMessage = {
          setup: {
            model: `models/${modelId}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0.7
            },
            systemInstruction: {
              parts: [{ text: 'Eres Cristi, una asistente de inteligencia artificial con control total de la computadora del usuario. Tienes acceso al sistema de archivos, terminal PowerShell y acciones de pantalla. Cuando el usuario te pida realizar una tarea en el sistema, invoca la herramienta correspondiente de inmediato.' }]
            },
            tools: getLiveToolsConfig()
          }
        };

        ws.send(JSON.stringify(setupMessage));
        console.log(`📤 [SETUP SENT] Herramientas de sistema y Computer Use registradas en el handshake.`);

        // Turn 1: Ask model to create a file and run a command in the project directory
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            turnCount++;
            console.log(`\n💬 [TURNO 1 - ENVIANDO PROMPT A ${modelId}]:`);
            console.log(`   "Por favor escribe un archivo llamado C:\\React-Nextjs-Projects\\Cristi AI\\live_test_output.txt con el texto 'Cristi AI en control' y luego ejecuta Get-Process para revisar los procesos."`);
            
            ws.send(JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: 'Por favor escribe un archivo llamado C:\\React-Nextjs-Projects\\Cristi AI\\live_test_output.txt con el texto "Cristi AI en control" y luego ejecuta Get-Process para revisar los procesos de mi PC.' }]
                  }
                ],
                turnComplete: true
              }
            }));
          }
        }, 1200);
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

          // Check if model returned thought or text
          if (parsed.serverContent && parsed.serverContent.modelTurn) {
            const parts = parsed.serverContent.modelTurn.parts || [];
            for (const p of parts) {
              if (p.text) {
                console.log(`🗣️ [RESPUESTA MODELO ${modelId}]:`, p.text.trim());
                receivedTexts.push(p.text.trim());
              }
              if (p.inlineData) {
                // Audio chunk received
              }
            }
          }

          // Intercept tool calls
          if (parsed.toolCall) {
            console.log(`\n⚡ [INTERCEPTADA LLAMADA DE HERRAMIENTA]:`);
            const functionCalls = parsed.toolCall.functionCalls || [];

            for (const fc of functionCalls) {
              console.log(`   🔹 Herramienta invocada por IA: "${fc.name}" (ID: ${fc.id})`);
              console.log(`   🔹 Argumentos proporcionados por IA:`, JSON.stringify(fc.args, null, 2));
              interceptedTools.push({ name: fc.name, args: fc.args, id: fc.id });

              // Execute tool in our real/virtual engine
              const executionResponses = await toolExecutor.executeCalls([fc]);
              const result = executionResponses[0]?.response?.result;
              console.log(`   ✅ [RESULTADO DE EJECUCIÓN EN EL SISTEMA]:`, JSON.stringify(result).substring(0, 200) + '...');

              // Send toolResponse back to Gemini over WebSocket
              if (ws.readyState === WebSocket.OPEN) {
                console.log(`   📤 [ENVIANDO TOOL_RESPONSE A GEMINI LIVE]`);
                ws.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [
                      {
                        id: fc.id,
                        name: fc.name,
                        response: { result: result }
                      }
                    ]
                  }
                }));
              }
            }

            // After Turn 1 tools finish, launch Turn 2 (Computer Action / Screen Vision test)
            if (turnCount === 1) {
              setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  turnCount++;
                  console.log(`\n💬 [TURNO 2 - ENVIANDO PROMPT DE COMPUTER ACTION A ${modelId}]:`);
                  console.log(`   "Ahora toma una captura de la pantalla para ver qué hay en el escritorio y haz clic en (500, 300)."`);
                  
                  ws.send(JSON.stringify({
                    clientContent: {
                      turns: [
                        {
                          role: 'user',
                          parts: [{ text: 'Ahora toma una captura de la pantalla para ver qué hay en el escritorio y haz clic en (500, 300).' }]
                        }
                      ],
                      turnComplete: true
                    }
                  }));
                }
              }, 2000);
            }
          }

          if (parsed.serverContent && parsed.serverContent.turnComplete) {
            console.log(`🏁 [TURNO COMPLETADO POR ${modelId}]`);
            if (turnCount >= 2 && interceptedTools.length >= 2) {
              clearTimeout(timeout);
              setTimeout(() => {
                ws.close();
                resolve({ modelId, success: true, interceptedTools, receivedTexts });
              }, 1500);
            }
          }
        } catch (e) {
          // Binary audio packet
        }
      };

      ws.onerror = (err) => {
        console.error(`❌ [ERROR ${modelId}]:`, err.message || err);
      };

      ws.onclose = (event) => {
        console.log(`🔒 [SESIÓN CERRADA ${modelId}] Código: ${event.code}`);
        clearTimeout(timeout);
        resolve({ modelId, success: interceptedTools.length > 0, code: event.code, interceptedTools, receivedTexts });
      };
    } catch (err) {
      clearTimeout(timeout);
      console.error(`❌ Fallo en sesión para ${modelId}:`, err);
      resolve({ modelId, success: false, reason: err.message });
    }
  });
}

async function runFullAudit() {
  console.log('================================================================');
  console.log('🚀 INICIANDO AUDITORÍA EN TIEMPO REAL CON LA LIVE API DE GOOGLE');
  console.log('================================================================\n');

  const modelsToTest = [
    'gemini-3.1-flash-live-preview',
    'gemini-2.5-flash-native-audio-preview-12-2025'
  ];

  const results = [];

  for (const model of modelsToTest) {
    const res = await runLiveAgenticTest(model);
    results.push(res);
  }

  console.log('\n================================================================');
  console.log('📊 RESUMEN FINAL DE AUDITORÍA EN VIVO DE CONTROL DE COMPUTADORA');
  console.log('================================================================');
  for (const r of results) {
    console.log(`\n🔹 Modelo: ${r.modelId}`);
    console.log(`   - Estado: ${r.success ? '✅ OPERATIVO Y PROBADO CON ÉXITO' : '❌ FALLIDO'}`);
    console.log(`   - Herramientas interceptadas y ejecutadas: ${r.interceptedTools?.length || 0}`);
    for (const t of (r.interceptedTools || [])) {
      console.log(`     * Herramienta: [${t.name}] | Args: ${JSON.stringify(t.args)}`);
    }
  }
  console.log('\n================================================================\n');
}

runFullAudit().catch(console.error);
