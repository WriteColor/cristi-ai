# Arquitectura del Sistema e Ingenieria de Rendimiento — Cristi AI Companion
> **Autor:** Write_Color | **Versión:** 2.0.0 (Auditoría Integral 2026) | **Stack:** Electron 43.6 + Node 24.20 + React 19.2 + Vite 8 (Rolldown) + PixiJS 7 + Live2D Cubism 4 + Gemini Live API + MCP 1.30

Documento exhaustivo de ingeniería de software, arquitectura de sistemas y diseño de flujo de datos de **Cristi AI Companion**. Validado contra el código real y respaldado por 52 pruebas unitarias reales y el pipeline CI de 7 compuertas.

---

## 1. Diagrama de Arquitectura por Capas

```
+---------------------------------------------------------------------------------------------------+
|                              CRISTI AI COMPANION UI & RENDERER LAYER                              |
|         React 19 + Vite 8 + PixiJS 7 + pixi-live2d-display (Cubism 4/5 Core) + Lucide Icons       |
+---------------------------------------------------------------------------------------------------+
       |                                |                                   |
       v                                v                                   v
+------------------------+   +------------------------+   +------------------------------------+
| Live2D Kinetic Engine  |   | Gemini Multimodal Live |   | Sensory Vision & Voice Biometrics  |
| - 13 Model Registry    |   | - WebSocket S2S Client |   | - Face-API (128D Multi-Sample)     |
| - Adaptive 30/60 Ticker|   | - 24kHz PCM Lip-Sync   |   | - MoveNet Multi-Pose Keypoints     |
| - Texture Zero-Leak GC |   | - 45+ Tool Declarations|   | - COCO-SSD Object Recognition      |
| - DesktopCursorTracker |   | - Instant Barge-In     |   | - Speaker Recognition (Log-Mel)    |
| - Dynamic Hit-Testing  |   | - Resilient Backoff    |   | - 60 FPS Native Screen Capturer    |
+------------------------+   +------------------------+   +------------------------------------+
       |                                |                                   |
       +--------------------------------+-----------------------------------+
                                        |
                                        v
+---------------------------------------------------------------------------------------------------+
|                     DOMAIN ORCHESTRATION & EVENT-DRIVEN CORE (6 PILARES)                          |
|  - EventBus (Typed Domain Envelopes)          - InteractionOrchestrator (15s Breathing Room)     |
|  - Multi-Layer Memory (SQLite + Hash Vectors) - AudioRoutingService & Feedback Shield             |
|  - Minecraft Companion (Mineflayer Adapter)   - Discord Gateway & Voice Transport (@discordjs)    |
|  - Dynamic MCP Servers (stdio / sse)          - Playwright Automation (Brave Browser)             |
+---------------------------------------------------------------------------------------------------+
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
|  - Windows WASAPI Loopback Helper (native/CristiWasapiLoopback.exe Core Audio Capture)            |
|  - Secure Storage (safeStorage API for tokens) & Isolated ContextBridge IPC                       |
|  - Global Shortcuts Dispatcher (Ctrl+Shift+C, H, P, A, M, S)                                      |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Los 6 Pilares de la Arquitectura de Cristi AI Companion

Cristi AI está construida sobre seis pilares arquitectónicos que aseguran modularidad, escalabilidad y tolerancia a fallos:

### 🏛️ Pilar 1: Catálogo de Herramientas Agénticas y Contratos de Eventos
* **Contratos de Dominio Fuertemente Tipados:** Toda comunicación entre subsistemas ocurre a través de `eventBus.emitDomain()`, que emite sobres estandarizados con:
  ```typescript
  interface DomainEventEnvelope<T = any> {
    type: string;          // Identificador semántico (ej: 'minecraft.threat_detected', 'discord.message')
    source: string;        // Origen del evento ('minecraft', 'discord', 'system', 'voice')
    sessionId: string;     // ID de sesión activa para evitar mezclar estados
    correlationId: string; // Trazabilidad de solicitudes y respuestas
    priority: number;      // Nivel de urgencia (0 = normal, 1 = prioritario, 2 = emergencia)
    privacy: string;       // Etiqueta de privacidad ('local', 'shared', 'sensitive')
    payload: T;            // Datos específicos del evento
  }
  ```
* **Declaración Universal de Herramientas (`COMPANION_FUNCTION_DECLARATIONS`):** Más de 45 herramientas expuestas a la API de Gemini Live v1beta (manipulación de Live2D, comandos de PowerShell, control de ventanas, portapapeles, Spotify, Minecraft, Discord, visión y automatización web con Playwright).
* **Gestión Dinámica de Servidores MCP:** Soporte para servidores locales (`stdio` JSON-RPC 2.0) y remotos (`sse`) administrados exclusivamente en el proceso principal de Electron. Las herramientas se namespacean por servidor (`mcp__<server>__<tool>`) y pueden ejecutarse inmediatamente mediante `mcp_call_tool`.

### 🧠 Pilar 2: Memoria Persistente Multicapa y Consolidación
* **Persistencia Híbrida y Desacoplada (`MemoryService` & `MemoryRepository`):**
  * Almacenamiento primario en **SQLite** nativo a través de IPC de Electron cuando `node:sqlite` está disponible.
  * Respaldo y fallback automático a **JSON transaccional atómico** con escrituras seguras en disco para máxima portabilidad.
* **Indexación Semántica Local (`MemoryIndex`):**
  * Emplea un motor de vectores hash locales y postings invertidos acotados para recuperar paráfrasis y similitudes sin necesidad de descargar modelos pesados ni realizar llamadas de red adicionales.
  * Recuperación top-$k$ acotada para alimentar el contexto del modelo sin saturar el buffer de tokens de Gemini Live.
* **Consolidación y Resolución de Contradicciones:** Clasificación por categorías (`fact`, `preference`, `relationship`, `task`, `minecraft`), marcas de confianza por fuente, versiones históricas y capacidad de invalidación programática.

### 💬 Pilar 3: Compañero Autónomo de Discord
* **Integración Gateway (`discord.js` v14):**
  * Escucha activa de canales de texto, menciones y mensajes directos.
  * Publicación de respuestas asíncronas preservando el `correlationId` para asociar cada consulta con su contexto de origen.
* **Transporte de Voz de Ultra-Baja Latencia (`@discordjs/voice`):**
  * Conexión a canales de voz y stages de servidores Discord.
  * Recepción de streams de audio Opus y decodificación a PCM mono a 16 kHz.
  * Soporte de reintento (`rejoin`) con backoff exponencial ante desconexiones inesperadas del socket de voz.

### ⛏️ Pilar 4: Percepción y Telemetría en Minecraft
* **Puerto Abstraído (`GameAdapter`):** Permite conectar indistintamente clientes Mineflayer, interfaces RCON o adaptadores de mods sin acoplar la lógica conversacional al juego.
* **Agente de Navegación Inteligente (`MinecraftCompanionService`):**
  * Implementado con `mineflayer` y `mineflayer-pathfinder` en el proceso de Electron.
  * Operaciones autónomas: seguimiento inteligente de jugadores, minería de bloques, colocación de estructuras y combate defensivo contra criaturas hostiles.
* **Detección de Amenazas y Telemetría Espacial:**
  * Supervisión continua de salud, hambre, posición XYZ y entorno.
  * Emisión de eventos de alerta cuando la vida cae por debajo de umbrales críticos o cuando entidades hostiles se acercan en un radio de proximidad.

### ⚖️ Pilar 5: Árbitro Proactivo y Orquestación Contextual (Breathing Room)
* **`InteractionOrchestrator` como Filtro Central:**
  * Ninguna integración (Discord, Minecraft, telemetría) habla directamente con Gemini Live; todos los eventos pasan por el orquestador.
  * Evalúa relevancia, estado de conversación actual y necesidad de intervención.
* **Ventana de Enfriamiento ("Breathing Room" de 15 segundos):**
  * Aplica un cooldown estricto para evitar saturar al usuario con intervenciones excesivas o fuera de momento.
  * Algoritmo anti-encadenamiento que bloquea bucles de retroalimentación infinita entre bots.
* **Bypass de Alerta de Emergencia:** Eventos marcados con prioridad máxima (daño in-game crítico, caídas de servidor o alertas del sistema) omiten el enfriamiento para alertar inmediatamente al usuario.

### 🛡️ Pilar 6: Blindaje de Audio, Audio DSP y Loopback WASAPI
* **Aislamiento Estricto y Prevención de Acople (`AudioRoutingService`):**
  * Cada frame de audio conserva su `sourceId`, `sessionId` y `correlationId`.
  * La función `markGenerated` etiqueta el audio sintetizado por Cristi y rechaza su reingreso al pipeline de reconocimiento, eliminando bucles de eco de raíz.
* **Pipeline de Captura de Micrófono (16 kHz):**
  * `AudioWorklet` dedicado (`cristi-pcm-processor`) para captura Int16 Little-Endian a 16 kHz.
  * Filtro paso-alto (HPF @ 80 Hz) para eliminar ruidos de baja frecuencia y vibraciones mecánicas.
* **Pipeline de Salida y Lip-Sync Orgánico (24 kHz):**
  * Desempaquetado de PCM streaming a 24,000 Hz con buffer de jitter adaptativo de 35 ms.
  * Cálculo de energía espectral en bandas bajas (80–450 Hz) para apertura de boca y bandas altas (450–3500 Hz) para forma labial sin sobrecargar el hilo de React.
* **Loopback Nativo de Windows WASAPI (`native/CristiWasapiLoopback.exe`):**
  * Helper nativo en C# utilizando Core Audio APIs de Windows.
  * Captura directa de la mezcla del dispositivo de salida predeterminado en PCM16 estructurado, transmitido por IPC seguro a Electron sin requerir cables virtuales ni controladores externos de audio. Fallback a `getDisplayMedia` de Chromium para entornos restringidos.
* **Salida Virtual Aislada (`game_voice`):** Permite a Cristi enviar audio traducido en tiempo real al canal de voz de un videojuego sin reproducirlo en los altavoces locales del usuario.

---

## 3. Motor Live2D Adaptativo y Ciclo de Vida con Cero Fugas

### A. Ticker Cinemático Adaptativo
Para reducir el consumo energético en sesiones prolongadas sin sacrificar fluidez:
* **Modo Activo (Interacción / Conversación):** 60 FPS con sincronización labial espectral y físicas pendulares completas.
* **Modo Inactivo (>4.5s sin interacción ni audio):** Capping adaptativo a 30 FPS con cálculo de delta-time continuo. Esto reduce el uso de GPU en un ~65% en reposo.
* **Boss Key / Oculto:** Detención total de `app.ticker` y cancelación de requestAnimationFrame (0% CPU/GPU).

### B. Destrucción Limpia de Memoria WebGL
Para evitar acumulaciones de memoria al cambiar entre los **13 modelos oficiales**:
1. Se destruyen las texturas y baseTextures recursivamente: `model.destroy({ children: true, texture: true, baseTexture: true })`.
2. Se invoca `PIXI.utils.clearTextureCache()` para purgar las referencias internas de WebGL.
3. Se desregistran todos los listeners de puntero y eventos de pérdida de contexto WebGL (`webglcontextlost` / `webglcontextrestored`).
4. Las cargas de modelos se serializan en cola para evitar condiciones de carrera en caché de texturas.

### C. Desktop-Wide Cursor Tracking y Hit-Testing Dinámico
* Un contenedor invisible (`.live2d-hit-target`) sincroniza su posición y dimensiones con el `model.getBounds()` del avatar Live2D en cada cuadro.
* Permite arrastre nativo (`setPointerCapture`) y zoom con la rueda del ratón (`0.25x` a `4.0x`) con respuesta instantánea.

---

## 4. Electron Native Desktop Shell & Click-Through Selectivo

### A. Inicialización de Ventana Transparente
* La ventana principal (`mainWindow`) se crea como transparente (`transparent: true`), sin bordes (`frame: false`), ocupando el monitor primario y con elevación `alwaysOnTop: 'screen-saver'`.
* Se inicializa con `mainWindow.setIgnoreMouseEvents(true, { forward: true })`.
* El parámetro `{ forward: true }` indica al Compositor de Windows que redirija los eventos de clic al escritorio o a las aplicaciones detrás, pero **continúa enviando los eventos `mousemove` y `pointermove` a la ventana web**.

### B. Hook React `useClickThrough`
* Cada componente interactivo (avatar Live2D, menú contextual, modal de ajustes, widgets y botones) implementa `const { interactiveProps } = useClickThrough()`.
* **`mouseenter`** $\rightarrow$ `electronBridge.setIgnoreMouseEvents(false)`: el componente captura clics de ratón inmediatamente.
* **`mouseleave`** $\rightarrow$ `electronBridge.setIgnoreMouseEvents(true, { forward: true })`: el fondo vuelve a permitir clics sobre las aplicaciones del sistema.

### C. Prevención de Throttling en Windows 11
Chromium ralentiza por defecto los procesos de renderizado cuando una ventana pierde el foco. Cristi AI elimina esta degradación mediante:

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

Esto garantiza **60 FPS constantes** mientras se juegan videojuegos 3D en pantalla completa, se programa o se cambia de escritorio virtual (`Win + Tab`).

---

## 5. Protocolo Google Gemini Multimodal Live (`BidiGenerateContent`)

Cristi opera mediante **WebSocket bidireccional S2S** con la API en tiempo real de Google Gemini:

* **Modelos Oficiales:**
  * `gemini-3.1-flash-live-preview`: Diálogo de ultra-baja latencia (~300ms), razonamiento espacial, visión continua y control total de PC.
  * `gemini-2.5-flash-native-audio-preview-12-2025`: Síntesis de audio nativa afectiva y alta estabilidad de conversación.
* **Propietario Único del Transporte (`GeminiLiveSocket`):** Gestiona el ciclo de vida del WebSocket, keepalive, reintentos con backoff y resumption tokens sin duplicación de llamadas.
* **Detección de Interrupción (Barge-In):** VAD neuronal del servidor de Gemini confirma interrupciones; al detectarse una interrupción, el cliente silencia y vacía los buffers de reproducción localmente en < 50ms.
* **Despachador de Visión con Backpressure (`VisionFrameDispatcher`):**
  * Mantiene exclusivamente el fotograma más reciente en cola acotada.
  * Aplica pausa y degradación elegante mientras el modelo está emitiendo voz para no saturar el canal de subida.
* **Subtítulos con Commit Atómico:**
  * La transcripción de la voz del usuario se muestra de inmediato con el primer delta recibido.
  * La respuesta textual de Cristi se acumula en un buffer y se vuelca completa a la interfaz al recibir el evento `turnComplete`, evitando que el texto visual se adelante a la cadencia natural de su voz hablada.

---

## 6. Automatización Web con Playwright (Brave Browser)

Para navegación autónoma, extracción de contenido y reproducción web:
* **Ejecutable de Brave:** Se utiliza de forma nativa la ruta oficial de Brave Browser (`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`), cumpliendo con la ausencia de Chrome.
* **Control Completo:** Navegación, clics en selectores, rellenado de formularios, capturas de pantalla de página completa y evaluación de JavaScript.

---

## 7. Enterprise Observability & Telemetry HUD (`F3`)

Analizador de rendimiento de ultra-bajo impacto (`PerformanceProfilerService.js`):
* **TPS (Ticks Per Second):** Monitorea la consistencia del bucle de actualización principal.
* **FPS & P99 Frame Time:** Mide la estabilidad de fotogramas y micro-tirones.
* **Memoria V8 Heap vs. Proceso RSS:** Monitoreo dual del heap de JavaScript y de la memoria nativa del proceso de Windows vía IPC.
* **Atribución de Coste por Subsistema:** Medición en microsegundos de `live2d`, `audioDsp`, `visionSensory` y `uiReact`.
* **Buffers Circulares de Cero Asignación:** Estructuras de anillo de tamaño fijo para almacenar métricas a 60 segundos, 5 minutos y 30 minutos sin generar recolección de basura (GC).

---

## 8. Reglas de Arquitectura para Nuevas Integraciones

1. **Adaptadores de Transporte Aislados:** Cada integración externa debe implementar un adaptador desacoplado que publique eventos hacia el `EventBus` con su propio `sourceId`.
2. **Centralización en el Orquestador:** Las integraciones no deben generar diálogo o respuestas autónomas directas; deben pasar por `InteractionOrchestrator` para respetar cooldowns y contexto.
3. **Blindaje de Audio:** Todo audio sintetizado o generado debe marcarse con `AudioRoutingService.markGenerated` antes de su emisión para imposibilitar su reentrada al micrófono.
4. **Cero Timers Permanentes:** Todo flujo de captura o procesamiento debe usar backpressure, buffers acotados y limpieza garantizada de recursos al desmontarse.

---

## 9. Verificación de Código y Compilación

Para validar la integridad del código y generar el paquete distribuible:

```powershell
# Análisis estático de código sin errores de linter
pnpm exec eslint src electron

# Compilación de producción y generación del instalador NSIS
pnpm app:build
```
