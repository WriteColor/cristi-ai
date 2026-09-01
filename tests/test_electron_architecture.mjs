/**
 * Cristi Desktop - Comprehensive Electron Architecture Verification Test
 * Verifies all contracts, IPC bridges, hooks, components, and package integrity.
 */

import fs from 'fs';

console.log('================================================================');
console.log('🧪 CRISTI DESKTOP - VERIFICACIÓN DE ARQUITECTURA ELECTRON (MATE)');
console.log('================================================================\n');

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

// 1. Check Electron main process
console.log('[1/7] Verificando electron/main.cjs...');
const mainContent = fs.readFileSync('electron/main.cjs', 'utf8');
assert(mainContent.includes('transparent: true'), 'Ventana configurada como transparente');
assert(mainContent.includes('frame: false'), 'Ventana frameless (sin bordes ni título)');
assert(mainContent.includes("setIgnoreMouseEvents(true, { forward: true })"), 'Click-through inicial con forward:true (Desktop Mate)');
assert(mainContent.includes("ipcMain.on('set-ignore-mouse-events'"), 'IPC handler para set-ignore-mouse-events');
assert(mainContent.includes("ipcMain.on('set-always-on-top'"), 'IPC handler para always-on-top');
assert(mainContent.includes("ipcMain.handle('exec-command'"), 'IPC handler para ejecución nativa de comandos');
assert(mainContent.includes("ipcMain.handle('read-file'"), 'IPC handler para lectura de archivos');
assert(mainContent.includes("ipcMain.handle('write-file'"), 'IPC handler para escritura de archivos');
assert(mainContent.includes("tray = new Tray("), 'System tray nativo de Electron configurado');
assert(mainContent.includes("createSettingsWindow"), 'Función createSettingsWindow configurada en main.cjs');
assert(mainContent.includes("open-settings-window"), 'IPC handler open-settings-window configurado');
assert(mainContent.includes("save-app-config"), 'IPC handler save-app-config configurado');

// 2. Check Electron preload script
console.log('\n[2/7] Verificando electron/preload.cjs...');
const preloadContent = fs.readFileSync('electron/preload.cjs', 'utf8');
assert(preloadContent.includes("contextBridge.exposeInMainWorld('electronAPI'"), 'Context bridge expone electronAPI de forma segura');
assert(preloadContent.includes('setIgnoreMouseEvents:'), 'Método setIgnoreMouseEvents expuesto');
assert(preloadContent.includes('setAlwaysOnTop:'), 'Método setAlwaysOnTop expuesto');
assert(preloadContent.includes('execCommand:'), 'Método execCommand expuesto');
assert(preloadContent.includes('openSettingsWindow:'), 'Método openSettingsWindow expuesto');
assert(preloadContent.includes('onConfigUpdated:'), 'Método onConfigUpdated expuesto');

// 3. Check Renderer ElectronBridge
console.log('\n[3/7] Verificando src/services/desktop/ElectronBridge.js...');
const bridgeContent = fs.readFileSync('src/services/desktop/ElectronBridge.js', 'utf8');
assert(bridgeContent.includes('export const electronBridge = {'), 'Objeto electronBridge exportado');
assert(bridgeContent.includes('setIgnoreMouseEvents(ignore, options = {})'), 'Wrapper setIgnoreMouseEvents con fallback seguro');
assert(bridgeContent.includes('execCommand(command'), 'Wrapper execCommand con soporte de opciones');
assert(bridgeContent.includes('openPath(targetPath)'), 'Wrapper openPath para apertura directa de archivos/carpetas');
assert(bridgeContent.includes('captureScreenNative(region'), 'Wrapper captureScreenNative para visión multimodal');
assert(bridgeContent.includes('onShortcutEvent(channel, callback)'), 'Wrapper onShortcutEvent para atajos globales');
assert(bridgeContent.includes('openSettingsWindow()'), 'Wrapper openSettingsWindow para ventana independiente');
assert(bridgeContent.includes('onConfigUpdated(callback)'), 'Wrapper onConfigUpdated para sincronización en caliente');

