import { create } from 'zustand';
import { GeminiLiveConnectionState, SessionLog } from '@/types';

const MAX_LOGS = 100;

export interface SessionState {
  // --- Core Estado Requerido ---
  connectionState: GeminiLiveConnectionState;
  userSubtitle: string;
  assistantSubtitle: string;
  isInterrupted: boolean;
  activeToolName: string | null;
  recentLogs: SessionLog[];

  // --- Extended / Convenience State ---
  isConnected: boolean;
  isConnecting: boolean;
  userTranscript: string;
  modelTranscript: string;
  translationTranscript: string;
  errorMessage: string | null;

  // --- Core Acciones Requeridas ---
  setConnectionState: (connectionState: GeminiLiveConnectionState) => void;
  setUserSubtitle: (userSubtitle: string) => void;
  setAssistantSubtitle: (assistantSubtitle: string) => void;
  setInterrupted: (isInterrupted: boolean) => void;
  setActiveTool: (activeToolName: string | null) => void;
  addLog: (tagOrLog: string | Omit<SessionLog, 'id' | 'timestamp'> | SessionLog, maybeMessage?: string) => void;
  clearSubtitles: () => void;

  // --- Extended Actions ---
  setIsConnected: (isConnected: boolean) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setUserTranscript: (userTranscript: string) => void;
  setModelTranscript: (modelTranscript: string) => void;
  setTranslationTranscript: (translationTranscript: string) => void;
  setErrorMessage: (errorMessage: string | null) => void;
  setSubtitleText: (text: string) => void;
  clearLogs: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  // Core initial state
  connectionState: 'DISCONNECTED',
  userSubtitle: '',
  assistantSubtitle: '',
  isInterrupted: false,
  activeToolName: null,
  recentLogs: [],

  // Extended initial state
  isConnected: false,
  isConnecting: false,
  userTranscript: '',
  modelTranscript: '',
  translationTranscript: '',
  errorMessage: null,

  // Core Actions
  setConnectionState: (connectionState) =>
    set({
      connectionState,
      isConnected: connectionState === 'READY' || connectionState === 'TRANSMITTING',
      isConnecting: connectionState === 'CONNECTING' || connectionState === 'RECONNECTING',
    }),

  setUserSubtitle: (userSubtitle) => set({ userSubtitle, userTranscript: userSubtitle }),
  setAssistantSubtitle: (assistantSubtitle) => set({ assistantSubtitle, modelTranscript: assistantSubtitle }),
  setInterrupted: (isInterrupted) => set({ isInterrupted }),
  setActiveTool: (activeToolName) => set({ activeToolName }),

  addLog: (tagOrLog, maybeMessage) =>
    set((state) => {
      let entry: SessionLog;

      if (typeof tagOrLog === 'string') {
        entry = {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          tag: tagOrLog,
          message: maybeMessage ?? '',
          timestamp: Date.now(),
        };
      } else {
        const hasId = 'id' in tagOrLog && typeof tagOrLog.id === 'string';
        const hasTimestamp = 'timestamp' in tagOrLog && typeof tagOrLog.timestamp === 'number';
        entry = {
          id: hasId ? (tagOrLog as SessionLog).id : `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          tag: tagOrLog.tag,
          message: tagOrLog.message,
          timestamp: hasTimestamp ? (tagOrLog as SessionLog).timestamp : Date.now(),
        };
      }

      const nextLogs = [entry, ...state.recentLogs].slice(0, MAX_LOGS);
      return { recentLogs: nextLogs };
    }),

  clearSubtitles: () =>
    set({
      userSubtitle: '',
      assistantSubtitle: '',
      userTranscript: '',
      modelTranscript: '',
      translationTranscript: '',
    }),

  // Extended Actions
  setIsConnected: (isConnected) =>
    set({
      isConnected,
      connectionState: isConnected ? 'READY' : 'DISCONNECTED',
      isConnecting: false,
    }),

  setIsConnecting: (isConnecting) =>
    set({
      isConnecting,
      connectionState: isConnecting ? 'CONNECTING' : 'DISCONNECTED',
    }),

  setUserTranscript: (userTranscript) => set({ userTranscript, userSubtitle: userTranscript }),
  setModelTranscript: (modelTranscript) => set({ modelTranscript, assistantSubtitle: modelTranscript }),
  setTranslationTranscript: (translationTranscript) => set({ translationTranscript }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setSubtitleText: (text) => set({ assistantSubtitle: text, modelTranscript: text }),
  clearLogs: () => set({ recentLogs: [] }),
}));
