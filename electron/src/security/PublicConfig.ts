import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { atomicWrite, credentialVault } from './CredentialVault';
import { publicSettings } from '../../../shared/security';

let queue: Promise<unknown> = Promise.resolve();
const file = () => path.join(app.getPath('userData'), 'cristi-config.json');

export function readPublicConfig(): Promise<Record<string, unknown>> {
  const pending = queue.then(async () => {
    let config: Record<string, unknown> = {};
    try { config = JSON.parse(await fs.readFile(file(), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (!await credentialVault.get('gemini.apiKey')) config.apiKey ||= process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const clean = await credentialVault.migrate(config);
    if (JSON.stringify(clean) !== JSON.stringify(config)) await atomicWrite(file(), clean);
    return { ...clean, ...await credentialVault.status() };
  });
  queue = pending.catch(() => undefined);
  return pending;
}

export function writePublicConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const pending = queue.then(async () => {
    const clean = publicSettings(config);
    await atomicWrite(file(), clean);
    return { ...clean, ...await credentialVault.status() };
  });
  queue = pending.catch(() => undefined);
  return pending;
}
