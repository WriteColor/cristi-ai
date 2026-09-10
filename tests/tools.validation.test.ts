import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import {
  toolRegistry,
  writeFileHandler,
  manageMemoryHandler,
  spotifyPlayHandler,
  minecraftConnectHandler,
  startDesktopAudioCaptureHandler,
  stopDesktopAudioCaptureHandler,
  desktopAudioCaptureStatusHandler,
  sendGameVoiceTranslationHandler,
  translateAndSpeakInGameHandler,
  mcpAddServerHandler,
  mcpReconnectServerHandler,
  mcpRemoveServerHandler,
  mcpListServersHandler,
  mcpCallToolHandler,
  setReminderHandler,
  setAlarmHandler,
  showTacticalWidgetHandler,
  dismissTacticalWidgetHandler,
  triggerCompanionGestureHandler,
  triggerModelMotionHandler,
  moveAvatarHandler,
  switchAvatarModelHandler,
  captureScreenSnapshotHandler,
  setScreenWatchHandler,
  setScreenRegionHandler,
  analyzeVisualSceneHandler,
  computerActionHandler,
  getCurrentTimeAndDateHandler,
  getWeatherHandler,
  systemDiagnosticsHandler,
  executeSystemCommandHandler,
  listDirectoryHandler,
  getClipboardHandler,
  setClipboardHandler,
  getRunningProcessesHandler,
  killProcessHandler,
  openFileOrFolderHandler,
  openSystemAppOrLinkHandler
} from '../src/domain/tools/index';
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

test('Synchronous abort during handler startup is immediately detected and reported as cancelled', async () => {
  const controller = new AbortController();
  let startupControlledPromiseResolve: () => void = () => {};
  const controlledPromise = new Promise<void>((resolve) => {
    startupControlledPromiseResolve = resolve;
  });

  toolRegistry.register({
    name: 'test_sync_startup_abort_tool',
    declaration: {
      name: 'test_sync_startup_abort_tool',
      description: 'Synchronous abort during startup',
      parameters: { type: 'OBJECT', properties: {} }
    },
    async execute(_args, _context) {
      // Synchronously abort before first await
      controller.abort();
      await controlledPromise;
      return { status: 'success', message: 'unexpected_success' };
    }
  });

  const executor = new ToolExecutor();
  const startTime = Date.now();
  const executionPromise = executor.executeTool('test_sync_startup_abort_tool', {}, controller.signal);

  // Must promptly resolve as cancelled without waiting for controlledPromise
  const result = await executionPromise;
  const elapsed = Date.now() - startTime;

  assert.equal(result?.cancelled, true, 'Result must be marked cancelled');
  assert.equal(result?.status, 'cancelled', 'Status must be cancelled, not success');
  assert.ok(elapsed < 100, `Executor must not stay pending waiting for controlledPromise (elapsed: ${elapsed}ms)`);

  // Release controlled promise
  startupControlledPromiseResolve();

  // Listeners must be cleanly removed
  const listenersAfterAbort = getEventListeners(controller.signal, 'abort');
  assert.equal(listenersAfterAbort.length, 0, 'Abort listeners must be cleaned up after sync startup abort');
});

test('Production tool handlers cooperatively abort before starting side effects when signal is cancelled', async () => {
  const controller = new AbortController();
  controller.abort(); // already cancelled signal

  const writeResult = await writeFileHandler.execute({ path: 'test.txt', content: 'hello' }, { signal: controller.signal });
  assert.equal(writeResult?.cancelled, true);
  assert.equal(writeResult?.status, 'cancelled');

  const memoryResult = await manageMemoryHandler.execute({ action: 'store', key: 'test', content: 'fact' }, { signal: controller.signal });
  assert.equal(memoryResult?.cancelled, true);
  assert.equal(memoryResult?.status, 'cancelled');

  const spotifyResult = await spotifyPlayHandler.execute({ query: 'lofi' }, { signal: controller.signal });
  assert.equal(spotifyResult?.cancelled, true);
  assert.equal(spotifyResult?.status, 'cancelled');

  const mcResult = await minecraftConnectHandler.execute({}, { signal: controller.signal });
  assert.equal(mcResult?.cancelled, true);
  assert.equal(mcResult?.status, 'cancelled');
});

