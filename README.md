# 🌸 Cristi AI Companion — Asistente IA Multimodal con Live2D & Gemini Live API

<div align="center">

![Cristi AI Companion Banner](docs/assets/cristi-banner.jpg)

**Plataforma de compañera de escritorio y asistente virtual de alto rendimiento construida con Electron + React 19 + Vite 8, impulsada por Google Gemini Multimodal Live API (`gemini-2.5-flash` / `gemini-2.0-flash`), motor universal de avatares Live2D Cubism con físicas cinéticas, seguimiento del cursor por todo el escritorio (*Desktop-Wide Tracking*), biometría vocal, visión sensorial y observabilidad en tiempo real estilo Minecraft TPS.**

[![Author](https://img.shields.io/badge/Author-Write__Color-FF69B4?logo=visual-studio-code&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-v18%20--%20v24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/Package%20Manager-pnpm%20only-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-32.3.3-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Gemini Live](https://img.shields.io/badge/Google%20Gemini-Multimodal%20Live%20API-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
[![Tests](https://img.shields.io/badge/Diagnostics-12%2F12%20PASS-brightgreen?logo=checkmarx&logoColor=white)](#-diagnósticos-y-verificación-automatizada)

</div>

---

## 📑 Tabla de Contenidos
1. [Instalación Rápida en 1 Clic](#-instalación-rápida-en-1-clic-setupbat--setupps1)
2. [Características Principales](#-características-principales)
3. [Tabla de Atajos de Teclado y Controles](#-tabla-de-atajos-de-teclado-y-controles)
4. [Guía de Instalación Manual Paso a Paso](#-guía-de-instalación-manual-paso-a-paso)
5. [Estructura del Proyecto](#-estructura-del-proyecto)
6. [Catálogo de Modelos Live2D Oficiales](#-catálogo-de-modelos-live2d-oficiales)
7. [Catálogo de 26 Herramientas y Acceso al Sistema](#-catálogo-de-26-herramientas-y-acceso-al-sistema)
8. [Escenas de Fondo y Shaders Dinámicos](#-escenas-de-fondo-y-shaders-dinámicos)
9. [Centro de Observabilidad y Telemetría (`F3`)](#-centro-de-observabilidad-y-telemetría-f3)
10. [Diagnósticos y Verificación Automatizada](#-diagnósticos-y-verificación-automatizada)
11. [Documentación Técnica Detallada](#-documentación-técnica-detallada)

---

## ⚡ Instalación Rápida en 1 Clic (`setup.bat` / `setup.ps1`)

Para configurar todo el entorno automáticamente sin pasos manuales ni posibilidad de fallo:

* **Windows Explorer:** Haz doble clic en [`setup.bat`](file:///C:/React-Nextjs-Projects/Cristi%20AI/setup.bat).
* **PowerShell:** Ejecuta `.\setup.ps1`.

El instalador automático se encarga de habilitar `pnpm`, instalar dependencias, descargar el motor de Electron, compilar iconos y verificar los modelos de IA.

---

## 🚀 Guía de Instalación Manual Paso a Paso

### 1. Requisitos Previos
* **Windows 10 / 11 (64-bit)**
* **Node.js**: Versión LTS `v20.x` o `v22.x` / `v24.x` ([Descargar](https://nodejs.org/))
* **pnpm**: Gestor de paquetes obligatorio. Para activarlo con Corepack:
  ```powershell
  corepack enable
  corepack prepare pnpm@latest --activate
  ```

### 2. Clonar e Instalar Dependencias
```powershell
git clone https://github.com/tu-usuario/cristi-ai.git "Cristi AI"
cd "Cristi AI"
pnpm install
```

### 3. Inicializar y Validar el Entorno
Ejecuta el verificador y bootstrapper de recursos e IA:
```powershell
pnpm run setup:env
```

### 4. Configurar la API Key de Gemini Live
Obtén tu clave gratuita en [Google AI Studio](https://aistudio.google.com/) e introdúcela en tu `.env` o en los Ajustes de la App:
```env
VITE_GEMINI_API_KEY=AIzaSyTuClaveDeApiAqui
```

### 5. Iniciar en Modo Desarrollo
```powershell
pnpm run app:dev
```

### 6. Compilar el Instalador de Producción (.exe)
```powershell
pnpm run app:build
```
El instalador NSIS standalone (`Cristi-AI-Companion-Setup-1.0.0.exe`) se generará en la carpeta `release/`.

> 📖 *Para una guía extendida de instalación y resolución de errores, consulta [INSTALLATION_GUIDE.md](docs/INSTALLATION_GUIDE.md).*

---

## 🏛️ Estructura del Proyecto

```
Cristi AI/
├── electron/                       # Proceso principal nativo de Electron
│   ├── main.cjs                    # Ventana transparente, atajos globales, IPC, anti-throttling
│   └── preload.cjs                 # Puente ContextBridge seguro con el renderizador
├── public/                         # Recursos estáticos servidos en tiempo de ejecución
│   ├── live2dcubismcore.min.js     # Núcleo oficial Live2D Cubism Core
│   ├── models/                     # Pesos de redes neuronales Face-API y TensorFlow
│   ├── yanderegirl/ ...            # 8 carpetas con modelos Live2D oficiales (.moc3, texturas, physics)
│   └── audio/                      # Efectos de sonido procedurales y clicks
├── resources/                      # Iconos de aplicación (.ico, .png, .svg)
├── scripts/                        # Scripts de soporte y generación de assets
├── src/                            # Aplicación Frontend en React 19 + Vite 8
│   ├── components/                 # Componentes UI (Live2DCanvas, PerformanceHUD, ContextMenu, etc.)
│   ├── config/                     # Catálogo de modelos, voces neuronales, herramientas y escenas
│   ├── hooks/                      # Hooks React (useClickThrough, usePerformance, etc.)
│   ├── services/                   # Servicios lógicos del sistema
│   │   ├── profiler/               # PerformanceProfilerService (Observabilidad TPS/FPS)
│   │   ├── live2d/                 # Live2DController, Live2DAdapter, Live2DPhysicsEngine
│   │   ├── audio/                  # SpeakerRecognitionService, AudioInputService, AudioOutputService
│   │   ├── desktop/                # DesktopCursorTracker, ElectronBridge, LockScreenService
│   │   └── visionDetectionService.js # Visión artificial y reconocimiento facial
│   ├── App.jsx                     # Componente raíz orquestador
│   ├── index.css                   # Sistema de diseño futurista Obsidian Cyberpunk
│   └── main.jsx                    # Punto de entrada de React
├── tests/                          # Suite de 11 pruebas y diagnósticos automatizados
├── docs/                           # Documentación técnica completa
├── electron-builder.config.cjs     # Configuración del instalador NSIS de 64-bit
├── package.json                    # Dependencias y scripts de pnpm
└── vite.config.js                  # Configuración de empaquetado Vite 8
```

---

## 🎭 Catálogo de Modelos Live2D Oficiales

Cristi AI Companion integra un catálogo de **8 modelos Live2D Cubism** con perfiles cinéticos y físicos adaptados:

| Modelo | ID Interno | Origen / Estilo | Características y Expresiones |
|---|---|---|---|
| 🖤 **Cristi Gótica** | `yanderegirl` | Original Cristi AI | Personalidad gótica/yandere, 13 parámetros cinéticos, expresiones `mad`, `crazy`, `blush`. |
| 👘 **Ice Girl** | `icegirl` | Cheongsam Tradicional | Traje oriental, orejas de gato, alas, ojos de corazón, sonrojo y corona. |
| 🌸 **Hiyori Momose** | `hiyori` | Oficial Live2D Cubism Pro | 8 grupos de animación de movimiento, físicas avanzadas de cabello y ropa. |
| 🎀 **Miara** | `miara` | Oficial Live2D Cubism Pro | Animaciones dinámicas de saludo, alegría y gestos tiernos. |
| 🛡️ **Toki** | `toki` | Blue Archive | Seguimiento de mirada completo, expresiones de combate y compostura. |
| 🦈 **Ellen Joe** | `ellen` | Zenless Zone Zero | Maid tiburón de ZZZ con cola animada y expresiones características. |
| 🐀 **Jane Doe** | `jane_doe` | Zenless Zone Zero | Agente encubierta de ZZZ con cinemática corporal y gestos refinados. |
| 🍵 **Ruan Mei** | `ruan_mei` | Honkai: Star Rail | Erudita de Star Rail con instrumento tradicional y físicas de tela fluidas. |

---

## 🛠️ Catálogo de 25 Herramientas y Acceso al Sistema

Cristi puede ejecutar tareas de forma autónoma mediante llamadas a funciones de Gemini Live:

1. **`trigger_companion_gesture`**: Cambia su expresión facial o estado emocional.
2. **`trigger_model_motion`**: Ejecuta una animación o pose de movimiento del avatar.
3. **`move_avatar`**: Se desplaza a cualquier esquina de la pantalla.
4. **`execute_system_command`**: Ejecuta cualquier comando en PowerShell o CMD en Windows.
5. **`read_file`** / **`write_file`**: Lee o escribe archivos en el disco duro.
6. **`list_directory`**: Explora archivos y carpetas del sistema.
7. **`get_clipboard`** / **`set_clipboard`**: Lee o escribe en el portapapeles de Windows.
8. **`get_running_processes`** / **`kill_process`**: Monitorea o finaliza procesos de Windows.
9. **`open_file_or_folder`** / **`open_system_app_or_link`**: Abre carpetas en el Explorador o URLs en el navegador.
10. **`computer_action`**: Realiza clics de ratón en coordenadas, pulsa teclas o escribe texto (*Computer Use*).
11. **`capture_camera_snapshot`**: Captura un fotograma de la webcam para análisis visual.
12. **`get_sensory_vision_status`**: Consulta el estado de presencia y objetos frente a la pantalla.
13. **`set_screen_region`** / **`set_screen_watch`**: Monitoriza visualmente un área de la pantalla.
14. **`interact_minecraft_game`**: Consulta vida, inventario y posición en un servidor local de Minecraft.
15. **`send_external_device_signal`**: Envía señales a dispositivos IoT o microcontroladores.
16. **`start_focus_timer`**: Inicia un temporizador Pomodoro con acompañamiento.
17. **`trigger_desktop_widget`**: Despliega widgets interactivos en el escritorio.
*(Y más...)*

> 📖 *Para ver la referencia completa de parámetros, consulta [TOOLS_AND_CAPABILITIES.md](docs/TOOLS_AND_CAPABILITIES.md).*

---

## 🌌 Escenas de Fondo y Shaders Dinámicos

Además del modo transparente, Cristi puede generar fondos animados con shaders:
* **Transparente Puro**: Modo flotante sobre el escritorio.
* **Matrix Rain**: Lluvia de código binario verde estilo terminal hacker.
* **Cyber Grid 3D**: Cuadrícula de perspectiva cyberpunk con niebla.
* **Neon City**: Gradiente retro-futurista con iluminación dinámica.
* **Cozy Room**: Escena cálida y relajante para sesiones de estudio.
* **Zen Temple**: Templo nocturno con luna brillante.
* **Wallpaper Personalizado**: Carga de imágenes locales en alta definición.

---

## 📊 Centro de Observabilidad y Telemetría (`F3`)

Presiona **`F3`** o selecciona *Telemetría & FPS* en el menú contextual para activar el panel de observabilidad en tiempo real:

```
+-------------------------------------------------------------------------------+
| CRISTI TELEMETRY // OBSERVABILITY ENGINE (F3)                      [PROD V2.0] |
+-------------------------------------------------------------------------------+
| FRAMES & PACING: 60 FPS (60 TPS / 16.6ms)     MEMORIA: 142 MB Heap (RSS: 210MB) |
| 99p Frame Time: 16.8ms | Drops: 0             Límite Heap: 4096 MB            |
+-------------------------------------------------------------------------------+
| ATRIBUCIÓN DE COSTES POR SUBSISTEMA (CPU / GPU)                              |
| - Live2D Avatar & Físicas:    [████████░░░░░░░░]  2.1 ms                      |
| - Audio DSP & Voice Stream:   [████░░░░░░░░░░░░]  0.4 ms                      |
| - Visión Sensorial:           [░░░░░░░░░░░░░░░░]  0.0 ms (Bajo demanda)       |
| - React 19 UI & Hit-Testing:  [██░░░░░░░░░░░░░░]  0.2 ms                      |
+-------------------------------------------------------------------------------+
| HISTORIAL DE ESTABILIDAD (Últimos 60 segundos)                                |
| [ |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| ] |
+-------------------------------------------------------------------------------+
```

* **Medición de TPS / FPS**: Control del ritmo de frames en tiempo real.
* **Monitoreo Dual de Memoria**: Memoria JS Heap de V8 y memoria RSS del proceso nativo de Windows.
* **Atribución de Tiempos**: Coste en milisegundos de cada subsistema por fotograma.
* **Detección Autónoma de Anomalías**: Alertas visuales inmediatas ante caídas de framerate o picos de memoria.

---

## 🧪 Diagnósticos y Verificación Automatizada

Ejecuta la suite completa de 11 diagnósticos automatizados para certificar el estado del sistema:

```powershell
pnpm run test:diagnostics
```

Resultado verificado:
```
================================================================
🔬 CRISTI DESKTOP - SUITE MAESTRA DE DIAGNÓSTICO Y PRODUCCIÓN
================================================================
┌─────────┬──────────────────────────────────────────┬────────┬──────────┬──────────────────────────┐
│ (index) │ name                                     │ status │ duration │ details                  │
├─────────┼──────────────────────────────────────────┼────────┼──────────┼──────────────────────────┤
│ 0       │ 'Live2D Physics & Kinetics'              │ 'PASS' │ '149ms'  │ '100% exitoso'           │
│ 1       │ 'Computer Use & Vision'                  │ 'PASS' │ '145ms'  │ '100% exitoso'           │
│ 2       │ 'UI/UX Obsidian & Sound FX'              │ 'PASS' │ '121ms'  │ '100% exitoso'           │
│ 3       │ 'Audio DSP & Speaker Biometrics'         │ 'PASS' │ '287ms'  │ '100% exitoso'           │
│ 4       │ 'Proactive Trigger Engine'               │ 'PASS' │ '5162ms' │ '100% exitoso'           │
│ 5       │ 'Proactive Engine & State Management'    │ 'PASS' │ '160ms'  │ '100% exitoso'           │
│ 6       │ 'Performance Profiler & Telemetry'       │ 'PASS' │ '103ms'  │ '100% exitoso'           │
│ 7       │ 'Memory Lifecycle & Zero-Leak Stability' │ 'PASS' │ '146ms'  │ '100% exitoso'           │
│ 8       │ 'Electron Architecture & IPC'            │ 'PASS' │ '111ms'  │ '100% exitoso'           │
│ 9       │ 'Config Persistence & Backup'            │ 'PASS' │ '12ms'   │ 'Export/Import validado' │
│ 10      │ 'Live2D Asset Integrity'                 │ 'PASS' │ '18ms'   │ '8 modelos registrados'  │
└─────────┴──────────────────────────────────────────┴────────┴──────────┴──────────────────────────┘
🎉 TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO EN 6.39s
🚀 Cristi AI Companion está 100% lista para producción y distribución NSIS.
================================================================
```

---

## 📚 Documentación Técnica Detallada

* 🚀 [**Guía de Instalación desde Cero (`INSTALLATION_GUIDE.md`)**](docs/INSTALLATION_GUIDE.md): Paso a paso detallado para configurar el entorno en Windows.
* ⌨️ [**Guía de Atajos de Teclado y Controles (`SHORTCUTS_AND_CONTROLS.md`)**](docs/SHORTCUTS_AND_CONTROLS.md): Referencia exhaustiva de todos los atajos globales y locales.
* 🛠️ [**Catálogo de Herramientas y Computer Use (`TOOLS_AND_CAPABILITIES.md`)**](docs/TOOLS_AND_CAPABILITIES.md): Detalle técnico de las 25 funciones de herramientas de Gemini Live.
* 🏛️ [**Arquitectura e Ingeniería de Rendimiento (`ARCHITECTURE.md`)**](docs/ARCHITECTURE.md): Diagramas de capas, ciclo de vida de WebGL, DSP de audio y anti-throttling.
* 🎭 [**Modelos Live2D y Perfiles Cinéticos (`LIVE2D_MODELS.md`)**](docs/LIVE2D_MODELS.md): Especificación técnica de parámetros y mapeos de los 8 avatares.

---

<div align="center">
Desarrollado con ❤️ para llevar la experiencia de asistentes IA y compañeras virtuales al máximo nivel de rendimiento y estabilidad en Windows 11.
</div>
