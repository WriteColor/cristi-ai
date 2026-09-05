/**
 * Cristi AI - Service Barrel Exports
 */

export { eventBus, EVENTS } from './eventBus.js';
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
export { ToastService, toastService, toast } from './toastService.js';
export { ClickThroughService, clickThroughService, ElectronBridge, electronBridge } from './desktop/index.js';
export { ModelManager, modelManager } from './modelManager.js';
export { ConfigManager, configManager } from './configManager.js';
export { SoundFxService, soundFxService } from './soundFxService.js';
export { ProactiveTriggerService, proactiveTriggerService } from './proactiveTriggerService.js';
export { ProactiveScheduler, proactiveScheduler } from './proactiveScheduler.js';
export { SceneManager, sceneManager } from './sceneManager.js';
export { PerformanceProfilerService, performanceProfiler } from './profiler/PerformanceProfilerService.js';
export { MemoryService, memoryService, MEMORY_CATEGORIES } from './memory/MemoryService.js';
export { MemoryRepository } from './memory/MemoryRepository.js';
export { MCPClientManager, mcpClientManager } from './mcp/MCPClientManager.js';
export { BrowserAutomationService, browserAutomationService } from './browser/BrowserAutomationService.js';
export { MinecraftCompanionService, minecraftCompanion } from './gameIntegration/MinecraftCompanionService.js';
export { GameAdapter } from './gameIntegration/GameAdapter.js';
export { AudioRoutingService, audioRoutingService } from './translation/AudioRoutingService.js';
export { TranslationService, translationService } from './translation/TranslationService.js';
export { DesktopLoopbackCaptureService, desktopLoopbackCaptureService } from './translation/DesktopLoopbackCaptureService.js';
export { InteractionOrchestrator, interactionOrchestrator } from './interaction/InteractionOrchestrator.js';
export { DiscordCompanionService, discordCompanion } from './discord/DiscordCompanionService.js';
export { VisionStreamManager, visionStreamManager } from './vision/VisionStreamManager.js';
export { VisionFrameDispatcher, visionFrameDispatcher } from './vision/VisionFrameDispatcher.js';
export { TTSFallbackService, ttsFallbackService } from './ttsFallbackService.js';
export { PlaywrightService, playwrightService } from './playwright/PlaywrightService.js';
export { SpotifyService, spotifyService } from './spotify/SpotifyService.js';
export { logger } from './logger.js';



