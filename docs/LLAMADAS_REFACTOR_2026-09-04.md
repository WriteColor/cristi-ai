# Refactor de llamadas, subtítulos y rendimiento

Se trabajó sobre los cambios existentes del proyecto, sin revertirlos.

## Correcciones

- **Voces superpuestas:** el cursor de reproducción se adelantaba al presente cuando había más de 80 ms de audio pendiente. Eso programaba varios fragmentos sobre el mismo intervalo. Ahora conserva el final del fragmento anterior y solo se recupera hacia el presente si realmente se agotó el audio. Mantiene PCM a 24 kHz y la cadencia de reproducción existente.
- **Cancelación:** un fragmento que estaba esperando `AudioContext.resume()` no puede reproducirse después de colgar o interrumpir. Se liberan los listeners de desbloqueo y el contexto al destruir el servicio.
- **Micrófono:** captura en bloques de 20 ms mediante AudioWorklet, contexto a 16 kHz y conexión silenciosa al grafo de audio. Se conserva cancelación de eco, supresión de ruido y filtro de paso alto. Si se cancela mientras se solicitan permisos o se carga el worklet, se liberan los recursos tardíos. El estado de silencio se consulta en el servicio, evitando capturarlo en una función obsoleta.
- **Sesión única:** se espera `setupComplete` antes de enviar entradas. Las conexiones antiguas no pueden emitir audio, cerrar la conexión nueva ni entregar resultados de herramientas en una sesión distinta. Los cambios de voz/modelo cancelan el temporizador anterior. GeminiLiveSocket es el único responsable de reconectar; los errores permanentes se muestran y liberan el micrófono.
- **Interrupción:** el VAD neuronal de Gemini confirma la interrupción. Se eliminó el corte local basado solo en volumen, que también podía reaccionar al eco de los altavoces.
- **Subtítulos:** se acumulan los fragmentos de transcripción conservando espacios y puntuación. La respuesta recibida permanece visible mientras termina el audio, sin borrarse a los cinco segundos. El texto del usuario salta de línea y tiene el mismo tamaño y ancho que el de Cristi. Los textos auxiliares no reemplazan la transcripción durante una llamada.
- **Live2D:** un solo reloj actualiza movimiento, física y renderizado. Al cambiar de avatar se liberan controlador, adaptador, suscripciones y texturas; las cargas se serializan para evitar conflictos en la caché. El análisis labial se entrega directamente al controlador, sin actualizar todo React a la frecuencia del audio. Se conservaron los archivos de modelos, resolución, antialiasing y filtrado de texturas.
- **Electron:** se eliminó el registro duplicado de `spotify-control`, que impedía arrancar el proceso principal. Se corrigieron referencias inexistentes en cámara y menú de escenas. Los iconos se incluyen en el paquete y se resuelven desde él. Los comandos auxiliares de Spotify se ejecutan de forma asíncrona, con tiempo máximo y sin ventanas de consola. La aplicación instalada no intenta enviar logs al servidor de desarrollo.
- **Gemini 3.1:** configuración con `thinkingLevel` y texto conversacional mediante `realtimeInput.text`; se conserva la compatibilidad de Gemini 2.5. Se corrigió también la llamada a un método inexistente del orquestador de emociones.
- **Audio externo:** `DesktopLoopbackCaptureService` solicita una fuente compatible con Chromium, detiene el vídeo cuando no se necesita, convierte el audio a PCM 16 kHz en un `AudioWorklet` y conserva etiquetas de origen para impedir bucles de traducción.
- **Loopback Windows:** el ejecutable empaquetado incluye `native/CristiWasapiLoopback.exe`, un helper Core Audio sin dependencias que captura la mezcla del dispositivo de salida predeterminado y la entrega por frames PCM16 con framing validado. `DesktopLoopbackCaptureService` lo prefiere para traducción audio-only y vuelve a `getDisplayMedia` cuando no está disponible.

## Verificación realizada

