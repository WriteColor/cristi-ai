# Cristi AI - Plataforma Universal de Asistente IA de Voz a Voz con Live2D & Gemini Live API

**Cristi AI** es una plataforma de asistente virtual y compañera de IA de escritorio construida sobre **Neutralinojs + Vite + React**, potenciada por **Google Gemini Multimodal Live API** (`gemini-3.1-flash-live-preview` y `gemini-2.5-flash-live-preview`), un motor universal de avatares **Live2D Cubism** multi-modelo con físicas cinéticas, seguimiento del cursor por todo el escritorio y visión sensorial en tiempo real.

---

## ✨ Novedades & Capacidades Principales

### 🎭 1. Plataforma Multi-Modelo Live2D Cubism Universal
El sistema desacopla la lógica de animación e interactividad de cualquier modelo específico, permitiendo cargar e interactuar con **8 avatares Live2D oficiales** de forma dinámica:
- 🖤 **Cristi Gótica (`yanderegirl`)**: 13 parámetros cinéticos, expresiones Yandere, Mad, Crazy, Scared.
- 👘 **Ice Girl Cheongsam (`icegirl`)**: Traje tradicional, orejas de gato, alas, sonrojo, ojos de corazón y corona.
- 🌸 **Hiyori (`hiyori`)**: Modelo oficial Cubism Pro con 8 animaciones de movimiento y cinemática completa.
- 🎀 **Miara (`miara`)**: Modelo oficial Cubism Pro con animaciones idle dinámicas.
- 🛡️ **Toki (`toki`)**: Modelo oficial de Blue Archive con seguimiento completo de mirada y busto.
- 🦈 **Ellen Joe (`ellen`)**: Maid tiburón de Zenless Zone Zero (filtrado seguro de marcas de agua `hiddenParts`).
- 🐀 **Jane Doe (`jane_doe`)**: Agente de ZZZ con expresiones faciales y soporte de físicas.
- 🍵 **Ruan Mei (`ruan_mei`)**: Erudita de Honkai: Star Rail con físicas y gestos refinados.

### 🖥️ 2. Seguimiento del Cursor por Todo el Escritorio (*Desktop-Wide Tracking*)
Gracias al servicio centralizado [`DesktopCursorTracker`](file:///c:/React-Nextjs-Projects/Cristi%20AI/src/services/desktop/DesktopCursorTracker.js):
- La mirada y orientación de la cabeza siguen el cursor del usuario **a través de todo el monitor y ventanas externas**, incluso cuando la aplicación está minimizada o fuera de foco.
- Cálculo angular tridimensional respecto a la posición física del rostro del avatar en pantalla.

### 🎙️ 3. Conexión Directa por WebSockets (Gemini Live API)
- Streaming bidireccional de baja latencia con el protocolo `BidiGenerateContent`.
- **Audio 24kHz** de alta fidelidad con Lip-Sync orgánico a 60 FPS mediante Web Audio API FFT.
- Catálogo de **30 voces neuronales** (`Aoede`, `Zephyr`, `Kore`, `Puck`, `Charon`, `Fenrir`, etc.).
- Soporte para **Barge-in / Interrupción instantánea**: si hablas mientras Cristi responde, el audio se detiene inmediatamente.

### 👁️ 4. Visión Sensorial, Reconocimiento Facial & Detección de Objetos
- Integración con `@vladmandic/face-api` (Tiny Face, 68 Landmarks, 128D Descriptor) y `@tensorflow-models/coco-ssd`.
- Registro biométrico multi-muestra del dueño (con lentes, sin lentes, ángulos de perfil).
- Detección de celos Yandere cuando un tercero aparece en cámara junto al usuario.
- Soporte para cámaras Infrarrojas (IR) de Windows Hello.

### ⚙️ 5. Modal de Ajustes y Menú Contextual Ultra-Modernos
- **Modal de Ajustes Ampliado**: Panel Obsidian Glassmorphism con selector de modelos, spotlight con chips de capacidades, selector de 30 voces, slider de temperatura y **área de prompt del sistema autoajustable** con presets rápidos (Yandere, Ellen Joe, Ruan Mei, Hiyori, Hacker, Gamer).
- **Menú Contextual (Click Derecho)**: Acceso rápido a expresiones en vivo (❤️ Sonrojo, 🌸 Feliz, ⚡ Sorpresa, 😉 Guiño, 💃 Bailar, 🖤 Yandere), encuadre (Torso / Cuerpo Completo), visión y control de ventana.

---

## 🏛️ Arquitectura del Sistema

```
                         [ Cristi AI Architecture ]
                                      │
  ┌───────────────────────────────────┼───────────────────────────────────┐
  ▼                                   ▼                                   ▼
[Live2D Engine]             [Gemini Live API]                   [Sensory Vision]
 ├─ Model Registry (8 models) ├─ WebSocket 24kHz Audio Stream     ├─ Face-API 128D Biometrics
 ├─ Live2D Adapter            ├─ 30 Voice Synthesizers            ├─ COCO-SSD Object Detection
 ├─ Organic Controller        ├─ Barge-in Interruption Handler    ├─ IR Camera Enhancer
 └─ DesktopCursorTracker      └─ Function Calling (Tools)         └─ Screen Region Watcher
```

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js (v18+)
- `pnpm` (Nota: en este equipo se utiliza exclusivamente `pnpm`)

### 1. Configuración de Credenciales
Copia `.env.example` a `.env` y configura tu API Key de Google AI Studio:
```bash
cp .env.example .env
```

### 2. Modo Desarrollo Web (Vite)
```bash
pnpm dev
```
Accede en tu navegador Brave: `http://localhost:5173/`

### 3. Modo Aplicación de Escritorio Nativa (Neutralinojs)
```bash
pnpm app:run
```

### 4. Compilar Ejecutable Nativo de Producción (~2.7 MB)
```bash
pnpm app:build
```
El binario ejecutable sin dependencias externas se generará en:
`dist/cristi-ai/cristi-ai-win_x64.exe`

---

## 🧪 Pruebas Automatizadas con Playwright (Video + Audio)

Todas las suites de prueba de Cristi AI se ejecutan con grabación de video HD a 60 FPS y audio habilitado:
- `tests/playwright/test_universal_pointer_tracking.mjs`: Verifica el seguimiento ocular en los 8 modelos.
- `tests/playwright/test_desktop_wide_pointer_tracking.mjs`: Comprueba el tracking en los extremos del monitor fuera de la ventana.
- `tests/playwright/record_e2e_live_demo.mjs`: Demostración integral end-to-end.

Para ejecutar cualquiera de las pruebas:
```bash
node tests/playwright/test_desktop_wide_pointer_tracking.mjs
```

---

## 📚 Documentación Técnica Detallada
- 📖 [Arquitectura y Flujo de Datos](file:///c:/React-Nextjs-Projects/Cristi%20AI/docs/ARCHITECTURE.md)
- 🎭 [Catálogo de Modelos Live2D y Mappings](file:///c:/React-Nextjs-Projects/Cristi%20AI/docs/LIVE2D_MODELS.md)
- 📋 [Plan de Implementación de Modelos](file:///c:/React-Nextjs-Projects/Cristi%20AI/docs/superpowers/plans/2026-08-30-multi-live2d-model-architecture.md)
