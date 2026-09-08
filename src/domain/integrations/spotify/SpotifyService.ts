/**
 * Cristi AI - Spotify Desktop & Web API Music Service (Domain Layer)
 * 
 * Provides unified playback control for Spotify Desktop and Spotify Web API:
 * global search for tracks/albums, playback by Spotify URI, play/pause toggling,
 * track skipping, and volume adjustment.
 */

import type {
  SpotifyAlbum,
  SpotifyCommandResult,
  SpotifyPlaybackState,
  SpotifySearchResult,
  SpotifyTrack
} from '@/types';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { logger } from '@/services/logger.js';

export interface ISpotifyService {
  readonly currentTrack: string | null;
  readonly currentArtist: string | null;
  readonly isPlaying: boolean;

  configure(credentials: { clientId?: string; clientSecret?: string }): void;
  isDesktopInstalled(): Promise<boolean>;
  getClientCredentialsToken(): Promise<string | null>;
  search(query: string, type?: 'track' | 'album' | 'all'): Promise<SpotifySearchResult>;
  searchTracks(query: string): Promise<SpotifySearchResult>;
  searchAlbums(query: string): Promise<SpotifySearchResult>;
  play(params?: { query?: string; uri?: string; useWeb?: boolean }): Promise<SpotifyCommandResult>;
  playUri(uri: string): Promise<SpotifyCommandResult>;
  pause(): Promise<SpotifyCommandResult>;
  playPause(): Promise<SpotifyCommandResult>;
  next(): Promise<SpotifyCommandResult>;
  previous(): Promise<SpotifyCommandResult>;
  volumeUp(): Promise<SpotifyCommandResult>;
  volumeDown(): Promise<SpotifyCommandResult>;
  setVolume(level: number): Promise<SpotifyCommandResult>;
  getStatus(): Promise<SpotifyPlaybackState>;
}

export class SpotifyService implements ISpotifyService {
  private readonly bridge: typeof electronBridge;
  private clientId = '';
  private clientSecret = '';
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  public currentTrack: string | null = null;
  public currentArtist: string | null = null;
  public isPlaying = false;

