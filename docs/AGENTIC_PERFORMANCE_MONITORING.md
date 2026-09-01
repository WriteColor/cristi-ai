# 🔬 Monitoreo Agéntico de Rendimiento (APM Interno con Playwright & CDP) — Cristi AI Companion
> **Autor:** Write_Color | **Versión:** 1.0.0 | **Protocolo:** Chrome DevTools Protocol (CDP) sobre 127.0.0.1

---

## 🏛️ 1. Filosofía Arquitectural & Tres Reglas Innegociables

Este subsistema implementa un **Agente de Rendimiento de Cero Overhead (Zero-Overhead APM)** capaz de conectarse dinámicamente a la instancia de Cristi AI Companion en ejecución (tanto en modo desarrollo como empaquetada en producción) para diagnosticar cuellos de botella, fugas de memoria y bloqueos de interfaz.

```
+───────────────────────────────────────────────────────────────────────────────────────────+
| ARQUITECTURA DE MONITOREO AGÉNTICO SIN DUPLICACIÓN DE PROCESOS (ZERO-OVERHEAD CDP)         |
+───────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                           |
|  [ INSTANCIA DE ELECTRON EN PRODUCCIÓN ]                                                  |
|  ┌───────────────────────────────┐     Chrome DevTools Protocol (CDP)                     |
|  │  Chromium Renderer (Vite 8)   │ <────────────────────────────────┐                     |
|  │  - Live2D Cubism WebGL 2.0    │        ws://127.0.0.1:9222       │                     |
|  │  - React 19 UI & Modales      │                                  │                     |
|  │  - Audio DSP / Worklets       │                                  │                     |
|  └──────────────┬────────────────┘                                  │                     |
|                 │ IPC Nativo                                        │                     |
|  ┌──────────────▼────────────────┐                                  │                     |
|  │  Electron Main Process        │                                  │                     |
|  │  - Window Manager (DWM)       │                                  │                     |
|  │  - Flags: --remote-debug=9222 │                                  │                     |
|  └───────────────────────────────┘                                  │                     |
|                                                                     │                     |
|  [ AGENTE DE RENDIMIENTO PLAYWRIGHT ] ──────────────────────────────┘                     |
|  ┌───────────────────────────────────────────────────────────────┐                         |
|  │  PerformanceAgent (scripts/diagnostics/performance-agent.cjs) │                         |
|  │  - playwright.chromium.connectOverCDP('http://127.0.0.1:9222')│                         |
|  │  - Hilo Aislado (Worker Thread) sin impacto en el FPS del usuario                       |
|  │  - Extracción de Web Vitals, Heap V8, RTT de IPC y Tareas >50ms                         |
|  └───────────────────────────────────────────────────────────────┘                         |
+───────────────────────────────────────────────────────────────────────────────────────────+
```

### ✅ Cumplimiento de las 3 Reglas Innegociables:
1. **CERO PÉRDIDA DE RENDIMIENTO:** No realiza polling agresivo ni inyecta scripts pesados en el hilo de renderizado. Utiliza `PerformanceObserver` nativo y APIs del motor V8/CDP.
2. **BAJO CONSUMO DE RECURSOS:** **Nunca ejecuta `playwright.launch()`**. No levanta binarios adicionales de Chromium ni duplica procesos en el Administrador de Tareas. Se acopla al proceso existente mediante `chromium.connectOverCDP`.
3. **COMPATIBILIDAD TOTAL & GRACEFUL DEGRADATION:** Funciona tanto en `pnpm run app:dev` como en la aplicación instalada con el ejecutable NSIS. Si el agente se desconecta o finaliza, la aplicación principal continúa funcionando con 0 efectos secundarios.

---

## ⚙️ 2. Configuración del Proceso Principal (`electron/main.cjs`)

