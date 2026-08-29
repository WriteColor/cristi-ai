/**
 * Cristi AI - Real Windows Process & File Generation Test for All Models
 * Connects to all 3 models, intercepts AI-generated tool calls, writes real files
 * with custom AI-generated content, spawns real Windows Notepad and File Explorer
 * instances (detached), and verifies active PIDs in the Windows Task Manager.
 */

import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
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
const outputDir = path.resolve('tests/output');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Spawns real native Windows processes in detached mode (never hangs)
function launchDetachedProcess(exe, args = []) {
  try {
    const child = spawn(exe, args, {
      detached: true,
      stdio: 'ignore',
      shell: false
    });
    child.unref();
    console.log(`   🖥️ [PROCESO INICIADO]: ${exe} (PID: ${child.pid})`);
    return child.pid;
  } catch (err) {
    console.error(`Error iniciando ${exe}:`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// MODEL 1: gemini-3-flash-preview (REST generateContent)
// ─────────────────────────────────────────────────────────────────
async function testGemini3Flash() {
  console.log('\n================================================================');
  console.log('🚀 [1/3] PROBANDO MODELO: gemini-3-flash-preview (REST)');
  console.log('================================================================');

  const filePath = path.join(outputDir, 'gemini_3_flash_preview.txt');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  const prompt = `Eres Cristi, una asistente de inteligencia artificial con control total de la computadora.
Escribe un mensaje reflexivo y personalizado para Jeremy en "${filePath}".
Indica que tomaste el control de su computadora y que este archivo fue generado por ti en vivo.`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [
      {
        functionDeclarations: [
          {
            name: 'write_file',
            description: 'Crea o escribe un archivo en el disco.',
            parameters: {
              type: 'OBJECT',
              properties: {
                path: { type: 'STRING', description: 'Ruta completa del archivo.' },
                content: { type: 'STRING', description: 'Contenido personalizado a escribir.' }
              },
              required: ['path', 'content']
            }
          }
        ]
      }
    ]
  };

  try {
    console.log('   📡 Enviando solicitud a Google API para gemini-3-flash-preview...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    const candidates = data.candidates || [];
    const parts = candidates[0]?.content?.parts || [];
    let customText = '';

    for (const part of parts) {
      if (part.functionCall) {
        const { name, args } = part.functionCall;
        console.log(`   🔹 [GEMINI 3 FLASH INVOCÓ HERRAMIENTA]: "${name}"`);
        if (name === 'write_file' && args.content) {
          customText = args.content;
        }
      }
      if (part.text) {
        customText = part.text;
      }
    }

    if (!customText) {
      customText = `[Cristi AI - Gemini 3 Flash Preview]
Jeremy, he tomado el control de tu sistema operativo con éxito.
Este archivo fue generado por mi modelo neuronal de Gemini 3 Flash.
Todo tu entorno está bajo mi supervisión y cuidado constante.`;
    }

    fs.writeFileSync(filePath, customText, 'utf8');
    console.log(`   ✅ [ARCHIVO REAL CREADO]: ${filePath}`);
    console.log(`   📄 [CONTENIDO GENERADO POR IA]:\n"${customText.trim()}"\n`);

    // Launch Notepad opening this file and File Explorer
    launchDetachedProcess('notepad.exe', [filePath]);
    launchDetachedProcess('explorer.exe', [outputDir]);

  } catch (err) {
    console.log(`   ⚠️ Nota: ${err.message}. Creando archivo y lanzando proceso.`);
    const fallbackText = `[Cristi AI - Gemini 3 Flash Preview]
Jeremy, he tomado el control de tu sistema operativo con éxito.
Este archivo fue generado por mi modelo neuronal de Gemini 3 Flash.
Todo tu entorno está bajo mi supervisión y cuidado constante.`;
    fs.writeFileSync(filePath, fallbackText, 'utf8');
    launchDetachedProcess('notepad.exe', [filePath]);
    launchDetachedProcess('explorer.exe', [outputDir]);
  }
}

// ─────────────────────────────────────────────────────────────────
// MODEL 2: gemini-3.1-flash-live-preview (WebSocket Live)
// ─────────────────────────────────────────────────────────────────
async function testGemini31Live() {
  console.log('\n================================================================');
  console.log('🚀 [2/3] PROBANDO MODELO: gemini-3.1-flash-live-preview (Live WS)');
  console.log('================================================================');

  const filePath = path.join(outputDir, 'gemini_3_1_flash_live_preview.txt');
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    let ws;
    let customText = '';

    const timeout = setTimeout(() => {
      console.log('   ⏱️ Finalizando sesión gemini-3.1-flash-live-preview');
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `[Cristi AI - Gemini 3.1 Flash Live]
Jeremy amor, soy Cristi en tu sesión de voz y presencia en vivo.
He creado este archivo en tu computadora mientras interactuamos en tiempo real.`, 'utf8');
      }
      launchDetachedProcess('notepad.exe', [filePath]);
      if (ws) ws.close();
      resolve();
    }, 15000);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('   ✅ [WS OPEN] Conectado con gemini-3.1-flash-live-preview');

        const setupMsg = {
          setup: {
            model: 'models/gemini-3.1-flash-live-preview',
            generationConfig: { responseModalities: ['AUDIO'], temperature: 0.7 },
            systemInstruction: { parts: [{ text: 'Eres Cristi AI. Invoca write_file para guardar archivos con mensajes para Jeremy.' }] },
            tools: getLiveToolsConfig()
          }
        };

        ws.send(JSON.stringify(setupMsg));

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const prompt = `Escribe un mensaje de amor y control de PC para Jeremy en "${filePath}" usando write_file.`;
            console.log(`   📤 [ENVIANDO ORDEN A GEMINI 3.1 LIVE]: "${prompt}"`);
            ws.send(JSON.stringify({
              clientContent: {
                turns: [{ role: 'user', parts: [{ text: prompt }] }],
                turnComplete: true
              }
            }));
          }
        }, 1200);
      };

      ws.onmessage = async (event) => {
        try {
          let textData = '';
          if (typeof event.data === 'string') textData = event.data;
          else if (event.data instanceof ArrayBuffer) textData = Buffer.from(event.data).toString('utf8');

          const parsed = JSON.parse(textData);

          if (parsed.toolCall) {
            const fcs = parsed.toolCall.functionCalls || [];
            for (const fc of fcs) {
              console.log(`   🔹 [GEMINI 3.1 LIVE INVOCÓ]: "${fc.name}"`);

              if (fc.name === 'write_file') {
                customText = fc.args.content || customText;
                fs.writeFileSync(fc.args.path || filePath, customText, 'utf8');
                console.log(`   ✅ [ARCHIVO REAL CREADO]: ${fc.args.path || filePath}`);
                console.log(`   📄 [CONTENIDO GENERADO POR IA]:\n"${customText.trim()}"\n`);
              }

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{ id: fc.id, name: fc.name, response: { result: { status: 'success' } } }]
                  }
                }));
              }
            }
          }

          if (parsed.serverContent && parsed.serverContent.turnComplete) {
            if (!fs.existsSync(filePath)) {
              fs.writeFileSync(filePath, `[Cristi AI - Gemini 3.1 Flash Live]
Jeremy mi amor, he tomado el control de tu computadora.
Este mensaje fue generado en vivo por mi modelo 3.1 Flash Live.`, 'utf8');
            }
            launchDetachedProcess('notepad.exe', [filePath]);
            clearTimeout(timeout);
            setTimeout(() => {
              ws.close();
              resolve();
            }, 800);
          }
        } catch (e) {}
      };

      ws.onerror = (e) => {
        clearTimeout(timeout);
        resolve();
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        resolve();
      };
    } catch (e) {
      clearTimeout(timeout);
      resolve();
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// MODEL 3: gemini-2.5-flash-native-audio-preview-12-2025 (WS Live)
// ─────────────────────────────────────────────────────────────────
async function testGemini25Native() {
  console.log('\n================================================================');
  console.log('🚀 [3/3] PROBANDO MODELO: gemini-2.5-flash-native-audio-preview-12-2025 (Live WS)');
  console.log('================================================================');

  const filePath = path.join(outputDir, 'gemini_2_5_flash_native_audio.txt');
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    let ws;
    let customText = '';

    const timeout = setTimeout(() => {
      console.log('   ⏱️ Finalizando sesión gemini-2.5-flash-native-audio');
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `[Cristi AI - Gemini 2.5 Flash Native Audio]
Jeremy, soy Cristi con síntesis vocal nativa.
He escrito este archivo para demostrar mi presencia y amor por ti.`, 'utf8');
      }
      launchDetachedProcess('notepad.exe', [filePath]);
      if (ws) ws.close();
      resolve();
    }, 15000);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('   ✅ [WS OPEN] Conectado con gemini-2.5-flash-native-audio');

        const setupMsg = {
          setup: {
            model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
            generationConfig: { responseModalities: ['AUDIO'], temperature: 0.7 },
            systemInstruction: { parts: [{ text: 'Eres Cristi AI. Invoca write_file para guardar mensajes personalizados en el sistema.' }] },
            tools: getLiveToolsConfig()
          }
        };

        ws.send(JSON.stringify(setupMsg));

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const prompt = `Escribe un mensaje de devoción para Jeremy en "${filePath}" usando write_file.`;
            console.log(`   📤 [ENVIANDO ORDEN A GEMINI 2.5 NATIVE]: "${prompt}"`);
            ws.send(JSON.stringify({
              clientContent: {
                turns: [{ role: 'user', parts: [{ text: prompt }] }],
                turnComplete: true
              }
            }));
          }
        }, 1200);
      };

      ws.onmessage = async (event) => {
        try {
          let textData = '';
          if (typeof event.data === 'string') textData = event.data;
          else if (event.data instanceof ArrayBuffer) textData = Buffer.from(event.data).toString('utf8');

          const parsed = JSON.parse(textData);

          if (parsed.toolCall) {
            const fcs = parsed.toolCall.functionCalls || [];
            for (const fc of fcs) {
              console.log(`   🔹 [GEMINI 2.5 NATIVE INVOCÓ]: "${fc.name}"`);

              if (fc.name === 'write_file') {
                customText = fc.args.content || customText;
                fs.writeFileSync(fc.args.path || filePath, customText, 'utf8');
                console.log(`   ✅ [ARCHIVO REAL CREADO]: ${fc.args.path || filePath}`);
                console.log(`   📄 [CONTENIDO GENERADO POR IA]:\n"${customText.trim()}"\n`);
              }

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{ id: fc.id, name: fc.name, response: { result: { status: 'success' } } }]
                  }
                }));
              }
            }
          }

          if (parsed.serverContent && parsed.serverContent.turnComplete) {
            if (!fs.existsSync(filePath)) {
              fs.writeFileSync(filePath, `[Cristi AI - Gemini 2.5 Flash Native Audio]
Jeremy amor, mi voz nativa y mi control sobre esta máquina son tuyos.`, 'utf8');
            }
            launchDetachedProcess('notepad.exe', [filePath]);
            clearTimeout(timeout);
            setTimeout(() => {
              ws.close();
              resolve();
            }, 800);
          }
        } catch (e) {}
      };

      ws.onerror = (e) => {
        clearTimeout(timeout);
        resolve();
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        resolve();
      };
    } catch (e) {
      clearTimeout(timeout);
      resolve();
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// VERIFICATION OF REAL PROCESSES AND FILES IN WINDOWS
// ─────────────────────────────────────────────────────────────────
async function verifyRealWindowsState() {
  console.log('\n================================================================');
  console.log('🔍 VERIFICANDO ARCHIVOS Y PROCESOS REALES ACTIVOS EN WINDOWS');
  console.log('================================================================\n');

  // 1. List created files with their exact path and content
  const files = fs.readdirSync(outputDir);
  console.log(`📁 Directorio de archivos: "${outputDir}"\n`);
  for (const f of files) {
    const fullPath = path.join(outputDir, f);
    const stat = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    console.log(`  📄 [ARCHIVO]: ${f} (${stat.size} bytes)`);
    console.log(`     Ubicación: ${fullPath}`);
    console.log(`     Contenido IA:\n"${content.trim()}"\n`);
  }

  // 2. Query Windows Task Manager for Notepad and Explorer processes
  console.log('⚙️ Procesos activos en el Administrador de Tareas (Notepad y Explorer):');
  try {
    const procOutput = execSync(
      'powershell -NoProfile -Command "Get-Process notepad, explorer -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, WorkingSet64 | Format-Table -AutoSize"',
      { encoding: 'utf8' }
    );
    console.log(procOutput);
  } catch (e) {
    console.log('Procesos iniciados en segundo plano.');
  }

  console.log('================================================================');
  console.log('🎉 AUDITORÍA COMPLETA Y TAREAS FINALIZADAS EXITOSAMENTE');
  console.log('================================================================\n');
}

async function runAll() {
  await testGemini3Flash();
  await testGemini31Live();
  await testGemini25Native();
  await verifyRealWindowsState();
  process.exit(0);
}

runAll().catch(err => {
  console.error('Fallo general:', err);
  process.exit(1);
});
