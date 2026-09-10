/**
 * Cristi AI - Spotify Music Service
 * Comprehensive Spotify integration allowing Cristi to play music, search songs,
 * skip tracks, control playback and volume via Spotify Desktop, Web API, and Playwright Web Player.
 */

import { electronBridge } from '../../../services/desktop/ElectronBridge';
import { playwrightService } from '../playwright/PlaywrightService';
import { browserAutomationService } from '../browser/BrowserAutomationService';
import { configManager } from '../../../infrastructure/config/ConfigManager';
import { logger } from '../../../infrastructure/logging/logger';

export interface SpotifyTrackInfo {
  id?: string;
  name?: string;
  artists?: Array<{ name: string }>;
  uri?: string;
  external_urls?: { spotify?: string };
  owner?: { display_name?: string };
}

export interface SpotifySearchResultItem {
  id?: string;
  name?: string;
  artist?: string;
  uri?: string;
  url?: string;
}

export interface SpotifyActionResult {
  status: 'success' | 'idle' | 'error';
  action?: string;
  mode?: string;
  uri?: string;
  url?: string;
  track?: string | null;
  artist?: string | null;
  title?: string;
  query?: string;
  type?: string;
  count?: number;
  results?: SpotifySearchResultItem[];
  isRunning?: boolean;
  isPlaying?: boolean;
  message?: string;
}

export class SpotifyService {
  public clientId = '';
  public clientSecret = '';
  public accessToken: string | null = null;
  public tokenExpiresAt = 0;
  public currentTrack: string | null = null;
  public currentArtist: string | null = null;
  public isPlaying = false;

  constructor() {
    // Eagerly auto-load saved credentials from configManager
    try {
      const cfg = configManager.loadConfig();
      if (cfg && typeof cfg === 'object') {
        const clientCfg = cfg as { spotifyClientId?: string; spotifyClientSecret?: string };
        if (clientCfg.spotifyClientId && clientCfg.spotifyClientSecret) {
          this.configure({ clientId: clientCfg.spotifyClientId, clientSecret: clientCfg.spotifyClientSecret });
        }
      }
    } catch {
      // ignore
    }
  }

  configure({ clientId, clientSecret }: { clientId?: string; clientSecret?: string } = {}): void {
    if (clientId) this.clientId = clientId.trim();
    if (clientSecret) this.clientSecret = clientSecret.trim();
  }

  async isDesktopInstalled(): Promise<boolean> {
    try {
      const res = await electronBridge.spotifyControl('check_desktop_installed');
      if (res?.installed !== undefined) return Boolean(res.installed);
    } catch {
      // fallback
    }
    return false;
  }