test('Audio tool handlers cooperatively abort before starting side effects when signal is cancelled', async () => {
  const controller = new AbortController();
  controller.abort();

  const startCapResult = await startDesktopAudioCaptureHandler.execute({}, { signal: controller.signal });
  assert.equal(startCapResult?.cancelled, true);
  assert.equal(startCapResult?.status, 'cancelled');

  const stopCapResult = await stopDesktopAudioCaptureHandler.execute({}, { signal: controller.signal });
  assert.equal(stopCapResult?.cancelled, true);
  assert.equal(stopCapResult?.status, 'cancelled');

  const statusResult = await desktopAudioCaptureStatusHandler.execute({}, { signal: controller.signal });
  assert.equal(statusResult?.cancelled, true);
  assert.equal(statusResult?.status, 'cancelled');

  const sendTransResult = await sendGameVoiceTranslationHandler.execute({ message: 'hola' }, { signal: controller.signal });
  assert.equal(sendTransResult?.cancelled, true);
  assert.equal(sendTransResult?.status, 'cancelled');

  const speakResult = await translateAndSpeakInGameHandler.execute({ message: 'test', target_language: 'en' }, { signal: controller.signal });
  assert.equal(speakResult?.cancelled, true);
  assert.equal(speakResult?.status, 'cancelled');
});

test('MCP tool handlers cooperatively abort before connecting or executing when signal is cancelled', async () => {
  const controller = new AbortController();
  controller.abort();

  const addResult = await mcpAddServerHandler.execute({ id: 's1', transport: 'stdio', command: 'node' }, { signal: controller.signal });
  assert.equal(addResult?.cancelled, true);
  assert.equal(addResult?.status, 'cancelled');

  const reconnectResult = await mcpReconnectServerHandler.execute({ server_id: 's1' }, { signal: controller.signal });
  assert.equal(reconnectResult?.cancelled, true);
  assert.equal(reconnectResult?.status, 'cancelled');

  const removeResult = await mcpRemoveServerHandler.execute({ server_id: 's1' }, { signal: controller.signal });
  assert.equal(removeResult?.cancelled, true);
  assert.equal(removeResult?.status, 'cancelled');

  const listResult = await mcpListServersHandler.execute({}, { signal: controller.signal });
  assert.equal(listResult?.cancelled, true);
  assert.equal(listResult?.status, 'cancelled');

  const callResult = await mcpCallToolHandler.execute({ server_id: 's1', tool_name: 't1' }, { signal: controller.signal });
  assert.equal(callResult?.cancelled, true);
  assert.equal(callResult?.status, 'cancelled');
});

test('Widget tool handlers cooperatively abort before scheduling or emitting events when signal is cancelled', async () => {
  const controller = new AbortController();
  controller.abort();

  const reminderResult = await setReminderHandler.execute({ title: 'test reminder' }, { signal: controller.signal });
  assert.equal(reminderResult?.cancelled, true);
  assert.equal(reminderResult?.status, 'cancelled');

  const alarmResult = await setAlarmHandler.execute({ time: '08:00' }, { signal: controller.signal });
  assert.equal(alarmResult?.cancelled, true);
  assert.equal(alarmResult?.status, 'cancelled');

  const widgetResult = await showTacticalWidgetHandler.execute({ type: 'tactical' }, { signal: controller.signal });
  assert.equal(widgetResult?.cancelled, true);
  assert.equal(widgetResult?.status, 'cancelled');

  const dismissResult = await dismissTacticalWidgetHandler.execute({ id: 'w1' }, { signal: controller.signal });
  assert.equal(dismissResult?.cancelled, true);
  assert.equal(dismissResult?.status, 'cancelled');
});

test('Avatar, Vision, and Computer handlers cooperatively abort before triggering operations when signal is cancelled', async () => {
  const controller = new AbortController();
  controller.abort();

  const gestureResult = await triggerCompanionGestureHandler.execute({ gesture: 'wave' }, { signal: controller.signal });
  assert.equal(gestureResult?.cancelled, true);
  assert.equal(gestureResult?.status, 'cancelled');

  const motionResult = await triggerModelMotionHandler.execute({ group: 'idle' }, { signal: controller.signal });
  assert.equal(motionResult?.cancelled, true);
  assert.equal(motionResult?.status, 'cancelled');

  const moveResult = await moveAvatarHandler.execute({ x_pct: 50, y_pct: 50 }, { signal: controller.signal });
  assert.equal(moveResult?.cancelled, true);
  assert.equal(moveResult?.status, 'cancelled');

  const modelResult = await switchAvatarModelHandler.execute({ model_id: 'm1' }, { signal: controller.signal });
  assert.equal(modelResult?.cancelled, true);
  assert.equal(modelResult?.status, 'cancelled');

  const snapResult = await captureScreenSnapshotHandler.execute({}, { signal: controller.signal });
  assert.equal(snapResult?.cancelled, true);
  assert.equal(snapResult?.status, 'cancelled');

  const watchResult = await setScreenWatchHandler.execute({ enabled: true }, { signal: controller.signal });
  assert.equal(watchResult?.cancelled, true);
  assert.equal(watchResult?.status, 'cancelled');

  const regionResult = await setScreenRegionHandler.execute({ x_pct: 10, y_pct: 10, w_pct: 80, h_pct: 80 }, { signal: controller.signal });
  assert.equal(regionResult?.cancelled, true);
  assert.equal(regionResult?.status, 'cancelled');

  const analyzeResult = await analyzeVisualSceneHandler.execute({}, { signal: controller.signal });
  assert.equal(analyzeResult?.cancelled, true);
  assert.equal(analyzeResult?.status, 'cancelled');

  const computerResult = await computerActionHandler.execute({ action: 'screenshot' }, { signal: controller.signal });
  assert.equal(computerResult?.cancelled, true);
  assert.equal(computerResult?.status, 'cancelled');
});

