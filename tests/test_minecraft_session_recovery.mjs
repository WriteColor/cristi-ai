import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus } from '../src/services/eventBus.js';
import { MinecraftCompanionService } from '../src/services/gameIntegration/MinecraftCompanionService.js';

function createBridge(connectionIds = ['connection-a', 'connection-b']) {
  let eventListener = null;
  let chatListener = null;
  let connectionIndex = 0;
  const calls = { connect: 0, disconnect: 0 };
  return {
    isElectron: true,
    calls,
    onMinecraftEvent(listener) { eventListener = listener; return () => { eventListener = null; }; },
    onMinecraftChat(listener) { chatListener = listener; return () => { chatListener = null; }; },
    async minecraftConnect() {
      calls.connect += 1;
      return { success: true, username: 'Cristi_Test', connectionId: connectionIds[connectionIndex++] };
    },
    async minecraftDisconnect() { calls.disconnect += 1; return { success: true }; },
    emitEvent(payload) { eventListener?.(payload); },
    emitChat(payload) { chatListener?.(payload); }
  };
}

test('Minecraft ignores late events from retired connections and reconnects only the active transport', async () => {
  const bridge = createBridge();
  const service = new MinecraftCompanionService({ bridge, bus: new EventBus() });
  service.reconnectPolicy.baseDelayMs = 5;
  service.reconnectPolicy.maxDelayMs = 5;

  const first = await service.connect({ host: '127.0.0.1', port: 25565 });
  assert.equal(first.status, 'success');
  assert.equal(service.transportConnectionId, 'connection-a');
  const sessionId = service.sessionId;

  bridge.emitEvent({ type: 'end', connectionId: 'retired-connection', reason: 'old bot ended' });
  assert.equal(service.status, 'connected');
  assert.equal(service.reconnectTimer, null);
  assert.equal(bridge.calls.connect, 1);

  bridge.emitEvent({ type: 'end', connectionId: 'connection-a', reason: 'socket closed' });
  assert.equal(service.status, 'error');
  assert.ok(service.reconnectTimer);
  await new Promise(resolve => setTimeout(resolve, 35));

  assert.equal(bridge.calls.connect, 2);
  assert.equal(service.status, 'connected');
  assert.equal(service.transportConnectionId, 'connection-b');
  assert.equal(service.sessionId, sessionId, 'reconnection retains the logical Minecraft session');
  assert.equal(service.reconnectAttempts, 0);
  service.destroy();
});

test('manual Minecraft disconnect cannot be revived by a delayed end event', async () => {
  const bridge = createBridge(['connection-a']);
  const service = new MinecraftCompanionService({ bridge, bus: new EventBus() });
  await service.connect();
  await service.disconnect();
  bridge.emitEvent({ type: 'end', connectionId: 'connection-a', reason: 'late shutdown notification' });
  await new Promise(resolve => setTimeout(resolve, 15));

  assert.equal(bridge.calls.disconnect, 1);
  assert.equal(bridge.calls.connect, 1);
  assert.equal(service.status, 'disconnected');
  assert.equal(service.reconnectTimer, null);
  service.destroy();
});
