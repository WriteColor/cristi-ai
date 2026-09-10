import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolExecutor } from '../src/domain/tools/ToolExecutor';
import { toolRegistry } from '../src/domain/tools/index';
import type { IToolHandler } from '../src/domain/tools/IToolHandler';

test('ToolExecutor initializes with robust default handlers and context', async () => {
  const executor = new ToolExecutor();

  assert.equal(typeof executor.onGestureTrigger, 'function');
  assert.equal(typeof executor.onMotionTrigger, 'function');
  assert.equal(typeof executor.onAvatarMove, 'function');
  assert.equal(typeof executor.onModelSwitch, 'function');
  assert.equal(typeof executor.setScreenWatch, 'function');

  // Verify safe no-op defaults
  assert.doesNotThrow(() => executor.onGestureTrigger?.('wave'));
  assert.doesNotThrow(() => executor.onMotionTrigger?.('idle', 1));
  assert.doesNotThrow(() => executor.onAvatarMove?.('center'));
  assert.doesNotThrow(() => executor.onModelSwitch?.('live2d', 'model-1'));
  assert.doesNotThrow(() => executor.setScreenWatch?.(true));

  // Sensory fallback getters
  assert.equal(executor.getCameraSnapshot?.(), null);
  assert.equal(executor.getVisionDetections?.(), null);
  const capture = await executor.getScreenCapture?.();
  assert.equal(capture, null);
});

test('ToolExecutor accepts and propagates custom hooks into context', async () => {
  let movedTo = '';
  let modelSwitched = '';
  let watchActive = false;

  const executor = new ToolExecutor({
    onAvatarMove: (pos: string) => { movedTo = pos; },
    onModelSwitch: (_type: string, id: string) => { modelSwitched = id; },
    setScreenWatch: (active: boolean) => { watchActive = active; },
    getScreenCapture: async () => 'data:image/png;base64,mockCapture'
  });

  executor.onAvatarMove?.('bottom-right');
  assert.equal(movedTo, 'bottom-right');

  executor.onModelSwitch?.('live2d', 'cristi-casual');
  assert.equal(modelSwitched, 'cristi-casual');

  executor.setScreenWatch?.(true);
  assert.equal(watchActive, true);

  const screenResult = await executor.getScreenCapture?.();
  assert.equal(screenResult, 'data:image/png;base64,mockCapture');
  assert.equal(await executor.context.getScreenCapture?.(), 'data:image/png;base64,mockCapture');
});

test('ToolExecutor delegates tool execution to toolRegistry with lifecycle callbacks', async () => {
  const testHandler: IToolHandler = {
    name: 'test_calculator',
    declaration: {
      name: 'test_calculator',
      description: 'Calculates sum',
      parameters: {
        type: 'OBJECT',
        properties: {
          a: { type: 'NUMBER' },
          b: { type: 'NUMBER' }
        },
        required: ['a', 'b']
      }
    },
    async execute(args: { a: number; b: number }) {
      return { sum: args.a + args.b };
    }
  };

  toolRegistry.register(testHandler);

  const startCalls: string[] = [];
  const endCalls: string[] = [];

  const executor = new ToolExecutor({
    onToolExecutionStart: (name: string) => { startCalls.push(name); },
    onToolExecutionEnd: (name: string) => { endCalls.push(name); }
  });

  const result = await executor.executeTool('test_calculator', { a: 15, b: 27 });
  assert.deepEqual(result, { sum: 42 });
  assert.deepEqual(startCalls, ['test_calculator']);
  assert.deepEqual(endCalls, ['test_calculator']);

  toolRegistry.unregister('test_calculator');
});

test('ToolExecutor handles cancelled tool calls correctly', async () => {
  const testHandler: IToolHandler = {
    name: 'test_cancellable_tool',
    declaration: {
      name: 'test_cancellable_tool',
      description: 'Test cancellable',
      parameters: { type: 'OBJECT', properties: {} }
    },
    async execute() {
      return { executed: true };
    }
  };

  toolRegistry.register(testHandler);

  const executor = new ToolExecutor();
  const calls = [
    { id: 'call-cancelled-1', name: 'test_cancellable_tool', args: {} },
    { id: 'call-allowed-2', name: 'test_cancellable_tool', args: {} }
  ];

  const results = await executor.executeCalls(calls, (id?: string) => id === 'call-cancelled-1');

  // Cancelled calls are safely skipped from output responses
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'call-allowed-2');
  assert.equal((results[0].response.output as { executed?: boolean })?.executed, true);

  toolRegistry.unregister('test_cancellable_tool');
});
