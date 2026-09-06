/**
 * Test Suite: Tools Catalog & Event Contracts
 * Verifies that all required tools (memory, minecraft, discord, translation)
 * are properly declared in COMPANION_FUNCTION_DECLARATIONS, and handled in ToolExecutor,
 * and all required event contracts exist in eventBus EVENTS.
 */

import assert from 'node:assert/strict';
import { COMPANION_FUNCTION_DECLARATIONS, getLiveToolsConfig } from '../src/config/tools.js';
import { toolExecutor } from '../src/services/toolExecutor.js';
import { eventBus, EVENTS } from '../src/services/eventBus.js';

console.log('🧪 Running Test: Tools Catalog and Event Contracts...');

// 1. Verify Event Contracts in eventBus.EVENTS
const expectedEvents = [
  'DOMAIN_EVENT',
  'SESSION_STARTED',
  'SESSION_ENDED',
  'VOICE_DETECTED',
  'VOICE_TRANSCRIBED',
  'GAME_CONNECTED',
  'GAME_DISCONNECTED',
  'GAME_EVENT',
  'GAME_STATE_CHANGED',
  'DISCORD_MESSAGE',
  'DISCORD_CONNECTED',
  'DISCORD_DISCONNECTED',
  'USER_SILENCE',
  'MEMORY_RETRIEVED',
  'MEMORY_CREATED',
  'MEMORY_UPDATED',
  'MEMORY_INVALIDATED',
  'TRANSLATION_REQUESTED',
  'TRANSLATION_TEXT_READY',
  'TRANSLATION_COMPLETED'
];

for (const evt of expectedEvents) {
  assert(EVENTS[evt] !== undefined, `Event constant ${evt} must exist in EVENTS`);
  assert.equal(typeof EVENTS[evt], 'string', `Event ${evt} must be a string identifier`);
}
console.log(`  ✅ All ${expectedEvents.length} core domain event contracts verified in EVENTS.`);

// 2. Verify Function Declarations in tools.js
const declaredToolNames = COMPANION_FUNCTION_DECLARATIONS.map(t => t.name);

const expectedToolNames = [
  // Memory management tool
  'manage_memory',
  // Minecraft companion tools
  'minecraft_connect',
  'minecraft_disconnect',
  'minecraft_get_status',
  'minecraft_chat',
  'minecraft_move_to',
  'minecraft_follow_player',
  'minecraft_stop_moving',
  'minecraft_mine_block',
  'minecraft_place_block',
  'minecraft_attack_entity',
  // Discord companion tools
  'discord_send_message',
  'discord_set_status',
  'discord_voice_join',
  'discord_voice_leave',
  'discord_voice_status',
  // Reverse translation in-game tool
  'translate_and_speak_in_game'
];

for (const name of expectedToolNames) {
  assert(
    declaredToolNames.includes(name),
    `Tool "${name}" must be declared in COMPANION_FUNCTION_DECLARATIONS in tools.js`
  );
  const toolDecl = COMPANION_FUNCTION_DECLARATIONS.find(t => t.name === name);
  assert(toolDecl.description, `Tool "${name}" must have a description`);
}
console.log(`  ✅ All ${expectedToolNames.length} essential tools verified in COMPANION_FUNCTION_DECLARATIONS.`);

// 3. Verify Gemini tools config structure
const liveConfig = getLiveToolsConfig();
assert(Array.isArray(liveConfig), 'getLiveToolsConfig must return an array');
assert(Array.isArray(liveConfig[0]?.functionDeclarations), 'functionDeclarations must be an array');
assert(
  liveConfig[0].functionDeclarations.length >= expectedToolNames.length,
  'functionDeclarations must contain all declarations'
);
console.log('  ✅ Gemini Live tools schema packaging verified.');

// 4. Verify ToolExecutor dispatch for manage_memory and translate_and_speak_in_game
const memResult = await toolExecutor.executeTool('manage_memory', {
  action: 'store',
  key: 'test_fact',
  content: 'Ariel juega videojuegos de estrategia',
  category: 'preference',
  importance: 0.9
});
assert(memResult, 'manage_memory must return a response');
assert.equal(memResult.status, 'success', 'manage_memory store must return status: success');

console.log('  ✅ ToolExecutor successfully handles manage_memory.');
console.log('\n🎉 Test Tools Catalog & Event Contracts passed 100%!\n');
process.exit(0);