// 4. Check useClickThrough hook
console.log('\n[4/7] Verificando src/hooks/useClickThrough.js...');
const hookContent = fs.readFileSync('src/hooks/useClickThrough.js', 'utf8');
assert(hookContent.includes('electronBridge.setIgnoreMouseEvents(false)'), 'mouseenter desactiva click-through para permitir interacción');
assert(hookContent.includes('electronBridge.setIgnoreMouseEvents(true, { forward: true })'), 'mouseleave reactiva click-through con forward:true');
assert(hookContent.includes('onMouseEnter: enableInteraction'), 'Handler onMouseEnter expuesto en interactiveProps');
assert(hookContent.includes('onMouseLeave: disableInteraction'), 'Handler onMouseLeave expuesto en interactiveProps');

// 5. Check Interactive Components have useClickThrough
console.log('\n[5/7] Verificando integración de useClickThrough en componentes...');
const interactiveComponents = [
  'Live2DCanvas.jsx',
  'FloatingHUD.jsx',
  'ContextMenu.jsx',
  'SettingsModal.jsx',
  'VoiceEnrollmentModal.jsx',
  'CameraPreview.jsx',
  'SpeakerDiagnosticsHUD.jsx',
  'ToastContainer.jsx',
  'DesktopWidgets.jsx',
  'ScreenRegionPicker.jsx'
];

interactiveComponents.forEach(file => {
  const content = fs.readFileSync(`src/components/${file}`, 'utf8');
  assert(content.includes('useClickThrough'), `${file} utiliza useClickThrough`);
  assert(content.includes('interactiveProps'), `${file} aplica interactiveProps`);
});

// 6. Check Cleanliness & No Neutralino leftovers
console.log('\n[6/7] Verificando eliminación completa de Neutralino y código viejo...');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(!pkg.dependencies?.['@neutralinojs/lib'], 'package.json: sin @neutralinojs/lib');
assert(!pkg.devDependencies?.['@neutralinojs/neu'], 'package.json: sin @neutralinojs/neu');
assert(pkg.main === 'electron/main.cjs', 'package.json: main apunta a electron/main.cjs');
assert(pkg.scripts?.['app:dev']?.includes('electron'), 'package.json: app:dev configurado con electron');
assert(pkg.scripts?.['app:build']?.includes('electron-builder'), 'package.json: app:build configurado con electron-builder');

const oldFiles = [
  'neutralino.config.json',
  'neutralinojs.log',
  'src-native',
  'scripts/build-native.cjs',
  'scripts/dev-desktop.cjs',
  'scripts/run-desktop.cjs',
  'bin',
  'resources/js',
  '.tmp'
];
oldFiles.forEach(f => {
  assert(!fs.existsSync(f), `Archivo/Directorio eliminado correctamente: ${f}`);
});

// 7. Check Build Assets & Documentation
console.log('\n[7/7] Verificando bundle de producción y documentación...');
if (!fs.existsSync('dist/index.html')) {
  try {
    execSync('pnpm run build', { stdio: 'ignore' });
  } catch (_) {}
}
assert(fs.existsSync('dist/index.html'), 'dist/index.html existe');
const htmlContent = fs.readFileSync('dist/index.html', 'utf8');
assert(htmlContent.includes('./assets/'), 'dist/index.html usa rutas relativas (base: ./)');

assert(fs.existsSync('dist/settings.html'), 'dist/settings.html (Multi-Window Control Panel) existe');
const settingsHtmlContent = fs.readFileSync('dist/settings.html', 'utf8');
assert(settingsHtmlContent.includes('./assets/'), 'dist/settings.html usa rutas relativas (base: ./)');

const readme = fs.readFileSync('README.md', 'utf8');
assert(readme.includes('Electron'), 'README.md actualizado con arquitectura Electron');
assert(readme.includes('pnpm run app:dev'), 'README.md documenta comando app:dev');

const arch = fs.readFileSync('docs/ARCHITECTURE.md', 'utf8');
assert(arch.includes('Electron Native Desktop Shell'), 'docs/ARCHITECTURE.md actualizado');

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passedChecks}/${totalChecks} VERIFICACIONES EXITOSAS (${Math.round(passedChecks/totalChecks*100)}%)`);
console.log('================================================================\n');

if (passedChecks === totalChecks) {
  process.exit(0);
} else {
  process.exit(1);
}
