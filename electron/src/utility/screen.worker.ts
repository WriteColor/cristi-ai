/**
 * Worker thread para procesamiento de imagenes de captura de pantalla.
 * Recibe bytes BGRA raw desde el proceso main y devuelve un string base64 JPEG procesado.
 * Corre en un hilo separado para descargar el proceso main de trabajo CPU-bound.
 */

import { parentPort } from 'node:worker_threads';

if (!parentPort) throw new Error('screen.worker debe ejecutarse como worker thread');

type ScreenRequest = {
  id: number;
  width: number;
  height: number;
  /** Buffer BGRA raw proveniente de NativeImage.toBitmap() */
  buffer: ArrayBuffer;
  region: { x_pct: number; y_pct: number; w_pct: number; h_pct: number } | null;
  jpegQuality: number;
};

type ScreenReply = {
  id: number;
  base64: string | null;
  error?: string;
};

/**
 * Recorta un buffer BGRA (4 bytes por pixel) a la region indicada.
 * Copia fila a fila para evitar allocaciones innecesarias.
 */
function cropBgra(
  buf: Buffer<ArrayBuffer>,
  srcW: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): Buffer<ArrayBuffer> {
  const result = Buffer.allocUnsafe(cropW * cropH * 4) as Buffer<ArrayBuffer>;
  for (let row = 0; row < cropH; row++) {
    const srcOffset = ((cropY + row) * srcW + cropX) * 4;
    const dstOffset = row * cropW * 4;
    buf.copy(result, dstOffset, srcOffset, srcOffset + cropW * 4);
  }
  return result;
}

/**
 * Codifica un buffer BGRA como JPEG usando sharp si esta disponible.
 * Lanza un error si sharp no esta instalado para que main use su fallback nativo.
 */
async function encodeJpeg(
  bgraBuf: Buffer<ArrayBuffer>,
  width: number,
  height: number,
  quality: number
): Promise<string> {
  // Se importa con require dinamico para que falle en runtime (no en build-time)
  // si sharp no esta instalado; el caller usara NativeImage.toJPEG() como fallback.
  const sharp = require('sharp') as any;
  const jpegBuf = await sharp(bgraBuf, { raw: { width, height, channels: 4 } })
    .toFormat('jpeg', { quality })
    .toBuffer() as Buffer;
  return jpegBuf.toString('base64');
}

parentPort.on('message', async (request: ScreenRequest) => {
  const { id, width, height, buffer, region, jpegQuality } = request;

  try {
    // Convertir el ArrayBuffer transferido a Buffer de Node.js
    // El cast explícito a ArrayBuffer evita la ambigüedad con SharedArrayBuffer
    let buf: Buffer<ArrayBuffer> = Buffer.from(buffer as ArrayBuffer) as Buffer<ArrayBuffer>;
    let w = width;
    let h = height;

    // Aplicar recorte si la region no cubre la imagen completa
    if (
      region &&
      (region.x_pct > 0 || region.y_pct > 0 || region.w_pct < 100 || region.h_pct < 100)
    ) {
      const cropX = Math.max(0, Math.round((region.x_pct / 100) * w));
      const cropY = Math.max(0, Math.round((region.y_pct / 100) * h));
      const cropW = Math.max(1, Math.min(w - cropX, Math.round((region.w_pct / 100) * w)));
      const cropH = Math.max(1, Math.min(h - cropY, Math.round((region.h_pct / 100) * h)));
      buf = cropBgra(buf, w, cropX, cropY, cropW, cropH);
      w = cropW;
      h = cropH;
    }

    const base64 = await encodeJpeg(buf, w, h, jpegQuality);
    const reply: ScreenReply = { id, base64 };
    parentPort!.postMessage(reply);
  } catch (err) {
    // Senalar el error para que main active el fallback con NativeImage.toJPEG()
    const reply: ScreenReply = { id, base64: null, error: (err as Error).message };
    parentPort!.postMessage(reply);
  }
});
