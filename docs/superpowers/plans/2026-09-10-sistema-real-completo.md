# Cristi AI — Transición a Fase de Operación Real y Eliminación Total de Deuda Técnica

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar Cristi AI en un sistema real y completamente confiable, eliminando las 61 implementaciones legadas no tipadas `.js` en `src/`, sustituyendo los mocks engañosos de pruebas unitarias por pruebas de módulos reales y saneando fugas IPC, garantizando una arquitectura 100% TypeScript verificable sin excepciones.

**Architecture:** Arquitectura basada en dominios estrictos (`src/domain/`, `src/infrastructure/`, `src/app/`) comunicados por contratos IPC unificados (`shared/ipc/contracts.ts`) y `ElectronBridge.ts` fuertemente tipado (0 `any`). Se elimina la fachada híbrida y se unifica el runtime React 19/Zustand con aislamiento de procesos y Web Audio / WebGL eficientes.

**Tech Stack:** React 19, TypeScript 5.8+, Vite 6, Electron 43.6, PixiJS 7 / Cubism 4, Web Audio API, TensorFlow.js / MoveNet, Zustand 5, Zod, Node.js 22 test runner.

**Spec:** `docs/audit_reference/auditoria-cristi-ai.md` y `docs/estado-auditoria-2026-09-10.md`

## Global Constraints

- **REGLA ESTRICTA DE PAQUETES:** NUNCA usar `npm`. Usar `pnpm` exclusivamente (y `pnpm dlx` para npx).
- **CONCHAS WINDOWS:** Comandos PowerShell 5.1; separación por `;`, NUNCA usar `&&`.
- **CERO `any` Y CERO `.js`:** Todos los 61 archivos `.js` de `src/` deben ser migrados a `.ts` o eliminados si son duplicados.
- **IPC ESTRICTO:** Prohibido el acceso directo a `window.electronAPI` o `window.electron` en componentes y servicios; toda llamada debe atravesar `ElectronBridge.ts` bajo tipos definidos en `shared/ipc/contracts.ts`.
- **MÁQUINA DE ESTADOS (R-03):** Todo cambio de conexión en `useSessionStore` debe pasar por `dispatchConnection(...)`. Prohibido mutar `isConnecting` o `isConnected` directamente.
- **HONESTIDAD EN PRUEBAS:** `scripts/run-tests.mjs` no debe enmascarar fallas con stubs vacíos de servicios que se ejecutan en producción.

---

### Task 1: Limpieza de duplicados, Profiler estricto y SceneManager

**Files:**
- Delete: `src/hooks/useClickThrough.js`
- Delete: `src/hooks/index.js`
- Modify: `src/infrastructure/profiler/PerformanceProfilerService.js` -> `src/infrastructure/profiler/PerformanceProfilerService.ts`
- Modify: `src/domain/scenes/SceneManager.js` -> `src/domain/scenes/SceneManager.ts`
- Modify: `src/app/serviceRegistry.ts:13-35`

**Interfaces:**
- Consumes: `electronBridge.getProcessMemoryInfo()`, `electronBridge.getGpuInfo()`, `eventBus`, `logger`
- Produces: `performanceProfiler: PerformanceProfilerService`, `sceneManager: SceneManager`

- [ ] **Step 1: Eliminar archivos duplicados en hooks**
  Eliminar `src/hooks/useClickThrough.js` y `src/hooks/index.js` (ya existen sus versiones completas `.ts`).

- [ ] **Step 2: Migrar `PerformanceProfilerService.js` a TypeScript estricto**
  Convertir a `src/infrastructure/profiler/PerformanceProfilerService.ts`:
  - Enrutar `getProcessMemoryInfo` y `getGpuInfo` a través de `electronBridge`.
  - Definir interfaces `SnapshotData`, `ComponentTimings`, `MemoryMetrics`, `AnomalyIncident`.
  - Eliminar el archivo `.js`.

