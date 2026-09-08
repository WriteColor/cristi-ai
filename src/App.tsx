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

  // Consume Zustand stores
  const {
    currentGesture, viewMode, isSpeaking, isListening, activeToolName, activeDecision,
    isSolidBackdrop, isAlwaysOnTop, isClickThroughEnabled, isZenMode, isUiVisible, contextMenu,
    triggerRandomGesture, toggleViewMode, toggleBackdrop, toggleAlwaysOnTop, toggleClickThrough,
    toggleZenMode, closeContextMenu
  } = useCompanionStore();

  const { isConnected, isConnecting, errorMessage, userTranscript, modelTranscript, translationTranscript, setErrorMessage } = useSessionStore();
  const { isMuted, toggleMute } = useAudioStore();
  const { isCameraActive, isScreenWatchActive, screenRegion, isRegionPickerOpen, openRegionPicker, closeRegionPicker } = useVisionStore();
  const { config, switchAiModel, switchVoice, switchLive2DModel, handleOpenSettings } = useSettingsStore();
  const { isPerformanceHudOpen, togglePerformanceHud, closePerformanceHud } = useTelemetryStore();
  const { showWidgets, toggleShowWidgets } = useWidgetStore();

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
      <SubtitleOverlay
        userTranscript={userTranscript}
        modelTranscript={modelTranscript}
        translationTranscript={translationTranscript}
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
