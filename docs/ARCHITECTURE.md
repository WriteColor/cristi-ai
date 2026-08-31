# Arquitectura de Cristi Desktop (Arquitectura Electron & Desktop Mate)

Documento de ingeniería técnica y diseño de flujo de datos de la plataforma **Cristi Desktop**.

---

## 1. Capas del Sistema

```
+-------------------------------------------------------------------------------+
|                             Cristi Desktop Frontend                           |
|      React 19 + Vite 8 + PixiJS 7 + pixi-live2d-display (Cubism 4/5 Core)     |
+-------------------------------------------------------------------------------+
       |                         |                           |
       v                         v                           v
+------------------+    +-------------------+    +----------------------+
| Live2D Engine    |    | Gemini Live WS    |    | Sensory Vision & Bio |
| - Registry       |    | - Bidi Protocol   |    | - Voice Biometrics   |
| - Controller     |    | - 24kHz Audio     |    | - Face-API 128D      |
| - Adapter        |    | - Function Call   |    | - COCO-SSD           |
| - DesktopTracker |    | - Barge-In Sync   |    | - Screen Region      |
| - PointerCapture |    | - S2S Live Stream |    | - Win11 Lock Screen  |
+------------------+    +-------------------+    +----------------------+
       |                         |                           |
       +-------------------------+---------------------------+
                                 |
                                 v
+-------------------------------------------------------------------------------+
|                     Electron Native Desktop Shell (Mate Pattern)              |
|  - Transparent Frameless Fullscreen Window (win.setIgnoreMouseEvents)         |
|  - Selective IPC Click-Through (useClickThrough Hook with forward: true)      |
|  - Native System Tray, Always-on-Top ('screen-saver' level), Notifications    |
|  - Full OS API (PowerShell Execution, File System, Clipboard, Screen Capture)  |
+-------------------------------------------------------------------------------+
```

---

## 2. Click-Through Selectivo (Estilo Desktop Mate)

El sistema de ventana utiliza la técnica de **click-through selectivo** mediante la API nativa de Electron:

1. **Inicialización**:
   - `mainWindow` se crea como transparente, sin marcos (`frame: false`), ocupando el monitor completo y con `alwaysOnTop: 'screen-saver'`.
   - Inicia con `mainWindow.setIgnoreMouseEvents(true, { forward: true })`.
   - El flag `{ forward: true }` instruye a Windows a pasar los clics al escritorio u otras aplicaciones, pero continúa enviando los eventos `mousemove` a la ventana web.
2. **Hook React `useClickThrough`**:
   - Todos los componentes interactivos (avatar Live2D, menú contextual, modal de ajustes, widgets, dock inferior) usan `const { interactiveProps } = useClickThrough()`.
   - `mouseenter` $\rightarrow$ `electronBridge.setIgnoreMouseEvents(false)` (el componente recibe interacción de ratón inmediata).
   - `mouseleave` $\rightarrow$ `electronBridge.setIgnoreMouseEvents(true, { forward: true })` (el fondo vuelve a ser transparente para interacción con el escritorio y la barra de tareas de Windows).
3. **Hit-Target Dinámico de Live2D**:
   - `Live2DCanvas.jsx` sincroniza un div invisible (`.live2d-hit-target`) con el `getBounds()` exacto del modelo Live2D en cada frame a 60 FPS.
   - El arrastre se realiza con `setPointerCapture` nativo y la rueda de desplazamiento escala el modelo suavemente.

---

## 3. Flujo del Motor Live2D Universal

1. **`Live2DModelRegistry`**:
   - Registra descriptores y perfiles de modelos (`*.profile.js`).
   - Al cargar el archivo `.moc3` y sus texturas en WebGL, realiza introspección en tiempo de ejecución de los parámetros del modelo (`coreModel._parameterIds`), sus rangos numéricos y sus partes (`_partIds`).
   - Normaliza nombres de parámetros en inglés, estándar y CJK.
2. **`Live2DAdapter`**:
   - Mapea identificadores semánticos estándar (`head_angle_x`, `eye_ball_x`, `mouth_open_y`, `breath`) a los parámetros nativos de cada modelo.
   - Aplica interpolación exponencial suavizada (Lerp físico) en cada frame del ticker.
   - Aplica reglas de ocultamiento de partes no deseadas (`hiddenParts`).
