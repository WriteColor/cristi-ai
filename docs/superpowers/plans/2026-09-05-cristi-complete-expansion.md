# Cristi AI Complete Architecture Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar de manera integral, robusta y modular los 6 pilares arquitectónicos solicitados para Cristi AI: catálogo unificado de herramientas, memoria persistente multicapa con consolidación post-sesión y RAG dinámico, canal conversacional en Discord con contexto independiente, integración resiliente con Minecraft y adaptadores de juegos, árbitro proactivo de diálogo espontáneo contextual, y pipeline de audio/VAD con traducción en tiempo real bidireccional y blindaje estricto de bucles.

**Architecture:** Arquitectura desacoplada orientada a eventos (`EventBus` + `InteractionOrchestrator`) donde los canales externos (Discord, Minecraft, Audio de juego, Sensores) operan como adaptadores que publican eventos tipados con `sessionId` y tokens de correlación, y el núcleo cognitivo (Gemini Live WebSocket / Flash REST) ejecuta herramientas formales (`tools.js` / `toolExecutor.js`), consulta el almacén de memoria episódica/semántica indexado con búsqueda híbrida, y orquesta intervenciones mediante un Árbitro Proactivo con vetos de molestia y cooldowns.

**Tech Stack:** JavaScript (ESM, Node.js v20+, React 19, Electron v32), `@discordjs/voice`, `discord.js`, `mineflayer`, `mineflayer-pathfinder`, `minecraft-protocol`, Web Audio API / AudioWorklet, WASAPI loopback, Gemini 3 Multimodal Live WebSocket y Gemini Flash REST API.

## Global Constraints
- Uso exclusivo de `pnpm` (nunca `npm` ni intentar instalarlo).
- Navegador oficial del sistema: Brave en `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe` o `chrome_proxy.exe`.
- Cero regresiones: las 39 suites de diagnóstico existentes deben seguir pasando al 100%.
- Aislamiento estricto de bucles de audio: todo audio generado por Cristi debe etiquetarse (`markGenerated`) y jamás reingresar como entrada de usuario o traducción.
- Privacidad y segregación de sesiones: las conversaciones de Discord no deben contaminar la sesión de llamada en vivo principal.

---

### Task 1: Catálogo Unificado de Herramientas y Contratos de Eventos
**Files:**
- Modify: `src/config/tools.js`
- Modify: `src/services/toolExecutor.js`
- Modify: `src/services/eventBus.js`
- Test: `tests/test_tools_catalog_and_event_contracts.mjs`

- [ ] **Step 1: Crear prueba de especificación para las herramientas requeridas y contratos de eventos**
- [ ] **Step 2: Ejecutar prueba para verificar fallos iniciales en herramientas no declaradas**
- [ ] **Step 3: Agregar declaraciones formales en `src/config/tools.js` (`manage_memory`, `minecraft_*`, `discord_*`, `translation_request_voice`)**
- [ ] **Step 4: Implementar y conectar los handlers correspondientes en `src/services/toolExecutor.js`**
- [ ] **Step 5: Ejecutar prueba unitaria para verificar que pasa al 100% y commitear**

---

### Task 2: Rediseño del Núcleo de Memoria Persistente y Herramienta `manage_memory`
**Files:**
- Modify: `src/services/memory/MemoryService.js`
- Modify: `src/services/memory/MemoryRepository.js`
- Test: `tests/test_memory_service_enhanced.mjs`

- [ ] **Step 1: Escribir prueba para CRUD de memoria, categorías (`fact`, `preference`, `relationship`, `task`, `conversation`, `minecraft`), linaje, vigencia y versionado de contradicciones**
- [ ] **Step 2: Ejecutar prueba y verificar fallos**
- [ ] **Step 3: Implementar método `manageMemory(action, payload)` en `MemoryService.js` con soporte para store, update, recall, invalidate y linaje**
- [ ] **Step 4: Ejecutar prueba y verificar que pasa al 100%**

---

### Task 3: Background Session Consolidation Worker y RAG Dinámico
**Files:**
- Modify: `src/services/memory/MemoryService.js`
- Modify: `src/services/geminiLiveSocket.js`
- Test: `tests/test_session_consolidation_and_continuity.mjs`

- [ ] **Step 1: Escribir prueba de continuidad entre sesiones: simular fin de llamada con hechos clave y verificar que en la siguiente llamada están inyectados en el prompt**
- [ ] **Step 2: Ejecutar prueba para constatar la pérdida de datos del sistema anterior**
- [ ] **Step 3: Implementar Session Consolidation Worker que extrae hechos, preferencias, tareas y resumen estructurado al emitir `SESSION_ENDED`**
- [ ] **Step 4: Conectar la inyección dinámica en `geminiLiveSocket.js` (`getSystemPromptContext`) para incluir hechos prioritarios + resumen de la última llamada + contexto reciente**
- [ ] **Step 5: Ejecutar prueba y verificar persistencia y continuidad real**

---

### Task 4: Búsqueda Semántica Híbrida y Detección de Contradicciones
**Files:**
- Modify: `src/services/memory/MemoryIndex.js`
- Test: `tests/test_semantic_memory_search.mjs`

- [ ] **Step 1: Escribir prueba para similitud semántica de paráfrasis (ej: "Ariel ama la música pesada" coincide con búsqueda "gustos de metal/rock")**
- [ ] **Step 2: Ejecutar prueba para constatar limitaciones del hash puro**
- [ ] **Step 3: Implementar scoring híbrido (BM25 + vector denso/ngram hashing con pesos de categoría y decaimiento temporal) en `MemoryIndex.js`**
- [ ] **Step 4: Ejecutar prueba y verificar precisión de ranking**

