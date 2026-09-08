import type { IToolHandler } from '../IToolHandler';
import { minecraftCompanion } from '@/services/gameIntegration/MinecraftCompanionService.js';
import { discordCompanion } from '@/services/discord/DiscordCompanionService.js';
import { discordVoiceService } from '@/services/discord/DiscordVoiceService.js';
import { translationService } from '@/services/translation/TranslationService.js';

export const minecraftConnectHandler: IToolHandler = {
  name: 'minecraft_connect',
  declaration: {
    name: 'minecraft_connect',
    description: 'Conecta tu bot compañero al servidor de Minecraft del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        host: { type: 'STRING', description: 'Dirección IP o host del servidor (por defecto "localhost").' },
        port: { type: 'INTEGER', description: 'Puerto del servidor (por defecto 25565).' },
        username: { type: 'STRING', description: 'Nombre de usuario del bot (por defecto "Cristi_AI").' }
      }
    }
  },
  async execute(args: any) {
    return await minecraftCompanion.connect(args);
  }
};

export const minecraftDisconnectHandler: IToolHandler = {
  name: 'minecraft_disconnect',
  declaration: {
    name: 'minecraft_disconnect',
    description: 'Desconecta tu bot del servidor de Minecraft.'
  },
  async execute() {
    return await minecraftCompanion.disconnect();
  }
};

export const minecraftGetStatusHandler: IToolHandler = {
  name: 'minecraft_get_status',
  declaration: {
    name: 'minecraft_get_status',
    description: 'Consulta tu estado en el juego: vida, hambre, coordenadas (X, Y, Z), dimensión y jugadores cercanos.'
  },
  async execute() {
    return await minecraftCompanion.getStatus();
  }
};

export const minecraftChatHandler: IToolHandler = {
  name: 'minecraft_chat',
  declaration: {
    name: 'minecraft_chat',
    description: 'Envía un mensaje de texto en el chat público de Minecraft.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: { type: 'STRING', description: 'El mensaje a enviar al chat del juego.' }
      },
      required: ['message']
    }
  },
  async execute(args: { message?: string }) {
    return await minecraftCompanion.sendChat(args?.message);
  }
};

export const minecraftMoveToHandler: IToolHandler = {
  name: 'minecraft_move_to',
  declaration: {
    name: 'minecraft_move_to',
    description: 'Navega autónomamente y camina hacia unas coordenadas X, Y, Z específicas en Minecraft.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'INTEGER', description: 'Coordenada X.' },
        y: { type: 'INTEGER', description: 'Coordenada Y.' },
        z: { type: 'INTEGER', description: 'Coordenada Z.' }
      },
      required: ['x', 'y', 'z']
    }
  },
  async execute(args: { x?: number; y?: number; z?: number }) {
    return await minecraftCompanion.moveTo(args?.x, args?.y, args?.z);
  }
};

export const minecraftFollowPlayerHandler: IToolHandler = {
  name: 'minecraft_follow_player',
  declaration: {
    name: 'minecraft_follow_player',
    description: 'Sigue automáticamente y acompaña a un jugador específico en Minecraft.',
    parameters: {
      type: 'OBJECT',
      properties: {
        player_name: { type: 'STRING', description: 'Nombre del jugador a seguir.' }
      },
      required: ['player_name']
    }
  },
  async execute(args: { player_name?: string }) {
    return await minecraftCompanion.followPlayer(args?.player_name);
  }
};

export const minecraftStopMovingHandler: IToolHandler = {
  name: 'minecraft_stop_moving',
  declaration: {
    name: 'minecraft_stop_moving',
    description: 'Detiene inmediatamente el movimiento o navegación del bot en Minecraft.'
  },
  async execute() {
    return await minecraftCompanion.stop();
  }
};

export const minecraftMineBlockHandler: IToolHandler = {
  name: 'minecraft_mine_block',
  declaration: {
    name: 'minecraft_mine_block',
    description: 'Mina o rompe un bloque en las coordenadas X, Y, Z especificadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'INTEGER', description: 'Coordenada X del bloque.' },
        y: { type: 'INTEGER', description: 'Coordenada Y del bloque.' },
        z: { type: 'INTEGER', description: 'Coordenada Z del bloque.' }
      },
      required: ['x', 'y', 'z']
    }
  },
  async execute(args: { x?: number; y?: number; z?: number }) {
    return await minecraftCompanion.mineBlock(args?.x, args?.y, args?.z);
  }
};

export const minecraftPlaceBlockHandler: IToolHandler = {
  name: 'minecraft_place_block',
  declaration: {
    name: 'minecraft_place_block',
    description: 'Coloca un bloque en las coordenadas X, Y, Z especificadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'INTEGER', description: 'Coordenada X.' },
        y: { type: 'INTEGER', description: 'Coordenada Y.' },
        z: { type: 'INTEGER', description: 'Coordenada Z.' },
        block_name: { type: 'STRING', description: 'Nombre del bloque en el inventario (ej: "cobblestone", "dirt", "torch").' }
      },
      required: ['x', 'y', 'z', 'block_name']
    }
  },
  async execute(args: { x?: number; y?: number; z?: number; block_name?: string }) {
    return await minecraftCompanion.placeBlock(args?.x, args?.y, args?.z, args?.block_name);
  }
};

