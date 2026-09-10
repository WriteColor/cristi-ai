/**
 * Cristi AI - Video Game Integration Architecture (Minecraft Focus)
 * Provides a modular, decoupled hook for game telemetry, state events,
 * and conversational companion reactions without bypassing authentication or DRM.
 */

import { eventBus, EVENTS } from '../../../infrastructure/events/eventBus';
import { logger } from '../../../infrastructure/logging/logger';
import { GameAdapter } from './GameAdapter';

export interface GameState {
  isRunning: boolean;
  playerHealth: number;
  playerMaxHealth: number;
  currentDimension: 'overworld' | 'nether' | 'the_end' | string;
  isDead: boolean;
  lastEvent: { eventType: string; payload: Record<string, unknown>; timestamp: number } | null;
}

export interface SupportedGame {
  id: string;
  name: string;
  defaultPort?: number;
}

export class GameIntegrationManager {
  public activeGame = 'minecraft';
  public gameState: GameState = {
    isRunning: false,
    playerHealth: 20,
    playerMaxHealth: 20,
    currentDimension: 'overworld',
    isDead: false,
    lastEvent: null
  };

  public supportedGames: SupportedGame[] = [
    { id: 'minecraft', name: 'Minecraft (Java / Bedrock)', defaultPort: 25565 }
  ];
  public adapters = new Map<string, GameAdapter | { id: string; name: string }>();

  constructor() {
    this.registerAdapter({ id: 'minecraft', name: 'Minecraft (Java / Bedrock)' });
  }

  registerAdapter(adapter: GameAdapter | { id: string; name: string }): boolean {
    if (!adapter?.id) return false;
    this.adapters.set(adapter.id, adapter);
    return true;
  }

  unregisterAdapter(gameId: string): boolean {
    return this.adapters.delete(gameId);
  }

  getAdapter(gameId: string = this.activeGame): GameAdapter | { id: string; name: string } | null {
    return this.adapters.get(gameId) || null;
  }

  setActiveGame(gameId: string): boolean {
    if (!this.adapters.has(gameId) && !this.supportedGames.some((game) => game.id === gameId)) return false;
    this.activeGame = gameId;
    eventBus.emitDomain(EVENTS.GAME_STATE_CHANGED, { game: gameId, active: true }, {
      source: 'game_manager', privacy: 'internal'
    });
    return true;
  }

  handleGameEvent(eventType: string, payload: Record<string, unknown> = {}): void {
    this.gameState.lastEvent = { eventType, payload, timestamp: Date.now() };

    logger.info('GAME-EVENT', `Evento de juego [${this.activeGame}]: "${eventType}"`, payload);
    eventBus.emit(EVENTS.GAME_EVENT, { game: this.activeGame, eventType, payload });
    eventBus.emitDomain('game.event', { game: this.activeGame, eventType, payload }, {
      source: this.activeGame, privacy: 'external'
    });

    switch (eventType) {
      case 'player_death':
        this.gameState.isDead = true;
        this.gameState.playerHealth = 0;
        eventBus.emit(EVENTS.EMOTION_CHANGED, 'scared');
        break;

      case 'player_damage':
        if (payload.health !== undefined && typeof payload.health === 'number') {
          this.gameState.playerHealth = payload.health;
        }
        if (this.gameState.playerHealth <= 6) {
          eventBus.emit(EVENTS.EMOTION_CHANGED, 'yandere');
        }
        break;

      case 'achievement_unlocked':
      case 'boss_defeated':
        eventBus.emit(EVENTS.EMOTION_CHANGED, 'happy');
        break;

      case 'chat_message':
        break;

      default:
        break;
    }
  }

  simulateMinecraftScenario(scenarioName: string): void {
    logger.info('GAME-SIM', `Ejecutando escenario simulado de Minecraft: "${scenarioName}"`);

    switch (scenarioName) {
      case 'boss_defeated':
        this.handleGameEvent('boss_defeated', {
          bossName: 'Ender Dragon',
          location: 'The End',
          message: '¡Jeremy derrotó al Ender Dragon!'
        });
        break;

      case 'low_health_warning':
        this.handleGameEvent('player_damage', {
          health: 4,
          damageSource: 'Creeper',
          message: '¡Cuidado amor! Tu salud está crítica (2 corazones).'
        });
        break;

      case 'player_death':
        this.handleGameEvent('player_death', {
          cause: 'Caída en lava',
          message: 'Jeremy fue devorado por el fuego.'
        });
        break;

      default:
        this.handleGameEvent('game_started', { status: 'world_loaded', worldName: 'Cristi_and_Jeremy_World' });
        break;
    }
  }

  getGameState(): GameState {
    return { ...this.gameState };
  }
}

export const gameIntegrationManager = new GameIntegrationManager();
export default gameIntegrationManager;
