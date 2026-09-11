import { hasLegacyCredentials, migrateLegacySettings } from '../infrastructure/config/LegacySettingsMigration';
import { publicSettings } from '../../shared/security';
import { create } from 'zustand';
import { AppConfig } from '@/types';
import { DEFAULT_MODEL_ID, SYSTEM_PERSONA_PROMPT } from '../config/models.js';
import { electronBridge } from '../services/desktop/ElectronBridge.js';
import { toastService } from '../infrastructure/notifications/toastService.js';
import { live2dModelRegistry } from '../domain/live2d/Live2DModelRegistry.js';

const STORAGE_KEY_CONFIG = 'cristi_ai_settings_v1';

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiKey: '',
  modelId: DEFAULT_MODEL_ID || 'gemini-3.1-flash-live-preview',
  voiceName: 'Aoede',
  systemPrompt: SYSTEM_PERSONA_PROMPT,
  temperature: 0.75,
  alwaysOnTop: false,
  viewMode: 'transparent',
  activeModelId: 'yanderegirl',
  avatarScale: 1.0,
  avatarPosition: { x: 0, y: 0 },
  microphoneDeviceId: 'default',
  speakerDeviceId: 'default',
  ttsVoice: 'Aoede',
  visionEnabled: true,
  screenWatchIntervalMs: 2000,
  autoReconnect: true,
  breathingRoomCooldownMs: 1500,
  soundFxEnabled: true,
  soundFxVolume: 0.7,
  voiceVolume: 100,
  ttsFallbackVoice: 'Microsoft Helena - Spanish (Spain)',
  ttsFallbackEnabled: true,
  spotifyClientId: '',
  spotifyClientSecret: '',
  externalTranslationEnabled: false,
  translationTargetLanguage: 'es',
  translationAggregateMs: 400,
  translationGameAudioDeviceId: '',
  translationGameAudioDeviceLabel: '',
};

function getEnvApiKey(): string { return ''; }

function loadFromLocalStorage(): AppConfig {
  const envKey = getEnvApiKey();
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return {
            ...DEFAULT_APP_CONFIG,
            ...publicSettings(parsed),
            apiKey: '',
          };
        }
      }
    }
  } catch (_) {
    // Fallback to default
  }
  return {
    ...DEFAULT_APP_CONFIG,
    apiKey: envKey,
  };
}

function saveToLocalStorage(config: AppConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (!hasLegacyCredentials()) localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(publicSettings(config)));
    }
  } catch (_) {
    // Ignore storage quota errors
  }
}

export interface SettingsState {
  // --- Core Estado Requerido ---
  config: AppConfig;
  isLoaded: boolean;

  // --- Flattened reactive properties for UI tabs & hooks ---
  apiKey: string;
  showApiKey: boolean;
  modelId: string;
  temperature: number;
  systemPrompt: string;
  voiceName: string;
  voiceVolume: number;
  ttsFallbackVoice: string;
  ttsFallbackEnabled: boolean;
  externalTranslationEnabled: boolean;
  translationSourceLanguage: string;
  translationTargetLanguage: string;
  translationAggregateMs: number;
  translationGameAudioDeviceId: string;
  translationGameAudioDeviceLabel: string;
  wasapiLoopbackEnabled: boolean;
  isSettingsWindowOpen: boolean;

  // --- Live2D Models ---
  live2dModelId: string;
  viewMode: 'torso' | 'full';
  inspectedLive2DId: string;
  modelScale: number;
  modelPosition: string;

  // --- Scene ---
  sceneId: string;
  inspectedSceneId: string;
  sceneOpacity: number;
  customWallpaper: string;

  // --- Spotify ---
  spotifyClientId: string;
  spotifyClientSecret: string;

  // --- Discord ---
  discordToken: string;
  discordAutoReply: boolean;
  discordMonitoredChannels: string;
  discordVoiceChannel: string;
  discordActivityStatus: string;

  // --- Tabs Navigation & Save Status ---
  activeTab: string;
  saveStatus: 'saved' | 'saving' | null;

