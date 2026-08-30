# Arquitectura de Cristi AI

Documento de ingeniería y flujo de datos de la plataforma Cristi AI.

---

## 1. Capas del Sistema

```
+-------------------------------------------------------------------------------+
|                             Cristi AI Frontend                                |
|  React 19 + Vite 8 + PixiJS 7 + pixi-live2d-display (Cubism 4/5 Core)        |
+-------------------------------------------------------------------------------+
       |                         |                           |
       v                         v                           v
+------------------+    +-------------------+    +----------------------+
| Live2D Engine    |    | Gemini Live WS    |    | Sensory Vision AI    |
| - Registry       |    | - Bidi Protocol   |    | - Face-API 128D      |
| - Controller     |    | - 24kHz Audio     |    | - COCO-SSD           |
| - Adapter        |    | - Function Call   |    | - Windows Hello IR   |
| - DesktopTracker |    | - Barge-In Sync   |    | - Screen Region      |
+------------------+    +-------------------+    +----------------------+
       |                         |                           |
       +-------------------------+---------------------------+
                                 |
                                 v
+-------------------------------------------------------------------------------+
|                       Neutralino.js Desktop Runtime                           |
|  - Frameless Transparent Window                                               |
|  - Native System Tray & Global Notifications                                  |
|  - Native OS Command Execution & File System Access                           |
+-------------------------------------------------------------------------------+
```

---

## 2. Flujo del Motor Live2D

1. **`Live2DModelRegistry`**:
   - Registra descriptores y perfiles de modelos (`*.profile.js`).
   - Al cargar el archivo `.moc3` y sus texturas en WebGL, realiza introspección en tiempo de ejecución de los parámetros del modelo (`coreModel._parameterIds`), sus rangos numéricos y sus partes (`_partIds`).
   - Normaliza nombres de parámetros en inglés, estándar y CJK.
2. **`Live2DAdapter`**:
   - Mapea identificadores semánticos estándar (`head_angle_x`, `eye_ball_x`, `mouth_open_y`, `breath`) a los parámetros nativos de cada modelo.
   - Aplica interpolación exponencial suavizada (Lerp físico) en cada frame del ticker.
   - Aplica reglas de ocultamiento de partes no deseadas (`hiddenParts: ['Part17']`).
3. **`Live2DController`**:
   - Modela comportamientos orgánicos biológicos: respiración sinusoidal, parpadeo estocástico, microsaccadas oculares, cinética del habla e inclinación de cabeza al hablar.
4. **`DesktopCursorTracker`**:
   - Mantiene la posición del cursor respecto a la pantalla global $(screenX, screenY)$ y el rostro del avatar.
   - Permite que el avatar mantenga la mirada hacia el cursor incluso fuera de los límites de la ventana o con la aplicación en segundo plano.

---

## 3. Flujo de Audio y Gemini Live WebSocket

1. **Entrada de Micrófono**:
   - Captura continua a $16\text{ kHz}$ PCM de 16 bits en Little Endian.
   - Envío mediante mensaje `realtimeInput.mediaChunks` en base64 al servidor de Google.
2. **Salida de Audio y Sincronización**:
   - Recepción de fragmentos de audio a $24\text{ kHz}$ PCM.
   - Decodificación y encolado en `AudioContext`.
   - Extracción de amplitud y frecuencia mediante `AnalyserNode` (FFT) para derivar `lipSyncValue` (0.0 a 1.0) enviado a 60 FPS al `Live2DController`.
3. **Mecanismo de Barge-in**:
   - Al detectar que el usuario comienza a hablar, el cliente cancela la reproducción en curso y emite una señal de interrupción para reiniciar el buffer de voz.
