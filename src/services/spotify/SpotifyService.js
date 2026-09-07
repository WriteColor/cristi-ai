/**
 * Cristi AI - Spotify Music Service
 * Comprehensive Spotify integration allowing Cristi to play music, search songs,
 * skip tracks, control playback and volume via Spotify Desktop, Web API, and Playwright Web Player.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { playwrightService } from '../playwright/PlaywrightService.js';
import { browserAutomationService } from '../browser/BrowserAutomationService.js';
import { configManager } from '../configManager.js';
import { logger } from '../logger.js';

export class SpotifyService {
  constructor() {
    const envClientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SPOTIFY_CLIENT_ID) ||
                        (typeof process !== 'undefined' && (process.env?.VITE_SPOTIFY_CLIENT_ID || process.env?.SPOTIFY_CLIENT_ID)) ||
                        '';
    const envClientSecret = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SPOTIFY_CLIENT_SECRET) ||
                           (typeof process !== 'undefined' && (process.env?.VITE_SPOTIFY_CLIENT_SECRET || process.env?.SPOTIFY_CLIENT_SECRET)) ||
                           '';
    this.clientId = envClientId.trim();
    this.clientSecret = envClientSecret.trim();
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.currentTrack = null;
    this.currentArtist = null;
    this.isPlaying = false;

    // Eagerly auto-load saved credentials from configManager
    try {
      const cfg = configManager.loadConfig();
      if (cfg?.spotifyClientId && cfg?.spotifyClientSecret) {
        this.configure({ clientId: cfg.spotifyClientId, clientSecret: cfg.spotifyClientSecret });
      }
    } catch (_) {}
  }

  /**
   * Configure Spotify API credentials if available
   */
  configure({ clientId, clientSecret } = {}) {
    if (clientId) this.clientId = clientId.trim();
    if (clientSecret) this.clientSecret = clientSecret.trim();
  }

  /**
   * Check if Spotify Desktop or Microsoft Store App is physically installed on the system
   */
  async isDesktopInstalled() {
    try {
      const res = await electronBridge.spotifyControl('check_desktop_installed');
      if (res?.installed !== undefined) return Boolean(res.installed);
    } catch (_) {}

    // Fallback environment candidate check
    try {
      if (typeof process !== 'undefined' && process.env) {
        const fs = await import(/* @vite-ignore */ 'fs');
        const path = await import(/* @vite-ignore */ 'path');
        const localApp = process.env.LOCALAPPDATA || '';
        const appData = process.env.APPDATA || '';
        const progFiles = process.env['ProgramFiles'] || '';

        const candidates = [
          path.join(appData, 'Spotify/Spotify.exe'),
          path.join(progFiles, 'Spotify/Spotify.exe'),
          path.join(localApp, 'Microsoft/WindowsApps/Spotify.exe')
        ];
        return candidates.some((p) => p && fs.existsSync(p));
      }
    } catch (_) {}

    return false;
  }

  /**
   * Get an app token from Spotify Accounts API via Client Credentials flow
   */
  async getClientCredentialsToken() {
    if (!this.clientId || !this.clientSecret) {
      try {
        const cfg = configManager.loadConfig();
        if (cfg?.spotifyClientId && cfg?.spotifyClientSecret) {
          this.configure({ clientId: cfg.spotifyClientId, clientSecret: cfg.spotifyClientSecret });
        }
      } catch (_) {}
    }
    if (!this.clientId || !this.clientSecret) return null;
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    try {
      const basic = btoa(`${this.clientId}:${this.clientSecret}`);
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        logger.info('SPOTIFY', 'Token de Spotify Web API obtenido con éxito.');
        return this.accessToken;
      }
    } catch (err) {
      logger.warn('SPOTIFY', 'Error obteniendo token de Spotify Web API:', err.message);
    }
    return null;
  }

  /**
   * Play music on Spotify.
   * Resolves exact track from Spotify Web API catalog, then executes playback:
   * 1. Via Desktop if installed.
   * 2. Via Playwright + Brave Browser selecting and clicking the track directly.
   * 3. Fallback: Opens the track in Brave Browser.
   */
  async play({ query, uri, useWeb = false } = {}) {
    logger.info('SPOTIFY', `Solicitud de reproducción: ${query ? `"${query}"` : uri || 'Reanudar'}`);

    const hasDesktop = await this.isDesktopInstalled();

    // 1. Direct Spotify URI provided
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

    // 2. Query provided: Search, resolve exact track, select and play
    if (query && typeof query === 'string' && query.trim()) {
      const cleanQuery = query.trim();

      // Check Spotify Web API to resolve exact track URI & ID
      const token = await this.getClientCredentialsToken();
      let resolvedTrack = null;
      if (token) {
        try {
          const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanQuery)}&type=track&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (searchRes.ok) {
            const data = await searchRes.json();
            resolvedTrack = data.tracks?.items?.[0] || null;
          }
        } catch (e) {
          logger.warn('SPOTIFY', 'Búsqueda por Web API falló:', e.message);
        }
      }

      // If Spotify Desktop is installed and user didn't force web:
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

      // Web Mode (Desktop not installed or forced web):
      // Navigate directly to track URL so no search ambiguity exists!
      const webUrl = (resolvedTrack && resolvedTrack.id)
        ? `https://open.spotify.com/track/${resolvedTrack.id}`
        : `https://open.spotify.com/search/${encodeURIComponent(cleanQuery)}`;

      try {
        await playwrightService.navigate(webUrl);
        await new Promise((r) => setTimeout(r, 2000));

        // Precision selector: Clicks play button, top card or first row of tracklist
        const playClickScript = `
          (() => {
            // 1. If on direct track page, click main big play button
            const mainPlay = document.querySelector('button[data-testid="play-button"]');
            if (mainPlay) {
              mainPlay.click();
              return { clicked: true, method: 'main-play-button' };
            }

            // 2. If on search results page, find first track row and select/play it
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

            // 3. Top result card
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
        logger.warn('SPOTIFY', 'Playwright falló, abriendo en Brave Browser directamente:', pwErr.message);
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

    // 3. No query: Toggle Play/Pause / Resume current track
    const res = await electronBridge.spotifyControl('play_pause');
    return {
      status: 'success',
      action: 'play_pause',
      message: 'Comando de reproducción/pausa enviado a Spotify.'
    };
  }

  /**
   * Pause playback
   */
  async pause() {
    logger.info('SPOTIFY', 'Pausando reproducción de Spotify...');
    const res = await electronBridge.spotifyControl('play_pause');
    return {
      status: 'success',
      action: 'pause',
      message: 'Música pausada en Spotify.'
    };
  }

  /**
   * Skip to next track
   */
  async next() {
    logger.info('SPOTIFY', 'Saltando a la siguiente canción...');
    const res = await electronBridge.spotifyControl('next');
    return {
      status: 'success',
      action: 'next',
      message: 'Saltando a la siguiente pista en Spotify.'
    };
  }

  /**
   * Go to previous track
   */
  async previous() {
    logger.info('SPOTIFY', 'Retrocediendo a la canción anterior...');
    const res = await electronBridge.spotifyControl('previous');
    return {
      status: 'success',
      action: 'previous',
      message: 'Volviendo a la pista anterior en Spotify.'
    };
  }

  /**
   * Get currently playing track and status from Spotify window title or API
   */
  async getStatus() {
    const res = await electronBridge.spotifyControl('get_status');
    if (res?.success || res?.status === 'success') {
      const title = res.title || res.rawTitle || '';
      let artist = res.artist || null;
      let track = res.track || null;
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
      message: res?.error || 'Spotify en segundo plano o inactivo.'
    };
  }

  /**
   * Search tracks, artists, albums, or playlists on Spotify
   */
  async search({ query, type = 'track' } = {}) {
    if (!query) return { status: 'error', message: 'Consulta de búsqueda requerida.' };

    const token = await this.getClientCredentialsToken();
    if (token) {
      try {
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=5`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const items = data[`${type}s`]?.items || [];
          return {
            status: 'success',
            query,
            type,
            count: items.length,
            results: items.map((item) => ({
              id: item.id,
              name: item.name,
              artist: item.artists ? item.artists.map((a) => a.name).join(', ') : item.owner?.display_name,
              uri: item.uri,
              url: item.external_urls?.spotify
            }))
          };
        }
      } catch (err) {
        logger.warn('SPOTIFY', 'Error en búsqueda API:', err.message);
      }
    }

    // Fallback search via Desktop app
    await electronBridge.spotifyControl('search_desktop', { query });
    return {
      status: 'success',
      query,
      type,
      message: `Búsqueda de "${query}" lanzada en Spotify.`
    };
  }

  /**
   * Adjust media volume up or down
   */
  async setVolume({ direction = 'up' } = {}) {
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
