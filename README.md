# 🌸 Cristi AI Companion — Asistente IA Multimodal con Live2D & Gemini Multimodal Live API

<div align="center">

![Cristi AI Companion Banner](docs/assets/cristi-banner.jpg)

**Plataforma de compañera de escritorio y asistente agéntica virtual de alto rendimiento construida con Electron 32 + React 19 + Vite 8. Impulsada por Google Gemini Multimodal Live API (gemini-3.1-flash-live-preview, gemini-3-flash-preview y gemini-2.5-flash-native-audio-preview), motor universal de avatares Live2D Cubism con físicas cinéticas invariantes, seguimiento del cursor por todo el escritorio (*Desktop-Wide Tracking*), biometría vocal, visión sensorial, control agéntico del sistema y observabilidad en tiempo real.**

[![Author](https://img.shields.io/badge/Author-Write__Color-FF69B4?logo=visual-studio-code&logoColor=white)](https://github.com/WriteColor)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%20--%20v24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/Package%20Manager-pnpm%20only-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-32.3.3-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Gemini Live](https://img.shields.io/badge/Google%20Gemini-Multimodal%20Live%20API-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
[![Tests](https://img.shields.io/badge/Diagnostics-12%2F12%20PASS-brightgreen?logo=checkmarx&logoColor=white)](#-diagnósticos-y-verificación-automatizada)

</div>

---

## 📑 Tabla de Contenidos
1. [Instalación Rápida en 1 Clic (setup.bat / setup.ps1)](#-instalación-rápida-en-1-clic-setupbat--setupps1)
2. [Arquitectura y Modelos de Inteligencia Artificial](#-arquitectura-y-modelos-de-inteligencia-artificial)
3. [Catálogo Oficial de las 30 Voces Neuronales de Gemini](#-catálogo-oficial-de-las-30-voces-neuronales-de-gemini)
4. [Catálogo Oficial de los 8 Modelos Live2D Cubism](#-catálogo-oficial-de-los-8-modelos-live2d-cubism)
5. [Catálogo de las 26 Herramientas Agénticas](#-catálogo-de-las-26-herramientas-agénticas)
6. [Sistema de Actualización Local y Offline](#-sistema-de-actualización-local-y-offline-zero-network)
7. [Tabla de Atajos de Teclado y Controles](#-tabla-de-atajos-de-teclado-y-controles)
8. [Seguridad y Protección de Claves de API](#-seguridad-y-protección-de-claves-de-api)
9. [Guía de Instalación Manual Paso a Paso](#-guía-de-instalación-manual-paso-a-paso)
10. [Diagnósticos y Verificación Automatizada (12/12 PASS)](#-diagnósticos-y-verificación-automatizada)
11. [Estructura del Repositorio](#-estructura-del-repositorio)
12. [Licencia y Contribución](#-licencia-y-contribución)

---

## ⚡ Instalación Rápida en 1 Clic (setup.bat / setup.ps1)

Para configurar todo el entorno automáticamente sin pasos manuales ni posibilidad de fallo:

* **Windows Explorer:** Haz doble clic en [setup.bat](setup.bat).
* **PowerShell:** Ejecuta .\setup.ps1.

El instalador automático se encarga de habilitar pnpm, instalar dependencias, descargar el motor de Electron, verificar iconos estáticos y validar los 8 modelos de Live2D y 14 redes neuronales.

---

## 🧠 Arquitectura y Modelos de Inteligencia Artificial

Cristi AI Companion se comunica directamente mediante **WebSocket bidireccional S2S (BidiGenerateContent)** con la API en tiempo real de Google Gemini:

| Modelo | ID de API | Especialidad y Capacidades | Latencia / Audio |
|---|---|---|---|
| ⭐ **Gemini 3.1 Flash Live (Predeterminado)** | gemini-3.1-flash-live-preview | Diálogo conversacional de ultra-baja latencia voz a voz, comprensión espacial, visión continua y síntesis afectiva. | ~300ms / 24 kHz |
| 🎮 **Gemini 3 Flash (Control Total de PC)** | gemini-3-flash-preview | Razonamiento agéntico avanzado para operar la computadora, inspeccionar archivos, ejecutar scripts nativos y automatización. | ~450ms / 24 kHz |
| 🎙️ **Gemini 2.5 Flash Native Audio** | gemini-2.5-flash-native-audio-preview-12-2025 | Síntesis afectiva y compatibilidad para sesiones conversacionales estándar con modulación emocional. | ~400ms / 24 kHz |

---

## 🗣️ Catálogo Oficial de las 30 Voces Neuronales de Gemini

Generadas nativamente a **24,000 Hz** con modulación emocional y Lip-Sync orgánico en tiempo real:

### 🔹 Voces Femeninas (16)
| Voz | Rasgo Principal | Descripción Sonora |
|---|---|---|
| 👑 **Aoede (Oficial)** | Dulce, Coqueta & Envolvente | Tono ligero, seductor y muy natural. Voz por defecto de Cristi. |
| **Kore** | Firme, Clara & Equilibrada | Timbre profesional, articulado y confiable. |
| **Leda** | Cálida, Amable & Protectora | Tono maternal y sumamente empático. |
| **Lyra** | Suave, Melódica & Poética | Modulación etérea, ideal para narración y conversación íntima. |
| **Zephyr** | Serena, Aireada & Cristalina | Tono fresco y ligero como una brisa suave. |
| **Ursa** | Resonante, Fuerte & Segura | Presencia vocal con cuerpo acústico y firmeza. |
| **Vega** | Radiante, Alegre & Luminosa | Tono chispeante lleno de optimismo y carisma. |
| **Callisto** | Profunda, Misteriosa & Serena | Matices aterciopelados con cadencia reflexiva. |
| **Ara** | Elegante, Sutil & Sofisticada | Tonalidades suaves con cortesía refinada. |
| **Vela** | Dinámica, Aventurera & Ágil | Ritmo activo y propositivo en cada frase. |
| **Carina** | Luminosa, Expresiva & Emotiva | Alta respuesta afectiva con micro-entonaciones precisas. |
| **Musca** | Vivaz, Curiosa & Espontánea | Tono juguetón y rápido para interacciones divertidas. |
| **Fornax** | Apasionada, Intensa & Creativa | Calidez ardiente con timbre envolvente. |
| **Hydra** | Multifacética & Versátil | Adaptación armónica con rango vocal completo. |
| **Pyxis** | Orientadora, Certera & Precisa | Voz de asistencia con dicción inmaculada. |
| **Gemini Natural** | Equilibrada & Pura | Síntesis neuronal pura optimizada por Google DeepMind. |

### 🔹 Voces Masculinas (14)
| Voz | Rasgo Principal | Descripción Sonora |
|---|---|---|
| **Puck** | Animada, Jovial & Rápida | Tono juvenil y veloz para respuestas dinámicas. |
| **Charon** | Informativa, Sobria & Calma | Pausada, reflexiva y analítica con excelente gravedad. |
| **Fenrir** | Enérgica, Directa & Fuerte | Alta energía con proyección firme e ímpetu. |
| **Orion** | Valiente, Firme & Heroica | Resonancia profunda y presencia imponente. |
| **Pegasus** | Inspiradora, Brillante & Cálida | Timbre motivacional y positivo. |
| **Perseus** | Aguda, Táctica & Decidida | Enfoque ágil en resolución lógica de problemas. |
| **Castor** | Cercana, Amistosa & Confiable | Tono natural y accesible de mejor amigo. |
| **Pollux** | Versátil, Curiosa & Astuta | Rango expresivo flexible para cualquier temática. |
| **Chiron** | Sabia, Mentora & Paciente | Tono de tutor académico con cadencia didáctica. |
| **Eridanus** | Fluida, Elegante & Natural | Modulación relajante y fluida. |
| **Lynx** | Perspicaz & Crítica | Velocidad analítica con agudeza mental. |
| **Indus** | Determinada & Práctica | Voz ejecutiva y concreta con claridad técnica. |
| **Sculptor** | Estructurada & Geométrica | Tono preciso para programación y arquitectura. |
| **Phoenix** | Vibrante, Audaz & Resiliente | Proyección ascendente con energía contagiosa. |

---

## 🎭 Catálogo Oficial de los 8 Modelos Live2D Cubism

Todos los avatares se cargan mediante WebGL 2.0 y PixiJS v7, desacoplados del ciclo de vida reactivo para un consumo mínimo de memoria:

| Avatar | ID Interno | Origen / Estilo | Características Técnicas |
|---|---|---|---|
| 🖤 **Cristi Gótica (Yandere)** | yanderegirl | Original Cristi AI | 13 parámetros cinéticos, físicas de cabello, expresiones lush, yandere, crazy, mad. |
| 👘 **Ice Girl (Cheongsam)** | icegirl | Traje Oriental Tradicional | Orejas de gato, alas animadas, ojos de corazón y corona. |
| 🌸 **Hiyori Momose** | hiyori | Oficial Live2D Cubism Pro | 8 grupos de movimiento, físicas avanzadas de tela y cabello. |
| 🎀 **Miara** | miara | Oficial Live2D Cubism Pro | Gestos de saludo, poses dinámicas y seguimiento ocular. |
| 🛡️ **Toki** | 	oki | Blue Archive | Modo combate, compostura militar y seguimiento de mirada completo. |
| 🦈 **Ellen Joe** | ellen | Zenless Zone Zero | Maid tiburón con cola animada, tijeras y físicas elásticas. |
| 🐀 **Jane Doe** | jane_doe | Zenless Zone Zero | Agente encubierta con cinemática corporal refinada. |
| 🍵 **Ruan Mei** | uan_mei | Honkai: Star Rail | Erudita con instrumento tradicional y túnica con físicas de viento. |

---

## 🛠️ Catálogo de las 26 Herramientas Agénticas

Cristi puede operar e interactuar de forma autónoma mediante llamadas a funciones:

1. **	rigger_companion_gesture**: Expresa emociones faciales en el avatar Live2D activo (love, lush, yandere, etc.).
2. **	rigger_model_motion**: Ejecuta animaciones o poses corporales registradas en el modelo.
3. **move_avatar**: Desplaza al avatar por el escritorio (	op-left, ottom-right, center, etc.).
4. **get_current_time_and_date**: Consulta la hora exacta, zona horaria y calendario local.
5. **get_weather**: Obtiene el pronóstico meteorológico de cualquier ubicación.
6. **system_diagnostics**: Consulta telemetría en tiempo real: CPU, RAM, FPS, Audio y Cámara.
7. **execute_system_command**: Ejecuta comandos nativos en PowerShell o CMD en Windows.
8. **list_running_processes**: Enumera procesos activos en el Administrador de Tareas.
9. **kill_process**: Finaliza procesos bloqueados por PID o nombre.
10. **ead_system_file**: Lee archivos locales de texto o código.
11. **write_system_file**: Crea o sobreescribe archivos en el disco local.
12. **list_directory_contents**: Explora directorios del sistema de archivos.
13. **create_directory**: Crea carpetas y rutas de almacenamiento.
14. **open_file_or_url**: Abre carpetas en el Explorador de Windows o enlaces en el navegador predeterminado.
15. **get_clipboard_content**: Lee el contenido de texto del portapapeles.
16. **set_clipboard_content**: Escribe datos en el portapapeles de Windows.
17. **get_system_specs**: Consulta hardware (GPU, CPU, monitores y memoria total).
18. **computer_action**: Realiza clics de ratón en coordenadas, pulsa teclas o tipea texto (*Computer Use* nativo).
19. **screen_snapshot**: Captura fotogramas completos o regionales a 60 FPS mediante la API nativa de Electron.
20. **show_desktop_widget**: Despliega widgets informativos o temporizadores en pantalla.
21. **manage_notes**: Guarda y consulta notas de memoria a largo plazo.
22. **manage_timers_reminders**: Configura alarmas, temporizadores Pomodoro y recordatorios.
23. **control_media_player**: Controla reproducción multimedia en Windows.
24. **set_screen_scene**: Conmuta entre fondos procedurales, shaders o transparentes.
25. **switch_live2d_avatar**: Cambia dinámicamente entre los 8 modelos de Live2D.
26. **switch_ai_voice**: Cambia la voz neuronal activa entre las 30 disponibles.

---

## 📦 Sistema de Actualización Local y Offline (Zero Network)

Cristi AI Companion **no depende de servidores de actualización externos en internet**:

1. Al compilar una nueva versión con pnpm app:build, el instalador generado (Cristi-AI-Companion-Setup-X.Y.Z.exe) se guarda en la carpeta local elease/.
2. La aplicación instalada detecta automáticamente en disco si existe una versión superior en la carpeta del proyecto.
3. Desde la pestaña **Ajustes $\rightarrow$ Actualizaciones**, basta con presionar **"Reiniciar e Instalar Actualización"** para actualizar la app localmente con privilegios de Administrador.

---

## ⌨️ Tabla de Atajos de Teclado y Controles

| Atajo / Control | Tipo | Acción / Comportamiento |
|---|---|---|
| **Ctrl + Shift + C** | Global (Sistema) | **Boss Key / Modo Residente**: Oculta o muestra a Cristi al instante (0% GPU/CPU al ocultarse). |
| **Ctrl + Shift + H** | Global (Sistema) | **Ocultar / Mostrar UI (Modo Zen Global)**: Alterna la interfaz visible desde cualquier app. |
| **Ctrl + Shift + P** | Global (Sistema) | **Telemetría & Profiler (HUD Global)**: Abre/Cierra el panel de FPS y memoria desde cualquier ventana. |
| **Ctrl + Shift + A** | Global (Sistema) | **Fijar Siempre Visible (Always-on-Top)**: Conmuta el anclaje de ventana prioritario. |
| **Ctrl + Shift + M** | Global (Sistema) | **Silenciar Micrófono**: Activa o silencia la captura de voz con confirmación sonora. |
| **Ctrl + Shift + S** | Global (Sistema) | **Visión Instantánea**: Captura la pantalla activa y la envía a Gemini Live. |
| **F3** | Interfaz (App) | **Performance Profiler HUD**: Alterna el panel de telemetría de rendimiento y TPS. |
| **H / h** | Interfaz (App) | **Modo Zen Local**: Oculta los controles flotantes. |
| **Escape** | Interfaz (App) | **Cerrar Modales**: Cierra cualquier menú contextual, modal de ajustes o diálogo. |
| **Clic Izquierdo** | Ratón sobre Avatar | Dispara una **reacción emocional aleatoria** adaptada al personaje activo. |
| **Clic Izq. + Arrastre** | Ratón sobre Avatar | **Mueve a Cristi** por cualquier parte de tu monitor con arrastre nativo. |
| **Rueda del Ratón** | Ratón sobre Avatar | **Escalado dinámico** suave del modelo ( .25x a 4.0x). |
| **Clic Derecho** | Ratón sobre Avatar | Despliega el **Menú Contextual Táctico Obsidian**. |

---

## 🔒 Seguridad y Protección de Claves de API

* **Cero Hardcoding:** El código fuente no contiene claves de API ni credenciales privadas.
* **Almacenamiento Seguro:** La clave VITE_GEMINI_API_KEY se carga únicamente desde tu archivo .env local (ignorado en .gitignore) o mediante el almacenamiento cifrado de configuración del usuario en su equipo.
* **Obtención de Clave Gratuita:** Puedes generar tu API Key gratuita en [Google AI Studio](https://aistudio.google.com/).

---

## 🚀 Guía de Instalación Manual Paso a Paso

### 1. Requisitos Previos
* **Windows 10 / 11 (64-bit)**
* **Node.js**: Versión LTS 20.x, 22.x o 24.x ([Descargar Node.js](https://nodejs.org/))
* **pnpm**: Gestor de paquetes obligatorio. Actívalo con Corepack:
  `powershell
  corepack enable
  corepack prepare pnpm@latest --activate
  `

### 2. Clonar e Instalar Dependencias
`powershell
git clone https://github.com/WriteColor/cristi-ai.git "Cristi AI"
cd "Cristi AI"
pnpm install
`

### 3. Inicializar y Validar el Entorno
`powershell
pnpm run setup:env
`

### 4. Configurar la API Key
Crea tu archivo .env en la raíz del proyecto:
`env
VITE_GEMINI_API_KEY=tu_clave_de_aistudio_aqui
`

### 5. Iniciar en Modo Desarrollo
`powershell
pnpm run app:dev
`

### 6. Compilar el Instalador de Producción (.exe)
`powershell
pnpm run app:build
`
El instalador NSIS standalone (Cristi-AI-Companion-Setup-1.0.0.exe) se generará en la carpeta elease/.

---

## 🧪 Diagnósticos y Verificación Automatizada

Ejecuta la suite maestra de 12 pruebas automatizadas para certificar la integridad del sistema:

`powershell
pnpm run test:diagnostics
`

`
================================================================
📊 RESUMEN DE LA EJECUCIÓN MAESTRA DE DIAGNÓSTICOS
================================================================
┌─────────┬──────────────────────────────────────────┬────────┬──────────┬──────────────────────────┐
│ (index) │ name                                     │ status │ duration │ details                  │
├─────────┼──────────────────────────────────────────┼────────┼──────────┼──────────────────────────┤
│ 0       │ 'Live2D Physics & Kinetics'              │ 'PASS' │ '135ms'  │ '100% exitoso'           │
│ 1       │ 'Computer Use & Vision'                  │ 'PASS' │ '127ms'  │ '100% exitoso'           │
│ 2       │ 'UI/UX Obsidian & Sound FX'              │ 'PASS' │ '108ms'  │ '100% exitoso'           │
│ 3       │ 'Audio DSP & Speaker Biometrics'         │ 'PASS' │ '261ms'  │ '100% exitoso'           │
│ 4       │ 'Proactive Trigger Engine'               │ 'PASS' │ '5154ms' │ '100% exitoso'           │
│ 5       │ 'Proactive Engine & State Management'    │ 'PASS' │ '160ms'  │ '100% exitoso'           │
│ 6       │ 'Performance Profiler & Telemetry'       │ 'PASS' │ '120ms'  │ '100% exitoso'           │
│ 7       │ 'Memory Lifecycle & Zero-Leak Stability' │ 'PASS' │ '170ms'  │ '100% exitoso'           │
│ 8       │ 'Adversarial Integrity & Regressions'    │ 'PASS' │ '248ms'  │ '100% exitoso'           │
│ 9       │ 'Electron Architecture & IPC'            │ 'PASS' │ '123ms'  │ '100% exitoso'           │
│ 10      │ 'Config Persistence & Backup'            │ 'PASS' │ '12ms'   │ 'Export/Import validado' │
│ 11      │ 'Live2D Asset Integrity'                 │ 'PASS' │ '18ms'   │ '8 modelos registrados'  │
└─────────┴──────────────────────────────────────────┴────────┴──────────┴──────────────────────────┘
🎉 12/12 SUITES COMPLETADAS CON ÉXITO (100% PASS)
`

---

## 🏛️ Estructura del Repositorio

`
Cristi AI/
├── electron/                       # Proceso principal nativo de Electron
│   ├── main.cjs                    # Ventana transparente, atajos globales, IPC, actualizador local
│   └── preload.cjs                 # Puente ContextBridge seguro con el renderizador
├── public/                         # Recursos estáticos servidos en tiempo de ejecución
│   ├── live2dcubismcore.min.js     # Runtime oficial de Live2D Cubism Core
│   ├── models/                     # Pesos binarios y manifiestos de TensorFlow / Face-API
│   └── models/live2d/              # 8 carpetas con modelos oficiales Live2D Cubism
├── resources/                      # Iconos de aplicación (.ico, .png)
├── scripts/                        # Scripts de bootstrapper y hooks de instalación
│   ├── postinstall-setup.cjs       # Hook automático postinstall
│   ├── prebuild-electron.cjs       # Preparación de binarios y cachés NSIS
│   └── setup-clean-env.cjs         # Bootstrapper y verificador de 7 pilares
├── src/                            # Aplicación Frontend en React 19 + Vite 8
│   ├── components/                 # Componentes UI (Live2DCanvas, SettingsModal, ContextMenu, etc.)
│   ├── config/                     # Configuración de modelos (3), voces (30), herramientas (26) y escenas
│   ├── hooks/                      # Hooks React (useClickThrough, usePerformance, etc.)
│   ├── services/                   # Servicios (Live2DController, GeminiLiveSocket, AudioDSP, Vision)
│   ├── App.jsx                     # Orquestador raíz de la aplicación
│   └── index.css                   # Sistema de diseño futurista Obsidian Cyberpunk (Zero-Lag)
├── tests/                          # 12 suites de diagnósticos automatizados
├── docs/                           # Documentación técnica completa
├── electron-builder.config.cjs     # Configuración del instalador NSIS de 64-bit
├── setup.bat / setup.ps1           # Instaladores automáticos en 1 clic
├── CONTRIBUTING.md                  # Guía para contribuidores open-source
├── LICENSE                         # Licencia MIT oficial
└── package.json                    # Manifiesto de paquetes y scripts de pnpm
`

---

## 📄 Licencia y Contribución

Este proyecto es de código abierto y está distribuido bajo la [Licencia MIT](LICENSE).
Para contribuir con mejoras, optimizaciones o nuevos avatares, consulta [CONTRIBUTING.md](CONTRIBUTING.md).

<div align="center">
Creado y mantenido por <b>Write_Color</b>.
</div>
