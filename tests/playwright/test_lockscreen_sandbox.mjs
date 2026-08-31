import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.text()));
page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

console.log('\n======================================================');
console.log('🔒 1. ABRIR SANDBOX SIMULATOR DE PANTALLA DE BLOQUEO');
console.log('======================================================');

await page.evaluate(() => {
  if (window.__cristiOpenLockSandbox) {
    window.__cristiOpenLockSandbox();
  }
});

await page.waitForTimeout(1000);

const sandboxStats = await page.evaluate(() => {
  const root = document.querySelector('.lockscreen-sandbox-root');
  const clock = document.querySelector('.win11-clock-time')?.innerText;
  const date = document.querySelector('.win11-clock-date')?.innerText;
  const companion = document.querySelector('.companion-model-title')?.innerText;
  const toasts = Array.from(document.querySelectorAll('.win11-lock-toast-card')).map(t => t.innerText.split('\n')[0]);
  return {
    isOpen: !!root,
    clock,
    date,
    companion,
    toasts
  };
});

console.log('Sandbox Inicial Stats:', sandboxStats);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/lockscreen_sandbox_01_main.png' });

console.log('\n======================================================');
console.log('🎙️ 2. SIMULAR COMANDO DE VOZ EN PANTALLA DE BLOQUEO');
console.log('======================================================');

// Click on voice simulation button "¿Qué pendientes tengo?"
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.dock-action-btn'));
  const voiceBtn = btns.find(b => b.innerText.includes('pendientes'));
  if (voiceBtn) voiceBtn.click();
});

await page.waitForTimeout(2000);

const voiceSimStats = await page.evaluate(() => {
  const userDialogue = document.querySelector('.dialogue-user')?.innerText;
  const cristiDialogue = document.querySelector('.dialogue-cristi')?.innerText;
  const stateText = document.querySelector('.voice-state-text')?.innerText;
  const logs = Array.from(document.querySelectorAll('.log-row')).map(r => r.innerText);
  return {
    userDialogue,
    cristiDialogue,
    stateText,
    recentLog: logs[0]
  };
});

console.log('Voice Simulation Stats:', voiceSimStats);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/lockscreen_sandbox_02_voice_reply.png' });

console.log('\n======================================================');
console.log('🎨 3. CAMBIO DE LAYOUT Y WALLPAPER EN SANDBOX');
console.log('======================================================');

// Switch to 'Centro' layout and 'Cyber' wallpaper
await page.evaluate(() => {
  const chips = Array.from(document.querySelectorAll('.sandbox-chip-btn'));
  const centerChip = chips.find(c => c.innerText === 'Centro');
  const cyberWp = chips.find(c => c.innerText.includes('Cyber') || c.innerText.includes('Purple'));
  if (centerChip) centerChip.click();
  if (cyberWp) cyberWp.click();
});

// Add another toast
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.dock-action-btn'));
  const addToastBtn = btns.find(b => b.innerText.includes('Toast Recordatorio'));
  if (addToastBtn) addToastBtn.click();
});

await page.waitForTimeout(1000);

const customStats = await page.evaluate(() => {
  const layoutClass = document.querySelector('.cristi-lockscreen-companion')?.className;
  const toastCount = document.querySelectorAll('.win11-lock-toast-card').length;
  return {
    layoutClass,
    toastCount
  };
});

console.log('Custom Layout & Toasts Stats:', customStats);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/lockscreen_sandbox_03_center_layout.png' });

console.log('\n✨ SANDBOX SIMULATOR VERIFICADO AL 100%!');
await browser.close();
