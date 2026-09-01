# ⚡ Cristi AI Companion — Spark Performance Profiler & Timings Report

> **Generado:** `2026-09-01T02:41:37.344Z` | **Motor:** `LIVE_CDP` | **Veredicto:** `PERFECT_60FPS`

---

## 1. 📊 Resumen Ejecutivo de Fluidez (TPS & MSPT)

| Métrica | Valor Registrado | Estado / Objetivo |
| :--- | :---: | :---: |
| **TPS Actual (Ticks Per Second)** | **`60.00 TPS`** | ✅ `60.0 TPS Nominal` |
| **Índice de Estabilidad de Tasa** | **`100%`** | ✅ `≥ 99.0% Óptimo` |
| **Ventanas de TPS (5s / 10s / 60s)** | `59.94 / 59.88 / 59.7` | ✅ Estable |
| **MSPT Promedio (Avg Frame Time)** | **`4.27 ms`** | ✅ `Presupuesto: 16.67 ms` |
| **MSPT Mediana (p50)** | **`4.2 ms`** | ✅ Ultra-rápido |
| **MSPT Percentil 95 (p95)** | **`4.3 ms`** | ✅ Fluido |
| **MSPT Percentil 99 (p99)** | **`8.12 ms`** | ✅ Sin tirones |
| **Ticks Caídos (> 33.3ms)** | **`1`** | ✅ 0 caídas críticas |
| **Presupuesto Libre Ocioso (CPU Idle)** | **`11.25 ms`** | 🚀 `67.5% Headroom` |

---

## 2. 🌳 Desglose de Tiempo por Subsistema (Subsystem Attribution)

```text
Active Tick Budget: 5.42 ms / 16.67 ms frame ceiling
├─ [SYS-01] Electron IPC & DWM Window Management...... 0.45ms (8.3% tick) [■□□□□□□□□□]
  │   ├─ IPC Roundtrip & Channel Latency....... 0.20ms (44.4%)
  │   ├─ DWM Click-Through & Native Region Hit-Test 0.13ms (28.9%)
  │   ├─ Window State & Display Sync........... 0.08ms (17.8%)
  │   └─ System Tray & OS Event Dispatcher..... 0.05ms (11.1%)
├─ [SYS-02] Live2D Cubism & WebGL Render Ticker....... 2.10ms (38.7% tick) [■■■■□□□□□□]
  │   ├─ PIXI.js Render Pipeline & WebGL Draw Calls 0.95ms (45.2%)
  │   ├─ Cubism Motion & Physics 2.0 Interpolation 0.59ms (28.1%)
  │   ├─ Expression Matrix Transform & Blending 0.36ms (17.1%)
  │   └─ Texture Buffer Uploads & Eye-Tracking. 0.21ms (10.0%)
├─ [SYS-03] Audio DSP & Speech Streaming Queue........ 0.65ms (12.0% tick) [■□□□□□□□□□]
  │   ├─ AudioWorklet Buffer Processing........ 0.29ms (44.6%)
  │   ├─ VAD & Volume RMS Energy Analysis...... 0.18ms (27.7%)
  │   ├─ S2S Audio Queue Dispatch & Resampling. 0.11ms (16.9%)
  │   └─ Speaker Biometric Embeddings Extraction 0.07ms (10.8%)
├─ [SYS-04] Sensory Vision & Screen Watch............. 1.15ms (21.2% tick) [■■□□□□□□□□]
  │   ├─ Desktop Capturer Thumbnail Extraction. 0.52ms (45.2%)
  │   ├─ Local Vision & Face-API Inference Pipeline 0.32ms (27.8%)
  │   ├─ Region Boundary Extraction & Screen Diffing 0.20ms (17.4%)
  │   └─ Camera Video Stream Ingestion......... 0.11ms (9.6%)
├─ [SYS-05] Proactive Engine & Tool Scheduler......... 0.42ms (7.7% tick) [■□□□□□□□□□]
  │   ├─ Event Bus Trigger Evaluator........... 0.19ms (45.2%)
  │   ├─ Proactive Activity Heartbeat & Cron Timers 0.12ms (28.6%)
  │   ├─ Tool Executor Dispatch Loop & Sandbox. 0.07ms (16.7%)
  │   └─ State Transition & Context Memory Sync 0.04ms (9.5%)
└─ [SYS-06] React 19 UI & Modals Virtual DOM.......... 0.65ms (12.0% tick) [■□□□□□□□□□]
      ├─ Concurrent Root Fiber Reconciliation.. 0.29ms (44.6%)
      ├─ Dynamic Widgets & Obsidian HUD State Updates 0.18ms (27.7%)
      ├─ DOM Style Recalculation & Compositing. 0.11ms (16.9%)
      └─ Modals (Settings, Voice Enrollment, Zen Mode) 0.07ms (10.8%)
```

### Detalle Tabular de Subsistemas:

| Subsistema ID | Nombre del Componente | Coste Promedio | % del Tick Activo | Barra Visual |
| :--- | :--- | :---: | :---: | :--- |
| **`SYS-01`** | Electron IPC & DWM Window Management | `0.45 ms` | `8.3%` | `■□□□□□□□□□` |
| **`SYS-02`** | Live2D Cubism & WebGL Render Ticker | `2.1 ms` | `38.7%` | `■■■■□□□□□□` |
| **`SYS-03`** | Audio DSP & Speech Streaming Queue | `0.65 ms` | `12%` | `■□□□□□□□□□` |
| **`SYS-04`** | Sensory Vision & Screen Watch | `1.15 ms` | `21.2%` | `■■□□□□□□□□` |
| **`SYS-05`** | Proactive Engine & Tool Scheduler | `0.42 ms` | `7.7%` | `■□□□□□□□□□` |
| **`SYS-06`** | React 19 UI & Modals Virtual DOM | `0.65 ms` | `12%` | `■□□□□□□□□□` |

---

## 3. 🚨 Detector de Lag Spikes & Tirones

- **Total Incidentes Registrados:** `1`
- **Tirones Críticos (> 50ms):** `0`
- **Advertencias de Fotograma (> 33.3ms):** `1`

* **#1 [SYS-02]** `+41.6ms` en `T+1112757ms` — *Frame duration took 41.60ms (> 33.3ms threshold)*

---

## 4. 💾 Memoria V8 Heap & Proceso

- **JS Heap Usado:** `89.81 MB` / `91.92 MB` (`97.7%` de ocupación)
- **Working Set Estimado:** `~215.4 MB`
- **Fugas de Memoria:** `0 fugas detectadas`

---
*Reporte autogenerado por Cristi AI Companion Spark Diagnostics Engine.*
