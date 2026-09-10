# Catalogo Verificado de Herramientas, Capacidades y Servidores MCP — Cristi AI Companion
> **Autor:** Write_Color | **Versión:** 2.0.0 (Auditoría Integral 2026) | **Protocolo:** Gemini Multimodal Live API (BidiGenerateContent)

Cristi AI Companion dispone de un catálogo agéntico fuertemente tipado sincronizado en tiempo real a través del protocolo bidireccional de **Google Gemini Multimodal Live API (`v1beta`)**. Todas las herramientas están gobernadas por el patrón de diseño *Command* en `src/domain/tools/` y son filtradas estrictamente por el enrutador de seguridad `CapabilityRouter` y la política de aislamiento en `electron/src/security/`.

---

## 📑 Resumen General por Categorías y Capacidades Reales

| Categoría | Herramientas Registradas | Alcance Real y Límites de Seguridad |
|---|---|---|
| 🎭 **Control de Avatar Live2D** | `trigger_companion_gesture`, `trigger_model_motion`, `move_avatar`, `switch_avatar_model` | Manipulación cinemática de los 13 modelos oficiales, expresiones emocionales, poses `motion3` y reposicionamiento en pantalla. |
| 💻 **Diagnóstico y Sistema Operativo** | `get_current_time_and_date`, `get_weather`, `system_diagnostics`, `execute_system_command`, `read_file`, `write_file`, `list_directory`, `get_clipboard_text`, `set_clipboard_text`, `open_external_link` | Consultas del reloj/clima, diagnósticos autorizados (`system-info`, `list-processes`), portapapeles y lectura/escritura acotada a la carpeta de trabajo aprobada. |
| 🖱️ **Captura del Entorno (Computer Use)**| `computer_action` | Captura fotográfica instantánea de pantalla completa (`take_screenshot`) a través del pipeline nativo. Acciones de inyección de ratón deshabilitadas por seguridad. |
| 👁️ **Visión de Pantalla y Regiones** | `capture_screen_snapshot`, `set_screen_watch`, `set_screen_region`, `analyze_visual_scene` | Capturas nativas con `desktopCapturer`, recorte por cuadrantes o regiones porcentuales (`x_pct`, `y_pct`, `w_pct`, `h_pct`) y streaming continuo a Gemini Live. |
| 🛡️ **Blindaje de Audio & Loopback WASAPI**| `start_desktop_audio_capture`, `stop_desktop_audio_capture`, `desktop_audio_capture_status`, `send_game_voice_translation`, `translate_and_speak_in_game` | Captura de audio de salida de Windows mediante el helper nativo `CristiWasapiLoopback.exe`, aislamiento de eco con `markGenerated` y enrutamiento hacia canales de voz. |
| 🧠 **Memoria Persistente Multicapa** | `manage_memory`, `remember_fact`, `search_memory`, `delete_memory` | Almacenamiento seguro en SQLite (`node:sqlite`), indexación léxica BM25 (`MemoryIndex`), consolidación de preferencias y contexto dinámico. |
| 🪟 **Widgets Tácticos y Alarmas** | `set_reminder`, `set_alarm`, `show_tactical_widget`, `dismiss_tactical_widget` | Notificaciones en pantalla (toasts), programación de alarmas proactivas con temporizador en segundo plano y HUDs de estado. |
| 🌐 **Búsqueda Web y Scrapeo** | `search_internet`, `browse_web_page`, `open_in_brave_browser` | Búsqueda web asistida, extracción de texto legible y apertura directa de enlaces en el navegador predeterminado. |
| ⛏️ **Compañero de Minecraft (Mineflayer)**| `minecraft_connect`, `minecraft_disconnect`, `minecraft_get_status`, `minecraft_chat`, `minecraft_move_to`, `minecraft_follow_player`, `minecraft_stop_moving`, `minecraft_mine_block`, `minecraft_place_block`, `minecraft_attack_entity` | Conexión de un bot virtual autónomo a servidores Minecraft Java Edition, navegación con pathfinding A*, telemetría de vida/hambre y combate defensivo. |
| 💬 **Compañero de Discord** | `discord_send_message`, `discord_set_status`, `discord_voice_join`, `discord_voice_leave`, `discord_voice_status` | Publicación en canales de texto, actualización de actividad rica y transmisión/recepción de voz en canales de voz mediante `@discordjs/voice`. |
| 🔌 **Servidores MCP Dinámicos** | `mcp_add_server`, `mcp_remove_server`, `mcp_list_servers`, `mcp_reconnect_server`, `mcp_call_tool` | Gestión e invocación en caliente de herramientas MCP mediante transportes `stdio` (JSON-RPC 2.0) y `sse` con esquemas autogenerados. |
| 🎵 **Control Multimedia y Spotify** | `spotify_play`, `spotify_pause`, `spotify_next`, `spotify_previous`, `spotify_get_status`, `spotify_search`, `spotify_set_volume` | Búsqueda estructurada mediante Spotify Web API e interacción con la aplicación de escritorio de Windows mediante teclas de medios y lectura de título de ventana. |
| 🎭 **Automatización Web con Playwright** | `playwright_navigate`, `playwright_click`, `playwright_fill`, `playwright_press`, `playwright_screenshot`, `playwright_get_content`, `playwright_evaluate`, `playwright_close` | Navegación autónoma en Brave Browser, llenado de formularios, clics en selectores CSS, evaluación de scripts y capturas en un worker aislado. |

