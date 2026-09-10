import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { MemoryRepository } from '../src/domain/integrations/memory/MemoryRepository';

test('renderer repository propagates native failures without secondary file writes', async () => {
  let fileWrites = 0;
  const repository = new MemoryRepository({ bridge: {
    isElectron: true,
    memoryLoad: async () => ({ success: false, error: 'unavailable' }),
    memorySave: async () => ({ success: false, error: 'unavailable' }),
    writeFile: async () => { fileWrites++; },
  } });
  await assert.rejects(repository.load(), /unavailable/);
  await assert.rejects(repository.save([]), /unavailable/);
  assert.equal(fileWrites, 0);
});

test('memory migrates legacy JSON, rejects failed transactions and preserves an empty save across restart', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cristi-memory-test-'));
  let worker: Worker;
  let id = 0;
  const launch = () => { worker = new Worker(path.resolve('.test-build/memory.worker.cjs'), { workerData: { userData: root } }); };
  const request = (operation: 'load' | 'save', records?: unknown[]): Promise<{ success: boolean; backend?: string; memories?: { id: string }[] }> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Memory worker timeout')), 5000);
      worker.once('message', reply => { clearTimeout(timer); resolve(reply.result); });
      worker.once('error', reject);
      worker.postMessage({ id: ++id, operation, records });
    });
  try {
    await fs.writeFile(path.join(root, 'cristi-memories.json'), JSON.stringify([{ id: 'legacy' }]));
    launch();
    assert.equal((await request('load')).memories?.[0].id, 'legacy');
    assert.equal((await request('save', [{ id: 'current' }])).backend, 'sqlite');
    assert.equal((await request('save', [{ id: 'duplicate' }, { id: 'duplicate' }])).success, false);
    assert.equal((await request('load')).memories?.[0].id, 'current');
    assert.equal((await request('save', [{ text: 'missing id' }])).success, false);
    assert.equal((await request('load')).memories?.[0].id, 'current');
    await request('save', []); await worker!.terminate(); launch();
    assert.deepEqual((await request('load')).memories, [], 'stale JSON must not resurrect cleared records');
  } finally {
    await worker!?.terminate();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('damaged SQLite never falls back to stale JSON or reports a successful save', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cristi-memory-damaged-'));
  const database = path.join(root, 'cristi-memory.sqlite');
  const legacy = path.join(root, 'cristi-memories.json');
  await fs.writeFile(database, 'damaged database');
  await fs.writeFile(legacy, '[{"id":"stale"}]');
  const worker = new Worker(path.resolve('.test-build/memory.worker.cjs'), { workerData: { userData: root } });
  const request = (operation: 'load' | 'save'): Promise<{ success: boolean }> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Memory worker timeout')), 5000);
    worker.once('message', reply => { clearTimeout(timer); resolve(reply.result); });
    worker.postMessage({ id: 1, operation, records: [{ id: 'new' }] });
  });
  try {
    assert.equal((await request('load')).success, false);
    assert.equal((await request('save')).success, false);
    assert.equal((await request('load')).success, false, 'initialization failure remains an error');
    assert.equal(await fs.readFile(database, 'utf8'), 'damaged database');
    assert.equal(await fs.readFile(legacy, 'utf8'), '[{"id":"stale"}]');
  } finally {
    await worker.terminate();
    await fs.rm(root, { recursive: true, force: true });
  }
});
