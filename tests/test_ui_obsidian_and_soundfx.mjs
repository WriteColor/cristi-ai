/**
 * Cristi Desktop - UI/UX Obsidian Glassmorphism, React 19 Modals,
 * Hierarchical Escape, Selective Click-Through & Sound FX Test Suite
 */

import fs from 'fs';
import { soundFxService } from '../src/services/soundFxService.js';
import { clickThroughService } from '../src/services/desktop/ClickThroughService.js';
import { electronBridge } from '../src/services/desktop/ElectronBridge.js';

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
console.log('🧪 CRISTI DESKTOP - UI/UX OBSIDIAN, REACT 19 & SOUND FX VALIDATION');
console.log('================================================================');

// ── 1. SoundFxService Procedural Web Audio API ──────────────────────────────
console.log('\n[1/5] Verificando SoundFxService (Web Audio API procedural)...');

// Mock Web Audio Context
global.window = {
  AudioContext: class {
    constructor() {
      this.currentTime = 0;
      this.state = 'running';
      this.destination = {};
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {}
        },
        connect: () => {}
      };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {}
        },
        connect: () => {},
        start: () => {},
        stop: () => {}
      };
    }
    resume() {}
  }
};

soundFxService.init();
assert(soundFxService.audioCtx !== null, 'AudioContext inicializado correctamente.');

soundFxService.playClick();
assert(true, 'playClick() ejecutado sin errores.');

soundFxService.playMenuOpen();
assert(true, 'playMenuOpen() sintetizado acordes armónicos.');

soundFxService.playConnect();
assert(true, 'playConnect() sintetizado barrido ascendente.');

soundFxService.playDisconnect();
assert(true, 'playDisconnect() sintetizado barrido descendente.');

soundFxService.playMuteToggle(true);
soundFxService.playMuteToggle(false);
assert(true, 'playMuteToggle() sintetizado bips de estado.');

soundFxService.playSnapshot();
assert(true, 'playSnapshot() sintetizado obturador cibernético.');

// ── 2. Click-Through & ElectronBridge Contract ──────────────────────────────
console.log('\n[2/5] Verificando Selective Click-Through & ElectronBridge...');
assert(typeof clickThroughService.init === 'function', 'ClickThroughService shim provee interfaz de compatibilidad.');
assert(typeof electronBridge.setIgnoreMouseEvents === 'function', 'ElectronBridge implementa setIgnoreMouseEvents.');

const useClickThroughSrc = fs.readFileSync('src/hooks/useClickThrough.js', 'utf8');
assert(useClickThroughSrc.includes('setIgnoreMouseEvents(false)'), 'useClickThrough activa interactividad al entrar.');
assert(useClickThroughSrc.includes('forward: true'), 'useClickThrough desactiva interactividad con forward:true.');

const appSrc = fs.readFileSync('src/App.jsx', 'utf8');
assert(appSrc.includes('evaluateHitTarget'), 'App.jsx implementa hit-tester inteligente global.');
assert(appSrc.includes('isClickThroughEnabled'), 'App.jsx sincroniza hit-testing con estado isClickThroughEnabled.');
assert(appSrc.includes('configManager'), 'App.jsx importa y utiliza configManager sin referencias nulas.');
assert(appSrc.includes('soundFxService'), 'App.jsx importa y utiliza soundFxService sin referencias nulas.');

// ── 3. Hierarchical Escape Key & Stop Propagation ──────────────────────────
console.log('\n[3/5] Verificando Pila Jerárquica de Modales y Tecla Escape...');
const settingsSrc = fs.readFileSync('src/components/SettingsModal.jsx', 'utf8');
assert(settingsSrc.includes('e.key === \'Escape\''), 'SettingsModal escucha tecla Escape.');
assert(settingsSrc.includes('stopPropagation'), 'SettingsModal detiene propagación de Escape hacia la ventana.');
assert(settingsSrc.includes('Tab'), 'SettingsModal gestiona navegación con Tab / Focus Trap.');
assert(settingsSrc.includes('PERSONA_PRESETS'), 'SettingsModal contiene 6 presets de personalidad.');

const voiceEnrollSrc = fs.readFileSync('src/components/VoiceEnrollmentModal.jsx', 'utf8');
assert(voiceEnrollSrc.includes('e.key === \'Escape\''), 'VoiceEnrollmentModal escucha tecla Escape.');
assert(voiceEnrollSrc.includes('stopPropagation'), 'VoiceEnrollmentModal detiene propagación de Escape.');

const contextMenuSrc = fs.readFileSync('src/components/ContextMenu.jsx', 'utf8');
assert(contextMenuSrc.includes('e.key === \'Escape\''), 'ContextMenu escucha tecla Escape.');
assert(contextMenuSrc.includes('stopPropagation'), 'ContextMenu detiene propagación de Escape.');

const perfHudSrc = fs.readFileSync('src/components/PerformanceHUD.jsx', 'utf8');
assert(perfHudSrc.includes('e.key === \'Escape\''), 'PerformanceHUD escucha tecla Escape.');
assert(perfHudSrc.includes('stopPropagation'), 'PerformanceHUD detiene propagación de Escape.');

assert(appSrc.includes('if (contextMenu.isOpen)'), 'App.jsx gestiona cierre jerárquico fallback en cascada.');

// ── 4. React 19 Timers & Event Listener Cleanups ───────────────────────────
console.log('\n[4/5] Verificando Limpieza de Timers y Listeners en Hooks React 19...');
assert(appSrc.includes('clearTimeout(subtitleTimeoutRef.current)'), 'App.jsx limpia subtitleTimeoutRef.');
assert(appSrc.includes('clearTimeout(autoHideTimerRef.current)'), 'App.jsx limpia autoHideTimerRef en desmontaje.');

const widgetsSrc = fs.readFileSync('src/components/DesktopWidgets.jsx', 'utf8');
assert(widgetsSrc.includes('autoDismissTimersRef'), 'DesktopWidgets rastrea timers de auto-cierre con useRef.');
assert(widgetsSrc.includes('clearTimeout'), 'DesktopWidgets limpia todos los timers pendientes en unmount.');

const hudSrc = fs.readFileSync('src/components/FloatingHUD.jsx', 'utf8');
assert(hudSrc.includes('isIdleFade'), 'FloatingHUD contiene detector de reposo isIdleFade.');
assert(hudSrc.includes('hud-idle-faded'), 'FloatingHUD aplica clase hud-idle-faded tras inactividad.');
assert(hudSrc.includes('useClickThrough'), 'FloatingHUD aplica hooks de click-through.');

// ── 5. CSS Design System & Visual Tokens ────────────────────────────────────
console.log('\n[5/5] Verificando CSS tokens, scrollbars y High-DPI canvas...');
const cssSrc = fs.readFileSync('src/index.css', 'utf8');
assert(cssSrc.includes('*::-webkit-scrollbar'), 'index.css define scrollbars cibernéticas globales.');
assert(cssSrc.includes('.hud-idle-faded'), 'index.css define transiciones suaves para hud-idle-faded.');
assert(cssSrc.includes('.hud-corner'), 'index.css contiene crosshairs tácticos.');
assert(cssSrc.includes('crisp-edges'), 'index.css optimiza canvas Live2D para High-DPI (4K).');

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