- [ ] **Step 3: Migrar `SceneManager.js` a TypeScript estricto**
  Convertir a `src/domain/scenes/SceneManager.ts`:
  - Definir interfaces `SceneState`, `SceneItem`, `CustomSceneData`.
  - Tipar métodos `getScene()`, `getAvailableScenes()`, `addCustomScene()`, `removeCustomScene()`.
  - Eliminar el archivo `.js`.

- [ ] **Step 4: Verificar typecheck**
  Ejecutar: `pnpm run typecheck:renderer`

---

### Task 2: Migración del Subsistema Sensorial y Visión

**Files:**
- Modify: `src/domain/sensory/vision/CaptureLoop.js` -> `src/domain/sensory/vision/CaptureLoop.ts`
- Modify: `src/domain/sensory/vision/VisionFrameDispatcher.js` -> `src/domain/sensory/vision/VisionFrameDispatcher.ts`
- Modify: `src/domain/sensory/vision/VisionStreamManager.js` -> `src/domain/sensory/vision/VisionStreamManager.ts`
- Modify: `src/domain/sensory/CameraService.js` -> `src/domain/sensory/CameraService.ts`
- Modify: `src/domain/sensory/ScreenCaptureService.js` -> `src/domain/sensory/ScreenCaptureService.ts`
- Modify: `src/domain/sensory/LocalVisionService.js` -> `src/domain/sensory/LocalVisionService.ts`
- Modify: `src/domain/sensory/VisionDetectionService.js` -> `src/domain/sensory/VisionDetectionService.ts`
- Modify: `src/domain/sensory/index.ts`

**Interfaces:**
- Consumes: `electronBridge.captureScreenNative()`, `VISION_CONFIG`, `eventBus`, `logger`
- Produces: `CameraService`, `ScreenCaptureService`, `VisionDetectionService`, `LocalVisionService`, `VisionStreamManager`

- [ ] **Step 1: Migrar `CaptureLoop.js` a `CaptureLoop.ts`**
  Tipar callbacks de captura, estado activo, generación y temporizadores. Eliminar `.js`.

- [ ] **Step 2: Migrar `VisionFrameDispatcher.js` a `VisionFrameDispatcher.ts`**
  Tipar cola de frames (`Map<string, PendingFrame>`), ciclo de habla y entrega a websocket. Eliminar `.js`.

- [ ] **Step 3: Migrar `VisionStreamManager.js` a `VisionStreamManager.ts`**
  Tipar captura concurrente de pantalla y cámara, sincronización con GeminiLiveSocket. Eliminar `.js`.

- [ ] **Step 4: Migrar `CameraService.js` y `ScreenCaptureService.js` a `.ts`**
  Implementar tipos para dispositivos de video, restricciones de resolución, recorte de regiones `ScreenRegion` y buffers JPEG. Eliminar `.js`.

- [ ] **Step 5: Migrar `LocalVisionService.js` y `VisionDetectionService.js` a `.ts`**
  Mantener dynamic imports para TensorFlow.js / MoveNet / FaceAPI para respetar Q-03 (bundle splitting). Tipar keypoints, detecciones faciales y telemetría HUD. Eliminar `.js`.

- [ ] **Step 6: Verificar typecheck**
  Ejecutar: `pnpm run typecheck:renderer`

---

### Task 3: Migración del Dominio de Audio y Sintetizador

**Files:**
- Modify: `src/domain/audio/SoundFxService.js` -> `src/domain/audio/SoundFxService.ts`
- Modify: `src/domain/audio/AudioAnalysisService.js` -> `src/domain/audio/AudioAnalysisService.ts`
- Modify: `src/domain/audio/TTSFallbackService.js` -> `src/domain/audio/TTSFallbackService.ts`
- Modify: `src/domain/audio/AudioRoutingService.js` -> `src/domain/audio/AudioRoutingService.ts`
- Modify: `src/domain/audio/DesktopLoopbackCaptureService.js` -> `src/domain/audio/DesktopLoopbackCaptureService.ts`
- Modify: `src/domain/audio/GeminiTranslationProvider.js` -> `src/domain/audio/GeminiTranslationProvider.ts`
- Modify: `src/domain/audio/TranslationOutputCoordinator.js` -> `src/domain/audio/TranslationOutputCoordinator.ts`
- Modify: `src/domain/audio/TranslationService.js` -> `src/domain/audio/TranslationService.ts`
- Modify: `src/domain/audio/VirtualAudioOutputService.js` -> `src/domain/audio/VirtualAudioOutputService.ts`
- Modify: `src/domain/audio/index.ts`