test('System tool handlers cooperatively abort before accessing system when signal is cancelled', async () => {
  const controller = new AbortController();
  controller.abort();

  const timeResult = await getCurrentTimeAndDateHandler.execute({}, { signal: controller.signal });
  assert.equal(timeResult?.cancelled, true);
  assert.equal(timeResult?.status, 'cancelled');

  const weatherResult = await getWeatherHandler.execute({ city: 'Madrid' }, { signal: controller.signal });
  assert.equal(weatherResult?.cancelled, true);
  assert.equal(weatherResult?.status, 'cancelled');

  const diagResult = await systemDiagnosticsHandler.execute({}, { signal: controller.signal });
  assert.equal(diagResult?.cancelled, true);
  assert.equal(diagResult?.status, 'cancelled');

  const cmdResult = await executeSystemCommandHandler.execute({ kind: 'system-info' }, { signal: controller.signal });
  assert.equal(cmdResult?.cancelled, true);
  assert.equal(cmdResult?.status, 'cancelled');

  const listDirResult = await listDirectoryHandler.execute({ path: 'test' }, { signal: controller.signal });
  assert.equal(listDirResult?.cancelled, true);
  assert.equal(listDirResult?.status, 'cancelled');

  const getClipResult = await getClipboardHandler.execute({}, { signal: controller.signal });
  assert.equal(getClipResult?.cancelled, true);
  assert.equal(getClipResult?.status, 'cancelled');

  const setClipResult = await setClipboardHandler.execute({ text: 'test' }, { signal: controller.signal });
  assert.equal(setClipResult?.cancelled, true);
  assert.equal(setClipResult?.status, 'cancelled');

  const procsResult = await getRunningProcessesHandler.execute({}, { signal: controller.signal });
  assert.equal(procsResult?.cancelled, true);
  assert.equal(procsResult?.status, 'cancelled');

  const killResult = await killProcessHandler.execute({}, { signal: controller.signal });
  assert.equal(killResult?.cancelled, true);
  assert.equal(killResult?.status, 'cancelled');

  const openFileResult = await openFileOrFolderHandler.execute({ path: 'test.txt' }, { signal: controller.signal });
  assert.equal(openFileResult?.cancelled, true);
  assert.equal(openFileResult?.status, 'cancelled');

  const openAppResult = await openSystemAppOrLinkHandler.execute({ url: 'https://example.com' }, { signal: controller.signal });
  assert.equal(openAppResult?.cancelled, true);
  assert.equal(openAppResult?.status, 'cancelled');
});

test('ToolExecutor uniformly cancels execution for all domain tools', async () => {
  const executor = new ToolExecutor();
  const controller = new AbortController();
  controller.abort();

  const toolsToTest = [
    'start_desktop_audio_capture',
    'stop_desktop_audio_capture',
    'desktop_audio_capture_status',
    'send_game_voice_translation',
    'translate_and_speak_in_game',
    'mcp_add_server',
    'mcp_reconnect_server',
    'mcp_remove_server',
    'mcp_list_servers',
    'mcp_call_tool',
    'set_reminder',
    'set_alarm',
    'show_tactical_widget',
    'dismiss_tactical_widget',
    'trigger_companion_gesture',
    'trigger_model_motion',
    'move_avatar',
    'switch_avatar_model',
    'capture_screen_snapshot',
    'set_screen_watch',
    'set_screen_region',
    'analyze_visual_scene',
    'computer_action',
    'get_current_time_and_date',
    'get_weather',
    'system_diagnostics',
    'list_directory',
    'get_clipboard',
    'set_clipboard',
    'get_running_processes'
  ];

  for (const toolName of toolsToTest) {
    const result = await executor.executeTool(toolName, {}, controller.signal);
    assert.equal(result?.cancelled, true, `Tool ${toolName} must return cancelled: true`);
    assert.equal(result?.status, 'cancelled', `Tool ${toolName} must return status: 'cancelled'`);
  }
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
