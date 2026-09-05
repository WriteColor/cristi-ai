# 🏛️ Arquitectura del Sistema e Ingeniería de Rendimiento — Cristi AI Companion

Documento exhaustivo de ingeniería de software, arquitectura de sistemas y diseño de flujo de datos de **Cristi AI (Cristi AI Companion)**.

---

## 1. Diagrama de Arquitectura por Capas

```
+---------------------------------------------------------------------------------------------------+
|                              CRISTI AI COMPANION UI & ENGINE LAYER                                |
|         React 19 + Vite 8 + PixiJS 7 + pixi-live2d-display (Cubism 4/5 Core) + Lucide Icons       |
+---------------------------------------------------------------------------------------------------+
       |                                |                                   |
       v                                v                                   v
+------------------------+   +------------------------+   +------------------------------------+
| Live2D Kinetic Engine  |   | Gemini Multimodal Live |   | Sensory Vision & Voice Biometrics  |
| - Model Registry (8x)  |   | - WebSocket S2S Client |   | - Face-API (128D Multi-Sample)     |
| - Adaptive 30/60 Ticker|   | - 24kHz PCM Lip-Sync   |   | - MoveNet Multi-Pose Keypoints     |
| - Texture Zero-Leak GC |   | - 25 Tool Declarations |   | - COCO-SSD Object Recognition      |
| - DesktopCursorTracker |   | - Instant Barge-In     |   | - Speaker Recognition (Log-Mel)    |
| - Dynamic Hit-Testing  |   | - Resilient Backoff    |   | - Win11 Lock Screen Notifications  |
+------------------------+   +------------------------+   +------------------------------------+
       |                                |                                   |
       +--------------------------------+-----------------------------------+
                                        |
                                        v
+---------------------------------------------------------------------------------------------------+
|                        ENTERPRISE OBSERVABILITY & TELEMETRY ENGINE (F3)                           |
|  - Real-time TPS / FPS & P99 Frame Pacing   - Process RSS & V8 Heap Memory Inspector              |
|  - Subsystem Cost Attribution (ms/frame)    - Zero-Allocation Circular Ring Buffers (60s/5m/30m)  |
|  - Autonomous Anomaly & Memory Stall Detector                                                     |
+---------------------------------------------------------------------------------------------------+
                                        |
                                        v
+---------------------------------------------------------------------------------------------------+
|                             ELECTRON NATIVE DESKTOP SHELL (WINDOWS 11)                            |
|  - Transparent Frameless Window (win.setIgnoreMouseEvents with selective { forward: true })       |
|  - Anti-Throttling Chromium Flags (disable-background-timer-throttling, SharedArrayBuffer)         |
|  - Virtual Desktop Continuity (mainWindow.setVisibleOnAllWorkspaces for Win+Tab switching)        |
|  - Full OS Privileges (PowerShell Command Executor, File System, Clipboard, Screen Capture)       |
|  - Windows System Tray Integration & Global Shortcuts Dispatcher (Ctrl+Shift+C, M, S)            |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Electron Native Desktop Shell & Click-Through Selectivo

El modo de ventana compañera flotante aprovecha la API de bajo nivel de Electron para ofrecer interacción simultánea con el asistente y con las ventanas del sistema operativo:

### A. Inicialización de Ventana
* La ventana principal (`mainWindow`) se crea como transparente (`transparent: true`), sin bordes (`frame: false`), ocupando el monitor primario y con nivel de elevación `alwaysOnTop: 'screen-saver'`.
* Se inicializa con `mainWindow.setIgnoreMouseEvents(true, { forward: true })`.
* El parámetro `{ forward: true }` indica a Windows que redirija los eventos de clic al escritorio o a las aplicaciones detrás, pero **continúa enviando los eventos `mousemove` y `pointermove` a la ventana web**.

### B. Hook React `useClickThrough`
* Cada componente interactivo (avatar Live2D, menú contextual, modal de ajustes, widgets y botones) implementa `const { interactiveProps } = useClickThrough()`.
* **`mouseenter`** $\rightarrow$ `electronBridge.setIgnoreMouseEvents(false)`: el componente captura clics de ratón inmediatamente.
* **`mouseleave`** $\rightarrow$ `electronBridge.setIgnoreMouseEvents(true, { forward: true })`: el fondo vuelve a permitir clics sobre las aplicaciones del sistema.
* **Hit-Target Dinámico Live2D:** Un contenedor invisible (`.live2d-hit-target`) sincroniza su posición y dimensiones con el `model.getBounds()` del avatar Live2D en cada cuadro, permitiendo arrastre nativo (`setPointerCapture`) y zoom con la rueda del ratón.

---

## 3. Prevención de Throttling & Continuidad en Windows 11

Por defecto, Chromium ralentiza los procesos de renderizado y timers cuando una ventana pierde el foco. Cristi AI Companion elimina este comportamiento mediante:

```javascript
// Switches Chromium en electron/main.cjs
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// Configuración de WebContents
mainWindow.webContents.setBackgroundThrottling(false);
mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
```

Esto garantiza **60 FPS constantes** cuando el usuario juega a videojuegos en pantalla completa, utiliza programas en otras ventanas o cambia de escritorio virtual (`Win + Tab`).

---

## 4. Motor Live2D Adaptativo y Ciclo de Vida con Cero Fugas

### A. Ticker Cinemático Adaptativo
Para reducir el consumo energético en sesiones prolongadas sin sacrificar fluidez:
* **Modo Activo (Interacción / Conversación):** 60 FPS con sincronización labial espectral y físicas pendulares.
* **Modo Inactivo (>4.5s sin interacción ni audio):** Capping adaptativo a 30 FPS con cálculo de delta-time continuo. Esto reduce el uso de GPU en un ~65% en reposo.
* **Boss Key / Oculto:** Detención total de `app.ticker` y cancelación de requestAnimationFrame (0% CPU/GPU).

### B. Destrucción Limpia de Memoria WebGL
Para evitar acumulaciones de memoria al cambiar de personaje:
1. Se destruyen las texturas y baseTextures recursivamente: `model.destroy({ children: true, texture: true, baseTexture: true })`.
2. Se invoca `PIXI.utils.clearTextureCache()` para purgar las referencias internas de WebGL.
3. Se desregistran todos los listeners de puntero y eventos de pérdida de contexto WebGL (`webglcontextlost` / `webglcontextrestored`).

---

## 5. DSP de Audio, Sincronización Labial y Biometría Vocal

### A. Pipeline de Captura (AudioWorklet @ 16 kHz)
* El micrófono captura audio mediante un hilo aislado `AudioWorkletNode` (`cristi-pcm-processor`), convirtiendo las muestras a PCM Int16 Little-Endian a 16 kHz.
* Incorpora un filtro paso-alto (HPF @ 80 Hz) para eliminar vibraciones mecánicas y ruido de ventiladores.

### B. Pipeline de Salida & Lip-Sync (@ 24 kHz)
* El streaming entrante de Gemini Live se procesa con un buffer de Jitter de 35ms.
* La apertura de la boca se calcula mediante la energía de bajas frecuencias (80–450 Hz) y la anchura de labios con altas frecuencias (450–3500 Hz).
* Al terminar cada fragmento, `source.onended` invoca `source.disconnect()` para liberar los buffers de Float32 de la memoria de inmediato.

### C. Biometría Vocal (*Voice ID*)
* Extracción de 80 filtros Log-Mel y 40 coeficientes DCT-II para proyectar un embedding de 192 dimensiones.
* Si el coeficiente de similitud de coseno respecto a las muestras del dueño está por debajo del umbral (`rejectThreshold`), Cristi silencia su respuesta por seguridad.

---

## 6. Enterprise Observability & Telemetry HUD (`F3`)

El sistema incluye un analizador de rendimiento de ultra-bajo overhead (`PerformanceProfilerService.js`):
* **TPS (Ticks Per Second):** Monitorea la frecuencia del bucle principal de actualización.
* **FPS & P99 Frame Time:** Mide la consistencia de fotogramas y detecta micro-tirones (*frame drops*).
* **Memoria V8 Heap vs. Proceso RSS:** Monitoreo dual del heap de JavaScript y de la memoria nativa de Windows vía IPC.
* **Atribución de Tiempos:** Medición en microsegundos de cada subsistema (`live2d`, `audioDsp`, `visionSensory`, `uiReact`).
* **Buffers Circulares:** Almacena métricas históricas a 60 segundos, 5 minutos y 30 minutos sin realizar reasignaciones dinámicas de arrays.

---

## 7. Contratos escalables de interacción

```text
Micrófono ───────────────► GeminiLiveSocket ─► AudioOutputService ─► Live2D/lipsync
Pantalla/cámara ─► VisionFrameDispatcher ───► realtimeInput.video
Discord/Minecraft ─► EventBus ─► InteractionOrchestrator ─► GeminiLiveSocket
Audio externo ─► AudioRoutingService ─► TranslationService ─► proveedor STT/MT/TTS
Memoria ─► MemoryRepository ─► MemoryService/MemoryIndex ─► contexto limitado del socket
```

Cada fuente conserva `sourceId`, `sessionId` y `correlationId`. El router rechaza frames marcados como generados para impedir que una respuesta vuelva a entrar como instrucción.

- **Gemini Live:** `GeminiLiveSocket` es el único dueño de WebSocket, reconexión, keepalive y resumption. La UI sólo recibe callbacks y nunca crea un segundo socket para la misma llamada.
- **Audio:** `AudioOutputService` es el único dueño del `AudioContext` y de la cola PCM. Una reconexión detiene la reproducción anterior antes de aceptar audio nuevo.
- **Visión:** `VisionFrameDispatcher` mantiene sólo el frame más reciente, aplica backpressure y pausa frames no prioritarios mientras Cristi habla. Las capturas nativas de Electron se mantienen separadas de la cámara.
- **Eventos:** las integraciones publican envelopes mediante `eventBus.emitDomain`. `InteractionOrchestrator` decide si un evento es relevante y aplica cooldowns; Discord y los juegos no contienen lógica de respuesta propia.
- **Memoria:** `MemoryService` aplica reglas de actualización, contradicción, caducidad e índice semántico. `MemoryRepository` permite cambiar SQLite por otro backend sin tocar el dominio.
- **Traducción:** `TranslationService` recibe frames etiquetados, agrega audio por utterance y conecta proveedores mediante métodos (`transcribe`, `detectLanguage`, `translate`, `synthesize`). Los hablantes Discord se agregan en colas independientes.
- **MCP/navegador:** `MCPClientManager` descubre herramientas y `PlaywrightService` ejecuta en Brave. Las herramientas nuevas se declaran en `src/config/tools.js` y se resuelven en `ToolExecutor`.

La traducción externa está desactivada por defecto. Al activarla desde Ajustes o con `translate: true`, el lote configurable de 200–1200 ms limita coste, CPU y latencia. Discord remuestrea el PCM TTS de Gemini a 16 kHz y Electron ignora el identificador del propio bot para impedir bucles.

## 8. Reglas para futuras integraciones

1. Crear un adaptador de transporte que publique eventos y conserve su `sourceId`.
2. Reutilizar `InteractionOrchestrator` para contexto, memoria, cooldown y respuesta.
3. No enviar audio generado al mismo pipeline de reconocimiento sin marcarlo con `AudioRoutingService.markGenerated`.
4. No crear timers permanentes por frame: usar backpressure, lotes y un único propietario por recurso.
5. Añadir una prueba reproducible del transporte antes de conectar un servicio público.

## 9. Verificación

- `pnpm exec eslint src electron`
- `pnpm test:diagnostics`
- `pnpm test:minecraft-local`
- `node tests/test_packaged_call.mjs`
- `pnpm app:build`

Las pruebas de API real (`tests/probe_live_call.mjs` y `tests/probe_live_vision.mjs`) requieren `VITE_GEMINI_API_KEY` y deben ejecutarse explícitamente.
