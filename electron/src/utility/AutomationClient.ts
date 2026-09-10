import { utilityProcess, type UtilityProcess } from 'electron';
import path from 'node:path';
import type { IpcRequest } from '../../../shared/ipc/contracts';

let worker: UtilityProcess | null = null;
let sequence = 0;
type Reply = { success: boolean; error?: string; [key: string]: unknown };
const pending = new Map<number, { resolve: (reply: Reply) => void; timer: ReturnType<typeof setTimeout> }>();
function failPending(): void {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.resolve({ success: false, error: 'El proceso de automatización se cerró; la acción no se reintentará.' });
  }
  pending.clear();
}
export function executeAutomation(...[action, params]: IpcRequest<'playwright-execute'>): Promise<Reply> {
  if (pending.size >= 16) return Promise.resolve({ success: false, error: 'Cola de automatización llena.' });
  if (!worker) {
    const child = utilityProcess.fork(path.join(__dirname, 'playwright.worker.cjs'), [], { serviceName: 'Cristi Browser Automation' });
    worker = child;
    child.on('message', (message: { id: number; result: Reply }) => {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer); pending.delete(message.id); request.resolve(message.result);
    });
    child.once('exit', () => { if (worker === child) { worker = null; failPending(); } });
  }
  const child = worker;
  const id = ++sequence;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      // Never replay a timed-out action: it might already have changed the page.
      if (worker === child) { worker = null; child.kill(); failPending(); }
    }, 60000);
    pending.set(id, { resolve, timer });
    child.postMessage({ id, action, params });
  });
}
export async function disposeAutomation(): Promise<void> {
  if (!worker) return;
  const child = worker;
  await Promise.race([executeAutomation('close', undefined), new Promise(resolve => setTimeout(resolve, 1500))]);
  if (worker === child) { worker = null; child.kill(); failPending(); }
}
