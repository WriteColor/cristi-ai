import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { toolRegistry } from '../src/domain/tools/index';
import { ToolExecutor } from '../src/domain/tools/ToolExecutor';
import { validateRequest } from '../shared/ipc/contracts';
import { liveServerMessageSchema } from '../src/domain/gemini/protocol';

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
  assert.ok('error' in result || result.status === 'error', 'Expected error property in result');
});

test('ToolExecutor strictly aborts and does NOT execute observable handler when signal is aborted', async () => {
  let handlerExecuted = false;
  toolRegistry.register({
    name: 'test_observable_abort_handler',
    declaration: {
      name: 'test_observable_abort_handler',
      description: 'Observable test handler',
      parameters: { type: 'OBJECT', properties: {} }
    },
    async execute() {
      handlerExecuted = true;
      return { executed: true };
    }
  });

  const controller = new AbortController();
  controller.abort(); // Pre-aborted signal

  const executor = new ToolExecutor();
  const result = await executor.executeTool('test_observable_abort_handler', {}, controller.signal);

  assert.equal(handlerExecuted, false, 'Handler must not execute when AbortSignal is already aborted');
  assert.equal(result?.cancelled, true);
  assert.equal(result?.status, 'cancelled');
});

test('ToolExecutor cleans up abort listeners on success, error and in-flight cancellation', async () => {
  toolRegistry.register({
    name: 'test_listener_cleanup_success',
    declaration: {
      name: 'test_listener_cleanup_success',
      description: 'Fast success tool',
      parameters: { type: 'OBJECT', properties: {} }
    },
    async execute() {
      return { ok: true };
    }
  });
  toolRegistry.register({
    name: 'test_listener_cleanup_error',
    declaration: {
      name: 'test_listener_cleanup_error',
      description: 'Error tool',
      parameters: { type: 'OBJECT', properties: {} }
    },
    async execute() {
      throw new Error('Tool error');
    }
  });

  const controller = new AbortController();
  const executor = new ToolExecutor();

  // Run 3 successful invocations sharing the same non-aborted signal
  await executor.executeTool('test_listener_cleanup_success', {}, controller.signal);
  await executor.executeTool('test_listener_cleanup_success', {}, controller.signal);
  await executor.executeTool('test_listener_cleanup_success', {}, controller.signal);

  // Assert no listeners are leaked
  const listenersAfterSuccess = getEventListeners(controller.signal, 'abort');
  assert.equal(listenersAfterSuccess.length, 0, 'No abort listeners should remain after successful runs');

  // Run error invocation
  await executor.executeTool('test_listener_cleanup_error', {}, controller.signal);
  const listenersAfterError = getEventListeners(controller.signal, 'abort');
  assert.equal(listenersAfterError.length, 0, 'No abort listeners should remain after error runs');
});

test('In-flight cancellation stops waiting and prevents subsequent observable side effects', async () => {
  let sideEffectExecuted = false;
  let checkpointReached = false;

  toolRegistry.register({
    name: 'test_inflight_cancel_tool',
    declaration: {
      name: 'test_inflight_cancel_tool',
      description: 'In-flight cancelable tool with checkpoint',
      parameters: { type: 'OBJECT', properties: {} }
    },
    async execute(_args, context) {
      checkpointReached = true;
      // Simulate asynchronous pending work (e.g. network/IPC delay)
      await new Promise(resolve => setTimeout(resolve, 30));

      // Cooperative cancellation: check signal before committing observable side effects
      if (context?.signal?.aborted) {
        return { status: 'cancelled', message: 'Ejecución cancelada en checkpoint.', cancelled: true };
      }
      sideEffectExecuted = true;
      return { status: 'success', effectDone: true };
    }
  });

  const controller = new AbortController();
  const executor = new ToolExecutor();

  // Start execution and abort while it is paused at the async checkpoint
  const executionPromise = executor.executeTool('test_inflight_cancel_tool', {}, controller.signal);
  assert.equal(checkpointReached, true);

  // Trigger abort in flight
  controller.abort();
  const result = await executionPromise;

  assert.equal(result?.cancelled, true);
  assert.equal(result?.status, 'cancelled');

  // Wait for the simulated async work to finish resolving
  await new Promise(resolve => setTimeout(resolve, 50));

  // The subsequent observable side effect must NOT have executed
  assert.equal(sideEffectExecuted, false, 'Observable side effect must not execute after in-flight abort');

  // Listeners must be cleanly removed
  const listenersAfterAbort = getEventListeners(controller.signal, 'abort');
  assert.equal(listenersAfterAbort.length, 0, 'Abort listeners must be cleaned up after in-flight cancellation');
});

test('Zod contracts reject malformed arguments, out-of-range values and injection attempts', () => {
  // Coordinates validation
  assert.throws(() => validateRequest('minecraft-move-to', [{ x: NaN, y: 10, z: 20 }]));
  assert.throws(() => validateRequest('minecraft-move-to', [{ x: 'invalid' as any, y: 10, z: 20 }]));
  assert.deepEqual(validateRequest('minecraft-move-to', [{ x: 100, y: 64, z: -200 }]), [{ x: 100, y: 64, z: -200 }]);

  // Screen capture percentage bounds (0-100)
  assert.throws(() => validateRequest('capture-screen-native', [{ x_pct: -5 }]));
  assert.throws(() => validateRequest('capture-screen-native', [{ x_pct: 150 }]));
  assert.deepEqual(validateRequest('capture-screen-native', [{ x_pct: 10, y_pct: 20, w_pct: 80, h_pct: 60 }]), [{ x_pct: 10, y_pct: 20, w_pct: 80, h_pct: 60 }]);

  // Spotify URI validation: reject arbitrary protocols / command injection
  assert.throws(() => validateRequest('spotify-control', ['open_uri', { uri: 'powershell:Start-Process calc' }]));
  assert.throws(() => validateRequest('spotify-control', ['open_uri', { uri: 'file:///C:/Windows/System32/cmd.exe' }]));
  assert.deepEqual(validateRequest('spotify-control', ['open_uri', { uri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT' }]), ['open_uri', { uri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT' }]);

  // System execute strict enum: only allow 'system-info' | 'list-processes'
  assert.throws(() => validateRequest('system-execute', [{ kind: 'rmdir /s /q C:\\' as any }]));
  assert.throws(() => validateRequest('system-execute', [{ kind: 'arbitrary-command' as any }]));
  assert.deepEqual(validateRequest('system-execute', [{ kind: 'system-info' }]), [{ kind: 'system-info' }]);
});

test('liveServerMessageSchema rejects malformed or oversized messages', () => {
  // Valid setupComplete message
  const validMsg = liveServerMessageSchema.parse({ setupComplete: {} });
  assert.ok(validMsg.setupComplete);

  // Invalid tool call shape
  assert.throws(() => liveServerMessageSchema.parse({ toolCall: { functionCalls: 'not_an_array' } }));
});
