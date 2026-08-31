# Cristi Desktop — Asistente IA Multimodal con Live2D & Gemini Live API

**Cristi Desktop** es una plataforma de asistente virtual y compañera de escritorio de alto rendimiento construida con **Electron + React 19 + Vite 8**, potenciada por **Google Gemini Multimodal Live API** (`gemini-2.5-flash` / `gemini-2.0-flash`), un motor universal de avatares **Live2D Cubism** multi-modelo con físicas cinéticas, seguimiento del cursor por todo el escritorio (*Desktop-Wide Tracking*), verificación biométrica vocal y visión sensorial en tiempo real.

---

## ✨ Características Principales

### 🖥️ 1. Ventana Transparente con Click-Through Selectivo (Estilo Desktop Mate / Your Wife)
- **Modo Compañera Flotante**: Cristi flota sobre tu escritorio de Windows 11 sin marcos ni barras de título.
- **Interacción Total con el Sistema Detrás**: Las áreas transparentes del fondo pasan todos los clics directamente a tus ventanas, carpetas y aplicaciones del sistema operativo.
- **Barra de Tareas 100% Accesible**: Al deslizar el cursor al borde inferior de la pantalla, la barra de tareas de Windows se muestra inmediatamente.
- **Hook `useClickThrough`**: Los elementos interactivos (el personaje Live2D, menú contextual, modal de ajustes, widgets y botones) reciben interacción total al posar el cursor sobre ellos.
- **Drag & Scale**: Arrastra a Cristi por la pantalla con arrastre nativo (`setPointerCapture`) y usa la rueda del ratón (`wheel`) sobre el personaje para cambiar su escala suavemente.

### 🎭 2. Motor Universal de Avatares Live2D Cubism
Soporte multi-modelo dinámico con 8 avatares oficiales y cinemática en tiempo real:
- 🖤 **Cristi Gótica (`yanderegirl`)**: Expresiones Yandere, Mad, Crazy, Scared con 13 parámetros cinéticos.
- 👘 **Ice Girl Cheongsam (`icegirl`)**: Traje tradicional, orejas de gato, alas, sonrojo, ojos de corazón y corona.
- 🌸 **Hiyori (`hiyori`)**: Modelo oficial Cubism Pro con 8 animaciones de movimiento y cinemática completa.
- 🎀 **Miara (`miara`)**: Modelo oficial Cubism Pro con animaciones idle dinámicas.
- 🛡️ **Toki (`toki`)**: Modelo de Blue Archive con seguimiento completo de mirada y busto.
- 🦈 **Ellen Joe (`ellen`)**: Maid tiburón de Zenless Zone Zero.
- 🐀 **Jane Doe (`jane_doe`)**: Agente de ZZZ con expresiones faciales y soporte de físicas.
- 🍵 **Ruan Mei (`ruan_mei`)**: Erudita de Honkai: Star Rail con físicas y gestos refinados.

### 🎙️ 3. Conexión WebSocket S2S de Baja Latencia (Gemini Live API)
- Streaming bidireccional de voz a voz en tiempo real con el protocolo `BidiGenerateContent`.
- **Audio 24kHz** de alta fidelidad con Lip-Sync orgánico a 60 FPS mediante Web Audio API FFT.
- Catálogo de **30 voces neuronales** (`Aoede`, `Zephyr`, `Kore`, `Puck`, `Charon`, `Fenrir`, etc.).
- Soporte para **Barge-in / Interrupción instantánea**: si hablas mientras Cristi responde, el audio se detiene de inmediato.

### 🔐 4. Biometría Vocal & Reconocimiento de Hablante (*Voice ID*)
- Identificación biométrica del usuario principal mediante análisis espectral y centroides armónicos.
- Asistente de calibración y enrolamiento de voz multi-muestra (`VoiceEnrollmentModal`).
- Silenciamiento preventivo automático cuando interviene un tercero no autorizado.

### 👁️ 5. Visión Sensorial, Reconocimiento Facial & Detección de Objetos
- Integración con `@vladmandic/face-api` (Tiny Face, 68 Landmarks, 128D Descriptor) y `@tensorflow-models/coco-ssd`.
- Registro biométrico multi-muestra del dueño.
- Soporte para cámaras Infrarrojas (IR) de Windows Hello y captura regional de pantalla.

### 🛡️ 6. Companion en Pantalla de Bloqueo de Windows 11
- Notificaciones WinRT en pantalla de bloqueo (`Win + L`) para alarmas y recordatorios generados por Cristi.
- Simulador sandbox interactivo para pruebas de diseño y visualización.