3. **`Live2DController`**:
   - Modela comportamientos orgánicos biológicos: respiración sinusoidal, parpadeo estocástico, microsaccadas oculares, cinética del habla e inclinación de cabeza al hablar.
4. **`DesktopCursorTracker`**:
   - Monitorea la posición del cursor respecto a la pantalla global $(screenX, screenY)$ y el rostro del avatar a 60 FPS sin retraso.

---

## 4. Motor Físico y Cinemática Avanzada 2.0 (`Live2DPhysicsEngine.js`)

1. **Ecuaciones Armónicas Amortiguadas**:
   - Simula movimiento pendular elástico ($F = -k \cdot x - c \cdot v + F_{\text{ext}}$) para oscilación natural de cabello (`ParamHairFront`, `ParamHairSide`, `ParamHairBack`), ropa y accesorios.
2. **Generador Multi-Armónico de Viento**:
   - Viento ambiental continuo con ráfagas estocásticas aleatorias y turbulencia no periódica.
3. **Inercia y Fuerzas Centrífugas**:
   - Los giros de cabeza (`ParamAngleX`, `ParamAngleY`, `ParamAngleZ`) y cuerpo inducen fuerzas de inercia directamente sobre los péndulos físicos.

---

## 5. Subsistema de Audio DSP, AudioWorklet & Gemini Live WebSocket

1. **Captura en Hilo Aislado con AudioWorklet (`AudioInputService.js`)**:
   - Captura continua a $16\text{ kHz}$ PCM de 16 bits en Little Endian mediante `AudioWorkletNode` dedicado (`cristi-pcm-processor`), eliminando bloqueos de audio ocasionados por renderizado de la UI.
   - Filtro paso-alto (HPF @ 80 Hz) para suprimir ruidos por viento y vibraciones mecánicas.
   - Puerta de ruido (*Noise Gate*) adaptativa para amortiguar el ruido de fondo.
2. **Biometría Vocal & Similitud de Coseno (`SpeakerRecognitionService.js`)**:
   - Extracción de 80 bandas Log-Mel, 40 coeficientes cepstrales DCT-II y proyección a vectores 192D normalizados con norma L2.
   - Si una voz desconocida interviene (`score < rejectThreshold`), Cristi silencia inmediatamente su respuesta y muestra una advertencia de seguridad.
3. **Salida con Buffer de Jitter y Sincronización Labial (`AudioOutputService.js`)**:
   - Recepción de fragmentos de audio a $24\text{ kHz}$ PCM con un lead-time nominal de 35ms para amortiguar la fluctuación de paquetes de red (*Jitter*).
   - Extracción espectral multi-banda: frecuencias graves (80–450 Hz) para apertura de mandíbula (`ParamMouthOpenY`) y frecuencias agudas (450–3500 Hz) para ensanchamiento de labios (`ParamMouthForm`).
4. **Reconexión Resiliente con Exponential Backoff (`GeminiLiveSocket.js`)**:
   - Reconexión automática de hasta 5 intentos con retroceso exponencial (`Math.pow(1.8, attempts) + jitter`) y preservación del `sessionResumptionHandle`.

---

## 6. Persistencia, Atajos de Teclado & Empaquetado

1. **Gestor de Configuración Resiliente (`ConfigManager.js`)**:
   - Auto-guardado de configuración, almacenamiento de historial de snapshots de respaldo en almacenamiento local, exportación e importación directa en formato JSON desde el modal de ajustes.
2. **Atajos Globales Nativos de Windows**:
   - `Ctrl + Shift + C`: Boss Key / Modo Residente.
   - `Ctrl + Shift + M`: Silenciar / Activar micrófono.
   - `Ctrl + Shift + S`: Captura de pantalla contextual instantánea para visión en Gemini Live.
3. **Instalador NSIS Standalone**:
   - Empaquetado automatizado con `electron-builder.config.cjs` generando `Cristi-Desktop-Setup-1.0.0.exe` de 64 bits con accesos directos y desinstalador limpio.

