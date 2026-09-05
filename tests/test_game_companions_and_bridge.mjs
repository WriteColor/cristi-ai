/**
 * Cristi AI - Game & Chat Companions (AIRI Engine) Diagnostic Suite
 * Validates Minecraft Companion Service, Discord Companion Service, and Gemini Live Tools Catalog.
 */

import { MinecraftCompanionService } from '../src/services/gameIntegration/MinecraftCompanionService.js';
import { DiscordCompanionService } from '../src/services/discord/DiscordCompanionService.js';
import { COMPANION_FUNCTION_DECLARATIONS } from '../src/config/tools.js';

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
console.log('🧪 TEST: GAME & CHAT COMPANIONS (AIRI) DIAGNOSTIC SUITE');
console.log('================================================================');

async function runCompanionTests() {
  // ── 1. Minecraft Companion Service ──────────────────────────────────────────
  console.log('\n[1/3] Verificando Minecraft Companion Service...');
  const mcService = new MinecraftCompanionService();

  assert(mcService.status === 'disconnected', 'Estado inicial es "disconnected".');
  assert(mcService.config.username === 'Cristi_AI', 'Nombre de usuario predeterminado es "Cristi_AI".');

  mcService.saveConfig({ host: '127.0.0.1', port: 25565, username: 'Cristi_Companion' });
  assert(mcService.config.host === '127.0.0.1', 'Configuración de host actualizada correctamente.');
  assert(mcService.config.username === 'Cristi_Companion', 'Configuración de username persistida.');

  const botState = mcService.getBotState();
  assert(botState.health !== undefined && botState.food !== undefined, 'Estructura de telemetría de vida y hambre presente.');
  assert(botState.position && typeof botState.position.x === 'number', 'Estructura vectorial de posición {x, y, z} presente.');
  const connection = await mcService.connect({ host: '127.0.0.1', port: 25565 });
  assert(connection.sessionId && connection.sessionId.startsWith('minecraft_'), 'Cada conexión de Minecraft recibe una sesión estable para aislar reconexiones.');
  await mcService.disconnect();
  assert(mcService.sessionId === null, 'Cerrar Minecraft libera la identidad de sesión.');

  // ── 2. Discord Companion Service ────────────────────────────────────────────
  console.log('\n[2/3] Verificando Discord Companion Service...');
  const discordService = new DiscordCompanionService();

  assert(discordService.status === 'disconnected', 'Estado inicial es "disconnected".');
  
  // Validation: connecting without token should fail gracefully
  const failRes = await discordService.connect('');
  assert(failRes.status === 'error', 'Conexión sin token rechazada preventivamente con error claro.');

  discordService.saveConfig({ botToken: 'mock_test_token_123', statusMessage: 'En línea con Jeremy' });
  assert(discordService.config.botToken === 'mock_test_token_123', 'Token de bot guardado.');
  assert(discordService.config.statusMessage === 'En línea con Jeremy', 'Mensaje de actividad guardado.');

  // ── 3. Gemini Live Function Declarations for Companions ─────────────────────
  console.log('\n[3/3] Verificando Catálogo de Herramientas Gemini Live (AIRI Tools)...');
  const toolNames = COMPANION_FUNCTION_DECLARATIONS.map(t => t.name);

  // Minecraft Tools
  assert(toolNames.includes('minecraft_connect'), 'Herramienta "minecraft_connect" expuesta a Gemini Live.');
  assert(toolNames.includes('minecraft_chat'), 'Herramienta "minecraft_chat" expuesta a Gemini Live.');
  assert(toolNames.includes('minecraft_move_to'), 'Herramienta "minecraft_move_to" expuesta a Gemini Live.');
  assert(toolNames.includes('minecraft_follow_player'), 'Herramienta "minecraft_follow_player" expuesta a Gemini Live.');
  assert(toolNames.includes('minecraft_mine_block'), 'Herramienta "minecraft_mine_block" expuesta a Gemini Live.');
  assert(toolNames.includes('minecraft_place_block'), 'Herramienta "minecraft_place_block" expuesta a Gemini Live.');
  assert(toolNames.includes('minecraft_attack_entity'), 'Herramienta "minecraft_attack_entity" expuesta a Gemini Live.');

  // Discord Tools
  assert(toolNames.includes('discord_send_message'), 'Herramienta "discord_send_message" expuesta a Gemini Live.');
  assert(toolNames.includes('discord_set_status'), 'Herramienta "discord_set_status" expuesta a Gemini Live.');
  assert(toolNames.includes('discord_voice_join'), 'Herramienta "discord_voice_join" expuesta a Gemini Live.');
  const discordVoiceJoin = COMPANION_FUNCTION_DECLARATIONS.find(t => t.name === 'discord_voice_join');
  assert(discordVoiceJoin.parameters.properties.output_route.enum.includes('discord_voice'), 'discord_voice_join permite devolver la traducción al canal de voz.');
  assert(toolNames.includes('discord_voice_leave'), 'Herramienta "discord_voice_leave" expuesta a Gemini Live.');
  assert(toolNames.includes('discord_voice_status'), 'Herramienta "discord_voice_status" expuesta a Gemini Live.');

  // Hybrid Model Switching
  assert(toolNames.includes('switch_avatar_model'), 'Herramienta "switch_avatar_model" expuesta a Gemini Live.');

  console.log('\n================================================================');
  console.log(`📊 RESULTADO: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
  console.log('================================================================\n');

  process.exit(0);
}

runCompanionTests().catch(err => {
  console.error('Fatal Companion Test Error:', err);
  process.exit(1);
});
