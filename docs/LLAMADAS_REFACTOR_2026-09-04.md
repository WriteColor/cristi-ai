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

## Verificación realizada

| Comprobación | Resultado |
| --- | --- |
| ESLint en `src` y `electron` | Sin errores ni advertencias |
| Diagnósticos del proyecto | 36 suites aprobadas, incluyendo contratos de eventos, memoria, orquestación y loopback |
| Compilación Vite y electron-builder NSIS | Correcta |
| Ejecutable empaquetado en perfil aislado | Arranque con `app://`, preload y ajustes correctos |
| Avatares en el ejecutable empaquetado | 13 cargados; suscriptores de audio constantes en cada cambio |
| Captura en el ejecutable | AudioWorklet a 16 kHz; se verificó procesamiento de bloques con micrófono sintético |
| Reproducción real Web Audio | 15 bloques en ráfaga, sin solapamiento tras bloquear 180 ms el renderer |
| Subtítulos en el ejecutable | Respuesta acumulada y entrada de más de 300 caracteres, mismo ancho y tipografía, sin elipsis |
| Cierre de llamada | Dos desconexiones consecutivas no reinician la llamada |
| API real Gemini 3.1 | Dos turnos, audio y transcripción de entrada; herramientas solicitadas respondidas como deshabilitadas, sin ejecutarlas |
| API real Gemini 2.5 | Dos turnos, audio y transcripción de entrada |
| API real Gemini con visión | Dos modelos recibieron imágenes JPEG reales de pantalla; devolvieron audio y descripción transcrita |
| API real Gemini Live repetida | `gemini-3.1-flash-live-preview`: 32 bloques PCM, transcripción de entrada y respuesta completa |

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

La prueba empaquetada usa un perfil temporal y dispositivos sintéticos. No captura el micrófono del usuario ni conecta a Gemini. Sus directorios temporales están excluidos de Git. El loopback de escritorio requiere que el usuario seleccione una fuente en el selector de Chromium; la prueba automatizada valida el contrato de degradación cuando no existe `getDisplayMedia`.

La comprobación opcional de API real consume solicitudes y utiliza `VITE_GEMINI_API_KEY` del entorno o de `.env`, sin imprimirla:

```powershell
powershell.exe -NoProfile -File tests/create_call_probe.ps1
node tests/probe_live_call.mjs
node tests/probe_live_vision.mjs
```

## Límites comprobados

Los subtítulos aparecen al recibir la transcripción de Gemini; no es posible mostrar palabras que el servidor aún no ha entregado. La respuesta se acumula completa conforme llega, sin esperar a que termine de pronunciarse. La transcripción automática puede equivocarse: Gemini 2.5 no reprodujo exactamente la frase sintética de entrada.

Estas pruebas cubren ráfagas, cancelaciones, reconexiones, cambios de modelos y una pausa controlada del renderer. No garantizan latencia cero ni continuidad física del audio si Windows, la red, el controlador de sonido o la GPU quedan completamente saturados. No se realizó una prueba de varias horas ni una escucha humana con el micrófono y los altavoces personales.

Los contratos de transporte se contrastaron con la [documentación oficial de capacidades de Gemini Live](https://ai.google.dev/gemini-api/docs/live-api/capabilities) y la [gestión de sesiones](https://ai.google.dev/gemini-api/docs/live-api/session-management).