export const minecraftAttackEntityHandler: IToolHandler = {
  name: 'minecraft_attack_entity',
  declaration: {
    name: 'minecraft_attack_entity',
    description: 'Ataca a una entidad hostil o criatura cercana en Minecraft.',
    parameters: {
      type: 'OBJECT',
      properties: {
        entity_name: { type: 'STRING', description: 'Nombre o tipo de la entidad a atacar (ej: "zombie", "skeleton", "creeper").' }
      }
    }
  },
  async execute(args: { entity_name?: string }) {
    return await minecraftCompanion.attackEntity(args?.entity_name);
  }
};

export const discordSendMessageHandler: IToolHandler = {
  name: 'discord_send_message',
  declaration: {
    name: 'discord_send_message',
    description: 'Envía un mensaje de texto o respuesta a un canal de Discord configurado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        channel_id: { type: 'STRING', description: 'ID del canal de Discord destino.' },
        content: { type: 'STRING', description: 'Texto del mensaje a enviar.' }
      },
      required: ['channel_id', 'content']
    }
  },
  async execute(args: { channel_id?: string; content?: string }) {
    return await discordCompanion.sendMessage(args?.channel_id, args?.content);
  }
};

export const discordSetStatusHandler: IToolHandler = {
  name: 'discord_set_status',
  declaration: {
    name: 'discord_set_status',
    description: 'Actualiza el mensaje de estado y actividad de tu bot de Discord (ej: "Jugando con Ariel").',
    parameters: {
      type: 'OBJECT',
      properties: {
        status_text: { type: 'STRING', description: 'El texto de estado.' },
        activity_type: { type: 'STRING', enum: ['Playing', 'Listening', 'Watching'], description: 'Tipo de actividad.' }
      },
      required: ['status_text']
    }
  },
  async execute(args: { status_text?: string; activity_type?: string }) {
    return await discordCompanion.setStatus(args?.status_text, args?.activity_type);
  }
};

export const discordVoiceJoinHandler: IToolHandler = {
  name: 'discord_voice_join',
  declaration: {
    name: 'discord_voice_join',
    description: 'Conecta a Cristi a un canal de voz de Discord para escuchar participantes y enviar audio traducido cuando corresponda.',
    parameters: {
      type: 'OBJECT',
      properties: {
        guild_id: { type: 'STRING', description: 'ID del servidor de Discord.' },
        channel_id: { type: 'STRING', description: 'ID del canal de voz o stage.' },
        translate: { type: 'BOOLEAN', description: 'Activa traducción por lotes de participantes.' },
        target_language: { type: 'STRING', description: 'Idioma destino ISO (por ejemplo es, en, ja).' },
        output_route: {
          type: 'STRING',
          enum: ['local', 'discord_voice'],
          description: 'Ruta de salida de la traducción: local reproduce en el equipo; discord_voice devuelve el audio al canal.'
        }
      },
      required: ['guild_id', 'channel_id']
    }
  },
  async execute(args: {
    guild_id?: string;
    channel_id?: string;
    translate?: boolean;
    target_language?: string;
    output_route?: string;
  }) {
    const result = await discordVoiceService.join({ guildId: args?.guild_id, channelId: args?.channel_id });
    if (args?.translate !== true) {
      translationService.detachEventSource('discord.voice_audio');
    }
    if (result?.success && args?.translate === true) {
      if (!translationService.isEnabled()) {
        return {
          ...result,
          translation: {
            enabled: false,
            error: 'La traducción externa está desactivada en Ajustes.'
          }
        };
      }
      const attached = translationService.attachEventSource('discord.voice_audio', {
        targetLanguage: typeof args?.target_language === 'string' ? args.target_language : 'es',
        aggregateMs: 400,
        relevanceGate: true,
        outputRoute: args?.output_route === 'discord_voice' ? 'discord_voice' : 'local',
        guildId: args?.guild_id,
        channelId: args?.channel_id
      } as any);
      return {
        ...result,
        translation: {
          enabled: true,
          attached,
          outputRoute: args?.output_route === 'discord_voice' ? 'discord_voice' : 'local'
        }
      };
    }
    return result;
  }
};

export const discordVoiceLeaveHandler: IToolHandler = {
  name: 'discord_voice_leave',
  declaration: {
    name: 'discord_voice_leave',
    description: 'Desconecta a Cristi del canal de voz de Discord y libera el decodificador.'
  },
  async execute() {
    translationService.detachEventSource('discord.voice_audio');
    return await discordVoiceService.leave();
  }
};

export const discordVoiceStatusHandler: IToolHandler = {
  name: 'discord_voice_status',
  declaration: {
    name: 'discord_voice_status',
    description: 'Devuelve el estado de la conexión de voz de Discord.'
  },
  async execute() {
    return { status: 'success', ...(discordVoiceService.getStatus() as any) };
  }
};

export const gameTools: IToolHandler[] = [
  minecraftConnectHandler,
  minecraftDisconnectHandler,
  minecraftGetStatusHandler,
  minecraftChatHandler,
  minecraftMoveToHandler,
  minecraftFollowPlayerHandler,
  minecraftStopMovingHandler,
  minecraftMineBlockHandler,
  minecraftPlaceBlockHandler,
  minecraftAttackEntityHandler,
  discordSendMessageHandler,
  discordSetStatusHandler,
  discordVoiceJoinHandler,
  discordVoiceLeaveHandler,
  discordVoiceStatusHandler
];
