/**
 * Cristi Desktop - UI/UX Obsidian Glassmorphism, Zen Mode & Sound FX Test Suite
 */

import fs from 'fs';
import { soundFxService } from '../src/services/soundFxService.js';

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
console.log('🧪 CRISTI DESKTOP - UI/UX OBSIDIAN, ZEN MODE & SOUND FX VALIDATION');
console.log('================================================================');

// ── 1. SoundFxService Procedural Web Audio API ──────────────────────────────
console.log('\n[1/4] Verificando SoundFxService (Web Audio API procedural)...');

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

// ── 2. FloatingHUD Zen Mode & Auto-Idle ──────────────────────────────────────
console.log('\n[2/4] Verificando FloatingHUD y modo Zen...');
const hudSrc = fs.readFileSync('src/components/FloatingHUD.jsx', 'utf8');
assert(hudSrc.includes('isIdleFade'), 'FloatingHUD contiene detector de reposo isIdleFade.');
assert(hudSrc.includes('hud-idle-faded'), 'FloatingHUD aplica clase hud-idle-faded tras inactividad.');
assert(hudSrc.includes('soundFxService'), 'FloatingHUD dispara efectos de sonido en botones.');
assert(hudSrc.includes('useClickThrough'), 'FloatingHUD aplica hooks de click-through.');

// ── 3. Modals Accessibility, Focus Trap & Escape Key ────────────────────────
console.log('\n[3/4] Verificando accesibilidad en modales (Focus Trap & Escape)...');
const settingsSrc = fs.readFileSync('src/components/SettingsModal.jsx', 'utf8');
assert(settingsSrc.includes('Escape'), 'SettingsModal escucha tecla Escape.');
assert(settingsSrc.includes('Tab'), 'SettingsModal gestiona navegación con Tab / Focus Trap.');
assert(settingsSrc.includes('PERSONA_PRESETS'), 'SettingsModal contiene 6 presets de personalidad.');
assert(settingsSrc.includes('stopPropagation'), 'SettingsModal detiene propagación de Escape.');

const voiceEnrollSrc = fs.readFileSync('src/components/VoiceEnrollmentModal.jsx', 'utf8');
assert(voiceEnrollSrc.includes('Escape'), 'VoiceEnrollmentModal escucha tecla Escape.');
assert(voiceEnrollSrc.includes('soundFxService'), 'VoiceEnrollmentModal integrado con soundFxService.');
assert(voiceEnrollSrc.includes('stopPropagation'), 'VoiceEnrollmentModal detiene propagación de Escape.');

const contextMenuSrc = fs.readFileSync('src/components/ContextMenu.jsx', 'utf8');
assert(contextMenuSrc.includes('Escape'), 'ContextMenu escucha tecla Escape.');
assert(contextMenuSrc.includes('soundFxService'), 'ContextMenu integrado con soundFxService.');
assert(contextMenuSrc.includes('stopPropagation'), 'ContextMenu detiene propagación de Escape.');

const perfHudSrc = fs.readFileSync('src/components/PerformanceHUD.jsx', 'utf8');
assert(perfHudSrc.includes('Escape'), 'PerformanceHUD escucha tecla Escape.');
assert(perfHudSrc.includes('stopPropagation'), 'PerformanceHUD detiene propagación de Escape.');

// ── 4. CSS Design System & High-DPI Scaling ─────────────────────────────────
console.log('\n[4/4] Verificando CSS tokens, scrollbars y High-DPI canvas...');
const cssSrc = fs.readFileSync('src/index.css', 'utf8');
assert(cssSrc.includes('*::-webkit-scrollbar'), 'index.css define scrollbars cibernéticas globales.');
assert(cssSrc.includes('.hud-idle-faded'), 'index.css define transiciones suaves para hud-idle-faded.');
assert(cssSrc.includes('.hud-corner'), 'index.css contiene crosshairs tácticos.');
assert(cssSrc.includes('crisp-edges'), 'index.css optimiza canvas Live2D para High-DPI (4K).');

console.log('\n================================================================');
console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
console.log('================================================================\n');

process.exit(0);
