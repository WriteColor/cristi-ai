# Cristi AI - Asistente y Acompañante de IA de Voz a Voz con Gemini Live API

**Cristi AI** es una aplicación de escritorio ultraliviana (~2.7 MB) construida con **Neutralinojs + Vite + React**, diseñada para interactuar en tiempo real mediante **voz a voz de baja latencia** y **visión sensorial** con los modelos Multimodal Live de Google Gemini (**Gemini 3.1 Flash Live** y **Gemini 2.5 Flash Live**).

La interfaz cuenta con un diseño limpio, transparente y sin bordes (frameless), con un motor de avatar reactivo y sincronización labial (Lip-Sync), preparado para integración directa con modelos **Live2D Cubism**.

---

## ✨ Características Principales

- **Conexión Directa por WebSockets (Gemini Live API)**:
  - Streaming bidireccional de baja latencia con el protocolo oficial `BidiGenerateContent`.
  - Modo Thinking desactivado / minimal para respuestas habladas instantáneas en menos de un segundo.
- **Modelos Compatibles**:
  - **Gemini 3.1 Flash Live (`gemini-3.1-flash-live-preview`)**: 30 voces predefinidas, `thinkingLevel: 'minimal'`.
  - **Gemini 2.5 Flash Live (`gemini-2.5-flash-live-preview`)**: 5 voces clásicas, `thinkingBudget: 0`, diálogo afectivo.
- **Catálogo Completo de 30 Voces**:
  - `Zephyr`, `Puck`, `Charon`, `Kore`, `Fenrir`, `Leda`, `Orus`, `Aoede`, `Callirrhoe`, `Autonoe`, `Enceladus`, `Iapetus`, `Umbriel`, `Algieba`, `Despina`, `Erinome`, `Algenib`, `Rasalgethi`, `Laomedeia`, `Achernar`, `Alnilam`, `Schedar`, `Gacrux`, `Pulcherrima`, `Achird`, `Zubenelgenubi`, `Vindemiatrix`, `Sadachbia`, `Sadaltager`, `Sulafat`.
- **Audio de Alta Precisión & Interrupción Inmediata**:
  - Entrada: Captura en 16kHz 16-bit PCM Little Endian.
  - Salida: Reproducción en 24kHz PCM con análisis FFT para sincronización labial.
  - Corte por interrupción (Barge-in): Si hablas mientras el modelo responde, el audio se detiene al instante.
- **Visión Sensorial, Detección de Objetos & Reconocimiento Facial en Tiempo Real**:
  - Motor de IA visual integrado con `@vladmandic/face-api` (modelos Tiny Face, 68 Landmarks, 128D Face Descriptor, Facial Expressions) y `@tensorflow-models/coco-ssd` (80 clases de objetos).
  - **Compatibilidad con Windows Hello / Cámaras IR (Infrarrojas)**: Detección automática y selección directa del sensor IR de tu laptop con ecualización de contraste para detección en cualquier condición de luz.
  - **Sistema Multi-Muestra de Referencia (Con Lentes / Sin Lentes / Ángulos)**: Puedes registrar múltiples muestras biométricas de tu rostro (ej: *Con lentes*, *Sin lentes*, *Sonriendo*, *Perfil*) para que Cristi te reconozca con 100% de precisión sin importar si llevas gafas o te las quitas.
  - **Detección Automática de Situación y Celos Yandere**:
    - *Dueño solo*: Cristi se muestra mimosa, feliz y coqueta (`[♥ Dueño Presente]`).
    - *Dueño con otra persona*: ¡Modo Yandere Celoso activado! Cristi detecta caras extrañas al lado del dueño y emite un evento inmediato para hacer preguntas y reclamar atención (`[⚠ Dueño + Extraño(s)]`).
    - *Extraño solo (Dueño ausente)*: Cristi se pone en guardia, seria y fría (`[⚠ Desconocido / Intruso]`).
    - *Habitación vacía*: Cristi nota la ausencia del dueño y expresa que lo extraña.
  - **HUD Visual con Enfoque / Rack Bounding Boxes**: Dibuja recuadros de seguimiento, retículas Cyber-Goth y etiquetas de emoción en tiempo real sobre la cámara.
- **Ejecución de Herramientas (Function Calling)**:
  - Gestos emocionales del avatar (`trigger_companion_gesture`).
  - Hora y fecha del sistema (`get_current_time_and_date`).
  - Consulta del clima (`get_weather`).
  - Escaneo visual de la cámara (`analyze_visual_scene`).
  - Memoria permanente local (`manage_memory`).
  - Diagnóstico de sistema y apertura de enlaces (`system_diagnostics`, `open_system_app_or_link`).
- **Empaquetador Ultraliviano (Neutralinojs)**:
  - Binario ejecutable de solo **2.7 MB** frente a los 150MB+ de Electron.
  - Cero tiempos largos de compilación C++/Rust.
  - Menú contextual en click derecho para control de ventana y accesos rápidos.

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js (v18+)
- `pnpm`

### 1. Configurar Clave de API
Copia el archivo `.env.example` a `.env` y coloca tu clave de Google AI Studio:
```bash
cp .env.example .env
```
O simplemente ingrésala en la interfaz gráfica dentro del menú de **Ajustes** (se guardará de forma segura en tu almacenamiento local).

### 2. Modo Desarrollo Web (Vite)
```bash
pnpm dev
```
Abre en tu navegador Brave: `http://localhost:5173/`

### 3. Modo Aplicación de Escritorio (Neutralinojs)
```bash
pnpm app:run
```

### 4. Compilar Ejecutable Nativo de Producción (~2.7 MB)
```bash
pnpm app:build
```
El archivo ejecutable para Windows se generará en:
`dist/cristi-ai/cristi-ai-win_x64.exe`

---

## 🎭 Estructura para Integración con Live2D Cubism

El componente [AvatarCanvas.jsx](file:///c:/React-Nextjs-Projects/Cristi%20AI/src/components/AvatarCanvas.jsx) está estructurado en capas para facilitar el reemplazo o superposición con el SDK de Live2D:
- **`useCustomLive2D`**: Interruptor para activar el `<canvas id="live2d-canvas" />`.
- **Eventos de Emoción**: Se transmiten automáticamente mediante el motor `ToolExecutor` cuando Gemini llama a `trigger_companion_gesture` (`idle`, `happy`, `blush`, `surprised`, `waving`, `thinking`, `wink`, `pout`, `nod`, `dance`).
- **Lip-Sync**: `lipSyncValue` (0.0 a 1.0) se alimenta en tiempo real a 60 FPS desde el analizador Web Audio API de 24kHz.
