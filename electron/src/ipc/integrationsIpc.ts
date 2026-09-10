import { executeAutomation, disposeAutomation } from '../utility/AutomationClient';
import { credentialVault } from '../security/CredentialVault';
import { handleTrusted } from '../security/CapabilityRouter';
import { shell } from 'electron';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PassThrough } from 'stream';
import { windowManager } from '../windows/windowManager';
import { processManager } from '../core/processManager';
import {
  MinecraftConnectOptions,
  MinecraftStatus,
  DiscordConnectOptions,
  DiscordVoiceJoinOptions,
  PlaywrightExecuteParams,
  SpotifyControlParams,
} from '../types/electron.types';

// ============================================================================
// 1. PLAYWRIGHT NATIVE BROWSER CONTROLLER (BRAVE POWERED)
// ============================================================================

// ============================================================================
// 2. SPOTIFY NATIVE & MEDIA CONTROLLER
// ============================================================================

function isSpotifyDesktopInstalled(): boolean {
  const candidates = [
    path.join(process.env.APPDATA || '', 'Spotify', 'Spotify.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Spotify', 'Spotify.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'Spotify.exe'),
    'C:\\Program Files\\Spotify\\Spotify.exe',
    'C:\\Program Files (x86)\\Spotify\\Spotify.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return true;
  }
  return false;
}

function executePowerShellScript(script: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 15000 },
      (err, stdout, stderr) => {
        resolve({
          success: !err,
          stdout: stdout ? stdout.trim() : '',
          stderr: stderr ? stderr.trim() : '',
        });
      }
    );
  });
}

function getSpotifyInstallInfo(): { installed: boolean; type: string; exePath: string | null } {
  const localApp = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  const progFiles = process.env['ProgramFiles'] || '';

  const candidates = [
    { path: path.join(appData, 'Spotify/Spotify.exe'), type: 'official_desktop' },
    { path: path.join(progFiles, 'Spotify/Spotify.exe'), type: 'official_desktop' },
    { path: path.join(localApp, 'Microsoft/WindowsApps/Spotify.exe'), type: 'store_app' },
  ];

  for (const c of candidates) {
    if (fs.existsSync(c.path)) {
      return { installed: true, type: c.type, exePath: c.path };
    }
  }
  return { installed: false, type: 'web_only', exePath: null };
}

// ============================================================================
// 3. MINECRAFT COMPANION NATIVE ENGINE (AIRI INSPIRED)
// ============================================================================

let mcBot: any = null;
let mcConnectionId: string | null = null;
let mcConnectionSequence = 0;

function isCurrentMinecraftBot(bot: any, connectionId: string | null): boolean {
  return mcBot === bot && mcConnectionId === connectionId;
}

function releaseMinecraftBot(bot: any, connectionId: string | null): boolean {
  if (!isCurrentMinecraftBot(bot, connectionId)) return false;
  mcBot = null;
  mcConnectionId = null;
  return true;
}

function disposeMinecraftBot(reason = 'replaced'): boolean {
  const bot = mcBot;
  mcBot = null;
  mcConnectionId = null;
  if (!bot) return false;
  try {
    bot.quit(reason);
  } catch (_) {}
  return true;
}

// ============================================================================
// 4. DISCORD COMPANION NATIVE ENGINE (AIRI INSPIRED)
// ============================================================================

let discordClient: any = null;
let discordConnectionId: string | null = null;
let discordConnectionSequence = 0;
let discordVoiceConnection: any = null;
let discordVoicePlayer: any = null;
let discordVoiceOutput: PassThrough | null = null;
const discordVoiceSubscriptions = new Map<string, { opus: any; decoder: any }>();
let discordVoiceReconnectTimer: NodeJS.Timeout | null = null;
let discordVoiceJoinConfig: { guildId: string; channelId: string } | null = null;
let discordVoiceReconnectAttempts = 0;
const DISCORD_VOICE_RECONNECT_MAX_ATTEMPTS = 8;

function isCurrentDiscordClient(client: any, connectionId: string | null): boolean {
  return discordClient === client && discordConnectionId === connectionId;
}

