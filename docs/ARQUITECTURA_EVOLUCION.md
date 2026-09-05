# Arquitectura evolutiva de Cristi

## Contratos implementados

- `EventBus.emitDomain()` crea sobres JSON con `type`, `source`, `sessionId`, `correlationId`, `priority`, `privacy` y `payload`.
- `EventBus.onAny()` permite que un orquestador observe eventos sin acoplarse a cada integración.
- `MemoryService` mantiene sesiones de trabajo, turnos acotados, resúmenes, confianza, fuente, contexto, versiones anteriores e invalidación.
- `MemoryIndex` mantiene postings acotados y vectores hash locales para recuperar paráfrasis sin descargar un modelo ni inyectar toda la memoria en cada turno; admite sustituir el embedder por un proveedor real.
- `GameAdapter` define el puerto que permite cambiar Mineflayer por RCON, un mod o un adaptador de otro juego.
- `InteractionOrchestrator` centraliza relevancia, contexto, cooldowns y entrega de eventos de Discord/juegos.
- `AudioRoutingService` conserva el origen de cada frame y bloquea audio autogenerado para evitar bucles.
- `TranslationService` expone un pipeline provider-agnostic con métricas, VAD, transcripción, detección de idioma, traducción y síntesis.
- `DesktopLoopbackCaptureService` captura audio de una fuente compartida por Electron mediante `getDisplayMedia` + `AudioWorklet`, normaliza PCM a 16 kHz y conserva el `sourceId` para separar juego, sistema y voz.

## Integraciones actuales

Minecraft usa Mineflayer desde el proceso principal de Electron y expone estado, chat, movimiento, seguimiento, minería, colocación y combate. Discord usa `discord.js` para Gateway y texto. Playwright usa exclusivamente el ejecutable de Brave configurado por Electron.

## Límites deliberados

La captura de audio de una ventana o pantalla compartida está disponible con `DesktopLoopbackCaptureService`. La captura WASAPI loopback de procesos arbitrarios, el audio de voz de Discord y la síntesis hacia un dispositivo virtual todavía requieren un adaptador nativo de dispositivos. `TranslationService` ya define el contrato para conectar esos proveedores sin modificar el orquestador ni la llamada Live.

Los tokens de Discord se guardan mediante `safeStorage` de Electron cuando está disponible. El archivo de preferencias del renderer no contiene el token.

## Evolución prevista

1. Añadir repositorio SQLite/FTS5 detrás de `MemoryService` cuando el volumen de recuerdos lo requiera.
2. Sustituir el vector hash por embeddings en un worker y mantener la búsqueda local como fallback offline.
3. Conectar `InteractionOrchestrator` al envío de respuestas por canal.
4. Crear un servidor Minecraft local reproducible para pruebas de conexión y reconexión.
5. Implementar loopback WASAPI para procesos arbitrarios y dispositivos virtuales antes de activar traducción de voz de baja latencia.
