/**
 * Cristi AI — Master Service & Domain Facade (TypeScript)
 * Unifies new domain engines, Zustand stores, and service adapters.
 */

// Modern domain engines & stores

// Core utilities
export { eventBus, EVENTS } from '../infrastructure/events/eventBus';
export { logger } from '../infrastructure/logging/logger';
export { ToastService, toastService, toast } from '../infrastructure/notifications/toastService';
export { ElectronBridge, electronBridge } from '../services/desktop/ElectronBridge';
export { ClickThroughService, clickThroughService } from '../services/desktop/ClickThroughService';

// Legacy service adapters & instances
export { AudioAnalysisService } from '../domain/audio/AudioAnalysisService';
export { GeminiLiveClient as GeminiLiveSocket } from '../domain/gemini/GeminiLiveClient';
export { AudioInputProcessor as AudioInputService } from '../domain/gemini/AudioInputProcessor';
export { AudioOutputPlayer as AudioOutputService } from '../domain/gemini/AudioOutputPlayer';
export { CameraService } from '../domain/sensory/CameraService';
export { ScreenCaptureService } from '../domain/sensory/ScreenCaptureService';
export { SystemTrayService } from '../services/desktop/SystemTrayService';
export { ToolExecutor } from '../domain/tools/ToolExecutor';
export { VisionDetectionService } from '../domain/sensory/VisionDetectionService';
export { LocalVisionService, localVisionService } from '../domain/sensory/LocalVisionService';
export { Live2DModelRegistry, live2dModelRegistry, Live2DAdapter, Live2DController, ContextualEmotionOrchestrator, contextualEmotionOrchestrator } from '../domain/live2d/index';
export { ExternalDeviceManager, externalDeviceManager } from '../domain/integrations/externalDevices/index';
export { GameIntegrationManager, gameIntegrationManager } from '../domain/integrations/minecraft/index';
export { ModelManager, modelManager } from '../domain/gemini/ModelManager';
export { ConfigManager, configManager } from '../infrastructure/config/ConfigManager';
export { SoundFxService, soundFxService } from '../domain/audio/SoundFxService';
export { ProactiveTriggerService, proactiveTriggerService } from '../domain/interaction/ProactiveTriggerService';
export { ProactiveScheduler, proactiveScheduler } from '../domain/interaction/ProactiveScheduler';
export { SceneManager, sceneManager } from '../domain/scenes/SceneManager';
export { PerformanceProfilerService, performanceProfiler } from '../infrastructure/profiler/PerformanceProfilerService';
export { MemoryService, memoryService, MEMORY_CATEGORIES } from '../domain/integrations/memory/MemoryService';
export { MemoryRepository } from '../domain/integrations/memory/MemoryRepository';
export { MemoryIndex } from '../domain/integrations/memory/MemoryIndex';
export { MCPClientManager, mcpClientManager } from '../domain/integrations/mcp/MCPClientManager';
export { BrowserAutomationService, browserAutomationService } from '../domain/integrations/browser/BrowserAutomationService';
export { MinecraftCompanionService, minecraftCompanion } from '../domain/integrations/minecraft/MinecraftCompanionService';
export { GameAdapter } from '../domain/integrations/minecraft/GameAdapter';
export { AudioRoutingService, audioRoutingService } from '../domain/audio/AudioRoutingService';
export { TranslationService, translationService } from '../domain/audio/TranslationService';
export { GeminiTranslationProvider } from '../domain/audio/GeminiTranslationProvider';
export { DesktopLoopbackCaptureService, desktopLoopbackCaptureService } from '../domain/audio/DesktopLoopbackCaptureService';
export { VirtualAudioOutputService, virtualAudioOutputService } from '../domain/audio/VirtualAudioOutputService';
export { TranslationOutputCoordinator } from '../domain/audio/TranslationOutputCoordinator';
export { InteractionOrchestrator, interactionOrchestrator } from '../domain/interaction/InteractionOrchestrator';
export { ExternalReplyService, externalReplyService } from '../domain/interaction/ExternalReplyService';
export { DiscordCompanionService, discordCompanion } from '../domain/integrations/discord/DiscordCompanionService';
export { DiscordVoiceService, discordVoiceService } from '../domain/integrations/discord/DiscordVoiceService';
export { VisionStreamManager, visionStreamManager } from '../domain/sensory/vision/VisionStreamManager';
export { VisionFrameDispatcher, visionFrameDispatcher } from '../domain/sensory/vision/VisionFrameDispatcher';
export { TTSFallbackService, ttsFallbackService } from '../domain/audio/TTSFallbackService';
export { PlaywrightService, playwrightService } from '../domain/integrations/playwright/PlaywrightService';
export { SpotifyService, spotifyService } from '../domain/integrations/spotify/SpotifyService';