function disposeDiscordClient(): boolean {
  const client = discordClient;
  discordClient = null;
  discordConnectionId = null;
  if (!client) return false;
  try {
    client.destroy();
  } catch (_) {}
  return true;
}

function notifyDiscordVoiceEvent(type: string, payload: Record<string, unknown> = {}): void {
  const mainWin = windowManager.getMainWindow();
  if (mainWin?.webContents && !mainWin.isDestroyed()) {
    mainWin.webContents.send('discord-voice-event', { type, ...payload });
  }
}

function downsampleDiscordPcm(pcm: Buffer): Buffer {
  if (!Buffer.isBuffer(pcm) || pcm.length < 4) return Buffer.alloc(0);
  const input = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const frames = Math.floor(input.length / 2);
  const output = Buffer.alloc(Math.floor(frames / 3) * 2);
  for (let i = 0, out = 0; i + 5 < frames * 2; i += 6, out += 2) {
    const left = input[i] + input[i + 2] + input[i + 4];
    const right = input[i + 1] + input[i + 3] + input[i + 5];
    output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((left + right) / 6))), out);
  }
  return output;
}

function upsampleDiscordPcm(pcm: Buffer): Buffer {
  if (!Buffer.isBuffer(pcm) || pcm.length < 2) return Buffer.alloc(0);
  const input = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const output = Buffer.alloc(input.length * 6 * 2);
  let offset = 0;
  for (const sample of input) {
    for (let repeat = 0; repeat < 3; repeat += 1) {
      output.writeInt16LE(sample, offset);
      output.writeInt16LE(sample, offset + 2);
      offset += 4;
    }
  }
  return output;
}

