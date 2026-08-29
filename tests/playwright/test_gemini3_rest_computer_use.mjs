/**
 * Test Gemini 3 Flash Preview via official generateContent REST endpoint
 * Verifies how gemini-3-flash-preview generates function calls for computer control in REST mode.
 */

import fs from 'fs';
import path from 'path';

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

async function testGemini3FlashRest() {
  console.log('--- PROBANDO GEMINI 3 FLASH PREVIEW VÍA REST GENERATECONTENT ---');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Por favor ejecuta un comando en PowerShell para listar los procesos de mi PC en C:\\React-Nextjs-Projects\\Cristi AI.' }
        ]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: 'execute_system_command',
            description: 'Ejecuta un comando en el sistema operativo Windows.',
            parameters: {
              type: 'OBJECT',
              properties: {
                command: { type: 'STRING', description: 'Comando a ejecutar.' }
              },
              required: ['command']
            }
          },
          {
            name: 'computer_action',
            description: 'Acción de control de computadora (clic, captura, tipeo).',
            parameters: {
              type: 'OBJECT',
              properties: {
                action: { type: 'STRING', enum: ['mouse_click', 'take_screenshot', 'type_text'] }
              },
              required: ['action']
            }
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Respuesta de Google para gemini-3-flash-preview (REST):');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error al consultar gemini-3-flash-preview:', err);
  }
}

testGemini3FlashRest();
