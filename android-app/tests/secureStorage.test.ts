import test from 'node:test';
import assert from 'node:assert/strict';
import { secureStorage } from '../src/services/secureStorage';
import type { RegisteredLaptop } from '../src/types';

test('SecureStorageService: Encrypts and decrypts sensitive values', async () => {
  const secretKey = 'test_secret_256_bit_token';
  await secureStorage.setSecureItem('custom_token', secretKey);

  const retrieved = await secureStorage.getSecureItem('custom_token');
  assert.equal(retrieved, secretKey);

  await secureStorage.removeSecureItem('custom_token');
  const removed = await secureStorage.getSecureItem('custom_token');
  assert.equal(removed, null);
});

test('SecureStorageService: Device Credentials Management', async () => {
  const deviceId = 'dev_android_99182';
  const deviceSecret = 'sec_981273981273918273981273981273';

  await secureStorage.saveDeviceCredentials(deviceId, deviceSecret);
  const creds = await secureStorage.getDeviceCredentials();

  assert.equal(creds.deviceId, deviceId);
  assert.equal(creds.deviceSecret, deviceSecret);

  await secureStorage.clearDeviceCredentials();
  const cleared = await secureStorage.getDeviceCredentials();
  assert.equal(cleared.deviceId, null);
  assert.equal(cleared.deviceSecret, null);
});

test('SecureStorageService: Registered Laptops Profile Persistence', async () => {
  const laptop1: RegisteredLaptop = {
    id: 'lap_1',
    name: 'Work Laptop',
    agentUrl: 'http://192.168.1.100:8000',
    mode: 'local',
  };
  const laptop2: RegisteredLaptop = {
    id: 'lap_2',
    name: 'Home Laptop',
    agentUrl: 'https://desk.example.com',
    mode: 'remote',
  };

  await secureStorage.saveRegisteredLaptop(laptop1);
  await secureStorage.saveRegisteredLaptop(laptop2);

  let laptops = await secureStorage.getRegisteredLaptops();
  assert.equal(laptops.length, 2);
  assert.ok(laptops.some((l) => l.id === 'lap_1'));
  assert.ok(laptops.some((l) => l.id === 'lap_2'));

  await secureStorage.removeRegisteredLaptop('lap_1');
  laptops = await secureStorage.getRegisteredLaptops();
  assert.equal(laptops.length, 1);
  assert.equal(laptops[0].id, 'lap_2');
});
