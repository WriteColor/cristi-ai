# ⌨️ Guía Completa de Atajos de Teclado, Controles y Gestos — Cristi AI Companion

Esta guía recopila y detalla **todos los atajos de teclado globales y locales**, interacciones de ratón, gestos táctiles y controles de interfaz implementados en **Cristi AI (Cristi AI Companion)**.

---

## 🌐 1. Atajos de Teclado Globales de Windows (*Global System Shortcuts*)

Estos atajos funcionan a nivel del sistema operativo en cualquier momento, **incluso cuando Cristi está en segundo plano, minimizada o no tiene el foco activo**:

| Atajo Global | Acción | Descripción y Comportamiento |
|---|---|---|
| **`Ctrl + Shift + C`** | **Boss Key / Modo Residente** | Oculta o muestra instantáneamente la ventana flotante de Cristi en pantalla. Al ocultarse, se detiene por completo el ticker de renderizado WebGL para un consumo de recursos **0%**. |
| **`Ctrl + Shift + H`** | **Ocultar / Mostrar UI (Modo Zen Global)** | **Nuevo**: Oculta o muestra toda la interfaz gráfica de usuario a nivel de todo el sistema operativo, dejando únicamente el avatar Live2D visible y flotante. |
| **`Ctrl + Shift + P`** | **Telemetría & Profiler (HUD Global)** | **Nuevo**: Despliega o cierra el panel de telemetría de rendimiento y FPS en tiempo real desde cualquier ventana de Windows. |
| **`Ctrl + Shift + A`** | **Fijar Siempre Visible (Always-on-Top)** | **Nuevo**: Conmuta el anclaje de ventana prioritario (`screen-saver` level) sobre todas las demás apps. |
| **`Ctrl + Shift + M`** | **Silenciar / Activar Micrófono** | Conmuta el micrófono del asistente con respuesta táctil auditiva inmediata. Evita el envío de fragmentos de audio a la API de Gemini Live. |
| **`Ctrl + Shift + S`** | **Visión Contextual Instantánea** | Captura la pantalla activa de tu monitor a resolución completa y la transmite en tiempo real a Cristi para que analice lo que estás viendo y responda proactivamente. |

---

## 🎯 2. Atajos de Teclado en la Interfaz (*In-App Shortcuts*)

Estos atajos se activan al interactuar con la aplicación de Cristi AI:

| Tecla / Atajo | Acción | Contexto y Funcionamiento |
|---|---|---|
| **`F3`** | **Enterprise Performance Profiler & Observability HUD** | Abre/Cierra el panel futurista de telemetría en tiempo real estilo Minecraft timings. Muestra **FPS, TPS (Ticks Per Second), tiempo de frame P99, memoria JS Heap vs RSS, atribución de costes por subsistema** (Live2D, Audio DSP, Visión, UI React) y el detector autónomo de anomalías. |
| **`H` / `h`** | **Modo Zen / Ghost UI** | Oculta todos los botones, subtítulos, HUDs y widgets, dejando exclusivamente al personaje Live2D flotando sobre tu escritorio sin distracciones. *(Desactivado automáticamente mientras se escribe en campos de texto)*. |
| **`Escape`** | **Cerrar Todo / Descartar** | Cierra de forma inmediata cualquier ventana modal o menú abierto: Menú Contextual, Modal de Ajustes, Enrolamiento Vocal, Sandbox de Bloqueo, Selector de Región de Pantalla o Selector de Archivos. |

---

## 🖱️ 3. Interacciones y Gestos de Ratón (*Direct Mouse Manipulation*)

La interacción física con el personaje Live2D aprovecha el hook `useClickThrough` y la API de captura de punteros (`setPointerCapture`):

| Gesto / Acción de Ratón | Ubicación | Comportamiento |
|---|---|---|
| **Clic Izquierdo Simple** | Sobre el personaje Live2D | Dispara una **reacción emocional aleatoria** adaptada a la personalidad del modelo activo (`happy`, `blush`, `wink`, `dance`, `yandere`, `mad`, `surprised`). |
| **Clic Izquierdo + Arrastre (Drag & Drop)** | Sobre el personaje Live2D | **Mueve a Cristi libremente por el escritorio**. El personaje sigue la trayectoria del ratón sin retraso con captura de puntero física de alta precisión. |
| **Rueda del Ratón (Scroll / Wheel)** | Sobre el personaje Live2D | **Escalado dinámico y suave**: Aumenta o disminuye el tamaño del modelo en un rango de **`0.25x` a `4.0x`** centrado en el punto de pivote visual del personaje. |
| **Clic Derecho** | Sobre el personaje Live2D | Despliega el **Menú Contextual Táctico Obsidian**, con accesos directos categorizados (Personajes, Fondos/Escenas, Modelos de IA, Voces, Herramientas del Sistema). |
| **Clic Fuera / Pérdida de Foco (`Blur`)** | En cualquier parte fuera del Menú | **Cierre natural e instantáneo** del menú contextual sin requerir clics repetidos. |
| **Hover en Borde Inferior** | Borde inferior de la pantalla | Permite que la barra de tareas de Windows 11 se desplace y reciba interacción nativa sin interferencia de la ventana transparente. |

