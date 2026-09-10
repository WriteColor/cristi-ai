import { credentialVault } from './CredentialVault';

export async function issueLiveToken(model: string): Promise<string> {
  const key = await credentialVault.get('gemini.apiKey');
  if (!key) throw new Error('Configura la credencial Gemini en Ajustes.');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ uses: 1, expireTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
      liveConnectConstraints: { model: `models/${model}` } }),
  });
  if (!response.ok) throw new Error(`No se pudo aprovisionar Live (${response.status}).`);
  const result = await response.json() as { name?: string };
  if (!result.name?.startsWith('auth_tokens/')) throw new Error('Respuesta de autenticación inválida.');
  return result.name;
}
