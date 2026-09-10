import test from 'node:test';
import assert from 'node:assert/strict';
import { SpotifyService } from '../src/domain/integrations/spotify/SpotifyService';

test('SpotifyService initializes with empty state and handles configure', () => {
  const service = new SpotifyService();
  service.clientId = '';
  service.clientSecret = '';

  assert.equal(service.clientId, '');
  assert.equal(service.clientSecret, '');
  assert.equal(service.currentTrack, null);
  assert.equal(service.currentArtist, null);

  service.configure({ clientId: 'test_client_id', clientSecret: 'test_client_secret' });
  assert.equal(service.clientId, 'test_client_id');
  assert.equal(service.clientSecret, 'test_client_secret');
});

test('SpotifyService handles empty search query gracefully', async () => {
  const service = new SpotifyService();
  service.clientId = '';
  service.clientSecret = '';

  const result = await service.search({ query: '' });
  assert.equal(result.status, 'error');
  assert.ok(result.message?.includes('requerida'));
});

test('SpotifyService play handles empty invocation and media control delegates', async () => {
  const service = new SpotifyService();
  service.clientId = '';
  service.clientSecret = '';

  const playRes = await service.play();
  assert.ok(playRes);
  assert.equal(playRes.status, 'success');

  const pauseRes = await service.pause();
  assert.ok(pauseRes);
  assert.equal(pauseRes.status, 'success');

  const nextRes = await service.next();
  assert.ok(nextRes);
  assert.equal(nextRes.status, 'success');

  const prevRes = await service.previous();
  assert.ok(prevRes);
  assert.equal(prevRes.status, 'success');
});

test('SpotifyService setVolume accepts direction and dispatches safely', async () => {
  const service = new SpotifyService();

  const upRes = await service.setVolume({ direction: 'up' });
  assert.equal(upRes.status, 'success');
  assert.equal(upRes.action, 'volume_up');

  const downRes = await service.setVolume({ direction: 'down' });
  assert.equal(downRes.status, 'success');
  assert.equal(downRes.action, 'volume_down');
});