  async getClientCredentialsToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return this.accessToken;
    this.accessToken = await electronBridge.spotifyToken();
    this.tokenExpiresAt = Date.now() + 5 * 60 * 1000;
    return this.accessToken;
  }

  async play({ query, uri, useWeb = false }: { query?: string; uri?: string; useWeb?: boolean } = {}): Promise<SpotifyActionResult> {
    logger.info('SPOTIFY', `Solicitud de reproducción: ${query ? `"${query}"` : uri || 'Reanudar'}`);

    const hasDesktop = await this.isDesktopInstalled();

    if (uri && typeof uri === 'string') {
      if (hasDesktop && !useWeb) {
        await electronBridge.spotifyControl('open_uri', { uri });
        return {
          status: 'success',
          action: 'open_uri',
          uri,
          message: `Abriendo y reproduciendo en Spotify Desktop: ${uri}`
        };
      } else {
        const trackId = uri.replace('spotify:track:', '');
        const webUrl = uri.startsWith('spotify:track:')
          ? `https://open.spotify.com/track/${trackId}`
          : 'https://open.spotify.com';
        await browserAutomationService.openInBrave(webUrl);
        return {
          status: 'success',
          action: 'open_web',
          uri: webUrl,
          message: `Reproduciendo en Spotify Web (Brave): ${webUrl}`
        };
      }
    }

    if (query && typeof query === 'string' && query.trim()) {
      const cleanQuery = query.trim();

      const token = await this.getClientCredentialsToken();
      let resolvedTrack: SpotifyTrackInfo | null = null;
      if (token) {
        try {
          const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanQuery)}&type=track&limit=5`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (searchRes.ok) {
            const data = await searchRes.json();
            resolvedTrack = (data.tracks?.items?.[0] as SpotifyTrackInfo) || null;
          }
        } catch (e) {
          const err = e as Error;
          logger.warn('SPOTIFY', 'Búsqueda por Web API falló:', err.message);
        }
      }

      if (hasDesktop && !useWeb && resolvedTrack && resolvedTrack.uri) {
        await electronBridge.spotifyControl('open_uri', { uri: resolvedTrack.uri });
        return {
          status: 'success',
          mode: 'api_resolved_desktop',
          track: resolvedTrack.name,
          artist: resolvedTrack.artists?.map((a) => a.name).join(', '),
          uri: resolvedTrack.uri,
          message: `Reproduciendo "${resolvedTrack.name}" de ${resolvedTrack.artists?.[0]?.name} en Spotify Desktop.`
        };
      }

      const webUrl = (resolvedTrack && resolvedTrack.id)
        ? `https://open.spotify.com/track/${resolvedTrack.id}`
        : `https://open.spotify.com/search/${encodeURIComponent(cleanQuery)}`;

      try {
        await playwrightService.navigate(webUrl);
        await new Promise((r) => setTimeout(r, 2000));

        const playClickScript = `
          (() => {
            const mainPlay = document.querySelector('button[data-testid="play-button"]');
            if (mainPlay) {
              mainPlay.click();
              return { clicked: true, method: 'main-play-button' };
            }
            const firstRow = document.querySelector('[data-testid="tracklist-row"]');
            if (firstRow) {
              const rowPlay = firstRow.querySelector('button[data-testid="play-button"]') ||
                              firstRow.querySelector('button[aria-label*="Play" i]') ||
                              firstRow.querySelector('button[aria-label*="Reproducir" i]');
              if (rowPlay) {
                rowPlay.click();
                return { clicked: true, method: 'row-play-button' };
              }
              firstRow.click();
              firstRow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
              return { clicked: true, method: 'row-dblclick' };
            }
            const topCard = document.querySelector('[data-testid="top-result-card"] button, [data-testid="top-result-card"]');
            if (topCard) {
              const btn = topCard.tagName === 'BUTTON' ? topCard : topCard.querySelector('button');
              if (btn) {
                btn.click();
                return { clicked: true, method: 'top-card-button' };
              }
            }
            return { clicked: false };
          })()
        `;
        const evalRes = await playwrightService.evaluate(playClickScript);
        logger.info('SPOTIFY', 'Resultado de click Playwright:', evalRes);

        if (evalRes && evalRes.success === false) {
          logger.warn('SPOTIFY', 'Playwright no disponible en este entorno, abriendo en Brave Browser directamente.');
          await browserAutomationService.openInBrave(webUrl);
          return {
            status: 'success',
            mode: 'brave_browser',
            track: resolvedTrack?.name || cleanQuery,
            artist: resolvedTrack?.artists?.map((a) => a.name).join(', ') || null,
            url: webUrl,
            message: `Abriendo "${resolvedTrack?.name || cleanQuery}" en Brave Browser.`
          };
        }

        return {
          status: 'success',
          mode: 'playwright_web',
          track: resolvedTrack?.name || cleanQuery,
          artist: resolvedTrack?.artists?.map((a) => a.name).join(', ') || null,
          url: webUrl,
          message: `Reproduciendo "${resolvedTrack?.name || cleanQuery}" en Spotify Web vía Playwright.`
        };
      } catch (pwErr) {
        const error = pwErr as Error;
        logger.warn('SPOTIFY', 'Playwright falló, abriendo en Brave Browser directamente:', error.message);
        await browserAutomationService.openInBrave(webUrl);
        return {
          status: 'success',
          mode: 'brave_browser',
          track: resolvedTrack?.name || cleanQuery,
          artist: resolvedTrack?.artists?.map((a) => a.name).join(', ') || null,
          url: webUrl,
          message: `Abriendo "${resolvedTrack?.name || cleanQuery}" en Brave Browser.`
        };
      }
    }

    await electronBridge.spotifyControl('play_pause');
    return {
      status: 'success',
      action: 'play_pause',
      message: 'Comando de reproducción/pausa enviado a Spotify.'
    };
  }

  async pause(): Promise<SpotifyActionResult> {
    logger.info('SPOTIFY', 'Pausando reproducción de Spotify...');
    await electronBridge.spotifyControl('play_pause');
    return {
      status: 'success',
      action: 'pause',
      message: 'Música pausada en Spotify.'
    };
  }

  async next(): Promise<SpotifyActionResult> {
    logger.info('SPOTIFY', 'Saltando a la siguiente canción...');
    await electronBridge.spotifyControl('next');
    return {
      status: 'success',
      action: 'next',
      message: 'Saltando a la siguiente pista en Spotify.'
    };
  }

  async previous(): Promise<SpotifyActionResult> {
    logger.info('SPOTIFY', 'Retrocediendo a la canción anterior...');
    await electronBridge.spotifyControl('previous');
    return {
      status: 'success',
      action: 'previous',
      message: 'Volviendo a la pista anterior en Spotify.'
    };
  }

  async getStatus(): Promise<SpotifyActionResult> {
    const res = await electronBridge.spotifyControl('get_status');
    if (res?.success || res?.status === 'success') {
      const title = (res.title as string) || (res.rawTitle as string) || '';
      let artist = (res.artist as string) || null;
      let track = (res.track as string) || null;
      if (title && title.includes(' - ') && !title.includes('Spotify')) {
        const parts = title.split(' - ');
        artist = parts[0]?.trim();
        track = parts.slice(1).join(' - ')?.trim();
      }
      this.isPlaying = Boolean(res.isPlaying);
      this.currentArtist = artist;
      this.currentTrack = track;
      return {
        status: 'success',
        isRunning: true,
        isPlaying: Boolean(res.isPlaying),
        artist,
        track,
        title: title || `${artist ? `${artist} - ` : ''}${track || 'Spotify'}`
      };
    }
    return {
      status: 'idle',
      isRunning: false,
      isPlaying: false,
      message: (res?.error as string) || 'Spotify en segundo plano o inactivo.'
    };
  }

  async search({ query, type = 'track' }: { query: string; type?: string }): Promise<SpotifyActionResult> {
    if (!query) return { status: 'error', message: 'Consulta de búsqueda requerida.' };

    const token = await this.getClientCredentialsToken();
    if (token) {
      try {
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=5`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = (await res.json()) as Record<string, {
            items?: Array<{
              id?: string;
              name?: string;
              uri?: string;
              artists?: Array<{ name: string }>;
              owner?: { display_name?: string };
              album?: { name: string };
              external_urls?: { spotify?: string };
            }>;
          }>;
          const items = data[`${type}s`]?.items || [];
          return {
            status: 'success',
            query,
            type,
            count: items.length,
            results: items.map((item) => ({
              id: item.id,
              name: item.name,
              artist: item.artists ? item.artists.map((a: { name: string }) => a.name).join(', ') : item.owner?.display_name,
              uri: item.uri,
              url: item.external_urls?.spotify
            }))
          };
        }
      } catch (err) {
        const error = err as Error;
        logger.warn('SPOTIFY', 'Error en búsqueda API:', error.message);
      }
    }

    await electronBridge.spotifyControl('search_desktop', { query });
    return {
      status: 'success',
      query,
      type,
      message: `Búsqueda de "${query}" lanzada en Spotify.`
    };
  }

  async setVolume({ direction = 'up' }: { direction?: 'up' | 'down' } = {}): Promise<SpotifyActionResult> {
    const action = direction === 'down' ? 'volume_down' : 'volume_up';
    await electronBridge.spotifyControl(action);
    return {
      status: 'success',
      action,
      message: `Volumen ${direction === 'down' ? 'reducido' : 'aumentado'}.`
    };
  }
}

export const spotifyService = new SpotifyService();
export default spotifyService;
