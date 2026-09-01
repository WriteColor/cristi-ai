# 🛠️ Catálogo de Herramientas y Capacidades Autónomas — Cristi AI Companion

Cristi AI dispone de un catálogo de **25 funciones de herramientas (Function Calling Declarations)** sincronizadas a través del protocolo bidireccional de **Google Gemini Multimodal Live API**. Esta integración le otorga acceso autónomo al sistema operativo Windows, control cinemático de su avatar, visión artificial y automatización de tareas.

---

## 📋 Resumen de Herramientas Disponibles

```
+---------------------------------------------------------------------------------------------------+
| HERRAMIENTAS DECLARADAS PARA CRISTI AI (GEMINI BIDIGENERATECONTENT PROTOCOL)                     |
+---------------------------------------------------------------------------------------------------+
| 1. trigger_companion_gesture    | 10. write_file                  | 19. get_sensory_vision_status |
| 2. trigger_model_motion         | 11. list_directory              | 20. set_screen_region         |
| 3. move_avatar                  | 12. get_clipboard               | 21. set_screen_watch          |
| 4. get_current_time_and_date    | 13. set_clipboard               | 22. interact_minecraft_game  |
| 5. get_weather                  | 14. get_running_processes       | 23. send_external_device_signal|
| 6. system_diagnostics           | 15. kill_process                | 24. start_focus_timer         |
| 7. execute_system_command       | 16. open_file_or_folder         | 25. trigger_desktop_widget    |
| 8. read_file                    | 17. open_system_app_or_link     |                               |
| 9. computer_action              | 18. capture_camera_snapshot     |                               |
+---------------------------------------------------------------------------------------------------+
```

---

## 🎭 1. Control del Avatar & Expresiones Live2D

### `trigger_companion_gesture`
* **Descripción:** Activa un gesto emocional o expresión facial en el avatar de la compañera virtual.
* **Parámetros:**
  * `gesture` *(string, obligatorio)*: `idle`, `happy`, `blush`, `love`, `surprised`, `yandere`, `crazy`, `thinking`, `wink`, `pout`, `angry`, `sad`, `smug`, `gamer`, `nod`, `dance`, `relaxed`, `waving`.
  * `comment` *(string, opcional)*: Motivo interno del cambio gestual.

### `trigger_model_motion`
* **Descripción:** Ejecuta una animación o pose de movimiento nativa del modelo Live2D activo.
* **Parámetros:**
  * `motion_group` *(string, obligatorio)*: Grupo de animación (`Idle`, `Tap`, `Flick`, `MeiYan`, `HuiShou`, `DaiJi`).
  * `index` *(integer, opcional)*: Índice de la pose dentro del grupo (por defecto `0`).

### `move_avatar`
* **Descripción:** Desplaza a Cristi a una ubicación predefinida de la pantalla con una animación suave.
* **Parámetros:**
  * `position` *(string, obligatorio)*: `center`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `random`.
  * `animation` *(string, opcional)*: `none`, `bounce`, `float`, `shake`, `dance`, `slide`.

---

## 💻 2. Acceso Total al Sistema Operativo Windows & PowerShell

### `execute_system_command`
* **Descripción:** Ejecuta cualquier comando o script en PowerShell o CMD nativo con acceso completo al sistema de archivos y procesos.
* **Parámetros:**
  * `command` *(string, obligatorio)*: Comando completo a ejecutar (ej: `Get-Process`, `ipconfig /all`, `dir C:\`).
  * `use_powershell` *(boolean, opcional)*: Forzar PowerShell (`true` por defecto).

### `read_file`
* **Descripción:** Lee el contenido en texto plano de cualquier archivo del sistema.
* **Parámetros:**
  * `path` *(string, obligatorio)*: Ruta absoluta del archivo (ej: `C:\Users\jerem\Documents\nota.txt`).

### `write_file`
* **Descripción:** Crea o sobreescribe un archivo en el sistema de archivos del usuario.
* **Parámetros:**
  * `path` *(string, obligatorio)*: Ruta absoluta del archivo.
  * `content` *(string, obligatorio)*: Contenido a escribir.
  * `append` *(boolean, opcional)*: Si es `true`, añade el contenido al final sin sobrescribir.

### `list_directory`
* **Descripción:** Lista archivos, extensiones y subdirectorios de una ruta dada.
* **Parámetros:**
  * `path` *(string, obligatorio)*: Ruta del directorio a inspeccionar.

### `get_clipboard` / `set_clipboard`
* **Descripción:** Lee o escribe texto en el portapapeles global de Windows.

### `get_running_processes` / `kill_process`
* **Descripción:** Consulta los procesos activos con su consumo de memoria en MB o finaliza procesos por PID/nombre (ej: `notepad.exe`).

### `open_file_or_folder` / `open_system_app_or_link`
* **Descripción:** Abre archivos en el Explorador de Windows o enlaces web en el navegador predeterminado.

---

## 🖱️ 3. Computer Use & Automatización de Interfaz

### `computer_action`
* **Descripción:** Ejecuta acciones de entrada de hardware simuladas (clic de ratón en coordenadas de pantalla, pulsación de teclas, escritura de texto o desplazamiento).
* **Parámetros:**
  * `action` *(string, obligatorio)*: `mouse_click`, `type_text`, `press_key`, `mouse_scroll`, `take_screenshot`.
  * `coordinate` *(array [x, y], opcional)*: Coordenadas de píxel en la pantalla para clics.
  * `text` *(string, opcional)*: Cadena de texto a teclear.
  * `key` *(string, opcional)*: Tecla especial a pulsar (ej: `Enter`, `Tab`, `Escape`, `Control+s`).

---

## 👁️ 4. Visión Artificial, Detección de Objetos & Captura de Pantalla

### `capture_camera_snapshot`
* **Descripción:** Captura un fotograma de alta resolución de la webcam del usuario para análisis visual inmediato.

### `get_sensory_vision_status`
* **Descripción:** Consulta la telemetría sensorial en tiempo real: personas detectadas frente a la pantalla (dueño vs. desconocidos), objetos en la escena (teléfono en mano, tazas, portátiles) y estado de presencia.

### `set_screen_region` / `set_screen_watch`
* **Descripción:** Define un área rectangular de la pantalla o activa la monitorización visual continua de una ventana de aplicación.

---

## 🎮 5. Integración con Videojuegos, Periféricos y Productividad

### `interact_minecraft_game`
* **Descripción:** Se conecta con el bridge local de Minecraft para consultar el estado del jugador (vida, hambre, inventario, bioma actual) o ejecutar comandos en el servidor.

### `send_external_device_signal`
* **Descripción:** Envía señales o pulsos a dispositivos externos y controladores IoT (luces inteligentes, microcontroladores vía puerto serie/Bluetooth).

### `start_focus_timer`
* **Descripción:** Inicia un temporizador de concentración Pomodoro con acompañamiento y recordatorios de postura.

### `trigger_desktop_widget`
* **Descripción:** Despliega widgets interactivos en el escritorio (reloj digital, notas adhesivas, monitor de recursos, visualizador de música).
