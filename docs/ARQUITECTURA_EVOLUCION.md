# Arquitectura evolutiva de Cristi

## Contratos implementados

- `EventBus.emitDomain()` crea sobres JSON con `type`, `source`, `sessionId`, `correlationId`, `priority`, `privacy` y `payload`.
- `EventBus.onAny()` permite que un orquestador observe eventos sin acoplarse a cada integración.
- `MemoryService` mantiene sesiones de trabajo, turnos acotados, resúmenes, confianza, fuente, contexto, versiones anteriores e invalidación; en Electron persiste mediante IPC en SQLite cuando `node:sqlite` está disponible y cae a JSON atómico si el runtime no lo expone.
- `MemoryIndex` mantiene postings acotados y vectores hash locales para recuperar paráfrasis sin descargar un modelo ni inyectar toda la memoria en cada turno; admite sustituir el embedder por un proveedor real.
- `GameAdapter` define el puerto que permite cambiar Mineflayer por RCON, un mod o un adaptador de otro juego.
- `MinecraftCompanionService` asigna un `sessionId` por conexión y lo conserva
  durante los reintentos, evitando mezclar eventos de una sesión vieja con una
  reconexión nueva.
- `InteractionOrchestrator` centraliza relevancia, contexto, cooldowns y entrega de eventos de Discord/juegos.
- `AudioRoutingService` conserva el origen de cada frame y bloquea audio autogenerado para evitar bucles.
- `TranslationService` expone un pipeline provider-agnostic con métricas, VAD, transcripción, detección de idioma, traducción y síntesis.
- `TranslationService.attachSource()` conecta capturas etiquetadas con una cola por origen que conserva sólo el frame más reciente durante backpressure; admite filtro de relevancia y `speakerId` sin bloquear la llamada Live.
- `TranslationService.attachEventSource()` permite conectar eventos como `discord.voice_audio` al mismo pipeline sin acoplar Discord a la lógica de traducción.
- `GeminiTranslationProvider` ofrece transcripción PCM y traducción REST con timeout/reintento, detección de idioma ligera y síntesis inyectable; los proveedores locales pueden reemplazar cada etapa.
- `DesktopLoopbackCaptureService` captura audio de una fuente compartida por Electron mediante `getDisplayMedia` + `AudioWorklet`, normaliza PCM a 16 kHz y conserva el `sourceId` para separar juego, sistema y voz.
- `MCPClientManager` mantiene las herramientas namespaceadas por servidor. En Electron, el proceso principal ejecuta servidores MCP `stdio` con JSON-RPC 2.0 y servidores SSE mediante `SSEClientTransport`, descubre `tools/list`, enruta `tools/call` y libera procesos/conexiones en la desconexión; el renderer sólo recibe el contrato seguro mediante `contextBridge`.
- `GeminiLiveSocket` envía siempre el frame visual más reciente junto con la instrucción que lo solicita, descarta reproducciones PCM de sockets reemplazados y ancla los subtítulos de Cristi al cierre completo del turno.
- La voz de Discord conserva la configuración del canal y ejecuta `rejoin` con
  backoff acotado cuando la conexión pasa a `Disconnected`; `leave` cancela el
  ciclo de recuperación de forma explícita.

## Integraciones actuales

Minecraft usa Mineflayer desde el proceso principal de Electron y expone estado, chat, movimiento, seguimiento, minería, colocación y combate. `tests/test_minecraft_local_repro.mjs` levanta un servidor offline reproducible con `minecraft-protocol` para validar login, cambio a estado `play` y roundtrip de chat sin depender de UniversoCraft. Discord usa `discord.js` para Gateway y texto, y `@discordjs/voice` para unirse a canales, recibir Opus, decodificar PCM mono a 16 kHz y enviar PCM traducido. Playwright usa exclusivamente el ejecutable de Brave configurado por Electron. Los servidores MCP `stdio` y SSE se ejecutan fuera del renderer para que una herramienta pueda controlar aplicaciones compatibles sin exponer procesos ni stdin al DOM.

## Límites deliberados

La captura de audio de una ventana o pantalla compartida está disponible con `DesktopLoopbackCaptureService`. En Windows, el servicio prefiere ahora el helper `native/CristiWasapiLoopback.exe` para capturar la mezcla del dispositivo de salida predeterminado en un proceso privilegiado y entregar frames PCM16 etiquetados por IPC; si el helper no está disponible, conserva `getDisplayMedia` como fallback. La captura WASAPI por proceso y la síntesis hacia un dispositivo virtual todavía requieren un adaptador/driver adicional. Discord voice requiere permisos de voz y el intent Gateway correspondiente; si el paquete opcional no carga, el resto del bot de texto sigue funcionando. `TranslationService` ya define el contrato para conectar esos proveedores sin modificar el orquestador ni la llamada Live.

Los tokens de Discord se guardan mediante `safeStorage` de Electron cuando está disponible. El archivo de preferencias del renderer no contiene el token.

## Evolución prevista

1. Añadir FTS5 y consultas incrementales detrás del repositorio SQLite cuando el volumen de recuerdos lo requiera.
2. Sustituir el vector hash por embeddings en un worker y mantener la búsqueda local como fallback offline.
3. Conectar `InteractionOrchestrator` al envío de respuestas por canal.
4. Crear un servidor Minecraft local reproducible para pruebas de conexión y reconexión.
5. Completar loopback WASAPI por proceso y dispositivos virtuales antes de activar traducción de voz de baja latencia por aplicación.