**Interfaces:**
- Consumes: Web Audio API, `eventBus`, `electronBridge.startDesktopAudioCapture()`
- Produces: `soundFxService: SoundFxService`, `AudioAnalysisService`, `translationService: TranslationService`

- [ ] **Step 1: Migrar `SoundFxService.js` a `SoundFxService.ts`**
  Tipar nodos Web Audio (`AudioContext`, `GainNode`, `OscillatorNode`), métodos procedimentales de chimes y clicks. Eliminar `.js`.

- [ ] **Step 2: Migrar `AudioAnalysisService.js` a `AudioAnalysisService.ts`**
  Tipar buffer FFT, cálculo de RMS, bandas de formantes, spectral centroid y eventos de lip-sync. Eliminar `.js`.

- [ ] **Step 3: Migrar servicios de traducción y enrutamiento de audio a `.ts`**
  Convertir `TTSFallbackService`, `AudioRoutingService`, `DesktopLoopbackCaptureService`, `GeminiTranslationProvider`, `TranslationOutputCoordinator`, `TranslationService`, y `VirtualAudioOutputService` a TypeScript estricto. Eliminar archivos `.js`.

- [ ] **Step 4: Verificar typecheck**
  Ejecutar: `pnpm run typecheck:renderer`

---

### Task 4: Migración de Interacción, Planificación y Corrección R-03

**Files:**
- Modify: `src/domain/interaction/ExternalReplyService.js` -> `src/domain/interaction/ExternalReplyService.ts`
- Modify: `src/domain/interaction/InteractionOrchestrator.js` -> `src/domain/interaction/InteractionOrchestrator.ts`
- Modify: `src/domain/interaction/ProactiveScheduler.js` -> `src/domain/interaction/ProactiveScheduler.ts`
- Modify: `src/domain/interaction/ProactiveTriggerService.js` -> `src/domain/interaction/ProactiveTriggerService.ts`
- Modify: `src/hooks/useCompanionServices.ts:355-364`

**Interfaces:**
- Consumes: `useSessionStore.getState().dispatchConnection`, `memoryService`, `logger`
- Produces: `proactiveScheduler`, `proactiveTriggerService`, `interactionOrchestrator`

- [ ] **Step 1: Migrar los 4 servicios de `src/domain/interaction/` a TypeScript**
  Tipar triggers de proactividad, temporizadores de inactividad, respuestas de voz externa y orquestación. Eliminar `.js`.

- [ ] **Step 2: Corregir violación R-03 en `useCompanionServices.ts`**
  Reemplazar los setters directos de `setIsConnecting(false)` y `setIsConnected(false)` en el catch de conexión por `dispatchConnection('FAIL')`.

- [ ] **Step 3: Verificar typecheck**
  Ejecutar: `pnpm run typecheck:renderer`

---

### Task 5: Contratos IPC de Memoria e Integraciones (Memory, MCP, Discord, Spotify, Minecraft)

