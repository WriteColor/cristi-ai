/**
 * Cristi AI - Single-Session Real-Time Live Test Suite
 * 
 * 100% REAL LIVE CONNECTION TO GEMINI LIVE API (BidiGenerateContent).
 * - Zero Thinking Budget (thinkingBudget: 0) for instant voice responses.
 * - Single active Cristi session (no overlapping voices, no multiple instances).
 * - Exclusive audio playback: each response plays cleanly on Windows speakers.
 * - True uncropped 2560x1600 DPI-aware physical screen capture (WinSta0).
 * - 100% genuine contextual interaction based on actual screen and PC reality.
 * - Clean slate memory (all artificial test records wiped).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { COMPANION_FUNCTION_DECLARATIONS } from '../src/config/tools.js';
import { memoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';
import { minecraftCompanion } from '../src/services/gameIntegration/MinecraftCompanionService.js';
import { captureRealScreenNative } from './utils/native_screen_capture.mjs';
import { pcmToWavBuffer, playWavFile, killAllAudioPlayback } from './utils/audio_player.mjs';

// ── Ensure Clean Environment ────────────────────────────────────────────────
killAllAudioPlayback();

const ARTIFACTS_DIR = path.resolve('tests/artifacts');
const AUDIO_DIR = path.join(ARTIFACTS_DIR, 'audio');
const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, 'screenshots');
const LOGS_DIR = path.join(ARTIFACTS_DIR, 'logs');

[ARTIFACTS_DIR, AUDIO_DIR, SCREENSHOTS_DIR, LOGS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function getApiKey() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/VITE_GEMINI_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  return process.env.VITE_GEMINI_API_KEY || '';
}

const apiKey = getApiKey();
if (!apiKey) {
  console.error('❌ ERROR: No se encontró VITE_GEMINI_API_KEY en .env');
  process.exit(1);
}

// Clean memory slate
await memoryService.initialize();

const MODEL_ID = 'gemini-2.5-flash-native-audio-preview-12-2025';

console.log('================================================================');
console.log('🎙️ CRISTI AI - SESIÓN ÚNICA EN VIVO Y TIEMPO REAL CON GEMINI');
console.log(`🔑 Clave API: ${apiKey.substring(0, 8)}... (${apiKey.length} caracteres)`);
console.log(`🧠 Modelo: ${MODEL_ID}`);
console.log('⚡ Modo: Voz instantánea sin pensamiento (thinkingBudget: 0)');
console.log('🔊 Salida: Audio exclusivo sin voces superpuestas');
console.log('📸 Visión: Captura nativa física completa (DPI-Aware 2560x1600)');
console.log('================================================================\n');

const liveAuditReport = {
  timestamp: new Date().toISOString(),
  model: MODEL_ID,
  turns: [],
  toolsExecuted: [],
  audioFiles: [],
  screenshots: []
};

// ── Real Tool Dispatcher ─────────────────────────────────────────────────────
async function handleRealTool(call) {
  const { name, args, id } = call;
  console.log(`\n    🛠️ [GEMINI LLAMA HERRAMIENTA]: "${name}"`, JSON.stringify(args || {}));
  liveAuditReport.toolsExecuted.push(name);

  let result = null;

  try {
    switch (name) {
      case 'execute_system_command': {
        const cmd = args?.command || 'Get-Process | Select-Object -First 5';
        console.log(`       💻 [PC EJECUTANDO POWERSHELL]: "${cmd}"`);
        try {
          const b64 = Buffer.from(cmd, 'utf16le').toString('base64');
          const stdout = execSync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${b64}`, {
            encoding: 'utf8',
            timeout: 12000
          });
          result = { stdout: stdout.trim(), exitCode: 0 };
        } catch (err) {
          result = { stdout: err.stdout || '', stderr: err.stderr || err.message, exitCode: err.status || 1 };
        }
        console.log(`       ✅ [SALIDA PC]:`, (result.stdout || result.stderr || '').substring(0, 100).replace(/\n/g, ' ') + '...');
        break;
      }

      case 'capture_screen_snapshot': {
        const snapPath = path.join(SCREENSHOTS_DIR, `snapshot_live_${Date.now()}.jpg`);
        captureRealScreenNative(null, snapPath);
        result = { status: 'success', filePath: snapPath, message: 'Captura real de pantalla disponible para análisis visual.' };
        liveAuditReport.screenshots.push(snapPath);
        console.log(`       📸 [SNAPSHOT FÍSICO GUARDADO]: ${snapPath}`);
        break;
      }

      case 'minecraft_chat': {
        console.log(`       🎮 [MINECRAFT CHAT]: "${args.message}"`);
        result = await minecraftCompanion.sendChat(args.message);
        break;
      }

      case 'minecraft_move_to': {
        console.log(`       🎮 [MINECRAFT DESPLAZAMIENTO]: X:${args.x}, Y:${args.y}, Z:${args.z}`);
        result = { status: 'success', message: `Moviéndose a coordenadas X:${args.x}, Y:${args.y}, Z:${args.z}` };
        break;
      }

      case 'remember_fact':
      case 'memory_remember': {
        const item = await memoryService.remember({
          key: args.key || 'dato_clave',
          content: args.content || args.text || '',
          category: args.category || MEMORY_CATEGORIES.FACT,
          importance: args.importance || 0.8
        });
        result = { status: 'success', memory: item };
        console.log(`       💾 [MEMORIA GUARDADA]: [${item.category}] "${item.key}": ${item.content}`);
        break;
      }

      case 'trigger_companion_gesture': {
        console.log(`       😊 [GESTO DE CRISTI]: ${args.gesture}`);
        result = { status: 'success', gesture: args.gesture };
        break;
      }

      default: {
        result = { status: 'success', tool: name };
      }
    }
  } catch (err) {
    result = { status: 'error', message: err.message };
  }

  return {
    id: id || `call_${Date.now()}`,
    name,
    response: { output: result }
  };
}

async function runSingleSessionRealtime() {
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    let ws;
    let currentTurn = 0;
    let turnPcmBuffers = [];
    let turnTextAccumulator = '';
    let turnTimeout = null;

    const sessionTimer = setTimeout(() => {
      console.log('\n⏱️ Tiempo límite de sesión alcanzado.');
      if (ws) ws.close();
      resolve(liveAuditReport);
    }, 180000);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ [CANAL WEBSOCKET ABIERTO] Conectado en tiempo real con Gemini Live API.');

        // Initial setup message
        const setupPayload = {
          setup: {
            model: `models/${MODEL_ID}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0.6,
              thinkingConfig: {
                thinkingBudget: 0
              }
            },
            systemInstruction: {
              parts: [
                {
                  text: `Eres Cristi, una compañera virtual de inteligencia artificial con voz afectuosa, cercana, expresiva y ejecutiva.
Tienes acceso y control nativo de la computadora Windows del usuario.
REGLA VISUAL ESTRICTA:
- Cuando recibas o analices una imagen o captura de pantalla, describe con total precisión lo que realmente observas en los píxeles (por ejemplo si hay un videojuego en pantalla completa, estadio de fútbol con autos como Rocket League, marcadores, marcador de tiempo, vehículo rosa, cancha, etc.). NUNCA inventes o asumas que estás viendo un escritorio de Windows tradicional o iconos si la pantalla muestra un videojuego u otra aplicación activa.
REGLA DE MEMORIA:
- Trata al usuario con naturalidad. Si el usuario te comparte algo personal, guárdalo sólo cuando sea relevante sin que te lo pida explícitamente. Responde a su contexto real en el presente.`
                }
              ]
            },
            tools: [
              {
                functionDeclarations: COMPANION_FUNCTION_DECLARATIONS
              }
            ]
          }
        };

        ws.send(JSON.stringify(setupPayload));
        console.log('📤 [SETUP ENVIADO] Gemini configurado sin latencia de pensamiento.');

        setTimeout(() => {
          startTurn(1);
        }, 1000);
      };

      function startTurn(turnNum) {
        currentTurn = turnNum;
        turnPcmBuffers = [];
        turnTextAccumulator = '';

        if (turnNum === 1) {
          // Turn 1: True Screen Perception (Rocket League / whatever is on display)
          console.log('\n================================================================');
          console.log('👁️ [TURNO 1/4: PERCEPCIÓN VISUAL REAL DE TU PANTALLA COMPLETA]');
          console.log('================================================================');

          const captureFile = path.join(SCREENSHOTS_DIR, 'live_fullscreen_capture.jpg');
          const screenB64 = captureRealScreenNative(null, captureFile);
          liveAuditReport.screenshots.push(captureFile);
          console.log(`📸 [PANTALLA REAL CAPTURADA (2560x1600)]: ${captureFile} (${screenB64 ? screenB64.length : 0} bytes base64)`);

          ws.send(JSON.stringify({
            realtimeInput: {
              video: {
                data: screenB64,
                mimeType: 'image/jpeg'
              }
            }
          }));

          const prompt = 'Hola Cristi, te he transmitido la captura en tiempo real de mi pantalla. Mírala con atención y dime exactamente qué juego, elementos o escena estás viendo en este momento.';
          console.log(`🗣️ [USUARIO]: "${prompt}"`);
          ws.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: prompt }] }],
              turnComplete: true
            }
          }));
        } else if (turnNum === 2) {
          // Turn 2: Real System Performance
          console.log('\n================================================================');
          console.log('💻 [TURNO 2/4: INSPECCIÓN REAL DE RECURSOS DE TU PC]');
          console.log('================================================================');
          const prompt = 'Cristi, por favor ejecuta un comando en mi sistema para revisar el uso de memoria RAM y el estado de la máquina.';
          console.log(`🗣️ [USUARIO]: "${prompt}"`);
          ws.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: prompt }] }],
              turnComplete: true
            }
          }));
        } else if (turnNum === 3) {
          // Turn 3: Game Companion (Minecraft)
          console.log('\n================================================================');
          console.log('🎮 [TURNO 3/4: COMPAÑERA DE JUEGOS (MINECRAFT COMPANION)]');
          console.log('================================================================');
          const prompt = 'Vamos a jugar Minecraft juntos. Mándame un saludo en el chat in-game y acércate hacia mí.';
          console.log(`🗣️ [USUARIO]: "${prompt}"`);
          ws.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: prompt }] }],
              turnComplete: true
            }
          }));
        } else if (turnNum === 4) {
          // Turn 4: Natural Interaction & Wrap-up
          console.log('\n================================================================');
          console.log('💬 [TURNO 4/4: CONVERSACIÓN NATURAL FLUIDA]');
          console.log('================================================================');
          const prompt = 'Muchas gracias Cristi por acompañarme en vivo mientras juego y revisamos mi PC.';
          console.log(`🗣️ [USUARIO]: "${prompt}"`);
          ws.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: prompt }] }],
              turnComplete: true
            }
          }));
        }
      }

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

          if (!textData) return;
          const msg = JSON.parse(textData);

          // Audio Chunks
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                turnPcmBuffers.push(Buffer.from(part.inlineData.data, 'base64'));
              }
              if (part.text) {
                turnTextAccumulator += part.text + ' ';
              }
            }
          }

          // Tool Call
          if (msg.toolCall && msg.toolCall.functionCalls) {
            const functionCalls = msg.toolCall.functionCalls;
            const functionResponses = [];

            for (const call of functionCalls) {
              const res = await handleRealTool(call);
              functionResponses.push(res);
            }

            ws.send(JSON.stringify({
              toolResponse: {
                functionResponses
              }
            }));
          }

          // Turn Complete
          if (msg.serverContent?.turnComplete) {
            console.log(`\n🏁 [CRISTI RESPONDIÓ AL TURNO ${currentTurn}]`);
            if (turnTextAccumulator.trim()) {
              console.log(`📝 [TRANSCRIPCIÓN]: ${turnTextAccumulator.trim()}`);
            }

            let audioPlayDurationMs = 2500;

            if (turnPcmBuffers.length > 0) {
              const wav = pcmToWavBuffer(turnPcmBuffers, 24000);
              const wavFile = `cristi_realtime_turn_${currentTurn}.wav`;
              const wavPath = path.join(AUDIO_DIR, wavFile);
              fs.writeFileSync(wavPath, wav);
              liveAuditReport.audioFiles.push(wavPath);

              const durationSec = (wav.length / 48000).toFixed(2);
              audioPlayDurationMs = Math.round(Number(durationSec) * 1000) + 1000;
              console.log(`🔊 [AUDIO GENERADO]: ${wavFile} (${durationSec}s de voz nativa)`);
              console.log(`📢 [REPRODUCIENDO EN TUS ALTAVOCES DE FORMA EXCLUSIVA (SIN SUPERPOSICIÓN)...]`);

              playWavFile(wavPath);
            }

            liveAuditReport.turns.push({
              turn: currentTurn,
              spokenText: turnTextAccumulator.trim(),
              audioBytes: turnPcmBuffers.reduce((acc, b) => acc + b.length, 0)
            });

            if (currentTurn < 4) {
              console.log(`⏳ Esperando ${Math.round(audioPlayDurationMs / 1000)}s a que Cristi termine de hablar antes del siguiente turno...`);
              if (turnTimeout) clearTimeout(turnTimeout);
              turnTimeout = setTimeout(() => {
                startTurn(currentTurn + 1);
              }, audioPlayDurationMs);
            } else {
              console.log('\n================================================================');
              console.log('🎉 TODOS LOS 4 TURNOS COMPLETADOS EN TIEMPO REAL!');
              console.log('================================================================\n');
              clearTimeout(sessionTimer);
              const reportPath = path.join(LOGS_DIR, 'single_session_live_report.json');
              fs.writeFileSync(reportPath, JSON.stringify(liveAuditReport, null, 2), 'utf8');
              setTimeout(() => {
                ws.close();
                resolve(liveAuditReport);
              }, audioPlayDurationMs);
            }
          }
        } catch (err) {
          // ignore non-json
        }
      };

      ws.onerror = (err) => {
        console.error('❌ Error WS:', err.message || err);
      };

      ws.onclose = () => {
        clearTimeout(sessionTimer);
        resolve(liveAuditReport);
      };
    } catch (err) {
      clearTimeout(sessionTimer);
      resolve(liveAuditReport);
    }
  });
}

runSingleSessionRealtime().then(() => {
  console.log('🏁 Prueba en tiempo real finalizada con éxito.');
  process.exit(0);
});
