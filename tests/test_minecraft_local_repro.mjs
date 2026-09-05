/** Reproducible offline Mineflayer connection test; no public server required. */
import assert from 'node:assert/strict';
import mc from 'minecraft-protocol';
import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';

const VERSION = '1.16.4';
const server = mc.createServer({ 'online-mode': false, version: VERSION, port: 0 });
const mcData = minecraftData(VERSION);
const loginPacket = mcData.loginPacket;
let clientRef = null;
let receivedChat = null;

server.on('playerJoin', (client) => {
  clientRef = client;
  client.write('login', {
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: loginPacket.previousGameMode,
    worldNames: loginPacket.worldNames,
    dimensionCodec: loginPacket.dimensionCodec,
    dimension: loginPacket.dimension,
    worldName: 'minecraft:overworld',
    hashedSeed: [0, 0],
    maxPlayers: server.maxPlayers,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false
  });
  client.write('position', { x: 0, y: 1.62, z: 0, yaw: 0, pitch: 0, flags: 0 });
  client.on('chat', (packet) => { receivedChat = packet.message; });
});

try {
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.socketServer.address().port;
  const bot = mineflayer.createBot({ host: '127.0.0.1', port, username: 'Cristi_Local', version: VERSION });
  // The protocol login is the stable transport boundary; a full world/chunk
  // stream is intentionally outside this fixture. Wait on the actual state
  // transition instead of assuming a fixed delay under CPU contention.
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    const poll = () => {
      if (bot._client.state === 'play') return resolve();
      if (Date.now() >= deadline) return reject(new Error(`Minecraft login timeout (state=${bot._client.state})`));
      setTimeout(poll, 50);
    };
    poll();
  });
  assert.equal(bot._client.state, 'play');
  bot._client.write('chat', { message: 'Cristi local smoke test' });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(bot.username, 'Cristi_Local');
  assert.match(receivedChat || '', /Cristi local smoke test/);
  bot.quit();
  clientRef?.end('test complete');
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    try { server.socketServer.close(finish); } catch (_) { finish(); }
    setTimeout(finish, 1000);
  });
  console.log(JSON.stringify({ success: true, version: VERSION, port, chatReceived: receivedChat }));
  process.exit(0);
} catch (error) {
  try { clientRef?.end('test failed'); } catch (_) {}
  try { server.close(); } catch (_) {}
  console.error(error);
  process.exitCode = 1;
}
