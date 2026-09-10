import { dialog } from 'electron';
import { createHash } from 'node:crypto';
const approved = new Set<string>();
const pending = new Map<string, Promise<void>>();

/** Approval is held only in main memory and binds the exact launch configuration. */
export function approveMcpLaunch(config: object): Promise<void> {
  const encoded = JSON.stringify(config);
  const fingerprint = createHash('sha256').update(encoded).digest('hex');
  if (approved.has(fingerprint)) return Promise.resolve();
  if (pending.has(fingerprint)) return pending.get(fingerprint)!;
  const value = config as { command?: string; args?: string[]; url?: string };
  const task = dialog.showMessageBox({ type: 'question', buttons: ['Cancelar', 'Autorizar'], defaultId: 0, cancelId: 0,
    title: 'Autorizar servidor MCP', message: 'Este servidor podrá ejecutar herramientas en tu equipo.',
    detail: value.url || [value.command, ...(value.args || [])].join(' ') }).then(result => {
      if (result.response !== 1) throw new Error('Servidor MCP no autorizado.');
      approved.add(fingerprint);
    }).finally(() => pending.delete(fingerprint));
  pending.set(fingerprint, task);
  return task;
}
