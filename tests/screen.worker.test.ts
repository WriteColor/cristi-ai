import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import jpeg from 'jpeg-js';

test('screen.worker performs off-thread BGRA to RGBA conversion and encodes valid JPEG', async () => {
  const workerPath = path.resolve('.test-build/screen.worker.cjs');
  const worker = new Worker(workerPath);

  try {
    const width = 16;
    const height = 16;
    const bgra = Buffer.alloc(width * height * 4);

    // Fill with solid red in BGRA format: B=0, G=0, R=255, A=255
    for (let i = 0; i < bgra.length; i += 4) {
      bgra[i] = 0;       // B
      bgra[i + 1] = 0;   // G
      bgra[i + 2] = 255; // R
      bgra[i + 3] = 255; // A
    }

    const ab = bgra.buffer.slice(bgra.byteOffset, bgra.byteOffset + bgra.byteLength);

    const reply = await new Promise<{ id: number; base64: string | null; error?: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Screen worker timeout')), 4000);
      worker.once('message', (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      worker.postMessage({ id: 1, width, height, buffer: ab, region: null, jpegQuality: 85 }, [ab]);
    });

    assert.equal(reply.id, 1);
    assert.ok(reply.base64, 'Worker must return non-null base64');
    assert.ok(reply.base64.startsWith('/9j/'), 'Output must be standard JPEG format (magic bytes /9j/)');

    // Decode and verify that R and B were swapped correctly (Red should be 254-255, Blue should be 0)
    const rawJpeg = Buffer.from(reply.base64, 'base64');
    const decoded = jpeg.decode(rawJpeg);
    assert.equal(decoded.width, 16);
    assert.equal(decoded.height, 16);

    // Check pixel 0 RGBA
    const r = decoded.data[0];
    const g = decoded.data[1];
    const b = decoded.data[2];
    assert.ok(r >= 250, `Expected Red >= 250, got ${r}`);
    assert.ok(g <= 5, `Expected Green <= 5, got ${g}`);
    assert.ok(b <= 5, `Expected Blue <= 5, got ${b}`);
  } finally {
    await worker.terminate();
  }
});

test('screen.worker accurately crops region and encodes matching dimensions', async () => {
  const workerPath = path.resolve('.test-build/screen.worker.cjs');
  const worker = new Worker(workerPath);

  try {
    const width = 16;
    const height = 16;
    const bgra = Buffer.alloc(width * height * 4);

    for (let i = 0; i < bgra.length; i += 4) {
      bgra[i] = 0;
      bgra[i + 1] = 0;
      bgra[i + 2] = 255;
      bgra[i + 3] = 255;
    }

    const ab = bgra.buffer.slice(bgra.byteOffset, bgra.byteOffset + bgra.byteLength);

    const reply = await new Promise<{ id: number; base64: string | null; error?: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Screen worker crop timeout')), 4000);
      worker.once('message', (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      // Crop 50% width and 50% height starting at top-left
      worker.postMessage({
        id: 2,
        width,
        height,
        buffer: ab,
        region: { x_pct: 0, y_pct: 0, w_pct: 50, h_pct: 50 },
        jpegQuality: 85
      }, [ab]);
    });

    assert.equal(reply.id, 2);
    assert.ok(reply.base64);

    const rawJpeg = Buffer.from(reply.base64, 'base64');
    const decoded = jpeg.decode(rawJpeg);
    assert.equal(decoded.width, 8, 'Cropped width must be 8px');
    assert.equal(decoded.height, 8, 'Cropped height must be 8px');
  } finally {
    await worker.terminate();
  }
});