**Files:**
- Modify: `shared/ipc/contracts.ts` (corregir `IpcResponseMap['memory-load']`)
- Modify: `src/services/desktop/ElectronBridge.ts` (tipar con precisión `memoryLoad()`)
- Modify: `src/domain/integrations/memory/MemoryIndex.js` -> `src/domain/integrations/memory/MemoryIndex.ts`
- Modify: `src/domain/integrations/memory/MemoryRepository.js` -> `src/domain/integrations/memory/MemoryRepository.ts`
- Modify: `src/domain/integrations/memory/MemoryService.js` -> `src/domain/integrations/memory/MemoryService.ts`
- Modify: `src/domain/integrations/mcp/MCPClientManager.js` -> `src/domain/integrations/mcp/MCPClientManager.ts`
- Modify: `src/domain/integrations/browser/BrowserAutomationService.js` -> `src/domain/integrations/browser/BrowserAutomationService.ts`
- Modify: `src/domain/integrations/playwright/PlaywrightService.js` -> `src/domain/integrations/playwright/PlaywrightService.ts`
- Modify: `src/domain/integrations/spotify/SpotifyService.js` -> `src/domain/integrations/spotify/SpotifyService.ts`
- Modify: `src/domain/integrations/discord/DiscordCompanionService.js` -> `src/domain/integrations/discord/DiscordCompanionService.ts`
- Modify: `src/domain/integrations/discord/DiscordVoiceService.js` -> `src/domain/integrations/discord/DiscordVoiceService.ts`
- Modify: `src/domain/integrations/minecraft/*.js` -> `*.ts`
- Modify: `src/domain/integrations/externalDevices/*.js` -> `*.ts`
- Modify: `src/domain/integrations/index.ts`

**Interfaces:**
- Consumes: `electronBridge.mcpCallTool()`, `electronBridge.discordConnect()`, `electronBridge.spotifyControl()`, `electronBridge.minecraftConnect()`
- Produces: `memoryService`, `mcpClientManager`, `discordCompanion`, `spotifyService`, `minecraftCompanion`

- [ ] **Step 1: Tipar el contrato real de Memoria en `shared/ipc/contracts.ts` y `ElectronBridge.ts`**
  Sincronizar `IpcResponseMap['memory-load']` con `{ success: true, backend: 'sqlite' | 'json', memories: MemoryRecord[] | null } | { success: false, error: string }`.

- [ ] **Step 2: Migrar repositorio e índice de memoria a TypeScript**
  Convertir `MemoryIndex.ts`, `MemoryRepository.ts` y `MemoryService.ts`. Tipar `MemoryRecord`, categorías, sesiones y consolidación. Eliminar `.js`.

- [ ] **Step 3: Migrar MCP, Browser y Playwright a TypeScript**
  Convertir `MCPClientManager.ts`, `BrowserAutomationService.ts` y `PlaywrightService.ts`. Eliminar `.js`.

- [ ] **Step 4: Migrar Discord, Spotify, Minecraft y ExternalDevices a TypeScript**
  Convertir `DiscordCompanionService.ts`, `DiscordVoiceService.ts`, `SpotifyService.ts`, `MinecraftCompanionService.ts`, `GameAdapter.ts`, `GameIntegrationManager.ts`, `ExternalDeviceManager.ts`. Eliminar todos los `.js`.

- [ ] **Step 5: Verificar typecheck**
  Ejecutar: `pnpm run typecheck:renderer`

---

### Task 6: Migración de Live2D, Controladores y Perfiles de Modelos

**Files:**
- Modify: `src/domain/live2d/ContextualEmotionOrchestrator.js` -> `src/domain/live2d/ContextualEmotionOrchestrator.ts`
- Modify: `src/domain/live2d/ExpressionManager.js` -> `src/domain/live2d/ExpressionManager.ts`
- Modify: `src/domain/live2d/Live2DAdapter.js` -> `src/domain/live2d/Live2DAdapter.ts`
- Modify: `src/domain/live2d/Live2DController.js` -> `src/domain/live2d/Live2DController.ts`
- Modify: `src/domain/live2d/Live2DModelRegistry.js` -> `src/domain/live2d/Live2DModelRegistry.ts`
- Modify: `src/domain/live2d/Live2DPhysicsEngine.js` -> `src/domain/live2d/Live2DPhysicsEngine.ts`
- Modify: `src/domain/live2d/MotionSyncService.js` -> `src/domain/live2d/MotionSyncService.ts`
- Modify: `src/domain/live2d/PhysicsKineticsService.js` -> `src/domain/live2d/PhysicsKineticsService.ts`
- Modify: `src/domain/live2d/models/*.profile.js` -> `*.profile.ts`
- Modify: `src/domain/live2d/models/index.js` -> `src/domain/live2d/models/index.ts`
- Modify: `src/domain/live2d/index.ts`

