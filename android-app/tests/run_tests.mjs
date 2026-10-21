/**
 * PocketDesk Android Client Automated Test Runner
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Test Suite 1: Secure Storage & KeyStore Abstraction
import { secureStorage } from '../src/services/secureStorage.ts';

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
  const laptop1 = {
    id: 'lap_1',
    name: 'Work Laptop',
    agentUrl: 'http://192.168.1.100:8000',
    mode: 'local',
  };
  const laptop2 = {
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

// Test Suite 2: Touch Coordinate Mapping & Letterbox/Pillarbox Compensation
import { androidInput } from '../src/services/input.ts';

test('Coordinate Mapping: Exact Aspect Ratio Match (16:9)', () => {
  const result = androidInput.mapTouchToNormalized({
    touchX: 800,
    touchY: 450,
    containerWidth: 1600,
    containerHeight: 900,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(result.isInsideDisplay, true);
  assert.equal(result.x, 0.5);
  assert.equal(result.y, 0.5);
});

test('Coordinate Mapping: Pillarboxed Phone Viewport (Tall Portrait)', () => {
  const resultCenter = androidInput.mapTouchToNormalized({
    touchX: 200,
    touchY: 400,
    containerWidth: 400,
    containerHeight: 800,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(resultCenter.isInsideDisplay, true);
  assert.equal(resultCenter.x, 0.5);
  assert.equal(resultCenter.y, 0.5);

  // Touch in the top black letterbox bar
  const resultTopBlackBar = androidInput.mapTouchToNormalized({
    touchX: 200,
    touchY: 50,
    containerWidth: 400,
    containerHeight: 800,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(resultTopBlackBar.isInsideDisplay, false);
});

test('Coordinate Mapping: Letterboxed Viewport (Ultrawide container)', () => {
  const resultCenter = androidInput.mapTouchToNormalized({
    touchX: 1000,
    touchY: 400,
    containerWidth: 2000,
    containerHeight: 800,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(resultCenter.isInsideDisplay, true);
  assert.equal(resultCenter.x, 0.5);
  assert.equal(resultCenter.y, 0.5);

  // Touch in the left black bar
  const resultLeftBar = androidInput.mapTouchToNormalized({
    touchX: 50,
    touchY: 400,
    containerWidth: 2000,
    containerHeight: 800,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(resultLeftBar.isInsideDisplay, false);
});

test('Coordinate Mapping: Clamps bounds to [0.0, 1.0]', () => {
  const resultOutOfBounds = androidInput.mapTouchToNormalized({
    touchX: 9999,
    touchY: 9999,
    containerWidth: 1000,
    containerHeight: 1000,
    desktopAspectRatio: 1.0,
  });

  assert.equal(resultOutOfBounds.isInsideDisplay, false);
  assert.equal(resultOutOfBounds.x, 1.0);
  assert.equal(resultOutOfBounds.y, 1.0);
});

// Test Suite 3: Files & 50MB Limit Guard
import { MAX_UPLOAD_BYTES, androidFiles } from '../src/services/files.ts';

test('Files Service: Enforces 50 MB Maximum Upload Limit', async () => {
  assert.equal(MAX_UPLOAD_BYTES, 52428800);

  const oversizedFile = {
    name: 'large_archive.zip',
    size: 51 * 1024 * 1024,
    uri: 'file:///storage/emulated/0/large_archive.zip',
  };

  await assert.rejects(
    async () => {
      await androidFiles.uploadFile('http://127.0.0.1:8000', 'downloads', '', oversizedFile);
    },
    (err) => {
      assert.match(err.message, /50 MB maximum upload limit/i);
      return true;
    }
  );
});

test('Files Service: Constructs download URLs safely', () => {
  const url = androidFiles.getDownloadUrl('http://192.168.1.50:8000', 'documents', 'finance/report.pdf');
  assert.ok(url.includes('/api/files/download'));
  assert.ok(url.includes('root_id=documents'));
  assert.ok(url.includes('path=finance%2Freport.pdf'));
});

// Test Suite 4: Auth & Session Token Storage
import { authService } from '../src/services/auth.ts';

test('Auth Service: Generates device ID and manages secrets', async () => {
  const deviceId = await authService.getOrCreateDeviceId();
  assert.ok(deviceId.startsWith('dev_android_'));

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

// Test Suite 5: AI Assistant Interface
import { androidAssistant } from '../src/services/assistant.ts';

test('Assistant Service: Exposes parse and execute functions', () => {
  assert.equal(typeof androidAssistant.getIntents, 'function');
  assert.equal(typeof androidAssistant.parseInstruction, 'function');
  assert.equal(typeof androidAssistant.executeInstruction, 'function');
});