---

## 1. 🎭 Control del Avatar y Expresiones Live2D

### `trigger_companion_gesture`
* **Descripción:** Activa una expresión o gesto emocional en el avatar activo. Se resuelven sinónimos semánticos y se respetan las expresiones bloqueadas por modelo.
* **Parámetros:**
  * `gesture` *(string, obligatorio)*: Gesto deseado (ej: `happy`, `blush`, `love`, `surprised`, `yandere`, `crazy`, `thinking`, `wink`, `pout`, `angry`, `sad`, `smug`, `gamer`, `nod`, `dance`, `relaxed`, `waving`).
  * `comment` *(string, opcional)*: Razón explicativa interna.

### `trigger_model_motion`
* **Descripción:** Dispara una animación nativa (`motion3.json`) del modelo activo.
* **Parámetros:**
  * `motion_group` *(string, obligatorio)*: Nombre del grupo de animación (`Idle`, `Tap`, `Flick`, `Special`, etc.).
  * `index` *(integer, opcional)*: Índice dentro del grupo (por defecto `0`).

### `move_avatar`
* **Descripción:** Reposiciona la ventana del avatar en el monitor.
* **Parámetros:**
  * `position` *(string, obligatorio)*: `center`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`.
  * `animation` *(string, opcional)*: `none`, `slide`, `bounce`, `float`.

### `switch_avatar_model`
* **Descripción:** Cambia el avatar activo entre los 13 modelos Live2D oficiales registrados con tipado estricto.
* **Parámetros:**
  * `model_id` *(string, obligatorio)*: Uno de: `yanderegirl`, `icegirl`, `hiyori`, `miara`, `toki`, `ellen`, `jane_doe`, `ruan_mei`, `belle`, `sparkle`, `huohuo`, `vivian`, `goth_loli`.

---

## 2. 💻 Sistema Operativo y Diagnósticos Seguros

### `get_current_time_and_date`
* **Descripción:** Retorna la fecha, hora actual exacta, zona horaria y día de la semana. Sin parámetros requeridos.

### `get_weather`
* **Descripción:** Consulta el pronóstico o clima actual.
* **Parámetros:**
  * `city` *(string, opcional)*: Ciudad o ubicación a consultar.

### `execute_system_command`
* **Descripción:** Consulta diagnósticos mediante capacidades nominales permitidas del sistema. Por seguridad, rechaza comandos de terminal arbitrarios.
* **Parámetros:**
  * `kind` *(string, obligatorio)*: Únicamente `system-info` (especificaciones de CPU/RAM/SO) o `list-processes` (procesos activos).

### `read_file`
* **Descripción:** Lee un archivo de texto dentro del directorio autorizado configurado en Ajustes.
* **Parámetros:**
  * `path` *(string, obligatorio)*: Ruta relativa del archivo dentro de la carpeta aprobada.

### `write_file`
* **Descripción:** Crea o sobreescribe un archivo en la carpeta aprobada.
* **Parámetros:**
  * `path` *(string, obligatorio)*: Ruta relativa del archivo.
  * `content` *(string, obligatorio)*: Texto a escribir.
  * `append` *(boolean, opcional)*: Si es true, añade al final en lugar de sobreescribir.

### `list_directory`
* **Descripción:** Lista los archivos y subcarpetas dentro del directorio de trabajo aprobado.
* **Parámetros:**
  * `path` *(string, opcional)*: Subdirectorio relativo a inspeccionar.

---

## 3. 🖱️ Captura del Entorno (Computer Use)

### `computer_action`
* **Descripción:** Captura la pantalla actual para inspección visual de interfaces o videojuegos.
* **Parámetros:**
  * `action` *(string, obligatorio)*: Exclusivamente `take_screenshot`.
  * *Nota de seguridad:* Acciones de inyección de teclado y clics sintéticos directos sobre el sistema operativo están deshabilitadas por política de aislamiento de privilegios.

---

## 4. 👁️ Visión de Pantalla y Regiones

### `capture_screen_snapshot`
* **Descripción:** Toma una captura inmediata de la pantalla completa o del recorte activo y la devuelve en base64 para análisis visual de Gemini.
* **Parámetros:**
  * `mode` *(string, opcional)*: `full` (pantalla completa), `region` (cuadrante seleccionado) o `active_window`.

### `set_screen_region`
* **Descripción:** Configura un área rectangular específica de la pantalla para observación continua o lecturas enfocadas.
* **Parámetros:**
  * `x_pct` *(number)*: Posición horizontal inicial en porcentaje (0-100).
  * `y_pct` *(number)*: Posición vertical inicial en porcentaje (0-100).
  * `w_pct` *(number)*: Ancho del área en porcentaje (1-100).
  * `h_pct` *(number)*: Alto del área en porcentaje (1-100).

---

## 5. 🧠 Memoria Persistente y Consolidación

### `manage_memory`
* **Descripción:** Administra la base de datos persistente SQLite de recuerdos a largo plazo de Cristi AI.
* **Parámetros:**
  * `action` *(string, obligatorio)*: `remember`, `recall`, `forget` o `list`.
  * `key` *(string, opcional)*: Identificador conceptual único del recuerdo (ej: `comida_favorita`, `apodo_usuario`).
  * `value` *(string, opcional)*: Hecho o contenido del recuerdo a guardar.
  * `category` *(string, opcional)*: `fact`, `preference`, `relationship`, `task`, `rule` o `lore`.
  * `importance` *(number, opcional)*: Valor entre 0.1 y 1.0 que pondera su prioridad de inyección en el prompt.
  * `query` *(string, opcional)*: Consulta de búsqueda semántica/léxica para la acción `recall`.

---

## 6. ⛏️ Compañero de Minecraft (Mineflayer)

### `minecraft_connect`
* **Descripción:** Conecta al bot virtual de Cristi a un servidor de Minecraft Java.
* **Parámetros:**
  * `host` *(string, opcional)*: Dirección IP o dominio del servidor (por defecto `localhost`).
  * `port` *(number, opcional)*: Puerto del servidor (por defecto `25565`).
  * `username` *(string, opcional)*: Nombre del bot en el juego (por defecto `Cristi_AI`).
  * `version` *(string/boolean, opcional)*: Versión del protocolo o false para detección automática.

### `minecraft_get_status`
* **Descripción:** Obtiene la posición XYZ actual, dimensión, salud (0-20), nivel de comida, jugadores conectados y entidades hostiles cercanas.

### `minecraft_chat`
* **Descripción:** Envía un mensaje al chat público del servidor de Minecraft.
* **Parámetros:**
  * `message` *(string, obligatorio)*: Texto a enviar.

### `minecraft_move_to`
* **Descripción:** Navega de forma autónoma mediante el algoritmo pathfinder A* hacia unas coordenadas dadas.
* **Parámetros:**
  * `x` *(number)*: Coordenada X.
  * `y` *(number)*: Coordenada Y.
  * `z` *(number)*: Coordenada Z.

### `minecraft_follow_player`
* **Descripción:** Sigue de cerca a un jugador específico en el servidor evitando obstáculos y caídas.
* **Parámetros:**
  * `player` *(string, obligatorio)*: Nombre de usuario del jugador.

---

## 7. 🎵 Control Multimedia y Spotify

### `spotify_play`, `spotify_pause`, `spotify_next`, `spotify_previous`
* **Descripción:** Controla la reproducción de música enviando señales virtuales a las teclas multimedia nativas de Windows. Sin parámetros requeridos.

### `spotify_get_status`
* **Descripción:** Consulta si Spotify está abierto y qué canción y artista se están reproduciendo en este momento inspeccionando el título de la ventana de Windows.

### `spotify_search`
* **Descripción:** Busca pistas, álbumes o artistas en Spotify Web API o lanza la reproducción en la aplicación de escritorio.
* **Parámetros:**
  * `query` *(string, obligatorio)*: Término de búsqueda (canción o artista).
  * `type` *(string, opcional)*: `track`, `album`, `artist` o `playlist`.

---

## 8. 🎭 Automatización Web con Playwright

### `playwright_navigate`
* **Descripción:** Abre el navegador Brave y navega a una dirección URL.
* **Parámetros:**
  * `url` *(string, obligatorio)*: Dirección web completa.

### `playwright_click`
* **Descripción:** Hace clic sobre un elemento del DOM en la página web abierta.
* **Parámetros:**
  * `selector` *(string, obligatorio)*: Selector CSS o texto del elemento.

### `playwright_fill`
* **Descripción:** Introduce texto en un campo de entrada o formulario.
* **Parámetros:**
  * `selector` *(string, obligatorio)*: Selector CSS del campo.
  * `value` *(string, obligatorio)*: Texto a rellenar.

### `playwright_get_content`
* **Descripción:** Extrae el contenido de texto visible de la página o de un contenedor específico para que Gemini lo lea.
* **Parámetros:**
  * `selector` *(string, opcional)*: Selector CSS del contenedor o cuerpo entero si se omite.

---

## 9. Semántica de Cancelación Cooperativa y Ciclo de Vida de AbortSignal

Para garantizar que las interrupciones del usuario o cancelaciones de sesión no dejen llamadas colgadas ni generen condiciones de carrera, el subsistema agéntico (`ToolExecutor` y `ToolRegistry`) opera bajo las siguientes garantías formales de cancelación:

1. **Prevención e Invocación Atómica Previa**:
   - `ToolExecutor` registra el listener de `'abort'` en el `AbortSignal` *antes* de iniciar el trabajo de la herramienta y valida `signal.aborted` inmediatamente tras el registro.
   - Si la señal ya está cancelada o si el handler emite un aborto sincrónico durante su arranque (antes de cualquier await), la ejecución se marca de inmediato como `cancelled: true` y nunca se reporta como éxito.

2. **Comprobación Cooperativa en Handlers de Producción**:
   - Los manejadores de producción (`systemTools`, `memoryTools`, `gameTools`, `spotifyTools`, `webTools`) reciben `context: ToolExecutionContext` y comprueban `context.signal?.aborted` antes de ejecutar mutaciones o llamadas de impacto (escritura en disco, mutación de memoria permanente, llamadas de red o envío de mensajes).
   - En flujos con checkpoints asíncronos o etapas compuestas (como la conexión de voz en Discord), si la señal se aborta durante el proceso, el manejador deshace el estado parcial (e.g. `discordVoiceService.leave()`) y aborta cooperativamente.

3. **Límites en Operaciones en Vuelo no Interrumpibles**:
   - Cuando una operación externa ya ha sido despachada hacia el sistema operativo o un servicio remoto sin API de reversión (por ejemplo, un paquete de red ya transmitido, una reproducción ya iniciada en la aplicación externa de Spotify o una invocación IPC a bajo nivel sin canal de cancelación en el kernel), el ejecutor **deja de esperar** el resultado mediante `Promise.race`, retornando inmediatamente el estado cancelado a Gemini Live.
   - No se garantiza la revocación atómica de efectos secundarios externos ya consumados por el sistema operativo o servicios de terceros una vez transmitidos; el sistema se desvincula de la espera pero no asume rollback imposible.

4. **Limpieza Garantizada de Event Listeners**:
   - Los listeners asociados a `AbortSignal` se retiran de manera garantizada dentro de bloques `finally` en `ToolExecutor`, tanto tras ejecuciones exitosas, con error o interrumpidas en vuelo, previniendo retención de referencias en el colector de basura de Node.js.

