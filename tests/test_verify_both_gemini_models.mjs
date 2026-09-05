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

const apiKey = getApiKey();
if (!apiKey) {
  console.error('ERROR: No se encontró VITE_GEMINI_API_KEY');
  process.exit(1);
}

const screenFile = path.resolve('tests/artifacts/live_verification/test_real_screen.jpg');
const screenB64 = fs.existsSync(screenFile) ? fs.readFileSync(screenFile).toString('base64') : '';

const MODELS_TO_TEST = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-3.1-flash-live-preview'
];

async function testModel(modelId) {
  console.log(`\n================================================================`);
  console.log(`🧪 PROBANDO MODELO: ${modelId}`);
  console.log(`================================================================`);

  const host = 'generativelanguage.googleapis.com';
  // Try v1alpha Bidi endpoint
  const url = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    let ws;
    let completed = false;
    let turnCount = 0;
    let heardAudio = false;
    let recognizedContent = '';

    const cleanup = (success, reason = '') => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch (_) {}
      resolve({ modelId, success, reason, heardAudio, recognizedContent });
    };

    const timer = setTimeout(() => {
      cleanup(false, 'Timeout alcanzado (30s)');
    }, 30000);

    try {
      ws = new WebSocket(url);
    } catch (err) {
      return cleanup(false, `Error inicializando WebSocket: ${err.message}`);
    }

    ws.onopen = () => {
      console.log(`   ✅ WebSocket abierto para ${modelId}`);
      // Send setup
      const setup = {
        setup: {
          model: `models/${modelId}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede'
                }
              }
            },
            temperature: 0.4
          },
          systemInstruction: {
            parts: [{ text: 'Eres Cristi, una asistente virtual en español. Di "Hola Ariel" y confirma qué ves en la imagen adjunta de forma muy breve y dulce.' }]
          }
        }
      };
      ws.send(JSON.stringify(setup));
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

        if (msg.setupComplete) {
          console.log(`   ✅ Setup completado exitosamente por Google AI Studio para ${modelId}`);
          
          // Send a turn with attached real screen image and prompt
          const parts = [];
          if (screenB64) {
            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: screenB64
              }
            });
          }
          parts.push({ text: 'Cristi, salúdame y descríbeme en una frase corta lo que estás viendo.' });

          ws.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts }],
              turnComplete: true
            }
          }));
          return;
        }

        if (msg.serverContent?.outputTranscription?.text) {
          const trans = msg.serverContent.outputTranscription.text.trim();
          if (trans) {
            console.log(`   🗣️ [TRANSCRIPCIÓN]: "${trans}"`);
            recognizedContent += ' ' + trans;
          }
        }

        if (msg.serverContent?.modelTurn?.parts) {
          for (const p of msg.serverContent.modelTurn.parts) {
            if (p.inlineData?.data) {
              heardAudio = true;
            }
            if (p.text) {
              const clean = p.text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
              if (clean) {
                console.log(`   📝 [TEXTO]: "${clean}"`);
                recognizedContent += ' ' + clean;
              }
            }
          }
        }

        if (msg.serverContent?.turnComplete) {
          console.log(`   ✅ Turno finalizado para ${modelId}`);
          cleanup(true, 'Respuesta recibida correctamente');
        }
      } catch (err) {
        console.error('Error procesando mensaje:', err);
      }
    };

    ws.onerror = (err) => {
      cleanup(false, `Error en WebSocket: ${err.message || err}`);
    };

    ws.onclose = (evt) => {
      if (!completed) {
        cleanup(false, `WebSocket cerrado con código ${evt.code}: ${evt.reason || 'Sin razón'}`);
      }
    };
  });
}

async function main() {
  const results = [];
  for (const m of MODELS_TO_TEST) {
    const res = await testModel(m);
    results.push(res);
  }

  console.log('\n================================================================');
  console.log('📊 REPORTE DE COMPATIBILIDAD DE MODELOS GEMINI LIVE');
  console.log('================================================================');
  for (const r of results) {
    console.log(`- Modelo: ${r.modelId}`);
    console.log(`  Estado: ${r.success ? '✅ OPERATIVO' : '❌ FALLÓ'}`);
    console.log(`  Audio Generado: ${r.heardAudio ? 'Sí' : 'No'}`);
    console.log(`  Detalle: ${r.reason}`);
    console.log(`  Muestra: "${r.recognizedContent.trim().substring(0, 150)}..."`);
    console.log('----------------------------------------------------------------');
  }
}

main();