**Interfaces:**
- Consumes: `Live2DCanvasEngine`, Pixi Cubism runtime, `eventBus`
- Produces: `live2dModelRegistry`, `Live2DAdapter`, `Live2DController`, `contextualEmotionOrchestrator`

- [ ] **Step 1: Migrar perfiles de modelos (13 perfiles) a TypeScript**
  Convertir `belle`, `ellen`, `goth_loli`, `hiyori`, `huohuo`, `icegirl`, `jane_doe`, `miara`, `ruan_mei`, `sparkle`, `toki`, `vivian`, `yanderegirl` a `.profile.ts` con interface `Live2DModelProfile`. Eliminar `.profile.js` e `index.js`.

- [ ] **Step 2: Migrar orquestador de emociones, expresiones y física a TypeScript**
  Convertir `ContextualEmotionOrchestrator.ts`, `ExpressionManager.ts`, `Live2DPhysicsEngine.ts`, `MotionSyncService.ts`, `PhysicsKineticsService.ts`. Eliminar `.js`.

- [ ] **Step 3: Migrar controlador principal y registro de modelos a TypeScript**
  Convertir `Live2DModelRegistry.ts`, `Live2DAdapter.ts` y `Live2DController.ts`. Eliminar `.js`.

- [ ] **Step 4: Verificar typecheck**
  Ejecutar: `pnpm run typecheck:renderer`

---

### Task 7: Saneamiento de `serviceRegistry.ts` y Activación de `checkJs`

**Files:**
- Modify: `src/app/serviceRegistry.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Limpiar todas las importaciones en `serviceRegistry.ts`**
  Eliminar extensiones `.js` y actualizar referencias para consumir directamente los módulos tipados.

- [ ] **Step 2: Verificar que 0 archivos `.js` queden en `src/`**
  Ejecutar: `Get-ChildItem -Path src -Filter *.js -Recurse | Select-Object FullName`
  Resultado esperado: 0 archivos `.js` en `src/`.

- [ ] **Step 3: Activar `checkJs: true` en `tsconfig.json`**
  Asegurar que el compilador TypeScript analice el 100% de la base de código sin puntos ciegos.

---

### Task 8: Des-mockeo de Suite de Pruebas y Validación Real E2E

**Files:**
- Modify: `scripts/run-tests.mjs`
- Create: `tests/audio-analysis.test.ts`
- Create: `tests/memory-service.test.ts`
- Create: `tests/sound-fx.test.ts`
- Create: `tests/scene-manager.test.ts`

- [ ] **Step 1: Crear pruebas unitarias reales para `AudioAnalysisService`**
  Probar creación de nodos, cálculo de RMS y normalización de formantes.

- [ ] **Step 2: Crear pruebas unitarias reales para `MemoryService`**
  Probar registro de hechos, consolidación de sesiones, búsqueda de contexto para prompts sin stubs ficticios.

- [ ] **Step 3: Saneamiento de `scripts/run-tests.mjs`**
  Retirar de la lista de resolución de mocks de esbuild los módulos que ahora tienen pruebas reales y dependencias desacopladas.

- [ ] **Step 4: Ejecución completa del pipeline de producción**
  Ejecutar:
  - `pnpm run typecheck:renderer`
  - `pnpm run typecheck:electron`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `pnpm run build:electron`
  - `pnpm run test:e2e`

- [ ] **Step 5: Actualizar walkthrough y documentación de auditoría**