  // --- Core Acciones Requeridas ---
  loadConfig: () => Promise<void>;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
  resetDefaults: () => Promise<void>;
  saveSettings: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  setSaveStatus: (status: 'saved' | 'saving' | null) => void;

  // --- Extended Actions ---
  setField: (field: string, value: unknown) => void;
  setConfig: (configOrUpdater: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
  setIsSettingsWindowOpen: (isOpen: boolean) => void;
  handleOpenSettings: () => void;
  switchLive2DModel: (modelId: string) => void;
  switchAiModel: (modelId: string) => void;
  switchVoice: (voiceName: string) => void;
}

const initialConfig = loadFromLocalStorage();

export const useSettingsStore = create<SettingsState>()((set, get) => {
  // Real-time synchronization with Electron IPC when available
  if (typeof window !== 'undefined') {
    try {
      electronBridge.onConfigUpdated((remoteConfig: Partial<AppConfig>) => {
        if (remoteConfig && typeof remoteConfig === 'object') {
          const merged: AppConfig = { ...get().config, ...remoteConfig };
          saveToLocalStorage(merged);
          set({
            config: merged,
            isLoaded: true,
            apiKey: merged.apiKey,
            modelId: merged.modelId,
            temperature: merged.temperature,
            systemPrompt: merged.systemPrompt,
            voiceName: merged.voiceName,
            voiceVolume: merged.voiceVolume ?? 100,
            ttsFallbackVoice: merged.ttsFallbackVoice ?? '',
            ttsFallbackEnabled: merged.ttsFallbackEnabled ?? true,
            externalTranslationEnabled: merged.externalTranslationEnabled ?? false,
            translationTargetLanguage: merged.translationTargetLanguage ?? 'es',
            translationAggregateMs: merged.translationAggregateMs ?? 400,
            translationGameAudioDeviceId: merged.translationGameAudioDeviceId ?? '',
            translationGameAudioDeviceLabel: merged.translationGameAudioDeviceLabel ?? '',
          });
        }
      });
    } catch (_) {
      // Browser only
    }
  }

  return {
    // Core state
    config: initialConfig,
    isLoaded: false,

    // Flattened UI tab bindings
    apiKey: initialConfig.apiKey,
    showApiKey: false,
    modelId: initialConfig.modelId,
    temperature: initialConfig.temperature,
    systemPrompt: initialConfig.systemPrompt,
    voiceName: initialConfig.voiceName,
    voiceVolume: initialConfig.voiceVolume ?? 100,
    ttsFallbackVoice: initialConfig.ttsFallbackVoice ?? '',
    ttsFallbackEnabled: initialConfig.ttsFallbackEnabled ?? true,
    externalTranslationEnabled: initialConfig.externalTranslationEnabled ?? false,
    translationSourceLanguage: 'en',
    translationTargetLanguage: initialConfig.translationTargetLanguage ?? 'es',
    translationAggregateMs: initialConfig.translationAggregateMs ?? 400,
    translationGameAudioDeviceId: initialConfig.translationGameAudioDeviceId ?? '',
    translationGameAudioDeviceLabel: initialConfig.translationGameAudioDeviceLabel ?? '',
    wasapiLoopbackEnabled: false,
    isSettingsWindowOpen: false,

    // Live2D Models
    live2dModelId: initialConfig.activeModelId || 'yanderegirl',
    viewMode: 'torso',
    inspectedLive2DId: initialConfig.activeModelId || 'yanderegirl',
    modelScale: initialConfig.avatarScale ?? 1.0,
    modelPosition: 'center',

    // Scene
    sceneId: 'deep_nebula',
    inspectedSceneId: 'deep_nebula',
    sceneOpacity: 100,
    customWallpaper: '',

    // Spotify
    spotifyClientId: initialConfig.spotifyClientId || '',
    spotifyClientSecret: initialConfig.spotifyClientSecret || '',

    // Discord
    discordToken: (initialConfig as any)?.discord?.botToken || '',
    discordAutoReply: (initialConfig as any)?.discord?.autoReply === true,
    discordMonitoredChannels: Array.isArray((initialConfig as any)?.discord?.monitoredChannels)
      ? (initialConfig as any).discord.monitoredChannels.join(', ')
      : '',
    discordVoiceChannel: (initialConfig as any)?.discord?.voiceChannel || '',
    discordActivityStatus: (initialConfig as any)?.discord?.statusMessage || 'Conectada con Jeremy | Cristi AI',

    // Navigation & save status
    activeTab: 'general',
    saveStatus: null,

    saveSettings: async () => {
      set({ saveStatus: 'saving' });
      try {
        const drafts = get();
        for (const [key, value] of Object.entries({ 'gemini.apiKey': drafts.apiKey, 'spotify.clientSecret': drafts.spotifyClientSecret, 'discord.botToken': drafts.discordToken })) {
          if (value.trim()) await electronBridge.setSecureSecret(key, value.trim());
        }
        set({ apiKey: '', spotifyClientSecret: '', discordToken: '' });
        await get().updateConfig(await electronBridge.credentialStatus());
        set({ saveStatus: 'saved' });
        setTimeout(() => {
          if (get().saveStatus === 'saved') {
            set({ saveStatus: null });
          }
        }, 2500);
      } catch (err) {
        set({ saveStatus: null });
      }
    },

    setActiveTab: (tab: string) => set({ activeTab: tab }),
    setSaveStatus: (status: 'saved' | 'saving' | null) => set({ saveStatus: status }),

    // Core Actions
    loadConfig: async () => {
      await migrateLegacySettings();
      let activeConfig = loadFromLocalStorage();

      if (electronBridge.isElectron && typeof electronBridge.getAppConfig === 'function') {
        try {
          const ipcConfig = await electronBridge.getAppConfig();
          if (ipcConfig && typeof ipcConfig === 'object') {
            activeConfig = {
              ...activeConfig,
              ...ipcConfig,
              apiKey: '',
            };
            saveToLocalStorage(activeConfig);
          }
        } catch (err) {
          console.warn('[useSettingsStore] Fallo al cargar configuración vía IPC:', err);
        }
      }

      set({
        config: activeConfig,
        isLoaded: true,
        apiKey: activeConfig.apiKey,
        modelId: activeConfig.modelId,
        temperature: activeConfig.temperature,
        systemPrompt: activeConfig.systemPrompt,
        voiceName: activeConfig.voiceName,
        voiceVolume: activeConfig.voiceVolume ?? 100,
        ttsFallbackVoice: activeConfig.ttsFallbackVoice ?? '',
        ttsFallbackEnabled: activeConfig.ttsFallbackEnabled ?? true,
        externalTranslationEnabled: activeConfig.externalTranslationEnabled ?? false,
        translationTargetLanguage: activeConfig.translationTargetLanguage ?? 'es',
        translationAggregateMs: activeConfig.translationAggregateMs ?? 400,
        translationGameAudioDeviceId: activeConfig.translationGameAudioDeviceId ?? '',
        translationGameAudioDeviceLabel: activeConfig.translationGameAudioDeviceLabel ?? '',
      });
    },

    updateConfig: async (partial) => {
      await migrateLegacySettings();
      const current = get().config;
      const updated: AppConfig = {
        ...current,
        ...publicSettings(partial),
        updatedAt: new Date().toISOString(),
      };

      saveToLocalStorage(updated);
      set({
        config: updated,

        modelId: updated.modelId,
        temperature: updated.temperature,
        systemPrompt: updated.systemPrompt,
        voiceName: updated.voiceName,
        voiceVolume: updated.voiceVolume ?? 100,
        ttsFallbackVoice: updated.ttsFallbackVoice ?? '',
        ttsFallbackEnabled: updated.ttsFallbackEnabled ?? true,
        externalTranslationEnabled: updated.externalTranslationEnabled ?? false,
        translationTargetLanguage: updated.translationTargetLanguage ?? 'es',
        translationAggregateMs: updated.translationAggregateMs ?? 400,
        translationGameAudioDeviceId: updated.translationGameAudioDeviceId ?? '',
        translationGameAudioDeviceLabel: updated.translationGameAudioDeviceLabel ?? '',
      });

      if (electronBridge.isElectron && typeof electronBridge.saveAppConfig === 'function') {
        try {
          await electronBridge.saveAppConfig(updated);
        } catch (err) {
          console.warn('[useSettingsStore] Fallo al guardar configuración vía IPC:', err);
        }
      }
    },

    resetDefaults: async () => {
      const envKey = getEnvApiKey();
      const freshConfig: AppConfig = {
        ...DEFAULT_APP_CONFIG,
        apiKey: envKey,
        updatedAt: new Date().toISOString(),
      };

      saveToLocalStorage(freshConfig);
      set({
        config: freshConfig,
        apiKey: freshConfig.apiKey,
        showApiKey: false,
        modelId: freshConfig.modelId,
        temperature: freshConfig.temperature,
        systemPrompt: freshConfig.systemPrompt,
        voiceName: freshConfig.voiceName,
        voiceVolume: freshConfig.voiceVolume ?? 100,
        ttsFallbackVoice: freshConfig.ttsFallbackVoice ?? '',
        ttsFallbackEnabled: freshConfig.ttsFallbackEnabled ?? true,
        externalTranslationEnabled: freshConfig.externalTranslationEnabled ?? false,
        translationSourceLanguage: 'en',
        translationTargetLanguage: freshConfig.translationTargetLanguage ?? 'es',
        translationAggregateMs: freshConfig.translationAggregateMs ?? 400,
        translationGameAudioDeviceId: freshConfig.translationGameAudioDeviceId ?? '',
        translationGameAudioDeviceLabel: freshConfig.translationGameAudioDeviceLabel ?? '',
        wasapiLoopbackEnabled: false,
      });

      if (electronBridge.isElectron && typeof electronBridge.saveAppConfig === 'function') {
        try {
          await electronBridge.saveAppConfig(freshConfig);
        } catch (err) {
          console.warn('[useSettingsStore] Fallo al resetear configuración vía IPC:', err);
        }
      }
    },

    setField: (field, value) => {
      if (field === 'apiKey' || field === 'spotifyClientSecret' || field === 'discordToken') {
        set({ [field]: String(value) }); return;
      }
      if (field === 'showApiKey') {
        set({ showApiKey: Boolean(value) });
        return;
      }
      if (field === 'wasapiLoopbackEnabled') {
        set({ wasapiLoopbackEnabled: Boolean(value) });
        return;
      }
      if (field === 'translationSourceLanguage') {
        set({ translationSourceLanguage: String(value) });
        return;
      }

      // Update both top-level property and internal config
      const partialConfig: Partial<AppConfig> = { [field]: value };
      void get().updateConfig(partialConfig);
    },

    setConfig: (configOrUpdater) => {
      const current = get().config;
      const next = typeof configOrUpdater === 'function' ? configOrUpdater(current) : configOrUpdater;
      void get().updateConfig(next);
    },

    setIsSettingsWindowOpen: (isOpen) => set({ isSettingsWindowOpen: isOpen }),

    handleOpenSettings: () => {
      if (electronBridge.isElectron && typeof electronBridge.openSettingsWindow === 'function') {
        void electronBridge.openSettingsWindow();
      } else {
        set({ isSettingsWindowOpen: true });
      }
    },

    switchLive2DModel: (modelId) => {
      void get().updateConfig({ activeModelId: modelId, live2dModelId: modelId });
      const modelName = live2dModelRegistry.getModel(modelId)?.name || modelId;
      toastService.info('Avatar', `Modelo cambiado a: ${modelName}`);
    },

    switchAiModel: (modelId) => {
      void get().updateConfig({ modelId });
      toastService.info('Modelo IA', `Motor cambiado a: ${modelId}`);
    },

    switchVoice: (voiceName) => {
      void get().updateConfig({ voiceName });
      toastService.info('Voz de Cristi', `Timbre cambiado a: ${voiceName}`);
    },
  };
});
