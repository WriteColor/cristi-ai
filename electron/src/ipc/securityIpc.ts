import { ipcMain, safeStorage, app } from 'electron';
import path from 'path';
import fs from 'fs';

function getSecretsFilePath(): string {
  return path.join(app.getPath('userData'), 'cristi-secrets.json');
}

function readSecrets(): Record<string, string> {
  const filePath = getSecretsFilePath();
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) || {} : {};
  } catch (_) {
    return {};
  }
}

function writeSecrets(secrets: Record<string, string>): void {
  const filePath = getSecretsFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(secrets, null, 2), 'utf8');
}

/**
 * Registers secure secret storage handlers using Electron safeStorage (DPAPI on Windows).
 */
export function registerSecurityIpc(): void {
  ipcMain.handle('secure-set-secret', (_event, key: unknown, value: unknown) => {
    if (!key || typeof value !== 'string') {
      return { success: false, error: 'Secret o clave inválida.' };
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'Cifrado seguro (safeStorage) no disponible en este sistema.' };
    }
    const secrets = readSecrets();
    secrets[String(key)] = safeStorage.encryptString(value).toString('base64');
    writeSecrets(secrets);
    return { success: true };
  });

  ipcMain.handle('secure-get-secret', (_event, key: unknown): string | null => {
    if (!key || !safeStorage.isEncryptionAvailable()) return null;
    const encoded = readSecrets()[String(key)];
    if (!encoded) return null;
    try {
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    } catch (_) {
      return null;
    }
  });

  ipcMain.handle('secure-delete-secret', (_event, key: unknown) => {
    if (!key) return { success: false, error: 'Clave no especificada.' };
    const secrets = readSecrets();
    delete secrets[String(key)];
    writeSecrets(secrets);
    return { success: true };
  });
}
