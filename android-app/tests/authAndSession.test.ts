import test from 'node:test';
import assert from 'node:assert/strict';
import { authService } from '../src/services/auth';
import { secureStorage } from '../src/services/secureStorage';

test('Auth Service: Generates device ID and manages secrets', async () => {
  const deviceId = await authService.getOrCreateDeviceId();
  assert.ok(deviceId.startsWith('dev_android_'));

  // Should return existing ID on subsequent calls
  const secondCallId = await authService.getOrCreateDeviceId();
  assert.equal(deviceId, secondCallId);
});

test('Auth Service: Session Token Storage and Clear', async () => {
  const dummyToken = 'session_token_xyz_998811';
  await secureStorage.saveSessionToken(dummyToken);

  let activeToken = await secureStorage.getSessionToken();
  assert.equal(activeToken, dummyToken);

  await authService.disconnect();
  activeToken = await secureStorage.getSessionToken();
  assert.equal(activeToken, null);
});