function subscribeDiscordVoiceUser(userId: string, receiver: any, guildId: string, channelId: string): void {
  if (!userId || discordVoiceSubscriptions.has(userId)) return;
  if (discordClient?.user?.id && String(userId) === String(discordClient.user.id)) return;

  try {
     
    const { EndBehaviorType } = require('@discordjs/voice');
     
    const prism = require('prism-media');

    const opus = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 220 },
    });
    const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
    const subscription = { opus, decoder };
    discordVoiceSubscriptions.set(userId, subscription);
    opus.pipe(decoder);

    decoder.on('data', (pcm: Buffer) => {
      const mono16k = downsampleDiscordPcm(pcm);
      const mainWin = windowManager.getMainWindow();
      if (!mono16k.length || !mainWin?.webContents || mainWin.isDestroyed()) return;

      mainWin.webContents.send('discord-voice-audio', {
        guildId,
        channelId,
        userId,
        frameId: `discord_voice_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        encoding: 'pcm_s16le',
        sampleRate: 16000,
        channels: 1,
        data: mono16k.toString('base64'),
      });
    });

    const clear = () => {
      if (discordVoiceSubscriptions.get(userId) === subscription) discordVoiceSubscriptions.delete(userId);
    };
    opus.once('end', clear);
    opus.once('close', clear);
    opus.once('error', (error: Error) =>
      notifyDiscordVoiceEvent('audio_error', { userId, message: error?.message || String(error) })
    );
    decoder.once('error', (error: Error) =>
      notifyDiscordVoiceEvent('decoder_error', { userId, message: error?.message || String(error) })
    );
  } catch (error) {
    notifyDiscordVoiceEvent('audio_error', { userId, message: (error as Error)?.message || String(error) });
  }
}

function scheduleDiscordVoiceReconnect(): void {
  if (discordVoiceReconnectTimer || !discordVoiceJoinConfig || !discordVoiceConnection || !discordClient) return;
  if (discordVoiceReconnectAttempts >= DISCORD_VOICE_RECONNECT_MAX_ATTEMPTS) {
    notifyDiscordVoiceEvent('reconnect_failed', {
      guildId: discordVoiceJoinConfig.guildId,
      channelId: discordVoiceJoinConfig.channelId,
      attempts: discordVoiceReconnectAttempts,
    });
    return;
  }

  discordVoiceReconnectAttempts += 1;
  const delay = Math.min(30000, 1000 * 2 ** (discordVoiceReconnectAttempts - 1));
  notifyDiscordVoiceEvent('reconnecting', {
    guildId: discordVoiceJoinConfig.guildId,
    channelId: discordVoiceJoinConfig.channelId,
    attempt: discordVoiceReconnectAttempts,
    delayMs: delay,
  });

  discordVoiceReconnectTimer = setTimeout(async () => {
    discordVoiceReconnectTimer = null;
    const connection = discordVoiceConnection;
    if (!connection || !discordVoiceJoinConfig || !discordClient) return;

    try {
      const rejoined = connection.rejoin({
        channelId: discordVoiceJoinConfig.channelId,
        selfDeaf: false,
        selfMute: false,
      });
      if (!rejoined) throw new Error('Discord rechazó el rejoin del canal de voz.');
       
      const voice = require('@discordjs/voice');
      await voice.entersState(connection, voice.VoiceConnectionStatus.Ready, 10000);
      discordVoiceReconnectAttempts = 0;
      notifyDiscordVoiceEvent('ready', {
        guildId: discordVoiceJoinConfig.guildId,
        channelId: discordVoiceJoinConfig.channelId,
        resumed: true,
      });
    } catch (error) {
      notifyDiscordVoiceEvent('reconnect_error', {
        guildId: discordVoiceJoinConfig.guildId,
        channelId: discordVoiceJoinConfig.channelId,
        attempt: discordVoiceReconnectAttempts,
        message: (error as Error)?.message || String(error),
      });
      scheduleDiscordVoiceReconnect();
    }
  }, delay);
}

function disconnectDiscordVoice({ preserveJoinConfig = false } = {}): void {
  if (discordVoiceReconnectTimer) clearTimeout(discordVoiceReconnectTimer);
  discordVoiceReconnectTimer = null;
  discordVoiceReconnectAttempts = 0;
  if (!preserveJoinConfig) discordVoiceJoinConfig = null;

  for (const { opus, decoder } of discordVoiceSubscriptions.values()) {
    try {
      opus.destroy();
    } catch (_) {}
    try {
      decoder.destroy();
    } catch (_) {}
  }
  discordVoiceSubscriptions.clear();

  try {
    discordVoiceOutput?.end();
  } catch (_) {}
  discordVoiceOutput = null;

  try {
    discordVoicePlayer?.stop();
  } catch (_) {}
  discordVoicePlayer = null;

  try {
    discordVoiceConnection?.destroy();
  } catch (_) {}
  discordVoiceConnection = null;
}

// ============================================================================
// IPC REGISTRATION EXPORT
// ============================================================================

export function registerIntegrationsIpc(): void {
  // Register cleanup hook
  processManager.registerCleanupHook('integrations', async () => {
    try {
      disconnectDiscordVoice();
    } catch (_) {}
    try {
      disposeDiscordClient();
    } catch (_) {}
    try {
      disposeMinecraftBot('app_shutdown');
    } catch (_) {}
    await disposeAutomation();
  });

  // ── Playwright IPC Handlers ───────────────────────────────────────────────
  handleTrusted('playwright-execute', (_event, action, params) => executeAutomation(action, params));

  // ── Spotify IPC Handlers ──────────────────────────────────────────────────
  handleTrusted('spotify-control', async (_event, action: string, params: SpotifyControlParams = {}) => {
    try {
      switch (action) {
        case 'check_desktop_installed': {
          return { success: true, ...getSpotifyInstallInfo() };
        }
        case 'play_pause': {
          // Virtual key 179 (0xB3) = VK_MEDIA_PLAY_PAUSE
          const res = await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]179)');
          return { success: res.success, message: 'Reproducción conmutada (Play/Pause) en Spotify / reproductor del sistema.' };
        }
        case 'next': {
          const res = await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]176)');
          return { success: res.success, message: 'Pista siguiente (Next Track).' };
        }
        case 'previous': {
          const res = await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]177)');
          return { success: res.success, message: 'Pista anterior (Previous Track).' };
        }
        case 'open_uri': {
          const uri = params.uri || 'spotify:';
          const desktopInstalled = isSpotifyDesktopInstalled();

          if (!desktopInstalled) {
            let webUrl = 'https://open.spotify.com';
            if (uri.startsWith('spotify:track:')) {
              const trackId = uri.replace('spotify:track:', '');
              webUrl = `https://open.spotify.com/track/${trackId}`;
            } else if (uri.startsWith('spotify:search:')) {
              const query = uri.replace('spotify:search:', '');
              webUrl = `https://open.spotify.com/search/${query}`;
            }
            await shell.openExternal(webUrl).catch(() => {});
            return { success: true, uri: webUrl, isWebFallback: true, message: `Abriendo en Spotify Web: ${webUrl}` };
          }

          await shell.openExternal(uri).catch(() => {});
          const autoPlayScript = `
            $ws = New-Object -ComObject WScript.Shell
            $retries = 0
            while ($retries -lt 6) {
              Start-Sleep -Milliseconds 600
              $proc = Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
              if ($proc) {
                $ws.AppActivate($proc.Id)
                Start-Sleep -Milliseconds 300
                $ws.SendKeys('{ENTER}')
                Start-Sleep -Milliseconds 250
                $ws.SendKeys([char]179)
                break
              }
              $retries++
            }
          `;
          executePowerShellScript(autoPlayScript).catch(() => {});
          return { success: true, uri, message: `Reproduciendo en Spotify: ${uri}` };
        }
        case 'search_desktop': {
          const query = encodeURIComponent(params.query || '');
          const desktopInstalled = isSpotifyDesktopInstalled();

          if (!desktopInstalled) {
            const webUrl = `https://open.spotify.com/search/${query}`;
            await shell.openExternal(webUrl).catch(() => {});
            return { success: true, query: params.query, uri: webUrl, isWebFallback: true, message: `Buscando "${params.query}" en Spotify Web.` };
          }

          const uri = `spotify:search:${query}`;
          await shell.openExternal(uri).catch(() => {});
          const autoPlaySearchScript = `
            $ws = New-Object -ComObject WScript.Shell
            $retries = 0
            while ($retries -lt 8) {
              Start-Sleep -Milliseconds 600
              $proc = Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
              if ($proc) {
                $ws.AppActivate($proc.Id)
                Start-Sleep -Milliseconds 400
                $ws.SendKeys('{ENTER}')
                Start-Sleep -Milliseconds 300
                $ws.SendKeys('{DOWN}')
                Start-Sleep -Milliseconds 200
                $ws.SendKeys('{ENTER}')
                Start-Sleep -Milliseconds 250
                $ws.SendKeys([char]179)
                break
              }
              $retries++
            }
          `;
          executePowerShellScript(autoPlaySearchScript).catch(() => {});
          return { success: true, query: params.query, uri, message: `Buscando y reproduciendo "${params.query}" en Spotify.` };
        }
        case 'get_status': {
          const script =
            '(Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1).MainWindowTitle';
          const res = await executePowerShellScript(script);
          const title = res.stdout || '';
          const isRunning = Boolean(title);
          let artist = '';
          let track = '';
          if (title && title.includes(' - ')) {
            const parts = title.split(' - ');
            artist = parts[0].trim();
            track = parts.slice(1).join(' - ').trim();
          }
          return {
            success: true,
            isRunning,
            rawTitle: title,
            isPlaying: Boolean(title && !title.toLowerCase().startsWith('spotify')),
            artist: artist || null,
            track: track || (title && !title.toLowerCase().startsWith('spotify') ? title : null),
          };
        }
        case 'volume_up': {
          await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]175)');
          return { success: true, message: 'Volumen aumentado.' };
        }
        case 'volume_down': {
          await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]174)');
          return { success: true, message: 'Volumen reducido.' };
        }
        default:
          return { success: false, error: `Acción de Spotify no soportada: "${action}"` };
      }
    } catch (err) {
      console.error('[Spotify Native Error]', err);
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Minecraft IPC Handlers ────────────────────────────────────────────────
  handleTrusted('minecraft-connect', async (_event, opts: MinecraftConnectOptions = {}) => {
    try {
      disposeMinecraftBot('connection_replaced');

       
      const mineflayer = require('mineflayer');
       
      const { pathfinder } = require('mineflayer-pathfinder');

      const botOptions = {
        host: opts.host || 'localhost',
        port: opts.port ? Number(opts.port) : 25565,
        username: opts.username || 'Cristi_AI',
        version: opts.version || false,
      };

      const bot = mineflayer.createBot(botOptions);
      const connectionId = `minecraft_transport_${Date.now()}_${++mcConnectionSequence}`;
      mcBot = bot;
      mcConnectionId = connectionId;
      bot.loadPlugin(pathfinder);

      return new Promise((resolve) => {
        let resolved = false;
        const notifyMinecraftEvent = (type: string, payload: Record<string, unknown> = {}) => {
          if (!isCurrentMinecraftBot(bot, connectionId)) return;
          const mainWin = windowManager.getMainWindow();
          if (mainWin?.webContents && !mainWin.isDestroyed()) {
            mainWin.webContents.send('minecraft-event', { type, connectionId, ...payload });
          }
        };

        bot.once('spawn', () => {
          if (!isCurrentMinecraftBot(bot, connectionId)) return;
          if (!resolved) {
            resolved = true;
            resolve({ success: true, username: bot.username, connectionId });
          }
          notifyMinecraftEvent('spawn', { username: bot.username });
        });

        bot.on('chat', (username: string, message: string) => {
          if (!isCurrentMinecraftBot(bot, connectionId) || username === bot.username) return;
          const mainWin = windowManager.getMainWindow();
          if (mainWin?.webContents && !mainWin.isDestroyed()) {
            mainWin.webContents.send('minecraft-chat', { username, message, connectionId });
          }
        });

        bot.on('health', () => notifyMinecraftEvent('health', { health: bot.health, food: bot.food }));
        bot.on('death', () => notifyMinecraftEvent('death', { message: 'El bot ha muerto en el juego.' }));
        bot.on('entityHurt', (entity: any) => {
          if (entity === bot.entity) notifyMinecraftEvent('hurt', { health: bot.health });
        });
        bot.on('kicked', (reason: unknown) => notifyMinecraftEvent('kicked', { reason: String(reason || '') }));
        bot.on('end', (reason: unknown) => {
          if (!releaseMinecraftBot(bot, connectionId)) return;
          const mainWin = windowManager.getMainWindow();
          if (mainWin?.webContents && !mainWin.isDestroyed()) {
            mainWin.webContents.send('minecraft-event', { type: 'end', connectionId, reason: String(reason || '') });
          }
        });
        bot.on('error', (err: Error) => notifyMinecraftEvent('error', { message: err?.message || String(err) }));

        bot.once('error', (err: Error) => {
          if (!resolved) {
            resolved = true;
            releaseMinecraftBot(bot, connectionId);
            resolve({ success: false, error: err.message });
          }
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: 'Tiempo de espera agotado al conectar con el servidor de Minecraft.' });
          }
        }, 15000);
      });
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  handleTrusted('minecraft-disconnect', () => {
    disposeMinecraftBot('renderer_request');
    return { success: true };
  });

  handleTrusted('minecraft-chat', (_event, message: unknown) => {
    if (mcBot) {
      try {
        mcBot.chat(String(message));
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
    return { success: false, error: 'Bot de Minecraft no conectado.' };
  });

  handleTrusted('minecraft-get-status', (): MinecraftStatus => {
    if (!mcBot) return { connected: false, status: 'disconnected', connectionId: null };
    try {
      const pos = mcBot.entity?.position || { x: 0, y: 0, z: 0 };
      const players = Object.keys(mcBot.players || {}).filter((p) => p !== mcBot.username);

      const nearbyEntities = [];
      if (mcBot.entities) {
        for (const entity of Object.values(mcBot.entities) as any[]) {
          if (!entity || entity === mcBot.entity || !entity.position) continue;
          const dist = Math.hypot(entity.position.x - pos.x, entity.position.y - pos.y, entity.position.z - pos.z);
          if (dist <= 24) {
            nearbyEntities.push({
              id: entity.id,
              name: entity.name || entity.username || 'unknown',
              type: entity.type || 'entity',
              distance: Math.round(dist * 10) / 10,
              isHostile: Boolean(
                entity.kind === 'Hostile' ||
                  ['creeper', 'zombie', 'skeleton', 'spider', 'witch', 'enderman', 'phantom', 'drowned'].includes(
                    (entity.name || '').toLowerCase()
                  )
              ),
            });
          }
        }
      }
      nearbyEntities.sort((a, b) => a.distance - b.distance);

      const inventory = (mcBot.inventory?.items?.() || []).map((i: any) => ({
        name: i.name,
        count: i.count,
        slot: i.slot,
      }));

      return {
        connected: true,
        status: 'connected',
        connectionId: mcConnectionId,
        health: mcBot.health ?? 20,
        food: mcBot.food ?? 20,
        position: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
        dimension: mcBot.game?.dimension || 'overworld',
        timeOfDay: mcBot.time?.timeOfDay,
        isRaining: Boolean(mcBot.isRaining),
        nearbyPlayers: players,
        nearbyEntities: nearbyEntities.slice(0, 20),
        inventory,
      };
    } catch (e) {
      return { connected: false, status: 'error', connectionId: mcConnectionId, error: (e as Error).message };
    }
  });

  handleTrusted('minecraft-move-to', (_event, { x, y, z }: { x: number; y: number; z: number }) => {
    if (!mcBot || !mcBot.pathfinder) return { success: false, error: 'Bot no conectado.' };
    try {
       
      const { goals, Movements } = require('mineflayer-pathfinder');
      const defaultMove = new Movements(mcBot);
      mcBot.pathfinder.setMovements(defaultMove);
      mcBot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      return { success: true, message: `Navegando hacia ${x}, ${y}, ${z}` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  handleTrusted('minecraft-follow', (_event, targetPlayer: string) => {
    if (!mcBot || !mcBot.pathfinder) return { success: false, error: 'Bot no conectado.' };
    try {
      const player = mcBot.players[targetPlayer];
      if (!player || !player.entity) {
        return { success: false, error: `Jugador "${targetPlayer}" no encontrado cerca.` };
      }
       
      const { goals, Movements } = require('mineflayer-pathfinder');
      const defaultMove = new Movements(mcBot);
      mcBot.pathfinder.setMovements(defaultMove);
      mcBot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 3), true);
      return { success: true, message: `Siguiendo a ${targetPlayer}.` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  handleTrusted('minecraft-stop', () => {
    if (mcBot && mcBot.pathfinder) {
      try {
        mcBot.pathfinder.setGoal(null);
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
    return { success: true };
  });

  handleTrusted('minecraft-mine-block', async (_event, { x, y, z }: { x: number; y: number; z: number }) => {
    if (!mcBot) return { success: false, error: 'Bot de Minecraft no conectado.' };
    try {
       
      const { Vec3 } = require('vec3');
      const blockPos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
      const block = mcBot.blockAt(blockPos);
      if (!block || block.name === 'air') {
        return { success: false, error: `No hay bloque minable en [${x}, ${y}, ${z}].` };
      }
      await mcBot.dig(block);
      return { success: true, message: `Bloque ${block.name} minado en [${x}, ${y}, ${z}].` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  handleTrusted('minecraft-place-block', async (_event, { x, y, z, blockName }: { x: number; y: number; z: number; blockName: string }) => {
    if (!mcBot) return { success: false, error: 'Bot de Minecraft no conectado.' };
    try {
       
      const { Vec3 } = require('vec3');
      const targetPos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
      const item = mcBot.inventory.items().find((i: any) => i.name.toLowerCase().includes((blockName || '').toLowerCase()));
      if (!item) {
        return { success: false, error: `No hay bloque "${blockName}" en el inventario.` };
      }
      await mcBot.equip(item, 'hand');
      const referenceBlock = mcBot.blockAt(targetPos.offset(0, -1, 0)) || mcBot.blockAt(targetPos);
      if (!referenceBlock) return { success: false, error: 'No se encontró bloque de referencia para colocar.' };
      await mcBot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
      return { success: true, message: `Bloque ${item.name} colocado en [${x}, ${y}, ${z}].` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  handleTrusted('minecraft-attack', async (_event, { entityName }: { entityName?: string }) => {
    if (!mcBot) return { success: false, error: 'Bot de Minecraft no conectado.' };
    try {
      const entity = mcBot.nearestEntity((e: any) =>
        e.type === 'mob' || e.type === 'player' || (entityName && e.name && e.name.toLowerCase().includes(entityName.toLowerCase()))
      );
      if (!entity) return { success: false, error: `No se encontró entidad "${entityName || 'cercana'}" para atacar.` };
      mcBot.attack(entity);
      return { success: true, message: `Atacando a ${entity.name || 'entidad'}.` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // ── Discord IPC Handlers ──────────────────────────────────────────────────
  handleTrusted('discord-connect', async (_event, { statusMessage, activityType }) => {
    const token = await credentialVault.get('discord.botToken');
    try {
      disconnectDiscordVoice();
      disposeDiscordClient();

       
      const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.DirectMessages,
        ],
      });
      const connectionId = `discord_transport_${Date.now()}_${++discordConnectionSequence}`;
      discordClient = client;
      discordConnectionId = connectionId;

      return new Promise((resolve) => {
        let resolved = false;

        client.once('ready', () => {
          if (!isCurrentDiscordClient(client, connectionId)) return;
          if (!resolved) {
            resolved = true;
            resolve({
              success: true,
              connectionId,
              botInfo: {
                id: client.user.id,
                tag: client.user.tag,
                username: client.user.username,
              },
            });
          }

          try {
            client.user.setActivity(statusMessage || 'Cristi AI Companion', {
              type: ActivityType[activityType || 'Playing'] || ActivityType.Playing,
            });
          } catch (_) {}
        });

        client.on('messageCreate', (message: any) => {
          if (!isCurrentDiscordClient(client, connectionId) || message.author.bot) return;
          const mainWin = windowManager.getMainWindow();
          if (mainWin?.webContents && !mainWin.isDestroyed()) {
            const isMentioned = Boolean(
              client.user?.id &&
                (message.mentions?.has?.(client.user.id) || message.mentions?.users?.has?.(client.user.id))
            );
            const isDirectMessage = Boolean(!message.guildId || message.channel?.isDMBased?.() || message.channel?.type === 1);
            mainWin.webContents.send('discord-message', {
              id: message.id,
              channelId: message.channelId,
              channelName: message.channel?.name || 'DM',
              authorId: message.author.id,
              authorName: message.author.username,
              content: message.content,
              guildId: message.guildId,
              connectionId,
              guildName: message.guild?.name || 'Direct Message',
              isMentioned,
              isDirectMessage,
            });
          }
        });

        const notifyDiscordEvent = (type: string, payload: Record<string, unknown> = {}) => {
          if (!isCurrentDiscordClient(client, connectionId)) return;
          const mainWin = windowManager.getMainWindow();
          if (mainWin?.webContents && !mainWin.isDestroyed()) {
            mainWin.webContents.send('discord-event', { type, connectionId, ...payload });
          }
        };

        client.on('error', (err: Error) => notifyDiscordEvent('error', { message: err?.message || String(err) }));
        client.on('shardDisconnect', (closeEvent: any, shardId: number) =>
          notifyDiscordEvent('disconnect', { shardId, code: closeEvent?.code })
        );
        client.on('shardReconnecting', (shardId: number) => notifyDiscordEvent('reconnecting', { shardId }));
        client.on('shardReady', (shardId: number) => notifyDiscordEvent('ready', { shardId }));

        client.login(token).catch((err: Error) => {
          if (!resolved) {
            resolved = true;
            if (isCurrentDiscordClient(client, connectionId)) disposeDiscordClient();
            resolve({ success: false, error: err.message });
          }
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            if (isCurrentDiscordClient(client, connectionId)) disposeDiscordClient();
            resolve({ success: false, error: 'Tiempo de espera agotado al conectar a Discord.' });
          }
        }, 15000);
      });
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  handleTrusted('discord-disconnect', () => {
    disconnectDiscordVoice();
    disposeDiscordClient();
    return { success: true };
  });

  handleTrusted('discord-send-message', async (_event, { channelId, content }: { channelId: string; content: string }) => {
    if (!discordClient) return { success: false, error: 'Bot de Discord no conectado.' };
    try {
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Canal no encontrado o no admite texto.' };
      }
      await channel.send(String(content));
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  handleTrusted('discord-set-status', (_event, { statusText, activityType }: { statusText: string; activityType?: string }) => {
    if (!discordClient || !discordClient.user) return { success: false };
    try {
       
      const { ActivityType } = require('discord.js');
      discordClient.user.setActivity(statusText, {
        type: ActivityType[activityType || 'Playing'] || ActivityType.Playing,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  handleTrusted('discord-get-messages', async (_event, { channelId, limit = 20 }: { channelId: string; limit?: number }) => {
    if (!discordClient) return { success: false, error: 'Bot de Discord no conectado.', messages: [] };
    try {
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Canal no encontrado o no admite texto.', messages: [] };
      }
      const messages = await channel.messages.fetch({ limit: Math.min(50, limit) });
      const list = Array.from(messages.values()).map((m: any) => ({
        id: m.id,
        content: m.content,
        author: m.author.username,
        authorId: m.author.id,
        timestamp: m.createdAt.toISOString(),
      })).reverse();
      return { success: true, messages: list };
    } catch (e) {
      return { success: false, error: (e as Error).message, messages: [] };
    }
  });

  handleTrusted('discord-voice-join', async (_event, { guildId, channelId }: DiscordVoiceJoinOptions) => {
    if (!discordClient) return { success: false, error: 'Bot de Discord no conectado.' };
    if (!guildId || !channelId) return { success: false, error: 'guildId y channelId son obligatorios.' };

    try {
       
      const voice = require('@discordjs/voice');
      const guild = discordClient.guilds.cache.get(String(guildId)) || (await discordClient.guilds.fetch(String(guildId)));
      const channel = guild?.channels?.cache?.get(String(channelId)) || (await guild?.channels?.fetch(String(channelId)));
      if (!channel || ![2, 13].includes(Number(channel.type))) {
        return { success: false, error: 'El canal no es de voz o stage.' };
      }

      disconnectDiscordVoice();
      discordVoiceJoinConfig = { guildId: guild.id, channelId: channel.id };
      discordVoiceConnection = voice.joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      await voice.entersState(discordVoiceConnection, voice.VoiceConnectionStatus.Ready, 15000);
      discordVoicePlayer = voice.createAudioPlayer();
      discordVoiceOutput = new PassThrough();
      const resource = voice.createAudioResource(discordVoiceOutput, { inputType: voice.StreamType.Raw });
      discordVoiceConnection.subscribe(discordVoicePlayer);
      discordVoicePlayer.play(resource);

      discordVoiceConnection.receiver.speaking.on('start', (userId: string) => {
        if (discordClient?.user?.id && String(userId) === String(discordClient.user.id)) return;
        subscribeDiscordVoiceUser(userId, discordVoiceConnection.receiver, guild.id, channel.id);
      });

      discordVoiceConnection.on('stateChange', (_: unknown, next: any) => {
        if (next.status === voice.VoiceConnectionStatus.Ready) discordVoiceReconnectAttempts = 0;
        if (next.status === voice.VoiceConnectionStatus.Disconnected) {
          notifyDiscordVoiceEvent('disconnect', { guildId: guild.id, channelId: channel.id });
          scheduleDiscordVoiceReconnect();
        }
        if (next.status === voice.VoiceConnectionStatus.Destroyed) {
          notifyDiscordVoiceEvent('destroyed', { guildId: guild.id, channelId: channel.id });
          discordVoiceJoinConfig = null;
        }
      });

      notifyDiscordVoiceEvent('ready', { guildId: guild.id, channelId: channel.id });
      return { success: true, guildId: guild.id, channelId: channel.id, sampleRate: 16000 };
    } catch (error) {
      disconnectDiscordVoice();
      return { success: false, error: (error as Error)?.message || String(error) };
    }
  });

  handleTrusted('discord-voice-leave', () => {
    disconnectDiscordVoice();
    notifyDiscordVoiceEvent('disconnected');
    return { success: true };
  });

  handleTrusted('discord-voice-send-audio', (_event, { data }: { data?: string } = {}) => {
    if (!discordVoiceOutput || discordVoiceOutput.destroyed || !data) {
      return { success: false, error: 'No hay una conexión de voz de Discord activa.' };
    }
    try {
      const pcm = Buffer.from(String(data), 'base64');
      const upsampled = upsampleDiscordPcm(pcm);
      if (upsampled.length) discordVoiceOutput.write(upsampled);
      return { success: true, bytes: upsampled.length };
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) };
    }
  });
}