---

## 🎛️ 4. Menú Contextual Táctico Obsidian (*Right-Click Tactical Menu*)

El menú contextual categorizado ofrece control rápido sobre todas las capacidades del sistema:

### 1. 🎭 Categoría: Personaje Live2D
* **Selector Rápido de Avatar**: Conmuta entre los 8 modelos oficiales (`Cristi Gótica`, `Ice Girl`, `Hiyori`, `Miara`, `Toki`, `Ellen Joe`, `Jane Doe`, `Ruan Mei`).
* **Chips de Expresiones Directas**: Dispara expresiones faciales instantáneas (`Sonrojo`, `Corazones`, `Yandere`, `Wink`, `Enojada`, `Sorprendida`).

### 2. 🌌 Categoría: Fondo & Escena
* **Selector de Entornos**: Conmuta entre fondo transparente puro o escenas de animación y shaders:
  * `Transparente Puro` (Modo compañera de escritorio).
  * `Matrix Rain` (Lluvia de código digital verde).
  * `Cyber Grid 3D` (Cuadrícula cyberpunk animada).
  * `Neon City` (Ciudad futurista con gradientes dinámicos).
  * `Cozy Room` (Habitación cálida con iluminación suave).
  * `Zen Temple` (Atmósfera oriental relajante).
  * `Wallpaper Personalizado` (Carga cualquier imagen de fondo local).

### 3. 🧠 Categoría: Inteligencia Artificial
* **Selector de Modelo Gemini**: Conmuta entre `Gemini 2.5 Flash`, `Gemini 2.0 Flash`, `Gemini 2.0 Pro Experimental` y `Gemini 1.5 Pro`.
* **Selector de Voces Neuronales**: Conmuta entre las 30 voces oficiales (`Aoede`, `Zephyr`, `Kore`, `Puck`, `Charon`, `Fenrir`, etc.).

### 4. 🛠️ Categoría: Herramientas Tácticas
* **Capturar Región**: Abre el selector de coordenadas para que Cristi analice visualmente un área específica de tu pantalla.
* **Sandbox Bloqueo**: Abre el simulador de pantalla de bloqueo de Windows 11 (`Win + L`) con widgets interactivos.
* **Biometría Vocal**: Abre el asistente de enrolamiento de huella de voz multi-muestra.
* **Diagnóstico Audio**: Despliega el HUD de análisis espectral y decisión de hablante en tiempo real.
* **Telemetría & FPS (`F3`)**: Conmuta el panel de observabilidad de rendimiento de alta precisión.

### 5. ⚙️ Categoría: Sistema
* **Fijar / Flotante**: Alterna el modo *Always on Top* (`screen-saver` level).
* **Ajustes**: Abre el panel horizontal completo de configuración.
* **Salir**: Cierra de forma segura el proceso nativo de Electron.

---

## 🎙️ 5. Comandos de Voz y Control por Lenguaje Natural

Cristi cuenta con 25 herramientas integradas que se activan automáticamente mediante conversación natural por voz:

* *"Cristi, muévete a la esquina superior derecha"* $\rightarrow$ Ejecuta `move_avatar(position: "top-right")`.
* *"Ponte feliz y haz un baile"* $\rightarrow$ Ejecuta `trigger_companion_gesture(gesture: "dance")`.
* *"Abre mi carpeta de descargas"* $\rightarrow$ Ejecuta `open_file_or_folder(path: "C:\\Users\\...\\Downloads")`.
* *"¿Cómo va el rendimiento de mi PC?"* $\rightarrow$ Ejecuta `system_diagnostics()`.
* *"Inicia un temporizador de concentración de 25 minutos"* $\rightarrow$ Ejecuta `start_focus_timer(durationMinutes: 25)`.
* *"¿Qué estoy viendo en pantalla?"* $\rightarrow$ Toma captura contextual y analiza el contenido visual.
