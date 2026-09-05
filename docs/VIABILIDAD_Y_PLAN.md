# Viabilidad y plan de evolución

Este documento conserva el análisis técnico que guía la refactorización. Las integraciones comparten `EventBus`, `MemoryService`, `InteractionOrchestrator`, `GeminiLiveSocket`, `TranslationService` y puertos de adaptación; no se crean conversaciones paralelas aisladas.

## Matriz de viabilidad

| Componente | Ya existe | Modificar / implementar | Dependencias y APIs | Límites, latencia y permisos | Solución y orden |
| --- | --- | --- | --- | --- | --- |
| Llamada Gemini Live | WebSocket, audio, texto, herramientas y visión | Estados de sesión, reconexión, deduplicación PCM, frames actuales y subtítulos | WebSocket Live API, `AudioWorklet` | Red, cuota, disponibilidad del modelo y saturación GPU; el servidor determina cuándo llega la transcripción | `GeminiLiveSocket` como único dueño del transporte; primero |
| Subtítulos | Overlay React y transcripciones del servidor | Buffer de entrada inmediato y commit completo de salida al cerrar turno | Eventos `inputTranscription`, `outputTranscription`, `turnComplete` | No se pueden mostrar palabras que Gemini todavía no envió; el DOM puede ocultarse por inactividad | Renderizar incrementalmente al usuario y conservar una respuesta completa de Cristi |
| Visión cámara/pantalla/región | `ScreenCaptureService`, captura nativa Electron y dispatcher | Mutex, frame fresco por instrucción, epochs y backpressure | `desktopCapturer`, `captureScreenNative`, JPEG | Permisos de captura, DWM/compositor y coste de JPEG; no existe latencia cero bajo saturación externa | Un solo dispatcher con el frame más reciente; degradar frecuencia antes de bloquear audio |
| Live2D | Pixi/Live2D, catálogo y lip-sync | Un reloj, liberación de texturas y suscripciones | `pixi-live2d-display`, WebGL | GPU compartida con captura; reducir trabajo React sin reducir calidad del modelo | Actualizaciones directas al controlador; conservar assets y resolución |
| Memoria | Sesiones, resúmenes, índice semántico y persistencia | Selección, reemplazos, fuentes, contexto y aislamiento por sesión | SQLite IPC si existe, JSON atómico como fallback | Embeddings locales reducen coste, pero no equivalen a un modelo semántico remoto | Episódica + semántica acotada, recuperación top-k; luego FTS5/embeddings worker |
| Triggers y orquestación | EventBus, cooldowns y relevancia | Correlación, TTL, deduplicación y decisión contextual | Eventos de dominio | Interrupciones repetitivas y respuestas fuera de contexto | El trigger decide cuándo; el modelo decide qué decir |
| Minecraft | Mineflayer, acciones y eventos | Sesiones por conexión, reconexión y servidor reproducible | `mineflayer`, `minecraft-protocol` | Servidores públicos pueden bloquear bots, exigir autenticación o usar protocolos no compatibles | Adaptador `GameAdapter`; pruebas locales antes de UniversoCraft |
| Discord texto/voz | `discord.js`, `@discordjs/voice`, routing PCM | Contexto por canal, rejoin y separación de eventos | Gateway intents, permisos de bot y voz | Requiere token, intents y permisos; Opus/CPU añaden latencia | Adaptador aislado que publica eventos; no inyectar el socket Gemini compartido |
| Traducción externa | Pipeline provider-agnostic, VAD, speaker/source IDs y routing | Proveedores reales y selección de relevancia | Gemini REST/Live o proveedor local, TTS, Opus | Separación de hablantes imperfecta; pipeline completo acumula latencia | Fragmentos agregados, cola por fuente, descartar audio autogenerado y degradar a texto |
| Audio de juegos y sistema | `DesktopLoopbackCaptureService` para fuentes que Chromium expone | Helper WASAPI opcional para la mezcla de salida predeterminada; captura por proceso/dispositivo virtual sigue separada | `getDisplayMedia` + helper C# Core Audio/WASAPI incluido en el paquete | El renderer no abre loopback arbitrario; WASAPI default-render depende de un dispositivo de salida activo y no identifica cada proceso | Preferir WASAPI en Electron para audio-only, conservar `getDisplayMedia` para selección de ventana/pantalla y añadir aislamiento por proceso en una fase posterior |
| MCP, Spotify y navegador | `MCPClientManager`, Spotify local y Playwright Brave | Transporte real y ciclo de vida | MCP `stdio` JSON-RPC, `SSEClientTransport`, Brave executable, IPC Electron | Un servidor remoto necesita autenticación y políticas propias; nunca exponer `spawn` al renderer | Ejecutar MCP en main, namespace por servidor, validar esquema y enrutar `tools/call`; usar SSE para servidores remotos |
| Electron instalable | preload, IPC y electron-builder | Limpieza de procesos y pruebas aisladas | Electron 32, NSIS | Firma de código y permisos dependen del entorno del usuario | `contextBridge` mínimo, procesos hijos registrados y build reproducible |

## Fases recomendadas

1. **Contratos:** eventos con `sessionId`/`correlationId`, memoria aislada, routing de audio y puertos de juego/canales.
2. **Call path:** una sola conexión Live, reconexión con backoff, deduplicación PCM, subtítulos y frames visuales actuales.
3. **Integraciones:** Minecraft local, Discord texto/voz, herramientas MCP y Brave; cada una publica eventos al orquestador.
4. **Traducción:** VAD, agregación configurable, detección de idioma/hablante, traducción/TTS y rutas de salida sin bucles.
5. **Rendimiento:** perfiles de audio/visión/GPU, backpressure, workers y límites de memoria; preservar la calidad Live2D.
6. **Dispositivos nativos:** WASAPI default-render ya integrado; completar WASAPI por proceso y dispositivo virtual con instalador/controlador separado.
7. **Operación:** pruebas reales con credenciales autorizadas, métricas de latencia p50/p95, instalación limpia, firma y recuperación tras suspensión o saturación.

## Criterios de aceptación

- Cada evento externo conserva origen, sesión y correlación; un canal no puede cerrar ni contaminar otro.
- Una frase del usuario produce como máximo una reproducción Gemini por turno; el audio de reemplazo o generado no vuelve a entrar como instrucción.
- La respuesta de Cristi se muestra completa en cuanto se conoce, aunque su reproducción continúe; la transcripción del usuario aparece al primer fragmento.
- Un frame de visión enviado con una instrucción es el más reciente de esa fuente y no se reutiliza una región distinta.
- La captura o traducción que pierde permisos termina de forma segura, libera recursos y deja un error accionable.
- La aplicación empaquetada inicia con `app://`, carga los modelos Live2D y puede cerrar/reconectar sin procesos huérfanos.

El paquete Windows incluye un helper WASAPI sin dependencias que captura la mezcla del dispositivo de salida predeterminado y la entrega a Electron mediante frames PCM16 con longitud. La captura arbitraria por proceso, un dispositivo virtual de entrada/salida, firma y permisos de Discord siguen dependiendo del sistema operativo y de configuración del usuario; no se presentan como capacidades garantizadas del renderer.
