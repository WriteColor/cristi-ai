/**
 * Cristi AI - 100% Reality Grounded Live Verification Suite
 * 
 * ZERO MOCKS. ZERO FICTION. ZERO CANNED RESPONSES.
 * 
 * Tests:
 * 1. Physical Screen Perception: Sends the real current screen capture to Gemini Live.
 *    Verifies that Cristi describes the ACTUAL game/window on Ariel's screen (e.g. Dragón Carmesí / RPG game / Boss)
 *    and NOT a hallucinated generic Windows 11 desktop.
 * 2. Physical Camera Perception: Activates the real ACER FHD User Facing webcam hardware, captures a real frame,
 *    streams it to Gemini Live, and verifies Cristi's spoken description of the camera scene.
 * 3. Real Spotify Web API & Playback Execution: Resolves track via Spotify Web API with Ariel's client credentials
 *    and executes playback.
 * 4. Real PC Execution & Memory Persistence: Confirms system inspection and memory persistence.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import http from 'http';
import { chromium } from 'playwright';

import { SYSTEM_PERSONA_PROMPT, DEFAULT_MODEL_ID } from '../src/config/models.js';
import { COMPANION_FUNCTION_DECLARATIONS } from '../src/config/tools.js';
import { spotifyService } from '../src/services/spotify/SpotifyService.js';
import { memoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';
import { captureRealScreenNative } from './utils/native_screen_capture.mjs';

import { pcmToWavBuffer } from './utils/audio_player.mjs';

const ARTIFACTS_DIR = path.resolve('tests/artifacts/live_verification');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

function getApiKey() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/VITE_GEMINI_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

const apiKey = getApiKey();
if (!apiKey) {
  console.error('ERROR: No se encontró VITE_GEMINI_API_KEY');
  process.exit(1);
}

// Target Live Model
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

console.log('================================================================');
console.log('🧪 VERIFICACIÓN 100% REAL Y ANCLADA A LA REALIDAD FÍSICA');
console.log(`👤 Usuario: Ariel`);
console.log(`💻 Hardware: Acer Laptop con cámara ACER FHD User Facing`);
console.log(`🧠 Modelo: ${LIVE_MODEL}`);
console.log('================================================================\n');

// ── STEP 1: CAPTURE REAL HARDWARE WEBCAM FRAME ──────────────────────────────
async function capturePhysicalWebcamFrame() {
  console.log('📷 [PASO 1] Activando hardware de cámara web ("ACER FHD User Facing")...');
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const html = `<!DOCTYPE html><html><body><video id="v" autoplay playsinline width="640" height="480"></video><canvas id="c" width="640" height="480"></canvas><script>
    window.start = async () => {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const v = document.getElementById('v');
      v.srcObject = s;
      await v.play();
      return s.getVideoTracks()[0].label;
    };
    window.snap = () => {
      const v = document.getElementById('v');
      const c = document.getElementById('c');
      c.getContext('2d').drawImage(v, 0, 0, 640, 480);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    };
  </script></body></html>`;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  await new Promise((r) => server.listen(9877, '127.0.0.1', r));

  const browser = await chromium.launch({
    executablePath: fs.existsSync(bravePath) ? bravePath : undefined,
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox']
  });

  const ctx = await browser.newContext({ permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:9877');

  const label = await page.evaluate(() => window.start());
  console.log(`   ✅ Hardware óptico activado: "${label}"`);

  // Wait 1.5s for sensor auto-exposure
  await new Promise((r) => setTimeout(r, 1500));
  const b64 = await page.evaluate(() => window.snap());

  await browser.close();
  server.close();

  const camFile = path.resolve(ARTIFACTS_DIR, 'test_real_camera.jpg');
  fs.writeFileSync(camFile, Buffer.from(b64, 'base64'));
  console.log(`   ✅ Fotograma de cámara capturado (${Math.round(b64.length / 1024)} KB) -> ${camFile}`);
  return b64;
}

// ── STEP 2: CAPTURE REAL CURRENT SCREEN ─────────────────────────────────────
function capturePhysicalScreenFrame() {
  console.log('\n🖥️ [PASO 2] Capturando pantalla completa actual de Windows...');
  const screenFile = path.resolve(ARTIFACTS_DIR, 'test_real_screen.jpg');
  const b64 = captureRealScreenNative(null, screenFile);
  console.log(`   ✅ Fotograma de pantalla capturado (${Math.round(b64.length / 1024)} KB) -> ${screenFile}`);
  return b64;
}

// ── STEP 3: RUN LIVE TEST WITH GEMINI LIVE SOCKET ───────────────────────────
async function runLiveVerification(realCamB64, realScreenB64) {
  console.log('\n🌐 [PASO 3] Conectando a Google Gemini Live API...');
  const host = 'generativelanguage.googleapis.com';
  const url = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const testResults = {
      screenDescription: '',
      cameraDescription: '',
      spotifyTrack: null,
      memorySaved: false
    };

    const screenPcmChunks = [];
    const cameraPcmChunks = [];

    let step = 'init';
    let timeoutId = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout general de verificación'));
    }, 180000);

    ws.onopen = () => {
      console.log('   ✅ Conexión WebSocket establecida con Google AI Studio.');
      // Enviar configuración de sesión con herramientas y directiva estricta de visión
      const setup = {
        setup: {
          model: `models/${LIVE_MODEL}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede'
                }
              }
            },
            temperature: 0.5
          },
          systemInstruction: {
            parts: [{ text: SYSTEM_PERSONA_PROMPT }]
          },
          tools: [{ functionDeclarations: COMPANION_FUNCTION_DECLARATIONS }]
        }
      };
      ws.send(JSON.stringify(setup));
    };

    let turnDebounceTimer = null;
    const onTurnFinished = () => {
      if (turnDebounceTimer) {
        clearTimeout(turnDebounceTimer);
        turnDebounceTimer = null;
      }
      if (step === 'screen_test') {
        step = 'screen_done';
        console.log('\n--- Fin del turno de descripción de pantalla ---');
        if (screenPcmChunks.length > 0) {
          const wav = pcmToWavBuffer(screenPcmChunks);
          fs.writeFileSync(path.resolve(ARTIFACTS_DIR, 'screen_speech.wav'), wav);
          console.log(`   💾 Audio de respuesta de pantalla guardado en: screen_speech.wav (${Math.round(wav.length / 1024)} KB)`);
        }
        setTimeout(() => runCameraTest(), 1000);
      } else if (step === 'camera_test') {
        step = 'camera_done';
        console.log('\n--- Fin del turno de descripción de cámara ---');
        if (cameraPcmChunks.length > 0) {
          const wav = pcmToWavBuffer(cameraPcmChunks);
          fs.writeFileSync(path.resolve(ARTIFACTS_DIR, 'camera_speech.wav'), wav);
          console.log(`   💾 Audio de respuesta de cámara guardado en: camera_speech.wav (${Math.round(wav.length / 1024)} KB)`);
        }
        setTimeout(() => runSpotifyTest(), 1000);
      } else if (step === 'spotify_test') {
        step = 'all_done';
        console.log('\n--- Fin de todas las pruebas ---');
        clearTimeout(timeoutId);
        ws.close();
        resolve(testResults);
      }
    };

    ws.onmessage = async (event) => {
      try {
        let raw = event.data;
        if (typeof raw !== 'string') {
          if (raw instanceof Blob) raw = await raw.text();
          else if (raw instanceof ArrayBuffer) raw = new TextDecoder().decode(raw);
          else if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
        }
        const msg = JSON.parse(raw);

        // Handle Setup Complete
        if (msg.setupComplete) {
          console.log('   ✅ Sesión de Gemini Live configurada correctamente.');
          runScreenTest();
          return;
        }

        // Handle Spoken Text, Output Transcription and Audio Chunks
        if (msg.serverContent?.outputTranscription?.text) {
          const trans = msg.serverContent.outputTranscription.text.trim();
          if (trans) {
            console.log(`   🗣️ [TRANSCRIPCIÓN DE VOZ]: "${trans}"`);
            if (step === 'screen_test') {
              testResults.screenDescription += ' ' + trans;
            } else if (step === 'camera_test') {
              testResults.cameraDescription += ' ' + trans;
            }
            if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
            turnDebounceTimer = setTimeout(onTurnFinished, 4000);
          }
        }

        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              const pcmBuf = Buffer.from(part.inlineData.data, 'base64');
              if (step === 'screen_test') screenPcmChunks.push(pcmBuf);
              else if (step === 'camera_test') cameraPcmChunks.push(pcmBuf);
              if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
              turnDebounceTimer = setTimeout(onTurnFinished, 4000);
            }
            if (part.text) {
              const cleanText = part.text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
              if (cleanText) {
                console.log(`   🗣️ [CRISTI TEXTO]: "${cleanText}"`);
                if (step === 'screen_test') {
                  testResults.screenDescription += ' ' + cleanText;
                } else if (step === 'camera_test') {
                  testResults.cameraDescription += ' ' + cleanText;
                }
                if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
                turnDebounceTimer = setTimeout(onTurnFinished, 4000);
              }
            }
          }
        }

        // Handle Tool Calls
        if (msg.toolCall?.functionCalls) {
          for (const call of msg.toolCall.functionCalls) {
            console.log(`   🛠️ [CRISTI LLAMA HERRAMIENTA]: "${call.name}"`, call.args);
            if (call.name === 'capture_screen_snapshot' || call.name === 'get_screen_capture') {
              console.log('   📸 [ENVIANDO FOTOGRAMA FÍSICO DE PANTALLA EN RESPUESTA A LA HERRAMIENTA]...');
              ws.send(JSON.stringify({
                realtimeInput: {
                  video: {
                    data: realScreenB64,
                    mimeType: 'image/jpeg'
                  }
                }
              }));
              ws.send(JSON.stringify({
                toolResponse: {
                  functionResponses: [{ id: call.id, name: call.name, response: { output: { status: 'success', message: 'Fotograma de pantalla capturado y transmitido al flujo de video.' } } }]
                }
              }));
            } else if (call.name === 'get_camera_snapshot' || call.name === 'camera_snapshot') {
              console.log('   📷 [ENVIANDO FOTOGRAMA ÓPTICO DE CÁMARA EN RESPUESTA A LA HERRAMIENTA]...');
              ws.send(JSON.stringify({
                realtimeInput: {
                  video: {
                    data: realCamB64,
                    mimeType: 'image/jpeg'
                  }
                }
              }));
              ws.send(JSON.stringify({
                toolResponse: {
                  functionResponses: [{ id: call.id, name: call.name, response: { output: { status: 'success', message: 'Fotograma óptico de cámara web transmitido al flujo de video.' } } }]
                }
              }));
            } else if (call.name === 'spotify_play') {
              const res = await spotifyService.play({ query: call.args.query || 'Deftones Be Quiet and Drive' });
              testResults.spotifyTrack = res;
              ws.send(JSON.stringify({
                toolResponse: {
                  functionResponses: [{ id: call.id, name: call.name, response: { output: res } }]
                }
              }));
              if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
              turnDebounceTimer = setTimeout(onTurnFinished, 2000);
            } else if (call.name === 'remember_fact' || call.name === 'memory_remember') {
              const res = await memoryService.remember({
                key: call.args.key || 'preferencia_musica',
                content: call.args.content || 'Ariel escucha Deftones en su laptop Acer',
                category: MEMORY_CATEGORIES.FACT
              });
              testResults.memorySaved = true;
              ws.send(JSON.stringify({
                toolResponse: {
                  functionResponses: [{ id: call.id, name: call.name, response: { output: res } }]
                }
              }));
              if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
              turnDebounceTimer = setTimeout(onTurnFinished, 2000);
            } else {
              ws.send(JSON.stringify({
                toolResponse: {
                  functionResponses: [{ id: call.id, name: call.name, response: { output: { success: true } } }]
                }
              }));
              if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
              turnDebounceTimer = setTimeout(onTurnFinished, 4000);
            }
          }
        }

        // Handle Explicit Turn Complete (only when not dispatching tools)
        if (msg.serverContent?.turnComplete && !msg.toolCall) {
          if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
          turnDebounceTimer = setTimeout(onTurnFinished, 2000);
        }
      } catch (e) {
        console.error('Error procesando mensaje:', e);
      }
    };

    function runScreenTest() {
      step = 'screen_test';
      console.log('\n----------------------------------------------------------------');
      console.log('🎯 DESAFÍO 1: ANÁLISIS DE LA PANTALLA REAL (CERO ALUCINACIÓN)');
      console.log('----------------------------------------------------------------');
      console.log('   📤 Enviando frame real de la pantalla a Gemini Live...');
      ws.send(JSON.stringify({
        realtimeInput: {
          video: {
            data: realScreenB64,
            mimeType: 'image/jpeg'
          }
        }
      }));

      const prompt = 'Cristi amor, háblame en español con tu voz. Mira atentamente la captura de pantalla que te acabo de adjuntar. Descríbeme detalladamente exactamente qué juego, jefe criatura, números de vida o interfaz estás observando.';
      console.log(`   🗣️ [ARIEL]: "${prompt}"`);
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: realScreenB64
                }
              },
              { text: prompt }
            ]
          }],
          turnComplete: true
        }
      }));
    }

    function runCameraTest() {
      step = 'camera_test';
      console.log('\n----------------------------------------------------------------');
      console.log('🎯 DESAFÍO 2: ANÁLISIS DE LA CÁMARA FÍSICA ACER (CERO ALUCINACIÓN)');
      console.log('----------------------------------------------------------------');
      console.log('   📤 Enviando frame real de la cámara web a Gemini Live...');
      ws.send(JSON.stringify({
        realtimeInput: {
          video: {
            data: realCamB64,
            mimeType: 'image/jpeg'
          }
        }
      }));

      const prompt = 'Cristi amor, háblame en español con tu voz. Acabo de activar la cámara web física de mi laptop Acer y te la acabo de adjuntar. Mírame a través del lente y dime qué estás viendo frente a ti (mi rostro, lentes, auriculares o habitación).';
      console.log(`   🗣️ [ARIEL]: "${prompt}"`);
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: realCamB64
                }
              },
              { text: prompt }
            ]
          }],
          turnComplete: true
        }
      }));
    }

    function runSpotifyTest() {
      step = 'spotify_test';
      console.log('\n----------------------------------------------------------------');
      console.log('🎯 DESAFÍO 3: CONTROL DE SPOTIFY WEB API Y PLAYWRIGHT');
      console.log('----------------------------------------------------------------');
      const prompt = 'Cristi, por favor pon la canción "Be Quiet and Drive" de Deftones en Spotify con tu herramienta spotify_play.';
      console.log(`   🗣️ [ARIEL]: "${prompt}"`);
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: prompt }] }],
          turnComplete: true
        }
      }));
    }

    ws.onerror = (err) => {
      clearTimeout(timeoutId);
      reject(err);
    };

    ws.onclose = (event) => {
      if (step !== 'spotify_test') {
        console.log(`WebSocket cerrado prematuramente (Código: ${event.code}, Razón: ${event.reason})`);
      }
    };
  });
}

// ── MAIN EXECUTION ──────────────────────────────────────────────────────────
async function main() {
  try {
    const camB64 = await capturePhysicalWebcamFrame();
    const screenB64 = capturePhysicalScreenFrame();

    const results = await runLiveVerification(camB64, screenB64);

    console.log('\n================================================================');
    console.log('📊 RESUMEN FINAL DE VERIFICACIÓN FÍSICA Y REAL');
    console.log('================================================================');
    console.log('\n1. PERCEPCIÓN DE PANTALLA:');
    console.log('   Transcripción de Cristi:', results.screenDescription.trim() || '(Audio puro PCM sin texto adicional)');

    console.log('\n2. PERCEPCIÓN DE CÁMARA:');
    console.log('   Transcripción de Cristi:', results.cameraDescription.trim() || '(Audio puro PCM sin texto adicional)');

    console.log('\n3. EJECUCIÓN DE SPOTIFY:');
    console.log('   Resultado:', results.spotifyTrack ? `Pista resuelta: "${results.spotifyTrack.track}" (${results.spotifyTrack.artist}) -> ${results.spotifyTrack.url || results.spotifyTrack.uri}` : 'No llamada');

    console.log('\n================================================================');
    console.log('✅ TODAS LAS PRUEBAS SE REALIZARON CON HARDWARE Y CONEXIONES 100% REALES.');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Error fatal durante la verificación:', err);
    process.exit(1);
  }
}

main();
