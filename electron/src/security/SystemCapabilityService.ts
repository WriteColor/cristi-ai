import { app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PathPolicy } from './PathPolicy';
import type { FileRequest } from '../../../shared/ipc/contracts';

let workspaceApproved: string | undefined;
export async function approveWorkspace(): Promise<boolean> {
  const result = await dialog.showOpenDialog({ title: 'Autorizar carpeta para herramientas de Cristi', properties: ['openDirectory'] });
  if (result.canceled) return false;
  workspaceApproved = await fs.realpath(result.filePaths[0]);
  return true;
}

export async function resolveFile(request: FileRequest): Promise<string> {
  const exports = path.join(app.getPath('userData'), 'exports');
  await fs.mkdir(exports, { recursive: true });
  return new PathPolicy({ exports, workspaceApproved }).resolveWithin(request.scope, request.path);
}

export async function executeSystemCapability(request: { kind: 'system-info' | 'list-processes' }) {
  const executable = request.kind === 'system-info' ? 'systeminfo.exe' : 'tasklist.exe';
  const result = await promisify(execFile)(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', executable), [],
    { windowsHide: true, timeout: 10000, maxBuffer: 1_048_576 });
  return { stdOut: result.stdout, stdErr: result.stderr, exitCode: 0 };
}
