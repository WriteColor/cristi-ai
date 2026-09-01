# 🚀 Manual de Instalación y Puesta a Punto desde Cero — Cristi AI Companion
> **Autor:** Write_Color | **Versión:** 1.0.0 | **Motor:** Electron 32 + React 19 + Vite 8 + Live2D Cubism

Esta guía explica paso a paso **cómo instalar, configurar, optimizar y ejecutar Cristi AI Companion** en cualquier entorno Windows 10/11 limpio, desde el clonado inicial hasta el despliegue con aceleración de hardware y observabilidad en tiempo real.

---

## ⚡ Método 1: Instalación Rápida en 1 Clic (Automático)

Si acabas de clonar el proyecto o quieres una configuración 100% libre de errores:

### Opción A (Doble Clic en Explorador de Archivos):
Haz doble clic sobre el archivo **`setup.bat`** en la carpeta raíz del proyecto.

### Opción B (PowerShell):
```powershell
.\setup.ps1
```

Este script automático realiza:
1. Verificación y activación automática de `pnpm` mediante Corepack.
2. Instalación de todas las dependencias con enlace rápido en almacenamiento virtual.
3. Descarga y configuración del runtime nativo de Electron.
4. Generación de iconos multi-resolución de 1024x1024.
5. Verificación de los 8 modelos oficiales de Live2D y 14 redes neuronales.
6. Creación automática del archivo `.env` para la API Key de Gemini Live.

---

## 📋 Método 2: Instalación Manual Paso a Paso

### 1. Requisitos Previos del Sistema

#### Hardware Recomendado
* **Sistema Operativo:** Windows 10 / Windows 11 (64-bit).
* **Procesador:** Intel Core i5 / AMD Ryzen 5 o superior.
* **Memoria RAM:** 8 GB mínimo (16 GB - 32 GB recomendado).
* **GPU:** GPU dedicada o integrada compatible con WebGL 2.0 / DirectX 11+ (NVIDIA GeForce RTX/GTX, AMD Radeon o Intel Iris Xe).
* **Periféricos:** Micrófono (para voz bidireccional) y Webcam opcional (para visión sensorial).

