import test from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_PERSONA_PROMPT } from '../src/config/models';
import { ConfigManager } from '../src/infrastructure/config/ConfigManager';

test('Master System Prompt is compact, direct, and has fluid seductive cadence for all voices', () => {
  const words = SYSTEM_PERSONA_PROMPT.trim().split(/\s+/).length;
  assert(words < 550, `Master prompt must be compact (< 550 words), got: ${words}`);
  assert(words > 200, `Master prompt must contain all key capabilities (> 200 words), got: ${words}`);

  // Voice & Cadence matching cristi-live-call-audit.wav
  assert(SYSTEM_PERSONA_PROMPT.includes('conversacional natural, fluido y continuo'), 'Must include fluid cadence');
  assert(SYSTEM_PERSONA_PROMPT.includes('Evita pausas entre palabras'), 'Must avoid intra-word pauses');
  assert(SYSTEM_PERSONA_PROMPT.includes('Español Neutro Internacional'), 'Must use neutral Spanish');
  assert(SYSTEM_PERSONA_PROMPT.includes('Finales de Frase Limpios'), 'Must require clean endings');
  assert(SYSTEM_PERSONA_PROMPT.includes('gemidos, suspiros'), 'Must prohibit vocal sighs/groans');

  // Strict bans
  assert(SYSTEM_PERSONA_PROMPT.includes('Cero Emojis'), 'Must prohibit emojis');
  assert(SYSTEM_PERSONA_PROMPT.includes('Cero Etiquetas y Metadatos'), 'Must prohibit tags/metadata');

  // Precise operational duties
  assert(SYSTEM_PERSONA_PROMPT.includes('Copiloto de Programación'), 'Must include programming copilot');
  assert(SYSTEM_PERSONA_PROMPT.includes('Compañera de Estudio'), 'Must include study partner');
  assert(SYSTEM_PERSONA_PROMPT.includes('Hype Girl Gamer'), 'Must include gaming hype');
  assert(SYSTEM_PERSONA_PROMPT.includes('Automatización de PC, Spotify y Navegador'), 'Must include PC control');
  assert(SYSTEM_PERSONA_PROMPT.includes('Proactividad Total y Memoria Persistente'), 'Must include proactivity');
  assert(SYSTEM_PERSONA_PROMPT.includes('manage_memory'), 'Must reference manage_memory');
  assert(SYSTEM_PERSONA_PROMPT.includes('Visión Óptica Real'), 'Must include optical vision grounding');
});

test('ConfigManager persistently saves custom user prompts and sanitizes legacy presets', () => {
  const cm = new ConfigManager();

  // 1. Default initialization
  const emptySanitized = cm.sanitizeConfig({});
  assert.equal(emptySanitized.systemPrompt, SYSTEM_PERSONA_PROMPT);

  // 2. Custom user prompt persists intact
  const custom = 'Eres Cristi en mi versión totalmente personalizada.';
  const customSanitized = cm.sanitizeConfig({ systemPrompt: custom });
  assert.equal(customSanitized.systemPrompt, custom);

  // 3. Outdated legacy verbose/slow prompt automatically migrates to new Master Prompt
  const legacySlow = 'Eres Cristi... Rasgos Fundamentales de tu Identidad y Convivencia:... Cadencia Seductora, Pausada y Coqueta: Hablas un poquito más lento...';
  const migratedSlow = cm.sanitizeConfig({ systemPrompt: legacySlow });
  assert.equal(migratedSlow.systemPrompt, SYSTEM_PERSONA_PROMPT);
});
