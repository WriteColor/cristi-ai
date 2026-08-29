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

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Modelos disponibles en Google AI Studio para esta API Key:');
    if (data.models) {
      for (const m of data.models) {
        console.log(`- ${m.name} | Métodos: ${m.supportedGenerationMethods?.join(', ')}`);
      }
    } else {
      console.log('Respuesta:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error listando modelos:', err);
  }
}

listModels();