### A. Puerto de Depuración Remota Seguro (`127.0.0.1`)
En [`electron/main.cjs`](file:///C:/React-Nextjs-Projects/Cristi%20AI/electron/main.cjs), se habilitan los flags de Chromium antes de que la aplicación esté lista (`app.whenReady`):

```javascript
// ── CDP Remote Debugging for Agentic Performance Monitoring (APM) ───────────
// Habilita depuración local segura ligada exclusivamente a localhost (127.0.0.1).
const CDP_PORT = process.env.CRISTI_CDP_PORT || process.env.ELECTRON_CDP_PORT || '9222';
app.commandLine.appendSwitch('remote-debugging-port', CDP_PORT);
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
```

* **Seguridad de Red:** El flag `remote-debugging-address: 127.0.0.1` garantiza que ninguna máquina en la red local (LAN) o externa pueda abrir conexiones de depuración hacia el puerto.

---

## 🧠 3. Arquitectura del Agente de Monitoreo (`performance-agent.cjs`)

El agente implementa la clase `PerformanceAgent` en [`scripts/diagnostics/performance-agent.cjs`](file:///C:/React-Nextjs-Projects/Cristi%20AI/scripts/diagnostics/performance-agent.cjs):

```javascript
const { chromium } = require('playwright');

class PerformanceAgent {
  async connect() {
    // 1. Conexión CDP directa sin proceso secundario
    this.browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    
    // 2. Identificación de la página activa de Cristi
    this.context = this.browser.contexts()[0];
    this.page = this.context.pages().find(p => !p.url().startsWith('devtools://'));
    
    // 3. Habilitación de sesión nativa CDP para telemetría profunda
    this.cdpSession = await this.context.newCDPSession(this.page);
    await this.cdpSession.send('Performance.enable');
  }
}
```

---

## 📊 4. Métricas Recopiladas en Tiempo Real

| Categoría | Métrica | Método de Extracción | Umbral Óptimo |
|---|---|---|---|
| 🏎️ **Fluidez & FPS** | Framerate Promedio | `requestAnimationFrame` delta sampling | $\ge 55\text{ FPS}$ |
| ⏱️ **Estabilidad** | P95 Frame Time | Percentil 95 de tiempos entre fotogramas | $\le 18.0\text{ ms}$ |
| 🔻 **Jank / Tirones** | Frames Caídos | Conteo de fotogramas con duración $> 33.3\text{ ms}$ | $\le 2\text{ frames}$ |
| 🧠 **Memoria V8** | JS Heap Usado | `performance.memory` + `CDP Performance.getMetrics` | $\le 250\text{ MB}$ |
| 🌳 **Árbol DOM** | Nodos DOM Totales | `document.querySelectorAll('*').length` | $\le 1,500\text{ nodos}$ |
| 🔌 **Inter-Process** | Latencia IPC RTT | Muestreo de ida y vuelta en microsegundos | $< 5.0\text{ ms}$ |

---

## 🚀 5. Cómo Ejecutar una Auditoría en Vivo

Con Cristi AI Companion abierta (en desarrollo o instalada):

```powershell
pnpm run test:live-apm
```

### Ejemplo de Salida del Reporte Ejecutivo:

```
================================================================
🔬 CRISTI AI COMPANION — AGENTIC PERFORMANCE MONITORING (CDP)
================================================================
[1/4] Buscando instancia activa de Electron en http://127.0.0.1:9222...
  ✅ Conectado exitosamente vía Chrome DevTools Protocol (CDP).
  🎯 Ventana detectada: http://localhost:5173/

[2/4] Recopilando métricas de Web Vitals, Heap V8 y Nodos DOM...
[3/4] Ejecutando benchmark de fluidez y renderizado en vivo (2000ms)...
[4/4] Procesando informe holístico de rendimiento...

================================================================
📊 REPORTE EJECUTIVO DE RENDIMIENTO EN TIEMPO REAL
================================================================
┌────────────────────────┬───────────┬──────────────┐
│ (index)                │ Valor     │ Estado       │
├────────────────────────┼───────────┼──────────────┤
│ 'Framerate Promedio'   │ '60 FPS'  │ '✅ ÓPTIMO'  │
│ 'P95 Frame Time'       │ '16.6 ms' │ '✅ FLUIDO'  │
│ 'Frames Caídos (>33ms)'│ '0'       │ '✅ 0 LAG'   │
│ 'JS Heap Usado'        │ '142 MB'  │ '✅ BAJO'    │
│ 'Total Nodos DOM'      │ '412'     │ '✅ LIVIANO' │
│ 'Listeners de Eventos' │ '84'      │ '✅ CONTROL' │
│ 'IPC Display RTT'      │ '0.8 ms'  │ '✅ INSTANT' │
│ 'IPC Memory RTT'       │ '1.1 ms'  │ '✅ INSTANT' │
└────────────────────────┴───────────┴──────────────┘

🔍 DIAGNÓSTICO DE MÓDULOS:
  🎉 EXCELENTE: Todos los subsistemas (Live2D, UI React 19, Audio DSP) operan a máximo rendimiento.
  🚀 0% de sobrecarga detectada. Experiencia ultra-fluida garantizada.

🔒 Desconexión limpia del agente completada (La app sigue corriendo normalmente).
================================================================
```
