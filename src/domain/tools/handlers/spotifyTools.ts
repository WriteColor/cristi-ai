import type { IToolHandler } from '../IToolHandler';
import { spotifyService } from '@/services/spotify/SpotifyService.js';

export const spotifyPlayHandler: IToolHandler = {
  name: 'spotify_play',
  declaration: {
    name: 'spotify_play',
    description: 'Reproduce música en Spotify (aplicación de escritorio o web). Si indicas una canción, artista o playlist, la busca y reproduce de inmediato; si no indicas nada, reanuda la música o conmuta Play.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Canción, artista, álbum o estilo musical a reproducir (ej: "Lofi beats", "Deftones - Be Quiet and Drive", "The Weeknd").'
        },
        uri: {
          type: 'STRING',
          description: 'URI directa de Spotify si se dispone de ella (ej: "spotify:track:..." o "spotify:playlist:...").'
        },
        use_web: {
          type: 'BOOLEAN',
          description: 'Fuerza la reproducción a través del reproductor web de Spotify con Playwright.'
        }
      }
    }
  },
  async execute(args: { query?: string; uri?: string; use_web?: boolean }) {
    return await (spotifyService as any).play({
      query: args?.query,
      uri: args?.uri,
      useWeb: args?.use_web
    });
  }
};

export const spotifyPauseHandler: IToolHandler = {
  name: 'spotify_pause',
  declaration: {
    name: 'spotify_pause',
    description: 'Pausa la reproducción actual de música en Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  async execute() {
    return await spotifyService.pause();
  }
};

export const spotifyNextHandler: IToolHandler = {
  name: 'spotify_next',
  declaration: {
    name: 'spotify_next',
    description: 'Salta a la siguiente pista o canción en Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  async execute() {
    return await spotifyService.next();
  }
};

export const spotifyPreviousHandler: IToolHandler = {
  name: 'spotify_previous',
  declaration: {
    name: 'spotify_previous',
    description: 'Vuelve a la canción o pista anterior en Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  async execute() {
    return await spotifyService.previous();
  }
};

export const spotifyGetStatusHandler: IToolHandler = {
  name: 'spotify_get_status',
  declaration: {
    name: 'spotify_get_status',
    description: 'Consulta qué canción y artista se están reproduciendo actualmente en Spotify y el estado de la aplicación.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  async execute() {
    return await spotifyService.getStatus();
  }
};

export const spotifySearchHandler: IToolHandler = {
  name: 'spotify_search',
  declaration: {
    name: 'spotify_search',
    description: 'Busca canciones, artistas, álbumes o playlists en el catálogo de Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Término de búsqueda musical.'
        },
        type: {
          type: 'STRING',
          enum: ['track', 'artist', 'album', 'playlist'],
          description: 'Tipo de elemento a buscar.'
        }
      },
      required: ['query']
    }
  },
  async execute(args: { query?: string; type?: string }) {
    return await (spotifyService as any).search({
      query: args?.query,
      type: args?.type || 'track'
    });
  }
};

export const spotifySetVolumeHandler: IToolHandler = {
  name: 'spotify_set_volume',
  declaration: {
    name: 'spotify_set_volume',
    description: 'Ajusta el volumen de la música en Spotify hacia arriba o hacia abajo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        direction: {
          type: 'STRING',
          enum: ['up', 'down'],
          description: 'Dirección del ajuste de volumen ("up" para subir, "down" para bajar).'
        }
      },
      required: ['direction']
    }
  },
  async execute(args: { direction?: string }) {
    return await spotifyService.setVolume({
      direction: args?.direction || 'up'
    });
  }
};

export const spotifyTools: IToolHandler[] = [
  spotifyPlayHandler,
  spotifyPauseHandler,
  spotifyNextHandler,
  spotifyPreviousHandler,
  spotifyGetStatusHandler,
  spotifySearchHandler,
  spotifySetVolumeHandler
];
