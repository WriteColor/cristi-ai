/**
 * Cristi AI - Minecraft Autonomous Companion Service (Domain Layer)
 * 
 * Provides autonomous navigation, mining, block placement, combat, in-game chat,
 * and continuous spatial telemetry with real-time perception updates to EventBus.
 */

import type {
  MinecraftBotState,
  MinecraftCommandResult,
  MinecraftConfig,
  MinecraftEntity,
  MinecraftInventoryItem,
  MinecraftPerception,
  MinecraftPosition
} from '@/types';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { eventBus, EVENTS } from '@/services/eventBus.js';
import { logger } from '@/services/logger.js';

export interface IMinecraftCompanionService {
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error';
  readonly sessionId: string | null;
  readonly botState: Readonly<MinecraftBotState>;

  connect(options?: Partial<MinecraftConfig>): Promise<MinecraftCommandResult>;
  disconnect(): Promise<MinecraftCommandResult>;
  sendChat(message: string): Promise<MinecraftCommandResult>;
  getStatus(): Promise<{
    status: string;
    sessionId: string | null;
    bot: MinecraftBotState;
    perception: MinecraftPerception;
    error?: string;
  }>;
  moveTo(x: number, y: number, z: number): Promise<MinecraftCommandResult>;
  followPlayer(playerName?: string): Promise<MinecraftCommandResult>;
  stopMoving(): Promise<MinecraftCommandResult>;
  stop(): Promise<MinecraftCommandResult>;
  mineBlock(x: number, y: number, z: number): Promise<MinecraftCommandResult>;
  placeBlock(x: number, y: number, z: number, blockName: string): Promise<MinecraftCommandResult>;
  attackEntity(entityName: string): Promise<MinecraftCommandResult>;
  getPerceptionSummary(): MinecraftPerception;
  startTelemetry(intervalMs?: number): void;
  stopTelemetry(): void;
  destroy(): void;
}

export interface ReconnectPolicy {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export class MinecraftCompanionService implements IMinecraftCompanionService {
  private readonly bridge: typeof electronBridge;
  private readonly bus: typeof eventBus;
  private readonly storageKey = 'cristi_minecraft_config';

  public config: MinecraftConfig = {
    host: 'localhost',
    port: 25565,
    username: 'Cristi_AI',
    version: false,
    autoConnect: false,
    followDistance: 3,
    defendCreator: true
  };

  public status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  public sessionId: string | null = null;
  private transportConnectionId: string | null = null;

  public botState: MinecraftBotState = {
    health: 20,
    food: 20,
    position: { x: 0, y: 0, z: 0 },
    dimension: 'overworld',
    inventory: [],
    nearbyPlayers: [],
    nearbyEntities: []
  };

  public chatHistory: Array<{ sender: string; message: string; timestamp: number }> = [];
  public readonly maxChatHistory = 200;

  public reconnectPolicy: ReconnectPolicy = {
    enabled: true,
    maxAttempts: 8,
    baseDelayMs: 1000,
    maxDelayMs: 30000
  };

  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private telemetryIntervalId: NodeJS.Timeout | null = null;

  private unsubscribeEvent: (() => void) | null = null;
  private unsubscribeChat: (() => void) | null = null;

  constructor({ bridge = electronBridge, bus = eventBus } = {}) {
    this.bridge = bridge;
    this.bus = bus;

    this.loadConfig();
    this.setupListeners();
  }

