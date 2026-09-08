/**
 * Cristi AI — Master Service & Domain Facade (TypeScript)
 * Unifies new domain engines, Zustand stores, and service adapters.
 */

// Modern domain engines & stores
export * from '@/domain/gemini';
export * from '@/domain/live2d';
export * from '@/domain/tools';
export * from '@/domain/sensory';
export * from '@/domain/audio';
export * from '@/domain/integrations';
export * from '@/stores';

// Core utilities
export { eventBus, EVENTS } from './eventBus.js';
export { logger } from './logger.js';
export { ToastService, toastService, toast } from './toastService.js';
export { ElectronBridge, electronBridge } from './desktop/ElectronBridge.js';
export { ClickThroughService, clickThroughService } from './desktop/ClickThroughService.js';

// Legacy service adapters & instances
export { AudioAnalysisService } from './audioAnalysisService.js';
export { GeminiLiveSocket } from './geminiLiveSocket.js';
export { AudioInputService } from './audioInputService.js';
export { AudioOutputService } from './audioOutputService.js';
export { CameraService } from './cameraService.js';
export { ScreenCaptureService } from './screenCaptureService.js';
export { SystemTrayService } from './systemTrayService.js';
export { ToolExecutor } from './toolExecutor.js';
export { VirtualTerminalService } from './virtualTerminalService.js';
export { VisionDetectionService } from './visionDetectionService.js';
export { LocalVisionService, localVisionService } from './localVisionService.js';
export { Live2DModelRegistry, live2dModelRegistry, Live2DAdapter, Live2DController, ContextualEmotionOrchestrator, contextualEmotionOrchestrator } from './live2d/index.js';
export { ExternalDeviceManager, externalDeviceManager } from './externalDevices/index.js';
export { GameIntegrationManager, gameIntegrationManager } from './gameIntegration/index.js';
export { ModelManager, modelManager } from './modelManager.js';
export { ConfigManager, configManager } from './configManager.js';
export { SoundFxService, soundFxService } from './soundFxService.js';
export { ProactiveTriggerService, proactiveTriggerService } from './proactiveTriggerService.js';
export { ProactiveScheduler, proactiveScheduler } from './proactiveScheduler.js';
export { SceneManager, sceneManager } from './sceneManager.js';
export { PerformanceProfilerService, performanceProfiler } from './profiler/PerformanceProfilerService.js';
export { MemoryService, memoryService, MEMORY_CATEGORIES } from './memory/MemoryService.js';
export { MemoryRepository } from './memory/MemoryRepository.js';
export { MemoryIndex } from './memory/MemoryIndex.js';
export { MCPClientManager, mcpClientManager } from './mcp/MCPClientManager.js';
export { BrowserAutomationService, browserAutomationService } from './browser/BrowserAutomationService.js';
export { MinecraftCompanionService, minecraftCompanion } from './gameIntegration/MinecraftCompanionService.js';
export { GameAdapter } from './gameIntegration/GameAdapter.js';
export { AudioRoutingService, audioRoutingService } from './translation/AudioRoutingService.js';
export { TranslationService, translationService } from './translation/TranslationService.js';
export { GeminiTranslationProvider } from './translation/GeminiTranslationProvider.js';
export { DesktopLoopbackCaptureService, desktopLoopbackCaptureService } from './translation/DesktopLoopbackCaptureService.js';
export { VirtualAudioOutputService, virtualAudioOutputService } from './translation/VirtualAudioOutputService.js';
export { TranslationOutputCoordinator } from './translation/TranslationOutputCoordinator.js';
export { InteractionOrchestrator, interactionOrchestrator } from './interaction/InteractionOrchestrator.js';
export { ExternalReplyService, externalReplyService } from './interaction/ExternalReplyService.js';
export { DiscordCompanionService, discordCompanion } from './discord/DiscordCompanionService.js';
export { DiscordVoiceService, discordVoiceService } from './discord/DiscordVoiceService.js';
export { VisionStreamManager, visionStreamManager } from './vision/VisionStreamManager.js';
export { VisionFrameDispatcher, visionFrameDispatcher } from './vision/VisionFrameDispatcher.js';
export { TTSFallbackService, ttsFallbackService } from './ttsFallbackService.js';
export { PlaywrightService, playwrightService } from './playwright/PlaywrightService.js';
export { SpotifyService, spotifyService } from './spotify/SpotifyService.js';
