import { useShallow } from 'zustand/react/shallow';
import React, { useRef } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import {
  BackgroundScene,
  AvatarStage,
  SubtitleOverlay,
  FloatingHUD,
  ContextMenu,
  ScreenRegionOverlay,
  ScreenRegionPicker,
  PerformanceHUD,
  DesktopWidgets,
  ToastContainer
} from './components';
import {
  useCompanionStore,
  useSessionStore,
  useAudioStore,
  useVisionStore,
  useSettingsStore,
  useTelemetryStore,
  useWidgetStore
} from './stores/index.js';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts.js';
import { useCompanionServices } from './hooks/useCompanionServices.js';

export function App() {
  const live2dRef = useRef<any>(null);
  React.useEffect(() => {
    void useSettingsStore.getState().loadConfig().catch(error => useSessionStore.getState().setErrorMessage(String(error)));
  }, []);

  // Consume Zustand stores
  const { currentGesture, viewMode, isSpeaking, isListening, activeToolName, activeDecision, isSolidBackdrop, isAlwaysOnTop, isClickThroughEnabled, isZenMode, isUiVisible, contextMenu, triggerRandomGesture, toggleViewMode, toggleBackdrop, toggleAlwaysOnTop, toggleClickThrough, toggleZenMode, closeContextMenu } = useCompanionStore(useShallow(s => ({ currentGesture: s.currentGesture, viewMode: s.viewMode, isSpeaking: s.isSpeaking, isListening: s.isListening, activeToolName: s.activeToolName, activeDecision: s.activeDecision, isSolidBackdrop: s.isSolidBackdrop, isAlwaysOnTop: s.isAlwaysOnTop, isClickThroughEnabled: s.isClickThroughEnabled, isZenMode: s.isZenMode, isUiVisible: s.isUiVisible, contextMenu: s.contextMenu, triggerRandomGesture: s.triggerRandomGesture, toggleViewMode: s.toggleViewMode, toggleBackdrop: s.toggleBackdrop, toggleAlwaysOnTop: s.toggleAlwaysOnTop, toggleClickThrough: s.toggleClickThrough, toggleZenMode: s.toggleZenMode, closeContextMenu: s.closeContextMenu })));

  const { isConnected, isConnecting, errorMessage, setErrorMessage } = useSessionStore(useShallow(s => ({ isConnected: s.isConnected, isConnecting: s.isConnecting, errorMessage: s.errorMessage, setErrorMessage: s.setErrorMessage })));
  const { isMuted, toggleMute } = useAudioStore(useShallow(s => ({ isMuted: s.isMuted, toggleMute: s.toggleMute })));
  const { isCameraActive, isScreenWatchActive, screenRegion, isRegionPickerOpen, openRegionPicker, closeRegionPicker } = useVisionStore(useShallow(s => ({ isCameraActive: s.isCameraActive, isScreenWatchActive: s.isScreenWatchActive, screenRegion: s.screenRegion, isRegionPickerOpen: s.isRegionPickerOpen, openRegionPicker: s.openRegionPicker, closeRegionPicker: s.closeRegionPicker })));
  const { config, switchAiModel, switchVoice, switchLive2DModel, handleOpenSettings } = useSettingsStore(useShallow(s => ({ config: s.config, switchAiModel: s.switchAiModel, switchVoice: s.switchVoice, switchLive2DModel: s.switchLive2DModel, handleOpenSettings: s.handleOpenSettings })));
  const { isPerformanceHudOpen, togglePerformanceHud, closePerformanceHud } = useTelemetryStore(useShallow(s => ({ isPerformanceHudOpen: s.isPerformanceHudOpen, togglePerformanceHud: s.togglePerformanceHud, closePerformanceHud: s.closePerformanceHud })));
  const { showWidgets, toggleShowWidgets } = useWidgetStore(useShallow(s => ({ showWidgets: s.showWidgets, toggleShowWidgets: s.toggleShowWidgets })));

  // Background services coordination & native shortcuts
  const {
    handleToggleConnection, handleToggleCamera, handleToggleScreenWatch, handleRegionSelected,
    handleClearScreenRegion, handleModelContextMenu, handleMinimizeToTray, resetInactivityTimer
  } = useCompanionServices({ live2dRef });

  useGlobalShortcuts({ resetInactivityTimer, onToggleConnection: handleToggleConnection });

  return (
    <div className={`app-container ${isSolidBackdrop ? 'solid-backdrop' : 'transparent-backdrop'}`}>
      {errorMessage && (
        <div className="global-error-toast">
          <ShieldAlert size={16} color="#f43f5e" />
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)}><X size={14} /></button>
        </div>
      )}

      {/* 1. BackgroundScene */}
      <BackgroundScene />

      {/* 2. Live2DContainer / AvatarStage */}
      <AvatarStage
        ref={live2dRef}
        modelId={config.live2dModelId || 'yanderegirl'}
        gesture={currentGesture}
        isSpeaking={isSpeaking}
        isListening={isListening}
        viewMode={viewMode}
        onModelClick={triggerRandomGesture}
        onModelContextMenu={handleModelContextMenu}
      />

      {/* 3. SubtitleOverlay */}
      <ConnectedSubtitles
        activeDecision={activeDecision}
        isVisible={isUiVisible && !isZenMode}
      />

      {/* 4. FloatingHUD */}
      <FloatingHUD
        isConnected={isConnected} isConnecting={isConnecting} isMuted={isMuted}
        isCameraActive={isCameraActive} isSolidBackdrop={isSolidBackdrop}
        modelId={config.modelId} voiceName={config.voiceName}
        isSpeaking={isSpeaking} isListening={isListening}
        activeToolName={activeToolName} viewMode={viewMode} isUiVisible={isUiVisible}
        onToggleConnection={handleToggleConnection} onToggleMute={toggleMute}
        onToggleCamera={handleToggleCamera} onToggleBackdrop={toggleBackdrop}
        onOpenSettings={handleOpenSettings} isScreenWatchActive={isScreenWatchActive}
        hasScreenRegion={Boolean(screenRegion)} onToggleScreenWatch={handleToggleScreenWatch}
        onTogglePerformanceHUD={togglePerformanceHud} onOpenRegionPicker={openRegionPicker}
        onClearScreenRegion={handleClearScreenRegion} onToggleViewMode={toggleViewMode}
        onToggleZenMode={toggleZenMode} onWakeUi={resetInactivityTimer}
      />

      {/* 5. ContextMenu */}
      <ContextMenu
        position={contextMenu} isOpen={contextMenu.isOpen} onClose={closeContextMenu}
        onOpenSettings={handleOpenSettings} onToggleCamera={handleToggleCamera} isCameraActive={isCameraActive}
        onToggleBackdrop={toggleBackdrop} isSolidBackdrop={isSolidBackdrop}
        onTriggerRandomGesture={triggerRandomGesture} onToggleAlwaysOnTop={toggleAlwaysOnTop} isAlwaysOnTop={isAlwaysOnTop}
        viewMode={viewMode} onToggleViewMode={toggleViewMode} isZenMode={isZenMode} onToggleZenMode={toggleZenMode}
        onMinimizeToTray={handleMinimizeToTray} showWidgets={showWidgets} onToggleWidgets={toggleShowWidgets}
        isClickThroughEnabled={isClickThroughEnabled} onToggleClickThrough={toggleClickThrough}
        onTogglePerformanceHUD={togglePerformanceHud} onOpenRegionPicker={openRegionPicker}
        isMuted={isMuted} onToggleMute={toggleMute} activeModelId={config.live2dModelId || 'yanderegirl'}
        onSwitchLive2DModel={switchLive2DModel} activeAiModelId={config.modelId} onSwitchAiModel={switchAiModel}
        activeVoiceName={config.voiceName} onSwitchVoice={switchVoice}
      />

      {/* 6. ScreenRegionOverlay & ScreenRegionPicker */}
      <ScreenRegionOverlay region={screenRegion} isWatchActive={isScreenWatchActive} />
      {isRegionPickerOpen && (
        <ScreenRegionPicker onRegionSelected={handleRegionSelected} onCancel={closeRegionPicker} />
      )}

      {/* 7. PerformanceHUD */}
      <PerformanceHUD isVisible={isPerformanceHudOpen} onClose={closePerformanceHud} />

      {/* 8. DesktopWidgets */}
      <DesktopWidgets isVisible={showWidgets && isUiVisible && !isZenMode} />

      {/* 9. ToastContainer */}
      <ToastContainer />
    </div>
  );
}

export default App;

function ConnectedSubtitles(props: { activeDecision: unknown; isVisible: boolean }) {
  const userTranscript = useSessionStore(s => s.userTranscript);
  const modelTranscript = useSessionStore(s => s.modelTranscript);
  const translationTranscript = useSessionStore(s => s.translationTranscript);
  const provisional = useSessionStore(s => Boolean(s.inputInterim || s.outputInterim));
  return <div data-transcript-provisional={provisional}><SubtitleOverlay {...props} userTranscript={userTranscript} modelTranscript={modelTranscript} translationTranscript={translationTranscript} /></div>;
}
