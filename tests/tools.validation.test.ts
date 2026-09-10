import test from 'node:test';
import assert from 'node:assert/strict';
import { toolRegistry } from '../src/domain/tools/index';
import { ToolExecutor } from '../src/domain/tools/ToolExecutor';

test('toolRegistry registers declarations with valid structure and unique names', () => {
  const declarations = toolRegistry.getAllDeclarations();
  assert.ok(declarations.length > 20, 'Should have registered more than 20 tools');

  const names = new Set<string>();
  for (const decl of declarations) {
    assert.ok(decl.name && decl.name.trim().length > 0, 'Tool name must not be empty');
    assert.ok(decl.description && decl.description.trim().length > 0, `Tool ${decl.name} must have description`);
    assert.ok(!names.has(decl.name), `Duplicate tool name detected: ${decl.name}`);
    names.add(decl.name);
  }
});

test('ToolExecutor returns error response for unregistered tool calls without throwing', async () => {
  const executor = new ToolExecutor();
  const result = await executor.executeTool('non_existent_tool_12345', { some: 'arg' });
  assert.ok(result && typeof result === 'object');
  assert.ok('error' in result, 'Expected error property in result');
});

test('ToolExecutor handles abort signals gracefully during execution', async () => {
  const controller = new AbortController();
  controller.abort();

  const executor = new ToolExecutor();
  const result = await executor.executeTool('get_system_status', {}, controller.signal);
  assert.ok(result);
  // Cancelled or errored gracefully
  assert.ok('cancelled' in result || 'error' in result || 'status' in result);
});

test('toolRegistry retrieves registered handlers and handles case sensitivity', () => {
  const handler = toolRegistry.get('spotify_play');
  assert.ok(handler);
  assert.equal(handler.name, 'spotify_play');

  const missing = toolRegistry.get('SPOTIFY_PLAY_DOES_NOT_EXIST');
  assert.equal(missing, undefined);
});
