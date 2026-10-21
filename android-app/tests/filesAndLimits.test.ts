import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_UPLOAD_BYTES, androidFiles } from '../src/services/files';

test('Files Service: Enforces 50 MB Maximum Upload Limit', async () => {
  assert.equal(MAX_UPLOAD_BYTES, 52428800); // 50 * 1024 * 1024

  // Simulated oversized file (51 MB)
  const oversizedFile = {
    name: 'large_archive.zip',
    size: 51 * 1024 * 1024,
    uri: 'file:///storage/emulated/0/large_archive.zip',
  };

  await assert.rejects(
    async () => {
      await androidFiles.uploadFile('http://127.0.0.1:8000', 'downloads', '', oversizedFile);
    },
    (err: unknown) => {
      assert.match((err as Error).message, /50 MB maximum upload limit/i);
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
