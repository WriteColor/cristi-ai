import { app, protocol } from 'electron';
import path from 'node:path';
import { registerAppProtocol } from '../electron/src/protocol/AppProtocol';
import { windowManager } from '../electron/src/windows/windowManager';
import { registerAllIpcHandlers, unregisterAllIpcHandlers } from '../electron/src/ipc/ipcRouter';

app.setPath('userData', process.env.CRISTI_TEST_DATA!);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true,
  supportFetchAPI: true, corsEnabled: true, stream: true, bypassCSP: false } }]);
app.whenReady().then(() => {
  const root = path.resolve(__dirname, '..');
  registerAppProtocol(root); windowManager.setRootDir(root);
  // Test the production pages without a development server or the user's settings.
  (windowManager as unknown as { isDev: boolean }).isDev = false;
  registerAllIpcHandlers(root);
  unregisterAllIpcHandlers();
  registerAllIpcHandlers(root);
  windowManager.createMainWindow().hide();
});
app.on('before-quit', unregisterAllIpcHandlers);
