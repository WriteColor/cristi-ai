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
export { SpeechRecognitionService } from './speechRecognition.js';
export { SystemTrayService } from './systemTrayService.js';
export { ToolExecutor } from './toolExecutor.js';
export { VirtualTerminalService } from './virtualTerminalService.js';
export { VisionDetectionService } from './visionDetectionService.js';
export { LocalVisionService, localVisionService } from './localVisionService.js';
export { Live2DModelRegistry, live2dModelRegistry, Live2DAdapter, Live2DController, ContextualEmotionOrchestrator, contextualEmotionOrchestrator } from './live2d/index.js';
export { ExternalDeviceManager, externalDeviceManager } from './externalDevices/index.js';
export { GameIntegrationManager, gameIntegrationManager } from './gameIntegration/index.js';
export { ToastService, toastService, toast } from './toastService.js';
export { ClickThroughService, clickThroughService, ElectronBridge, electronBridge, LockScreenService, lockScreenService } from './desktop/index.js';
export { SpeakerRecognitionService, speakerRecognitionService } from './audio/SpeakerRecognitionService.js';
export { ModelManager, modelManager } from './modelManager.js';
export { ConfigManager, configManager } from './configManager.js';
export { SoundFxService, soundFxService } from './soundFxService.js';
export { logger } from './logger.js';


