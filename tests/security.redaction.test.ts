import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSettings, redactText } from '../shared/security';

test('publicSettings strips all credential fields recursively', () => {
  const sensitiveConfig = {
    appName: 'Cristi AI',
    version: '2.0.0',
    apiKey: 'SECRET_API_KEY_123',
    spotifyClientSecret: 'SUPER_SECRET_SPOTIFY',
    botToken: 'DISCORD_BOT_TOKEN_XYZ',
    spotify: {
      clientId: 'public_client_id_456',
      clientSecret: 'secret_nested_token_789',
      refreshToken: 'refresh_canary_000'
    },
    credentials: [
      { id: 1, token: 'token_in_array_1' },
      { id: 2, password: 'password_in_array_2', name: 'user_profile' }
    ],
    safeSettings: {
      volume: 0.8,
      theme: 'dark',
      alwaysOnTop: true
    }
  };

  const sanitized = publicSettings(sensitiveConfig) as any;

  // Safe properties preserved
  assert.equal(sanitized.appName, 'Cristi AI');
  assert.equal(sanitized.version, '2.0.0');
  assert.equal(sanitized.safeSettings.volume, 0.8);
  assert.equal(sanitized.safeSettings.theme, 'dark');
  assert.equal(sanitized.safeSettings.alwaysOnTop, true);
  assert.equal(sanitized.spotify.clientId, 'public_client_id_456');
  assert.equal(sanitized.credentials[1].name, 'user_profile');

  // Secrets removed
  assert.equal(sanitized.apiKey, undefined);
  assert.equal(sanitized.spotifyClientSecret, undefined);
  assert.equal(sanitized.botToken, undefined);
  assert.equal(sanitized.spotify.clientSecret, undefined);
  assert.equal(sanitized.spotify.refreshToken, undefined);
  assert.equal(sanitized.credentials[0].token, undefined);
  assert.equal(sanitized.credentials[1].password, undefined);

  // Stringified JSON check
  const json = JSON.stringify(sanitized);
  assert.ok(!json.includes('SECRET_API_KEY_123'));
  assert.ok(!json.includes('SUPER_SECRET_SPOTIFY'));
  assert.ok(!json.includes('DISCORD_BOT_TOKEN_XYZ'));
  assert.ok(!json.includes('secret_nested_token_789'));
  assert.ok(!json.includes('refresh_canary_000'));
  assert.ok(!json.includes('token_in_array_1'));
  assert.ok(!json.includes('password_in_array_2'));
});

test('redactText redacts keys, Google AIza tokens, and URL parameters', () => {
  const sample1 = 'Connecting to wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=AIzaSyDCanarySecretKey12345';
  const redacted1 = redactText(sample1);
  assert.ok(!redacted1.includes('AIzaSyDCanarySecretKey12345'));
  assert.ok(redacted1.includes('[REDACTED]'));

  const sample2 = 'curl -H "Authorization: Bearer my_secret_bearer_token" https://api.spotify.com/v1/search';
  const redacted2 = redactText(sample2);
  assert.ok(!redacted2.includes('my_secret_bearer_token'));
  assert.ok(redacted2.includes('[REDACTED]'));

  const sample3 = 'Config values: api_key=secret_123, password: super_password, safe=100';
  const redacted3 = redactText(sample3);
  assert.ok(!redacted3.includes('secret_123'));
  assert.ok(!redacted3.includes('super_password'));
  assert.ok(redacted3.includes('safe=100'));
});

test('publicSettings handles circular references without RangeError', () => {
  const circularObj: any = { name: 'RootNode', safe: true };
  circularObj.self = circularObj;
  circularObj.child = { parent: circularObj, apiKey: 'SECRET_CANARY' };

  let sanitized: any;
  assert.doesNotThrow(() => {
    sanitized = publicSettings(circularObj);
  });
  assert.equal(sanitized.name, 'RootNode');
  assert.equal(sanitized.self, '[Circular]');
  assert.equal(sanitized.child.parent, '[Circular]');
  assert.equal(sanitized.child.apiKey, undefined);
});

test('publicSettings preserves shared references without incorrectly converting them to [Circular]', () => {
  const sharedConfig = { volume: 0.8, theme: 'dark', apiKey: 'SECRET_SHARED_TOKEN' };
  const multiSectionConfig = {
    profileA: sharedConfig,
    profileB: sharedConfig,
    list: [sharedConfig, sharedConfig]
  };

  const sanitized = publicSettings(multiSectionConfig);

  // Neither should be replaced with '[Circular]'
  assert.notEqual(sanitized.profileA, '[Circular]');
  assert.notEqual(sanitized.profileB, '[Circular]');
  assert.equal(sanitized.profileA.volume, 0.8);
  assert.equal(sanitized.profileB.volume, 0.8);
  assert.equal(sanitized.profileA.apiKey, undefined);
  assert.equal(sanitized.profileB.apiKey, undefined);

  // Object identity preserved across shared references
  assert.equal(sanitized.profileA, sanitized.profileB);
  assert.equal(sanitized.list[0], sanitized.profileA);
  assert.equal(sanitized.list[1], sanitized.profileB);
});


