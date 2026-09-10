import { contextBridge } from 'electron';
import { electronBridgeApi } from '../preload';
const { requestLiveToken: _live, geminiGenerate: _generate, spotifyToken: _spotify,
  captureScreenNative: _screen, syncHitboxes: _hitboxes, syncInteractiveHitboxes: _interactive,
  setIgnoreMouseEvents: _mouse, memorySave: _memory, discordVoiceSendAudio: _audio, ...api } = electronBridgeApi;
for (const name of ['electron', 'electronBridge', 'electronAPI']) contextBridge.exposeInMainWorld(name, api);