### ⌨️ 7. Atajos de Teclado Globales (*Global System Shortcuts*)
- **`Ctrl + Shift + C` (Boss Key / Modo Residente)**: Oculta o muestra a Cristi al instante sobre el escritorio.
- **`Ctrl + Shift + M` (Silenciar Micrófono)**: Activa o desactiva el micrófono con feedback táctil.
- **`Ctrl + Shift + S` (Visión Contextual Instantánea)**: Captura la pantalla activa y la envía inmediatamente a Cristi para análisis visual proactivo.

### 💾 8. Persistencia, Copias de Seguridad y Portabilidad
- Auto-guardado con historial de puntos de restauración en `localStorage`.
- Exportación e importación de perfiles completos de configuración en formato JSON desde el modal de ajustes.

---

## 🏛️ Estructura del Proyecto

```
Cristi AI/
├── electron/                   # Núcleo de proceso Electron
│   ├── main.cjs                # Proceso principal (ventana transparente, IPC, tray, shortcuts)
│   └── preload.cjs             # ContextBridge seguro hacia el renderer
├── public/                     # Modelos de IA, pesos y assets estáticos
│   ├── models/                 # Pesos TensorFlow y Face-API
│   └── yanderegirl/ ...        # Recursos Live2D de modelos
├── resources/                  # Iconos multiplataforma (.ico, .png, .svg)
├── scripts/                    # Utilidades y bootstrappers
│   ├── generate-icons.cjs      # Generador automatizado de iconos
│   └── setup-clean-env.cjs     # Preparador de entorno limpio
├── src/                        # Aplicación React 19 + Vite
│   ├── components/             # Componentes UI con useClickThrough y accesibilidad
│   ├── config/                 # Configuraciones de modelos, voces y herramientas
│   ├── hooks/                  # Hooks React (useClickThrough, etc.)
│   └── services/               # Servicios (ElectronBridge, Live2D, SoundFx, ConfigManager)
├── tests/                      # Suites de prueba y verificación E2E
│   ├── run_all_diagnostics.mjs # Suite maestra de diagnósticos y producción
│   ├── test_electron_architecture.mjs
│   ├── test_live2d_physics_and_kinetics.mjs
│   ├── test_computer_use_and_vision.mjs
│   ├── test_ui_ux_zen_and_soundfx.mjs
│   └── test_speaker_recognition.mjs
├── electron-builder.config.cjs # Configuración de instalador de Windows (NSIS)
├── package.json
└── vite.config.js
```

---

## 🚀 Inicio Rápido

### Requisitos
- **Node.js**: v18+ (v24 recomendado)
- **pnpm**: Gestor de paquetes oficial del proyecto

### 1. Preparar el Entorno Limpio
Ejecuta el bootstrapper automatizado que verifica dependencias, modelos de IA e iconos:
```powershell
pnpm run setup:env
```

### 2. Configuración de API Key
Crea tu archivo `.env` en la raíz del proyecto o configúralo desde el modal de ajustes:
```env
VITE_GEMINI_API_KEY=tu_api_key_aqui
```

### 3. Modo Desarrollo (Vite + Electron)
Inicia el servidor de desarrollo y el shell transparente de Electron:
```powershell
pnpm run app:dev
```

### 4. Empaquetar Instalador de Windows (.exe)
Genera el instalador NSIS standalone de 64 bits para Windows (`Cristi-Desktop-Setup-1.0.0.exe`):
```powershell
pnpm run app:build
```
El instalador generado se ubicará en el directorio `release/`.

---

## 🧪 Pruebas y Diagnósticos Automatizados

Ejecuta la suite maestra de diagnósticos que valida todos los componentes del sistema:
```powershell
pnpm run test:diagnostics
```
O ejecuta las suites individuales:
```powershell
# Verificar arquitectura de Electron y contratos IPC
node tests/test_electron_architecture.mjs

# Verificar motor físico y cinemática Live2D 2.0
node tests/test_live2d_physics_and_kinetics.mjs

# Verificar herramientas de uso de computadora y visión
node tests/test_computer_use_and_vision.mjs

# Verificar UI/UX, Modo Zen y sonidos procedurales
node tests/test_ui_ux_zen_and_soundfx.mjs

# Verificar biometría de voz y reconocimiento de hablante
node tests/test_speaker_recognition.mjs
```

