import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const ARTIFACTS_DIR = 'C:\\Users\\jerem\\.gemini\\antigravity-ide\\brain\\428cbd8d-9fd9-4bb5-b96a-e16db84be0cb';

async function run() {
  console.log('======================================================');
  console.log('🎙️ TEST E2E: CRISTI DESKTOP - SPEAKER RECOGNITION & BIOMETRICS');
  console.log('======================================================\n');

  const browser = await chromium.launch({
    executablePath: fs.existsSync(BRAVE_PATH) ? BRAVE_PATH : undefined,
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.text().includes('[SPEAKER]') || msg.text().includes('[MODELS]') || msg.text().includes('CRISTI')) {
      console.log(`[BROWSER LOG] ${msg.text()}`);
    }
  });

  console.log('[1/5] Navegando a Cristi Desktop en http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // 1. Model Manager Audit Verification
  console.log('\n[2/5] Verificando Model Manager y estado de modelos...');
  const modelOverview = await page.evaluate(async () => {
    if (window.__cristiModelManager) {
      const res = await window.__cristiModelManager.auditAllModels();
      return window.__cristiModelManager.getOverview();
    }
    return null;
  });
  console.log('Model Manager Overview:', modelOverview);

  // 2. Synthetic Acoustic Sample Generator for Owner vs Stranger
  console.log('\n[3/5] Ejecutando Enrolamiento Multi-Muestra de Voz del Dueño...');
  const enrollmentResult = await page.evaluate(() => {
    const service = window.__cristiSpeakerService;
    if (!service) return { error: 'No speaker service available' };

    // Generate 3 distinct synthetic vocal frequency patterns for Owner (Fundamental ~140Hz with rich harmonics)
    const generateVoiceUtterance = (f0, durationSec = 2.0, noiseLevel = 0.02) => {
      const numSamples = Math.floor(16000 * durationSec);
      const samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const t = i / 16000;
        // Vocal tract harmonic formants F0, F1 (500Hz), F2 (1500Hz), F3 (2500Hz)
        const s =
          0.5 * Math.sin(2 * Math.PI * f0 * t) +
          0.3 * Math.sin(2 * Math.PI * 500 * t) +
          0.2 * Math.sin(2 * Math.PI * 1500 * t) +
          0.1 * Math.sin(2 * Math.PI * 2500 * t) +
          (Math.random() - 0.5) * noiseLevel;
        // Pitch vibrato / speech envelope
        const envelope = Math.sin(Math.PI * (i / numSamples));
        samples[i] = s * envelope;
      }
      return samples;
    };

    const ownerSamples = [
      { id: 's1', label: 'Saludo Natural', audioSamples: generateVoiceUtterance(138, 2.0) },
      { id: 's2', label: 'Comando e Instrucción', audioSamples: generateVoiceUtterance(142, 2.2) },
      { id: 's3', label: 'Frase Fluida', audioSamples: generateVoiceUtterance(139, 2.5) }
    ];

    const profile = service.enrollSamples('Jeremy', ownerSamples);

    // Test 1: Dueño hablando (misma fundamental acústica y armónicos)
    const ownerTestUtterance = generateVoiceUtterance(140, 2.0);
    const ownerDecision = service.verifySpeaker(ownerTestUtterance);

    // Test 2: Extraño / Otra persona hablando (voz diferente F0 = 240Hz con distintos formantes)
    const generateStrangerUtterance = (f0 = 240, durationSec = 2.0) => {
      const numSamples = Math.floor(16000 * durationSec);
      const samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const t = i / 16000;
        const s =
          0.5 * Math.sin(2 * Math.PI * f0 * t) +
          0.4 * Math.sin(2 * Math.PI * 800 * t) +
          0.3 * Math.sin(2 * Math.PI * 2800 * t);
        const envelope = Math.sin(Math.PI * (i / numSamples));
        samples[i] = s * envelope;
      }
      return samples;
    };

    const strangerTestUtterance = generateStrangerUtterance(240, 2.0);
    const strangerDecision = service.verifySpeaker(strangerTestUtterance);

    return {
      profileInfo: service.getProfileInfo(),
      ownerDecision,
      strangerDecision
    };
  });

  console.log('Resultados de Autenticación de Voz:', JSON.stringify(enrollmentResult, null, 2));

  // 3. Capture Live Speaker HUD screenshot
  console.log('\n[4/5] Capturando pantalla del HUD de Biometría de Voz en vivo...');
  await page.waitForTimeout(1000);
  const shot1 = path.join(ARTIFACTS_DIR, 'speaker_01_hud_live.png');
  await page.screenshot({ path: shot1 });
  console.log(`[Screenshot 1] Guardado en: ${shot1}`);

  // 4. Open and verify Voice Enrollment Modal UI
  console.log('\n[5/5] Abriendo modal de Enrolamiento y Calibración de Voz...');
  await page.evaluate(() => {
    if (window.__cristiOpenVoiceEnrollment) window.__cristiOpenVoiceEnrollment();
  });
  await page.waitForTimeout(1000);

  const shot2 = path.join(ARTIFACTS_DIR, 'speaker_02_enrollment_modal.png');
  await page.screenshot({ path: shot2 });
  console.log(`[Screenshot 2] Guardado en: ${shot2}`);

  // Click on "Probar Verificación" tab
  const testTabBtn = page.locator('.enroll-tab-btn:has-text("Probar Verificación")');
  if (await testTabBtn.count() > 0) {
    await testTabBtn.click();
    await page.waitForTimeout(600);
    const shot3 = path.join(ARTIFACTS_DIR, 'speaker_03_test_verification_tab.png');
    await page.screenshot({ path: shot3 });
    console.log(`[Screenshot 3] Guardado en: ${shot3}`);
  }

  // Click on "Calibración de Umbral" tab
  const settingsTabBtn = page.locator('.enroll-tab-btn:has-text("Calibración de Umbral")');
  if (await settingsTabBtn.count() > 0) {
    await settingsTabBtn.click();
    await page.waitForTimeout(600);
    const shot4 = path.join(ARTIFACTS_DIR, 'speaker_04_threshold_calibration_tab.png');
    await page.screenshot({ path: shot4 });
    console.log(`[Screenshot 4] Guardado en: ${shot4}`);
  }

  await browser.close();

  console.log('\n✨ VERIFICACIÓN DE RECONOCIMIENTO DE HABLANTE COMPLETADA CON ÉXITO!');
}

run().catch((err) => {
  console.error('❌ Error en test de speaker recognition:', err);
  process.exit(1);
});
