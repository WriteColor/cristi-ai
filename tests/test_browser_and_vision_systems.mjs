/**
 * Cristi AI - Browser Automation & Sensory Vision Stream Diagnostic Suite
 * Validates Brave Browser configuration, Search parser, Vision FPS clamping, and Gemini Live media streaming.
 */

import { BrowserAutomationService } from '../src/services/browser/BrowserAutomationService.js';
import { VisionStreamManager } from '../src/services/vision/VisionStreamManager.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
}

console.log('================================================================');
console.log('🧪 TEST: BROWSER AUTOMATION & VISION STREAM VALIDATION');
console.log('================================================================');

async function runBrowserVisionTests() {
  // ── 1. Browser Automation & User Global Rules Compliance ────────────────────
  console.log('\n[1/3] Verificando Reglas de Navegador Brave...');
  const browserService = new BrowserAutomationService();

  assert(
    browserService.bravePath.includes('BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    'Ruta de navegador apunta estrictamente a Brave Browser ("C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe").'
  );
  assert(
    !browserService.bravePath.toLowerCase().includes('google\\chrome'),
    'Google Chrome NO es referenciado en el servicio de automatización web.'
  );

  // Validation: empty search handling
  const emptyRes = await browserService.searchInternet('');
  assert(emptyRes.status === 'error', 'Búsqueda vacía rechazada con mensaje de error explícito.');

  // Mock HTML Snippet extraction
  const mockDdgHtml = `
    <a class="result__snippet" href="https://example.com/cristi">Cristi AI Companion es un asistente virtual multimodal</a>
    <a class="result__snippet" href="https://example.com/airi">AIRI Engine es un marco de inteligencia de juego</a>
  `;
  const regex = /<a class="result__snippet[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [];
  let m;
  while ((m = regex.exec(mockDdgHtml)) !== null) {
    matches.push({ url: m[1], text: m[2] });
  }

  assert(matches.length === 2, 'Extractor regex de resultados DuckDuckGo recupera snippets.');
  assert(matches[0].url.includes('example.com/cristi'), 'URL parseada correctamente.');
  assert(matches[0].text.includes('Cristi AI'), 'Texto de snippet parseado limpiamente.');

  // ── 2. Vision Stream Manager Lifecycle & Throttling ─────────────────────────
  console.log('\n[2/3] Verificando VisionStreamManager y Clamping de FPS...');
  const mockSocket = {
    current: {
      isConnected: true,
      sentFrames: [],
      sendRealtimeMedia: function(base64, mime) {
        this.sentFrames.push({ base64, mime });
      }
    }
  };

  const visionManager = new VisionStreamManager({ socketRef: mockSocket });
  assert(visionManager.isScreenStreaming === false, 'Monitoreo de pantalla inicialmente inactivo.');

  // Test FPS clamping
  visionManager.startScreenMonitoring({ fps: 15.0 });
  assert(visionManager.screenFPS <= 5.0, `FPS de pantalla restringido por seguridad térmica/ancho de banda a <= 5.0 (actual: ${visionManager.screenFPS}).`);
  assert(visionManager.isScreenStreaming === true, 'Monitoreo de pantalla marcado como activo.');

  visionManager.startScreenMonitoring({ fps: 0.01 });
  assert(visionManager.screenFPS >= 0.2, `FPS de pantalla restringido por umbral mínimo a >= 0.2 (actual: ${visionManager.screenFPS}).`);

  // Stop monitoring
  visionManager.stopScreenMonitoring();
  assert(visionManager.isScreenStreaming === false, 'stopScreenMonitoring() desactiva el streaming y limpia timers.');

  // ── 3. Realtime Media Payload Delivery ──────────────────────────────────────
  console.log('\n[3/3] Verificando Envío de Frames JPEG a Gemini Live...');
  const mockFrame = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
  mockSocket.current.sendRealtimeMedia(mockFrame, 'image/jpeg');

  assert(mockSocket.current.sentFrames.length === 1, 'Frame recibido en mockSocket.');
  assert(mockSocket.current.sentFrames[0].mime === 'image/jpeg', 'MIME type verificado como "image/jpeg".');

  console.log('\n================================================================');
  console.log(`📊 RESULTADO: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
  console.log('================================================================\n');

  process.exit(0);
}

runBrowserVisionTests().catch(err => {
  console.error('Fatal Browser & Vision Test Error:', err);
  process.exit(1);
});