#### Software Base Obligatorio
1. **Node.js**: Versión LTS recomendada `v20.x` o `v22.x` / `v24.x` ([Descargar Node.js](https://nodejs.org/)).
2. **pnpm (Gestor de Paquetes Exclusivo)**:
   * Actívalo con Corepack:
     ```powershell
     corepack enable
     corepack prepare pnpm@latest --activate
     ```
   > ⚠️ **Regla Estricta:** No utilices `npm` ni `yarn` en este proyecto; la arquitectura de dependencias está diseñada y congelada estrictamente para `pnpm`.

---

## 📥 2. Clonación e Instalación de Dependencias

1. Abre tu terminal de **PowerShell** en tu directorio de proyectos:
   ```powershell
   git clone https://github.com/tu-usuario/cristi-ai.git "Cristi AI"
   cd "Cristi AI"
   ```

2. Instala todas las dependencias del proyecto:
   ```powershell
   pnpm install
   ```
   *(El hook `postinstall` configurará automáticamente el runtime de Electron y sincronizará los iconos).*

---

## 🛠️ 3. Inicialización Automática del Entorno (`setup:env`)

Cristi AI Companion incluye un bootstrapper automatizado que comprueba los 7 pilares del entorno en tiempo de ejecución:

```powershell
pnpm run setup:env
```

Este script verifica de inmediato:
* ✅ **Node.js & Plataforma:** Compatibilidad de arquitectura Windows 64-bit y versión de Node.js (v18 - v24).
* ✅ **Gestor de Paquetes:** Cumplimiento estricto del estándar `pnpm`.
* ✅ **Núcleo Live2D Cubism:** Presencia del runtime oficial `live2dcubismcore.min.js` en `public/`.
* ✅ **Catálogo Live2D:** Integridad de los 8 avatares oficiales en `public/models/live2d/`.
* ✅ **Redes Neuronales:** 14 pesos binarios y manifiestos de TensorFlow / Face-API en `public/models/`.
* ✅ **Identidad Visual:** Sincronización y generación de iconos multi-resolución (`.ico` y `1024x1024 .png`) en `resources/icons/` y `public/`.
* ✅ **Motor Electron & .env:** Binario de Electron y variables de entorno para Gemini Live API.

---

## 🔑 4. Configuración de la API Key de Google Gemini Live

Para habilitar la comunicación multimodal de voz a voz en tiempo real con baja latencia:

1. Obtén tu clave de API gratuita en [Google AI Studio](https://aistudio.google.com/).
2. Crea un archivo `.env` en la raíz del proyecto (`C:\React-Nextjs-Projects\Cristi AI\.env`):
   ```env
   VITE_GEMINI_API_KEY=AIzaSyTuClaveDeApiAqui
   ```
3. *(Alternativa)*: Si prefieres no usar un archivo `.env`, puedes ingresar tu clave directamente en el **Modal de Ajustes** de la interfaz gráfica una vez iniciada la aplicación.

---

## 🏃 5. Ejecución en Modo Desarrollo

Inicia el entorno de desarrollo integrado (Vite Dev Server + Shell Nativo de Electron):

```powershell
pnpm run app:dev
```

### ¿Qué sucede al iniciar?
1. Se levanta el servidor de desarrollo local de Vite en `http://localhost:5173`.
2. Se inicia el proceso principal de Electron con aceleración por GPU, ventana transparente sin bordes y click-through selectivo.
3. Cristi aparecerá flotando en la esquina inferior derecha de tu monitor.

---

## 🧪 6. Validación de Salud y Diagnósticos del Sistema

Antes de dar por concluida la instalación, ejecuta la suite maestra de diagnósticos automatizados para verificar que todos los subsistemas responden con un **100% de éxito**:

```powershell
pnpm run test:diagnostics
```

Deberás observar las 11 suites aprobadas con éxito:
* ✅ `Live2D Physics & Kinetics`
* ✅ `Computer Use & Vision`
* ✅ `UI/UX Obsidian & Sound FX`
* ✅ `Audio DSP & Speaker Biometrics`
* ✅ `Proactive Trigger Engine`
* ✅ `Proactive Engine & State Management`
* ✅ `Performance Profiler & Telemetry`
* ✅ `Memory Lifecycle & Zero-Leak Stability`
* ✅ `Electron Architecture & IPC`
* ✅ `Config Persistence & Backup`
* ✅ `Live2D Asset Integrity`

---

## 📦 7. Compilación del Instalador para Producción (.exe)

Para generar el instalador ejecutable de Windows (`Cristi-Desktop-Setup-1.0.0.exe`):

```powershell
pnpm run app:build
```

El instalador final se generará en la carpeta `release/` y creará automáticamente accesos directos en el menú de inicio y en el escritorio con desinstalador limpio en el Panel de Control de Windows.

---

## 🔧 8. Solución de Problemas Frecuentes (*Troubleshooting*)

### 1. "Pérdida de contexto WebGL" o pantalla negra en Live2D
* **Causa:** Controladores gráficos desactualizados o ahorro de energía agresivo en laptops.
* **Solución:** Actualiza los drivers de tu GPU (NVIDIA / AMD / Intel) y asegúrate de que Windows asigne la GPU de alto rendimiento a `electron.exe`.

### 2. El micrófono no se activa o no hay respuesta de voz
* **Causa:** Permisos de privacidad de micrófono en Windows 11 desactivados.
* **Solución:** Ve a *Configuración de Windows $\rightarrow$ Privacidad y seguridad $\rightarrow$ Micrófono* y activa la casilla *"Permitir que las aplicaciones de escritorio accedan al micrófono"*.

### 3. La ventana no permite hacer clic en las aplicaciones de atrás
* **Causa:** El hook de click-through no ha inicializado su estado transparente.
* **Solución:** Mueve el cursor sobre el personaje y luego sal fuera de él hacia el escritorio; el sistema activará inmediatamente el modo transparente `{ forward: true }`.

### 4. Caídas de FPS en reposo o al cambiar de ventana
* **Solución:** Presiona **`F3`** para abrir el panel de telemetría. Verifica que el subsistema Live2D se mantenga a < 3ms. Si cambias de ventana, el anti-throttling automático mantendrá la tasa a 60 FPS.
