import { protocol, net, app } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PathPolicy } from '../security/PathPolicy';

export const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.scdn.co; media-src 'self' blob: data:; font-src 'self'; connect-src 'self' wss://generativelanguage.googleapis.com https://generativelanguage.googleapis.com https://api.spotify.com https://accounts.spotify.com https://storage.googleapis.com https://tfhub.dev; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export function protocolResource(url: string): { scenes: boolean; relative: string } {
  const parsed = new URL(url);
  if (parsed.protocol !== 'app:' || parsed.host !== 'cristi' || parsed.username || parsed.password) throw new Error('Origen inválido.');
  const decoded = decodeURIComponent(parsed.pathname);
  if (decoded.includes('\\') || decoded.includes('%')) throw new Error('Ruta inválida.');
  const scenes = decoded.startsWith('/custom-scenes/');
  const relative = scenes ? decoded.slice('/custom-scenes/'.length) : decoded.slice(1) || 'index.html';
  return { scenes, relative };
}

export function registerAppProtocol(rootDir: string): void {
  const policy = new PathPolicy({ exports: path.join(app.isPackaged ? app.getAppPath() : rootDir, 'dist'),
    customScenes: path.join(app.getPath('userData'), 'custom_scenes') });
  protocol.handle('app', async request => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
      const { scenes, relative } = protocolResource(request.url);
      const file = await policy.resolveWithin(scenes ? 'customScenes' : 'exports', relative);
      if (scenes && !/\.(mp4|webm|mkv|mov|png|jpg|jpeg|gif|webp)$/i.test(file)) throw new Error('Tipo inválido.');
      const response = await net.fetch(pathToFileURL(file).href, { method: request.method, headers: request.headers });
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response('Recurso no disponible', { status: 404,
        headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY } });
    }
  });
}
