import { ipcMain, app, WebContents } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { processManager } from '../core/processManager';
import { DesktopAudioStartOptions, DesktopAudioStatus } from '../types/electron.types';
import { getAppRootDir } from '../core/paths';

interface NativeDesktopAudioState {
  child: ChildProcess;
  sender: WebContents;
  sourceId: string;
  buffer: Buffer;
  stopping: boolean;
  frameCount: number;
  startedAt: number;
}

let nativeDesktopAudioState: NativeDesktopAudioState | null = null;

export function resolveWasapiHelperPath(rootDir?: string): string | null {
  const baseDir = rootDir || getAppRootDir();
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'app.asar.unpacked', 'native', 'CristiWasapiLoopback.exe'),
        path.join(process.resourcesPath, 'native', 'CristiWasapiLoopback.exe'),
        path.join(baseDir, 'native', 'CristiWasapiLoopback.exe'),
      ]
    : [path.join(baseDir, 'native', 'CristiWasapiLoopback.exe')];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export function emitNativeDesktopAudioEvent(
  payload: Record<string, unknown>,
  state = nativeDesktopAudioState
): void {
  const sender = state?.sender;
  if (sender && !sender.isDestroyed()) {
    try {
      sender.send('desktop-audio-native-event', payload);
    } catch (_) {}
  }
}

export function stopNativeDesktopAudioCapture(reason = 'stopped'): {
  success: boolean;
  sourceId?: string;
  alreadyStopped?: boolean;
} {
  const state = nativeDesktopAudioState;
  nativeDesktopAudioState = null;
  if (!state) return { success: true, alreadyStopped: true };

  state.stopping = true;
  processManager.untrack(state.child);
  try {
    state.child.kill();
  } catch (_) {}

  emitNativeDesktopAudioEvent({ type: 'stopped', sourceId: state.sourceId, reason }, state);
  return { success: true, sourceId: state.sourceId };
}

/**
 * Registers WASAPI Loopback audio capture supervisor and IPC handlers.
 */
export function registerAudioIpc(rootDir?: string): void {
  const baseDir = rootDir || getAppRootDir();

  // Register cleanup hook with process manager
  processManager.registerCleanupHook(() => {
    stopNativeDesktopAudioCapture('app_shutdown');
  });

  ipcMain.handle('desktop-audio-native-start', async (event, options: DesktopAudioStartOptions = {}) => {
    const requestedSourceId = String(options.sourceId || 'system_loopback').trim().slice(0, 120) || 'system_loopback';

    if (process.platform !== 'win32') {
      return { success: false, available: false, error: 'WASAPI loopback sólo está disponible en Windows.' };
    }

    if (nativeDesktopAudioState) {
      if (nativeDesktopAudioState.sourceId === requestedSourceId) {
        return { success: true, alreadyRunning: true, transport: 'wasapi', sourceId: requestedSourceId };
      }
      stopNativeDesktopAudioCapture('source_replaced');
    }

    const helperPath = resolveWasapiHelperPath(baseDir);
    if (!helperPath) {
      return {
        success: false,
        available: false,
        error: 'El helper WASAPI no está incluido en este paquete. Revisa native/CristiWasapiLoopback.exe.',
      };
    }

    let child: ChildProcess;
    try {
      child = spawn(helperPath, [], {
        cwd: path.dirname(helperPath),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      return { success: false, available: false, error: `No se pudo iniciar WASAPI: ${(error as Error).message}` };
    }

    const state: NativeDesktopAudioState = {
      child,
      sender: event.sender,
      sourceId: requestedSourceId,
      buffer: Buffer.alloc(0),
      stopping: false,
      frameCount: 0,
      startedAt: Date.now(),
    };

    nativeDesktopAudioState = state;
    processManager.track(child);

    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => {
        if (state.stopping) return;
        state.buffer = Buffer.concat([state.buffer, Buffer.from(chunk)]);

        // Binary frame format: 16-byte header:
        // [0..3]: ASCII "CRIS" (0x43, 0x52, 0x49, 0x53)
        // [4..7]: uint32 sampleRate (e.g. 48000)
        // [8..11]: uint32 payloadBytes
        // [12..15]: uint32 flags
        // followed by PCM16 data
        while (state.buffer.length >= 16) {
          const magicOffset = state.buffer.indexOf(Buffer.from([0x43, 0x52, 0x49, 0x53]));
          if (magicOffset < 0) {
            state.buffer = state.buffer.subarray(Math.max(0, state.buffer.length - 3));
            return;
          }
          if (magicOffset > 0) {
            state.buffer = state.buffer.subarray(magicOffset);
          }
          if (state.buffer.length < 16) return;

          const sampleRate = state.buffer.readUInt32LE(4);
          const payloadBytes = state.buffer.readUInt32LE(8);

          if (!sampleRate || payloadBytes < 2 || payloadBytes > 1024 * 1024 || payloadBytes % 2 !== 0) {
            state.buffer = state.buffer.subarray(4);
            continue;
          }

          const frameBytes = 16 + payloadBytes;
          if (state.buffer.length < frameBytes) return;

          const pcm = state.buffer.subarray(16, frameBytes);
          state.buffer = state.buffer.subarray(frameBytes);
          state.frameCount += 1;

          if (state.sender && !state.sender.isDestroyed()) {
            try {
              state.sender.send('desktop-audio-native-frame', {
                sourceId: state.sourceId,
                sampleRate,
                data: pcm.toString('base64'),
                frameId: `wasapi_${Date.now()}_${state.frameCount}`,
                timestamp: Date.now(),
              });
            } catch (_) {}
          }
        }
      });
    }

    let stderr = '';
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        stderr = `${stderr}${String(chunk)}`.slice(-4000);
      });
    }

    child.once('error', (error: Error) => {
      processManager.untrack(child);
      if (nativeDesktopAudioState === state) {
        nativeDesktopAudioState = null;
        emitNativeDesktopAudioEvent({ type: 'error', sourceId: state.sourceId, error: error.message }, state);
      }
    });

    child.once('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      processManager.untrack(child);
      if (nativeDesktopAudioState === state) {
        nativeDesktopAudioState = null;
        emitNativeDesktopAudioEvent(
          {
            type: state.stopping ? 'stopped' : 'error',
            sourceId: state.sourceId,
            code,
            signal,
            error: state.stopping ? undefined : (stderr.trim() || `WASAPI terminó (${code ?? signal ?? 'desconocido'}).`),
          },
          state
        );
      }
    });

    emitNativeDesktopAudioEvent({ type: 'started', sourceId: requestedSourceId, transport: 'wasapi' }, state);
    return { success: true, available: true, transport: 'wasapi', sourceId: requestedSourceId };
  });

  ipcMain.handle('desktop-audio-native-stop', () => stopNativeDesktopAudioCapture('renderer_request'));

  ipcMain.handle('desktop-audio-native-status', (): DesktopAudioStatus => {
    const state = nativeDesktopAudioState;
    return {
      running: Boolean(state && !state.child.killed),
      sourceId: state?.sourceId || null,
      transport: state ? 'wasapi' : null,
      frameCount: state?.frameCount || 0,
      uptimeMs: state ? Date.now() - state.startedAt : 0,
    };
  });
}