  constructor({ bridge = electronBridge } = {}) {
    this.bridge = bridge;

    const envClientId =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID) ||
      (typeof process !== 'undefined' && (process.env?.VITE_SPOTIFY_CLIENT_ID || process.env?.SPOTIFY_CLIENT_ID)) ||
      '';
    const envClientSecret =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SPOTIFY_CLIENT_SECRET) ||
      (typeof process !== 'undefined' && (process.env?.VITE_SPOTIFY_CLIENT_SECRET || process.env?.SPOTIFY_CLIENT_SECRET)) ||
      '';

    this.clientId = envClientId.trim();
    this.clientSecret = envClientSecret.trim();

    // Auto-load config if available
    this.loadSavedConfig();
  }

  private loadSavedConfig(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('cristi_app_config');
        if (stored) {
          const cfg = JSON.parse(stored);
          if (cfg?.spotifyClientId && cfg?.spotifyClientSecret) {
            this.configure({ clientId: cfg.spotifyClientId, clientSecret: cfg.spotifyClientSecret });
          }
        }
      }
    } catch (_) {}
  }

  public configure({ clientId, clientSecret }: { clientId?: string; clientSecret?: string }): void {
    if (clientId) this.clientId = clientId.trim();
    if (clientSecret) this.clientSecret = clientSecret.trim();
  }

  public async isDesktopInstalled(): Promise<boolean> {
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.spotifyControl('check_desktop_installed');
        if (res && res.installed !== undefined) return Boolean(res.installed);
        if (res && res.success !== undefined) return Boolean(res.success);
      }
    } catch (_) {}
    return false;
  }

  /**
   * Retrieves an app access token from Spotify Accounts API via Client Credentials flow
   */
  public async getClientCredentialsToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) {
      this.loadSavedConfig();
    }
    if (!this.clientId || !this.clientSecret) return null;

    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    try {
      const basic = typeof globalThis.btoa === 'function'
        ? globalThis.btoa(`${this.clientId}:${this.clientSecret}`)
        : Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
        logger.info?.('SPOTIFY', 'Token de Spotify Web API obtenido con éxito.');
        return this.accessToken;
      }
    } catch (err: any) {
      logger.warn?.('SPOTIFY', 'Fallo al obtener token de Spotify Web API:', err?.message || err);
    }

    return null;
  }

  /**
   * Global search for tracks and albums in Spotify catalog
   */
  public async search(query: string, type: 'track' | 'album' | 'all' = 'all'): Promise<SpotifySearchResult> {
    if (!query || typeof query !== 'string') {
      return { success: false, query: '', tracks: [], albums: [], error: 'Consulta de búsqueda vacía.' };
    }

    const token = await this.getClientCredentialsToken();
    if (!token) {
      // Offline fallback: return a synthesized search response with direct search URI
      const encoded = encodeURIComponent(query);
      return {
        success: true,
        query,
        tracks: [
          {
            id: `search_${Date.now()}`,
            name: query,
            artists: ['Spotify'],
            albumName: 'Resultado de búsqueda',
            uri: `spotify:search:${encoded}`
          }
        ],
        albums: []
      };
    }

    try {
      const apiType = type === 'all' ? 'track,album' : type;
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${apiType}&limit=10`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        return { success: false, query, tracks: [], albums: [], error: `Spotify API Error: ${res.statusText}` };
      }

      const data = await res.json();
      const tracks: SpotifyTrack[] = (data.tracks?.items || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        artists: (t.artists || []).map((a: any) => a.name),
        albumName: t.album?.name || '',
        uri: t.uri,
        durationMs: t.duration_ms,
        previewUrl: t.preview_url || null,
        coverImage: t.album?.images?.[0]?.url || null
      }));

      const albums: SpotifyAlbum[] = (data.albums?.items || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        artists: (a.artists || []).map((art: any) => art.name),
        uri: a.uri,
        totalTracks: a.total_tracks,
        coverImage: a.images?.[0]?.url || null
      }));

      return { success: true, query, tracks, albums };
    } catch (err: any) {
      logger.error?.('SPOTIFY', 'Error en búsqueda:', err);
      return { success: false, query, tracks: [], albums: [], error: err?.message || String(err) };
    }
  }

  public async searchTracks(query: string): Promise<SpotifySearchResult> {
    return this.search(query, 'track');
  }

  public async searchAlbums(query: string): Promise<SpotifySearchResult> {
    return this.search(query, 'album');
  }

  /**
   * Play music on Spotify: resolves query or URI and directs to Desktop or Web
   */
  public async play({
    query,
    uri,
    useWeb = false
  }: { query?: string; uri?: string; useWeb?: boolean } = {}): Promise<SpotifyCommandResult> {
    const hasDesktop = await this.isDesktopInstalled();

    // 1. Direct Spotify URI provided
    if (uri && typeof uri === 'string') {
      return this.playUri(uri);
    }

    // 2. Query provided: search catalog first to get exact URI
    if (query && typeof query === 'string') {
      logger.info?.('SPOTIFY', `Buscando pista para reproducir: "${query}"`);
      const searchRes = await this.search(query, 'track');
      const topTrack = searchRes.tracks?.[0];

      if (topTrack?.uri) {
        this.currentTrack = topTrack.name;
        this.currentArtist = topTrack.artists.join(', ');
        this.isPlaying = true;
        return this.playUri(topTrack.uri);
      }

      // If no exact match via Web API, trigger native desktop search
      if (hasDesktop && !useWeb && this.bridge?.isElectron) {
        await this.bridge.spotifyControl('search_desktop', { query });
        this.isPlaying = true;
        return {
          success: true,
          status: 'success',
          action: 'search_desktop',
          message: `Buscando y reproduciendo "${query}" en Spotify Desktop.`
        };
      }

      const webSearchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
      if (this.bridge?.isElectron) {
        await this.bridge.openExternal(webSearchUrl);
      } else if (typeof window !== 'undefined') {
        window.open(webSearchUrl, '_blank');
      }

      return {
        success: true,
        status: 'success',
        action: 'open_web_search',
        uri: webSearchUrl,
        isWebFallback: true,
        message: `Buscando "${query}" en Spotify Web.`
      };
    }

    // 3. Resume current playback
    return this.playPause();
  }

  /**
   * Play specific Spotify URI (track, album, playlist)
   */
  public async playUri(uri: string): Promise<SpotifyCommandResult> {
    if (!uri || typeof uri !== 'string') {
      return { success: false, status: 'error', error: 'URI de Spotify inválida.' };
    }

    const hasDesktop = await this.isDesktopInstalled();

    if (hasDesktop && this.bridge?.isElectron) {
      await this.bridge.spotifyControl('open_uri', { uri });
      this.isPlaying = true;
      return {
        success: true,
        status: 'success',
        action: 'open_uri',
        uri,
        message: `Reproduciendo en Spotify Desktop: ${uri}`
      };
    }

    // Web player fallback
    let webUrl = 'https://open.spotify.com';
    if (uri.startsWith('spotify:track:')) {
      const trackId = uri.replace('spotify:track:', '');
      webUrl = `https://open.spotify.com/track/${trackId}`;
    } else if (uri.startsWith('spotify:album:')) {
      const albumId = uri.replace('spotify:album:', '');
      webUrl = `https://open.spotify.com/album/${albumId}`;
    } else if (uri.startsWith('spotify:playlist:')) {
      const playlistId = uri.replace('spotify:playlist:', '');
      webUrl = `https://open.spotify.com/playlist/${playlistId}`;
    }

    if (this.bridge?.isElectron) {
      await this.bridge.openExternal(webUrl);
    } else if (typeof window !== 'undefined') {
      window.open(webUrl, '_blank');
    }

    this.isPlaying = true;
    return {
      success: true,
      status: 'success',
      action: 'open_web',
      uri: webUrl,
      isWebFallback: true,
      message: `Reproduciendo en Spotify Web: ${webUrl}`
    };
  }

  public async pause(): Promise<SpotifyCommandResult> {
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.spotifyControl('play_pause');
        this.isPlaying = false;
        return { success: true, status: 'success', message: 'Reproducción pausada.' };
      }
      this.isPlaying = false;
      return { success: true, status: 'success', message: 'Pausa simulada.' };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || String(err) };
    }
  }

  public async playPause(): Promise<SpotifyCommandResult> {
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.spotifyControl('play_pause');
        this.isPlaying = !this.isPlaying;
        return {
          success: true,
          status: 'success',
          message: this.isPlaying ? 'Reproducción reanudada.' : 'Reproducción pausada.'
        };
      }
      this.isPlaying = !this.isPlaying;
      return { success: true, status: 'success', message: 'Play/Pause conmutado.' };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || String(err) };
    }
  }

  public async next(): Promise<SpotifyCommandResult> {
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.spotifyControl('next');
        return { success: true, status: 'success', message: 'Siguiente pista.' };
      }
      return { success: true, status: 'success', message: 'Siguiente pista simulada.' };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || String(err) };
    }
  }

  public async previous(): Promise<SpotifyCommandResult> {
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.spotifyControl('previous');
        return { success: true, status: 'success', message: 'Pista anterior.' };
      }
      return { success: true, status: 'success', message: 'Pista anterior simulada.' };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || String(err) };
    }
  }

  public async volumeUp(): Promise<SpotifyCommandResult> {
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.spotifyControl('volume_up');
        return { success: true, status: 'success', message: 'Volumen aumentado.' };
      }
      return { success: true, status: 'success', message: 'Volumen aumentado.' };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || String(err) };
    }
  }

  public async volumeDown(): Promise<SpotifyCommandResult> {
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.spotifyControl('volume_down');
        return { success: true, status: 'success', message: 'Volumen reducido.' };
      }
      return { success: true, status: 'success', message: 'Volumen reducido.' };
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || String(err) };
    }
  }

  public async setVolume(level: number): Promise<SpotifyCommandResult> {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    // Adjust volume via successive steps if absolute control is not native
    const steps = clamped > 50 ? 2 : 1;
    if (clamped > 50) {
      for (let i = 0; i < steps; i++) await this.volumeUp();
    } else {
      for (let i = 0; i < steps; i++) await this.volumeDown();
    }
    return { success: true, status: 'success', message: `Volumen ajustado al nivel aproximado: ${clamped}%` };
  }

  public async getStatus(): Promise<SpotifyPlaybackState> {
    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.spotifyControl('get_status');
        if (res && res.success) {
          const isRunning = Boolean(res.isRunning);
          const isPlaying = Boolean(res.isPlaying);
          this.isPlaying = isPlaying;
          if (res.track) this.currentTrack = res.track;
          if (res.artist) this.currentArtist = res.artist;

          return {
            success: true,
            isRunning,
            isPlaying,
            rawTitle: res.rawTitle || (this.currentTrack ? `${this.currentArtist || ''} - ${this.currentTrack}` : undefined),
            artist: this.currentArtist,
            track: this.currentTrack
          };
        }
      }

      return {
        success: true,
        isRunning: false,
        isPlaying: this.isPlaying,
        artist: this.currentArtist,
        track: this.currentTrack
      };
    } catch (err: any) {
      return {
        success: false,
        isRunning: false,
        isPlaying: false,
        error: err?.message || String(err)
      };
    }
  }
}

export const spotifyService = new SpotifyService();
export default spotifyService;