| Comprobación | Resultado |
| --- | --- |
| ESLint en `src` y `electron` | Sin errores ni advertencias |
| Diagnósticos del proyecto | 39 suites aprobadas, incluyendo contratos de eventos, memoria, orquestación, loopback, MCP real y Minecraft local |
| Compilación Vite y electron-builder NSIS | Correcta |
| Ejecutable empaquetado en perfil aislado | Arranque con `app://`, preload y ajustes correctos |
| Avatares en el ejecutable empaquetado | 13 cargados; suscriptores de audio constantes en cada cambio |
| Captura en el ejecutable | AudioWorklet a 16 kHz; se verificó procesamiento de bloques con micrófono sintético |
| Reproducción real Web Audio | 15 bloques en ráfaga, sin solapamiento tras bloquear 180 ms el renderer |
| Subtítulos en el ejecutable | Respuesta acumulada y entrada de más de 300 caracteres, mismo ancho y tipografía, sin elipsis |
| Cierre de llamada | Dos desconexiones consecutivas no reinician la llamada |
| API real Gemini 3.1 | Dos turnos, 30 bloques y 230.434 bytes PCM; transcripción de entrada y respuesta completa |
| API real Gemini 2.5 | El probe de voz histórico entregó audio; en la prueba de visión más reciente el endpoint aceptó setup pero no entregó texto/audio, por lo que queda como limitación abierta |
| API real Gemini con visión | `gemini-3.1-flash-live-preview` identificó CARAMELO/COMETA en pantalla completa y TULIPAN en región; ambos resultados llegaron con `grounded:true` y dos frames posteriores al habla |
| API real Gemini Live repetida | `gemini-3.1-flash-live-preview`: audio PCM, transcripción de entrada y respuesta completa sin duplicación |
| Minecraft local reproducible | Servidor offline 1.16.4, login Mineflayer, estado `play` y roundtrip de chat |
| Discord voice transport | Carga de `@discordjs/voice` 0.18, decoder Opus y conversión PCM 16 kHz verificada |
| MCP en Electron | Servidor `stdio` y endpoint SSE locales: discovery, `tools/call`, namespace y cierre verificados dentro del ejecutable empaquetado |
| WASAPI en Electron | Inicio/estado/cierre del helper nativo verificados dentro del ejecutable empaquetado; frames reales dependen de que Windows tenga un endpoint de salida activo |

Evidencia en `tests/output/packaged-call-report.json`, `packaged-subtitles.png`, `live-call-probe.json`, `refactor-diagnostics.log` y `refactor-build.log`.

Instalador generado: `release/Cristi-AI-Companion-Setup-1.0.0.exe`. Se probó el ejecutable empaquetado que contiene el instalador; no se realizó una instalación sobre el perfil personal. No hay certificado de firma configurado.

## Repetir las pruebas

Desde la raíz del proyecto:

```powershell
pnpm exec eslint src electron
pnpm test
pnpm app:build
node tests/test_packaged_call.mjs
```

La prueba empaquetada usa un perfil temporal y dispositivos sintéticos. No captura el micrófono del usuario ni conecta a Gemini. Sus directorios temporales están excluidos de Git. En Windows también valida el ciclo de vida del helper WASAPI; si se necesita una ventana/pantalla concreta, el loopback Chromium continúa requiriendo seleccionar una fuente en su selector.

La comprobación opcional de API real consume solicitudes y utiliza `VITE_GEMINI_API_KEY` del entorno o de `.env`, sin imprimirla:

```powershell
powershell.exe -NoProfile -File tests/create_call_probe.ps1
node tests/probe_live_call.mjs
node tests/probe_live_vision.mjs
```

## Límites comprobados

Los subtítulos aparecen al recibir la transcripción de Gemini; no es posible mostrar palabras que el servidor aún no ha entregado. La respuesta se acumula completa conforme llega, sin esperar a que termine de pronunciarse. La transcripción automática puede equivocarse: Gemini 2.5 no reprodujo exactamente la frase sintética de entrada.

Estas pruebas cubren ráfagas, cancelaciones, reconexiones, cambios de modelos y una pausa controlada del renderer. No garantizan latencia cero ni continuidad física del audio si Windows, la red, el controlador de sonido o la GPU quedan completamente saturados. No se realizó una prueba de varias horas ni una escucha humana con el micrófono y los altavoces personales.

Los contratos de transporte se contrastaron con la [documentación oficial de capacidades de Gemini Live](https://ai.google.dev/gemini-api/docs/live-api/capabilities) y la [gestión de sesiones](https://ai.google.dev/gemini-api/docs/live-api/session-management). El helper WASAPI captura el endpoint de salida predeterminado; seleccionar un proceso concreto o crear un dispositivo virtual requiere APIs/driver adicionales de Windows.