  private loadConfig(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          this.config = { ...this.config, ...JSON.parse(stored) };
        }
      }
    } catch (e) {
      logger.warn?.('MINECRAFT', 'Error al cargar la configuración de Minecraft:', e);
    }
  }

  public saveConfig(newConfig: Partial<MinecraftConfig> = {}): void {
    this.config = { ...this.config, ...newConfig };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(this.config));
      }
    } catch (e) {
      logger.warn?.('MINECRAFT', 'Error al guardar la configuración de Minecraft:', e);
    }
  }

  private setupListeners(): void {
    this.unsubscribeEvent = this.bridge?.onMinecraftEvent?.((event: Record<string, any>) => {
      if (event?.connectionId && this.transportConnectionId && event.connectionId !== this.transportConnectionId) {
        return;
      }

      if (event?.type === 'health') {
        if (typeof event.health === 'number') this.botState.health = event.health;
        if (typeof event.food === 'number') this.botState.food = event.food;
      } else if (event?.type === 'death') {
        this.botState.health = 0;
      } else if (event?.type === 'hurt') {
        if (typeof event.health === 'number') this.botState.health = event.health;
      }

      const perception = this.getPerceptionSummary();

      this.bus.emitDomain(
        EVENTS.GAME_EVENT,
        {
          game: 'minecraft',
          eventType: event?.type || 'unknown',
          payload: event || {},
          perception,
          sessionId: this.sessionId
        },
        { source: 'minecraft', sessionId: this.sessionId, privacy: 'external' }
      );

      // Threat alerts for dangerous health or demise
      if (event?.type === 'health' && (event.health ?? 20) <= 6 && (event.health ?? 20) > 0) {
        this.bus.emitDomain(
          'game.threat_alert',
          {
            game: 'minecraft',
            alertType: 'low_health',
            health: event.health,
            perception,
            sessionId: this.sessionId
          },
          { source: 'minecraft', priority: 'high', privacy: 'external' }
        );
      } else if (event?.type === 'death') {
        this.bus.emitDomain(
          'game.threat_alert',
          {
            game: 'minecraft',
            alertType: 'bot_death',
            perception,
            sessionId: this.sessionId
          },
          { source: 'minecraft', priority: 'emergency', privacy: 'external' }
        );
      }

      // Handle unexpected disconnects
      if (['end', 'kicked', 'error', 'disconnect'].includes(event?.type)) {
        this.status = 'error';
        this.scheduleReconnect(this.config, event?.message || event?.reason || 'desconexión inesperada');
      }
    }) ?? null;

    this.unsubscribeChat = this.bridge?.onMinecraftChat?.((message: { username: string; message: string; connectionId?: string }) => {
      if (message?.connectionId && this.transportConnectionId && message.connectionId !== this.transportConnectionId) {
        return;
      }

      const item = {
        sender: message.username,
        message: message.message,
        timestamp: Date.now()
      };

      this.chatHistory.push(item);
      if (this.chatHistory.length > this.maxChatHistory) {
        this.chatHistory.shift();
      }

      this.bus.emitDomain(
        EVENTS.GAME_EVENT,
        {
          game: 'minecraft',
          eventType: 'chat_message',
          payload: item,
          sessionId: this.sessionId
        },
        { source: 'minecraft', sessionId: this.sessionId, privacy: 'external' }
      );
    }) ?? null;
  }

  public getPerceptionSummary(): MinecraftPerception {
    const { health, food, position, dimension, nearbyPlayers, nearbyEntities, inventory } = this.botState;
    const threats = (nearbyEntities || []).filter(
      (e) =>
        e.isHostile ||
        ['creeper', 'zombie', 'skeleton', 'spider', 'witch', 'enderman', 'phantom', 'drowned', 'warden', 'piglin'].includes(
          (e.name || '').toLowerCase()
        )
    );
    const items = (inventory || []).slice(0, 10).map((i) => `${i.name} (${i.count})`);

    const parts: string[] = [
      `Salud: ${health ?? 20}/20`,
      `Comida: ${food ?? 20}/20`,
      `Posición: [${position?.x ?? 0}, ${position?.y ?? 0}, ${position?.z ?? 0}] (${dimension || 'overworld'})`
    ];

    if (nearbyPlayers && nearbyPlayers.length > 0) {
      parts.push(`Jugadores cerca: ${nearbyPlayers.join(', ')}`);
    }

    if (threats.length > 0) {
      const threatDesc = threats.slice(0, 3).map((t) => `${t.name} a ${t.distance}m`).join(', ');
      parts.push(`¡Amenazas!: ${threatDesc}`);
    } else {
      parts.push('Sin amenazas inmediatas');
    }

    if (items.length > 0) {
      parts.push(`Inventario: ${items.join(', ')}`);
    }

    return {
      status: this.status,
      health: health ?? 20,
      food: food ?? 20,
      isLowHealth: (health ?? 20) <= 6,
      position: position || { x: 0, y: 0, z: 0 },
      dimension: dimension || 'overworld',
      threats,
      nearbyPlayers: nearbyPlayers || [],
      inventorySummary: items,
      narrative: parts.join(' | ')
    };
  }

  public async connect(options: Partial<MinecraftConfig> = {}): Promise<MinecraftCommandResult> {
    this.reconnectPolicy.enabled = true;
    if (this.status === 'connected' || this.status === 'connecting') {
      return {
        success: true,
        status: 'success',
        message: 'El bot de Minecraft ya se encuentra conectado o en proceso de conexión.',
        sessionId: this.sessionId
      };
    }

    const opts: MinecraftConfig = { ...this.config, ...options };
    this.config = opts;
    this.sessionId = `minecraft_${opts.host}_${opts.port}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.status = 'connecting';

    logger.info?.('MINECRAFT', `Conectando al servidor ${opts.host}:${opts.port} con usuario "${opts.username}"...`);

    try {
      if (this.bridge?.isElectron) {
        this.transportConnectionId = null;
        const res = await this.bridge.minecraftConnect(opts);

        if (res && res.success) {
          this.status = 'connected';
          this.transportConnectionId = res.connectionId || null;
          this.reconnectAttempts = 0;

          this.bus.emitDomain(
            EVENTS.GAME_CONNECTED,
            {
              game: 'minecraft',
              host: opts.host,
              port: opts.port,
              sessionId: this.sessionId,
              connectionId: this.transportConnectionId
            },
            { source: 'minecraft', sessionId: this.sessionId, privacy: 'internal' }
          );

          this.startTelemetry(3000);

          logger.info?.('MINECRAFT', `✓ Conexión establecida como ${opts.username}`);
          return {
            success: true,
            status: 'success',
            sessionId: this.sessionId,
            message: `Conectada al servidor ${opts.host}:${opts.port} como ${opts.username}.`
          };
        } else {
          this.status = 'error';
          const errMsg = res?.error || 'Fallo desconocido al conectar con el servidor.';
          this.scheduleReconnect(opts, errMsg);
          logger.error?.('MINECRAFT', 'Fallo al conectar:', errMsg);
          return { success: false, status: 'error', error: errMsg, sessionId: this.sessionId };
        }
      }

      // Browser mock fallback
      this.status = 'connected';
      this.bus.emitDomain(
        EVENTS.GAME_CONNECTED,
        { game: 'minecraft', host: opts.host, port: opts.port, sessionId: this.sessionId, connectionId: null },
        { source: 'minecraft', sessionId: this.sessionId, privacy: 'internal' }
      );
      this.startTelemetry(5000);
      return {
        success: true,
        status: 'success',
        sessionId: this.sessionId,
        message: 'Modo simulado de Minecraft Companion activo (entorno sin Electron).'
      };
    } catch (err: any) {
      this.status = 'error';
      this.scheduleReconnect(opts, err?.message || String(err));
      logger.error?.('MINECRAFT', 'Error crítico al conectar a Minecraft:', err);
      return { success: false, status: 'error', error: err?.message || 'Error de conexión', sessionId: this.sessionId };
    }
  }

  public async disconnect(): Promise<MinecraftCommandResult> {
    this.reconnectPolicy.enabled = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopTelemetry();
    this.status = 'disconnected';
    this.transportConnectionId = null;
    const currentSessionId = this.sessionId;

    logger.info?.('MINECRAFT', 'Desconectando bot de Minecraft...');
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.minecraftDisconnect();
      }
      this.bus.emitDomain(
        EVENTS.GAME_DISCONNECTED,
        { game: 'minecraft', sessionId: currentSessionId },
        { source: 'minecraft', sessionId: currentSessionId, privacy: 'internal' }
      );
      this.sessionId = null;
      return { success: true, status: 'success', message: 'Bot desconectado del servidor de Minecraft.' };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Error al desconectar' };
    }
  }

  public async sendChat(message: string): Promise<MinecraftCommandResult> {
    if (!message || typeof message !== 'string') {
      return { success: false, error: 'Mensaje inválido o vacío.' };
    }

    logger.info?.('MINECRAFT', `Enviando chat in-game: "${message}"`);
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.minecraftChat(message);
        if (res && res.success === false) {
          return { success: false, status: 'error', error: res.error || 'Error al enviar mensaje' };
        }
      }

      this.chatHistory.push({
        sender: this.config.username,
        message,
        timestamp: Date.now()
      });

      return { success: true, status: 'success', message: `Mensaje enviado: "${message}"` };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Error al enviar chat' };
    }
  }

  public async getStatus(): Promise<{
    status: string;
    sessionId: string | null;
    bot: MinecraftBotState;
    perception: MinecraftPerception;
    error?: string;
  }> {
    try {
      if (this.bridge?.isElectron) {
        const liveStatus = await this.bridge.minecraftGetStatus();
        if (liveStatus) {
          if (liveStatus.connectionId && this.transportConnectionId && liveStatus.connectionId !== this.transportConnectionId) {
            return {
              status: this.status,
              sessionId: this.sessionId,
              bot: this.botState,
              perception: this.getPerceptionSummary()
            };
          }

          if (liveStatus.health !== undefined) this.botState.health = liveStatus.health;
          if (liveStatus.food !== undefined) this.botState.food = liveStatus.food;
          if (liveStatus.position) this.botState.position = liveStatus.position;
          if (liveStatus.dimension) this.botState.dimension = liveStatus.dimension;
          if (liveStatus.timeOfDay !== undefined) this.botState.timeOfDay = liveStatus.timeOfDay;
          if (liveStatus.isRaining !== undefined) this.botState.isRaining = liveStatus.isRaining;
          if (Array.isArray(liveStatus.nearbyPlayers)) this.botState.nearbyPlayers = liveStatus.nearbyPlayers;
          if (Array.isArray(liveStatus.nearbyEntities)) this.botState.nearbyEntities = liveStatus.nearbyEntities;
          if (Array.isArray(liveStatus.inventory)) this.botState.inventory = liveStatus.inventory;

          if (liveStatus.status) this.status = liveStatus.status;

          const perception = this.getPerceptionSummary();
          this.bus.emitDomain(
            EVENTS.GAME_STATE_CHANGED,
            { game: 'minecraft', state: this.botState, perception, sessionId: this.sessionId },
            { source: 'minecraft', sessionId: this.sessionId, privacy: 'external' }
          );
        }
      }

      return {
        status: this.status,
        sessionId: this.sessionId,
        bot: this.botState,
        perception: this.getPerceptionSummary()
      };
    } catch (err: any) {
      return {
        status: this.status,
        sessionId: this.sessionId,
        bot: this.botState,
        perception: this.getPerceptionSummary(),
        error: err?.message
      };
    }
  }

  public async moveTo(x: number, y: number, z: number): Promise<MinecraftCommandResult> {
    logger.info?.('MINECRAFT', `Navegando a coordenadas: X=${x}, Y=${y}, Z=${z}`);
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.minecraftMoveTo({ x, y, z });
        return {
          success: Boolean(res?.success),
          status: res?.success ? 'success' : 'error',
          message: res?.message || `Moviéndose a ${x}, ${y}, ${z}`,
          error: res?.error
        };
      }
      return { success: true, status: 'success', message: `Moviéndose a ${x}, ${y}, ${z}` };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Error en movimiento' };
    }
  }

  public async followPlayer(playerName?: string): Promise<MinecraftCommandResult> {
    const target = playerName || 'creator';
    logger.info?.('MINECRAFT', `Siguiendo al jugador: ${target}`);
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.minecraftFollow(target);
        return {
          success: Boolean(res?.success),
          status: res?.success ? 'success' : 'error',
          message: res?.message || `Siguiendo a ${target}.`,
          error: res?.error
        };
      }
      return { success: true, status: 'success', message: `Siguiendo a ${target}.` };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Error al seguir jugador' };
    }
  }

  public async stopMoving(): Promise<MinecraftCommandResult> {
    logger.info?.('MINECRAFT', 'Deteniendo movimiento del bot.');
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.minecraftStop();
        return {
          success: Boolean(res?.success ?? true),
          status: 'success',
          message: 'Movimiento del bot detenido.'
        };
      }
      return { success: true, status: 'success', message: 'Bot detenido.' };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Error al detener bot' };
    }
  }

  public async stop(): Promise<MinecraftCommandResult> {
    return this.stopMoving();
  }

  public async mineBlock(x: number, y: number, z: number): Promise<MinecraftCommandResult> {
    logger.info?.('MINECRAFT', `Minando bloque en [${x}, ${y}, ${z}]`);
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.minecraftMineBlock({ x, y, z });
        return {
          success: Boolean(res?.success),
          status: res?.success ? 'success' : 'error',
          message: res?.message || `Bloque minado en [${x}, ${y}, ${z}].`,
          error: res?.error
        };
      }
      return { success: true, status: 'success', message: `Bloque minado en [${x}, ${y}, ${z}].` };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Error al minar bloque' };
    }
  }

  public async placeBlock(x: number, y: number, z: number, blockName: string): Promise<MinecraftCommandResult> {
    logger.info?.('MINECRAFT', `Colocando bloque "${blockName}" en [${x}, ${y}, ${z}]`);
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.minecraftPlaceBlock({ x, y, z, blockName });
        return {
          success: Boolean(res?.success),
          status: res?.success ? 'success' : 'error',
          message: res?.message || `Bloque ${blockName} colocado en [${x}, ${y}, ${z}].`,
          error: res?.error
        };
      }
      return { success: true, status: 'success', message: `Bloque ${blockName} colocado en [${x}, ${y}, ${z}].` };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Error al colocar bloque' };
    }
  }

  public async attackEntity(entityName: string): Promise<MinecraftCommandResult> {
    logger.info?.('MINECRAFT', `Atacando a: "${entityName}"`);
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.minecraftAttack({ entityName });
        return {
          success: Boolean(res?.success),
          status: res?.success ? 'success' : 'error',
          message: res?.message || `Atacando a ${entityName}.`,
          error: res?.error
        };
      }
      return { success: true, status: 'success', message: `Atacando a ${entityName}.` };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Error en combate' };
    }
  }

  public startTelemetry(intervalMs = 3000): void {
    this.stopTelemetry();
    this.telemetryIntervalId = setInterval(() => {
      if (this.status === 'connected') {
        void this.getStatus();
      }
    }, intervalMs);
  }

  public stopTelemetry(): void {
    if (this.telemetryIntervalId) {
      clearInterval(this.telemetryIntervalId);
      this.telemetryIntervalId = null;
    }
  }

  private scheduleReconnect(options: MinecraftConfig, reason: string): void {
    if (!this.reconnectPolicy.enabled || this.reconnectTimer || this.status === 'connected') return;
    if (this.reconnectAttempts >= this.reconnectPolicy.maxAttempts) {
      logger.warn?.('MINECRAFT', `Límite de reconexiones alcanzado (${this.reconnectPolicy.maxAttempts}).`);
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.reconnectPolicy.maxDelayMs,
      this.reconnectPolicy.baseDelayMs * 2 ** (this.reconnectAttempts - 1)
    );

    logger.warn?.(
      'MINECRAFT',
      `Reintento ${this.reconnectAttempts}/${this.reconnectPolicy.maxAttempts} en ${delay}ms (${reason})`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.status === 'disconnected' || !this.reconnectPolicy.enabled) return;
      this.status = 'disconnected';
      await this.connect(options);
    }, delay);
  }

  public destroy(): void {
    this.reconnectPolicy.enabled = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopTelemetry();
    this.unsubscribeEvent?.();
    this.unsubscribeEvent = null;
    this.unsubscribeChat?.();
    this.unsubscribeChat = null;
  }
}

export const minecraftCompanionService = new MinecraftCompanionService();
export default minecraftCompanionService;
