import { create } from 'zustand';
import { TelemetryMetrics } from '@/types';
import { toastService } from '../infrastructure/notifications/toastService.js';

export interface TelemetryState extends TelemetryMetrics {
  // --- Core Estado Requerido ---
  isVisible: boolean;

  // --- Extended State ---
  isPerformanceHudOpen: boolean; // Alias to isVisible
  activeTab: 'fps' | 'memory' | 'dsp';
  telemetry: Partial<TelemetryMetrics>;

  // --- Core Acciones Requeridas ---
  setMetrics: (metrics: Partial<TelemetryMetrics>) => void;
  toggleVisibility: () => void;

  // --- Extended Actions ---
  setIsVisible: (isVisible: boolean) => void;
  resetMetrics: () => void;
  setIsPerformanceHudOpen: (open: boolean) => void;
  togglePerformanceHud: () => void;
  openPerformanceHud: () => void;
  closePerformanceHud: () => void;
  setTelemetry: (telemetry: Partial<TelemetryMetrics>) => void;
  setActiveTab: (tab: 'fps' | 'memory' | 'dsp') => void;
}

const DEFAULT_METRICS: TelemetryMetrics = {
  fps: 0,
  tps: 0,
  p99: 0,
  v8HeapMB: 0,
  processRssMB: 0,
};

export const useTelemetryStore = create<TelemetryState>()((set, get) => ({
  // Core initial state
  ...DEFAULT_METRICS,
  isVisible: false,

  // Extended initial state
  isPerformanceHudOpen: false,
  activeTab: 'fps',
  telemetry: {},

  // Core Actions
  setMetrics: (metrics) =>
    set((state) => ({
      ...state,
      ...metrics,
      telemetry: { ...state.telemetry, ...metrics },
    })),

  toggleVisibility: () => {
    const next = !get().isVisible;
    set({ isVisible: next, isPerformanceHudOpen: next });
    toastService.info(next ? 'Telemetría y FPS activada (F3)' : 'Telemetría oculta (F3)');
  },

  // Extended Actions
  setIsVisible: (isVisible) => set({ isVisible, isPerformanceHudOpen: isVisible }),
  resetMetrics: () => set({ ...DEFAULT_METRICS, telemetry: {} }),
  setIsPerformanceHudOpen: (open) => set({ isVisible: open, isPerformanceHudOpen: open }),
  togglePerformanceHud: () => get().toggleVisibility(),
  openPerformanceHud: () => set({ isVisible: true, isPerformanceHudOpen: true }),
  closePerformanceHud: () => set({ isVisible: false, isPerformanceHudOpen: false }),
  setTelemetry: (telemetry) => get().setMetrics(telemetry),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
