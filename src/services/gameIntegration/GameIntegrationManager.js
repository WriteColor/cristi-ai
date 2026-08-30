/**
 * Cristi AI - Video Game Integration Architecture (Minecraft Focus)
 * Provides a modular, decoupled hook for game telemetry, state events,
 * and conversational companion reactions without bypassing authentication or DRM.
 */

import { eventBus, EVENTS } from '../eventBus';
import { logger } from '../logger';

export class GameIntegrationManager {
  constructor() {
    this.activeGame = 'minecraft';
    this.gameState = {
      isRunning: false,
      playerHealth: 20,
      playerMaxHealth: 20,
      currentDimension: 'overworld', // 'overworld' | 'nether' | 'the_end'
      isDead: false,
      lastEvent: null
    };

    this.supportedGames = [
      { id: 'minecraft', name: 'Minecraft (Java / Bedrock)', defaultPort: 25565 }
    ];
  }

  /**
   * Handle an event coming from Minecraft (via RCON, WebSockets, Mod, or Log watcher)
   * @param {string} eventType - e.g. 'player_damage', 'player_death', 'achievement_unlocked', 'chat_message'
   * @param {Object} payload 
   */
  handleGameEvent(eventType, payload = {}) {
    this.gameState.lastEvent = { eventType, payload, timestamp: Date.now() };

    logger.info('GAME-EVENT', `Evento de juego [${this.activeGame}]: "${eventType}"`, payload);
    eventBus.emit(EVENTS.GAME_EVENT, { game: this.activeGame, eventType, payload });

    // Automatic companion reaction triggers
    switch (eventType) {
      case 'player_death':
        this.gameState.isDead = true;
        this.gameState.playerHealth = 0;
        eventBus.emit(EVENTS.EMOTION_CHANGED, 'scared');
        break;

      case 'player_damage':
        if (payload.health !== undefined) {
          this.gameState.playerHealth = payload.health;
        }
        if (this.gameState.playerHealth <= 6) {
          eventBus.emit(EVENTS.EMOTION_CHANGED, 'yandere'); // Worried/Protective Yandere
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

  /**
   * Simulate a game event for demonstration and testing purposes
   */
  simulateMinecraftScenario(scenarioName) {
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

  getGameState() {
    return { ...this.gameState };
  }
}

export const gameIntegrationManager = new GameIntegrationManager();