---

### Task 5: Canal Conversacional de Discord Autónomo con Contexto Aislado
**Files:**
- Modify: `src/services/discord/DiscordCompanionService.js`
- Modify: `src/services/discord/DiscordVoiceService.js`
- Modify: `electron/main.cjs`
- Test: `tests/test_discord_autonomous_companion.mjs`

- [ ] **Step 1: Escribir prueba de mensajería, aislamiento de sesión (`discord_channelId`), respuestas a menciones y DMs**
- [ ] **Step 2: Ejecutar prueba y verificar fallos**
- [ ] **Step 3: Implementar `handleIncomingMessage`, rate limits, filtro anti-bot y respuesta desacoplada en `DiscordCompanionService.js`**
- [ ] **Step 4: Robustecer reconexión automática en Electron main y Voice Service**
- [ ] **Step 5: Ejecutar prueba y verificar éxito**

---

### Task 6: Integración y Percepción en Videojuegos (Minecraft Controlado)
**Files:**
- Modify: `src/services/gameIntegration/MinecraftCompanionService.js`
- Modify: `src/services/gameIntegration/GameIntegrationManager.js`
- Modify: `src/services/gameIntegration/GameAdapter.js`
- Test: `tests/test_minecraft_companion_advanced.mjs`

- [ ] **Step 1: Escribir prueba para ciclo de vida de conexión, percepción de entorno (salud, posición, mobs cercanos), acciones in-game y reconexión ante kick**
- [ ] **Step 2: Ejecutar prueba y verificar fallos**
- [ ] **Step 3: Implementar agregador de percepción de entorno y puente con el orquestador de Cristi en `MinecraftCompanionService.js`**
- [ ] **Step 4: Actualizar `GameIntegrationManager.js` con soporte para múltiples adaptadores y emisión de eventos semánticos para la IA**
- [ ] **Step 5: Ejecutar prueba y verificar 100% éxito**

---

### Task 7: Árbitro de Triggers Proactivos y Diálogo Espontáneo Contextual
**Files:**
- Modify: `src/services/proactiveTriggerService.js`
- Modify: `src/services/proactiveScheduler.js`
- Test: `tests/test_proactive_arbiter_and_dialogue.mjs`

- [ ] **Step 1: Escribir prueba para verificar que Cristi NO usa preguntas genéricas fijas, respeta veto post-usuario y selecciona temas pendientes de la memoria**
- [ ] **Step 2: Ejecutar prueba y verificar fallos**
- [ ] **Step 3: Implementar `ProactiveArbiter` con cálculo de pertinencia, veto de 15s post-usuario, veto de encadenamiento y generador de prompts contextuales dinámicos**
- [ ] **Step 4: Ejecutar prueba y verificar comportamiento no intrusivo y espontáneo**

---

### Task 8: Audio de Juego con VAD, Traducción Bidireccional y Blindaje Anti-Bucle
**Files:**
- Modify: `src/services/translation/AudioRoutingService.js`
- Modify: `src/services/translation/VirtualAudioOutputService.js`
- Modify: `src/services/translation/DesktopLoopbackCaptureService.js`
- Modify: `src/services/translation/TranslationService.js`
- Test: `tests/test_game_audio_translation_and_loop_safety.mjs`

- [ ] **Step 1: Escribir prueba para VAD de audio de juego, traducción inversa ("Cristi, dile que...") hacia la salida virtual y verificación de que el audio virtual nunca reingresa al loopback**
- [ ] **Step 2: Ejecutar prueba y verificar fallos**
- [ ] **Step 3: Implementar VAD espectral/energético ligero y enrutamiento bidireccional en `TranslationService.js` y `AudioRoutingService.js`**
- [ ] **Step 4: Blindar el enrutador virtual para aislar canales de micrófono físico, loopback de juego y salida virtual hacia el chat del juego**
- [ ] **Step 5: Ejecutar prueba y verificar latencia y aislamiento acústico**

---

### Task 9: Hub Central de Eventos y Desacoplamiento de IA
**Files:**
- Modify: `src/services/interaction/InteractionOrchestrator.js`
- Modify: `src/services/eventBus.js`
- Test: `tests/test_unified_interaction_hub.mjs`

- [ ] **Step 1: Escribir prueba de orquestación end-to-end recibiendo eventos cruzados (juego + Discord + silencio + traducción) sin colisiones de estado**
- [ ] **Step 2: Ejecutar prueba y verificar fallos**
- [ ] **Step 3: Refactorizar `InteractionOrchestrator.js` como despachador inteligente centralizado con políticas de prioridad y enrutamiento limpio**
- [ ] **Step 4: Ejecutar prueba y verificar fluidez entre subsistemas**

---

### Task 10: Suite Integral de Verificación y Diagnóstico Maestro
**Files:**
- Create: `tests/test_full_architecture_integration.mjs`
- Modify: `tests/run_all_diagnostics.mjs`
- Modify: `COLLAB_SYNC.md`
- Test: `node tests/run_all_diagnostics.mjs`

- [ ] **Step 1: Crear la suite de integración integral `test_full_architecture_integration.mjs` validando los 6 pilares en conjunto**
- [ ] **Step 2: Añadir la suite al runner maestro `tests/run_all_diagnostics.mjs`**
- [ ] **Step 3: Ejecutar `node tests/run_all_diagnostics.mjs` y confirmar 100% PASS en todas las suites**
- [ ] **Step 4: Actualizar `COLLAB_SYNC.md` con el reporte final de entrega**
