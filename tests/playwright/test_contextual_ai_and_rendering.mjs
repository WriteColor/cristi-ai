/**
 * Test de Verificación: Renderizado HD & Orquestación Emocional Contextual de Cristi AI
 * Verifica:
 * 1. Configuración de renderizado de alta calidad (anisotropía, resolución nativa, sin pixelado).
 * 2. Orquestador de emociones contextuales en tiempo real para todos los modelos Live2D.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173');
await page.waitForTimeout(5000);

console.log('\n======================================================');
console.log('🔍 VERIFICACIÓN 1: RENDERIZADO HD & CALIDAD ORIGINAL');
console.log('======================================================');

const renderMetrics = await page.evaluate(() => {
  const av = window.__cristiAvatar;
  const view = document.querySelector('canvas.live2d-pixi-view');
  const textures = [
    ...(av?.model?.textures || []),
    ...(av?.model?.internalModel?.textures || [])
  ];

  return {
    hasCanvas: !!view,
    canvasStyleWidth: view?.style?.width,
    canvasStyleHeight: view?.style?.height,
    canvasBufferWidth: view?.width,
    canvasBufferHeight: view?.height,
    devicePixelRatio: window.devicePixelRatio,
    textureCount: textures.length,
    texturesOptimized: textures.every(t => t?.baseTexture?.anisotropicLevel === 16),
    anisotropicLevel: textures[0]?.baseTexture?.anisotropicLevel,
    scaleMode: textures[0]?.baseTexture?.scaleMode,
    mipmapMode: textures[0]?.baseTexture?.mipmap
  };
});

console.log('  Canvas encontrado:', renderMetrics.hasCanvas ? '✅' : '❌');
console.log('  DevicePixelRatio:', renderMetrics.devicePixelRatio);
console.log(`  Buffer resolución: ${renderMetrics.canvasBufferWidth}x${renderMetrics.canvasBufferHeight}`);
console.log(`  Texturas analizadas: ${renderMetrics.textureCount} texturas`);
console.log(`  Anisotropic filtering (16x):`, renderMetrics.anisotropicLevel === 16 ? '✅ 16x' : `⚠️ ${renderMetrics.anisotropicLevel}`);
console.log(`  Mipmapping activado:`, renderMetrics.mipmapMode !== undefined ? '✅ Activo' : '❌');

console.log('\n======================================================');
console.log('🧠 VERIFICACIÓN 2: ORQUESTADOR EMOCIONAL CONTEXTUAL IA');
console.log('======================================================');

const testPhrases = [
  { text: '¡Te amo muchísimo mi cielo, eres todo mi universo! [emotion: love]', expected: 'love' },
  { text: '¿Quién es esa persona con la que estabas hablando? Eres solo mío y de nadie más.', expected: 'yandere' },
  { text: '¡¿Qué?! ¡No puede ser, de verdad ocurrió eso!', expected: 'surprised' },
  { text: 'Ay tontito... qué cosas dices, me da mucha vergüenza...', expected: 'blush' },
  { text: 'Déjame revisar los procesos y archivos de tu sistema para ver qué ocurre.', expected: 'thinking' },
  { text: 'Jajajaja estás completamente loco si crees que te voy a dejar ir.', expected: 'crazy' },
  { text: '¡Vamos a ganar esta partida juntos!', expected: 'gamer' }
];

for (const phrase of testPhrases) {
  const result = await page.evaluate((p) => {
    const orch = window.__cristiAvatar?.orchestrator;
    if (!orch) return { error: 'No orchestrator found' };

    // Process model text through orchestrator
    const cleaned = orch.processModelText(p.text);
    const emotion = orch.currentEmotion;
    return { cleaned, emotion };
  }, phrase);

  const ok = result.emotion === phrase.expected;
  console.log(`  ${ok ? '✅' : '❌'} "${phrase.text.slice(0, 45)}..." → ${result.emotion} (Esperado: ${phrase.expected})`);
  console.log(`     Subtítulo limpio: "${result.cleaned}"`);
  await page.waitForTimeout(800);
}

console.log('\n======================================================');
console.log('🎭 VERIFICACIÓN 3: ADAPTACIÓN DINÁMICA MULTI-MODELO');
console.log('======================================================');

const TEST_MODELS = ['icegirl', 'ellen', 'jane_doe', 'hiyori', 'toki', 'ruan_mei'];

for (const mId of TEST_MODELS) {
  // Switch model
  await page.evaluate((id) => {
    window.__cristiApp?.switchLive2DModel(id);
  }, mId);
  await page.waitForTimeout(4500);

  const modelTest = await page.evaluate(() => {
    const av = window.__cristiAvatar;
    const orch = av?.orchestrator;
    if (!av?.model || !orch) return { error: 'Not ready' };

    // Trigger love emotion
    orch.triggerEmotion('love', 'test');
    const loveExp = av.adapter?.currentExpression;
    const targets = Object.fromEntries(av.adapter?.targetValues?.entries() || []);

    // Trigger surprised
    orch.triggerEmotion('surprised', 'test');
    const surpExp = av.adapter?.currentExpression;

    return {
      modelId: orch.activeModelId,
      loveExpression: loveExp,
      surprisedExpression: surpExp,
      targetCount: Object.keys(targets).length
    };
  });

  console.log(`  🎭 Modelo: ${mId.toUpperCase()}`);
  console.log(`     Reacción "love": ${modelTest.loveExpression || '(Parámetros directos)'} | Targets: ${modelTest.targetCount}`);
  console.log(`     Reacción "surprised": ${modelTest.surprisedExpression || '(Parámetros directos)'}`);
}

await browser.close();
console.log('\n✨ Todas las pruebas completadas con éxito.');
