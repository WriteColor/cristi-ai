import { Worker } from 'node:worker_threads';
import path from 'node:path';

type Region = { x_pct?: number; y_pct?: number; w_pct?: number; h_pct?: number } | null;

/** Resultado que devuelve el worker o el fallback en main. */
export type ScreenWorkerReply = {
  base64: string | null;
  error?: string;
};

type WorkerReply = { id: number; base64: string | null; error?: string };

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<
  number,
  { resolve: (r: ScreenWorkerReply) => void; timer: ReturnType<typeof setTimeout> }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(path.join(__dirname, 'screen.worker.cjs'));
  worker = w;
  w.on('message', (msg: WorkerReply) => {
    const p = pending.get(msg.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(msg.id);
    p.resolve({ base64: msg.base64, error: msg.error });
  });
  const onFail = () => { if (worker === w) { worker = null; failAll(); } };
  w.on('error', onFail);
  w.on('exit', onFail);
  return w;
}

function failAll(): void {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.resolve({ base64: null, error: 'Worker de pantalla termino inesperadamente.' });
  }
  pending.clear();
}

/**
 * Envia bytes BGRA al worker para crop + JPEG encode.
 * Siempre copia el buffer a un ArrayBuffer propio para garantizar transferibilidad.
 * Tras postMessage el buffer copiado queda vaciado; el caller debe usar NativeImage
 * original si necesita el fallback.
 */
export function processScreen(
  bgraBuffer: Buffer,
  width: number,
  height: number,
  region: Region,
  jpegQuality = 55
): Promise<ScreenWorkerReply> {
  const w = ensureWorker();
  const id = ++sequence;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.delete(id);
      if (worker === w) {
        worker = null;
        w.terminate().catch(() => {});
      }
      resolve({ base64: null, error: 'Tiempo de espera de screen worker agotado.' });
    }, 5000);
    pending.set(id, { resolve, timer });
    // Copiar a nuevo Buffer para garantizar ArrayBuffer no compartido y transferible
    const copy = Buffer.allocUnsafe(bgraBuffer.byteLength);
    bgraBuffer.copy(copy);
    // copy.buffer es ArrayBuffer (no SharedArrayBuffer) porque allocUnsafe usa el pool de Node
    // que siempre devuelve ArrayBuffer estandar. El cast unknown->ArrayBuffer es seguro aqui.
    const ab = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as unknown as ArrayBuffer;
    w.postMessage({ id, width, height, buffer: ab, region: region ?? null, jpegQuality }, [ab]);
  });
}

export async function disposeScreenWorker(): Promise<void> {
  const w = worker;
  worker = null;
  failAll();
  if (w) await w.terminate();
}
