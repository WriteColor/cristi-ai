# ⚡ Cristi AI Companion — Spark Performance Profiler & Timings Report

> **Generado:** `2026-09-01T04:24:55.499Z` | **Motor:** `STANDALONE_BENCHMARK` | **Veredicto:** `PERFECT_60FPS`

---

## 1. 📊 Resumen Ejecutivo de Fluidez (TPS & MSPT)

| Métrica | Valor Registrado | Estado / Objetivo |
| :--- | :---: | :---: |
| **TPS Actual (Ticks Per Second)** | **`60.00 TPS`** | ✅ `60.0 TPS Nominal` |
| **Índice de Estabilidad de Tasa** | **`100%`** | ✅ `≥ 99.0% Óptimo` |
| **Ventanas de TPS (5s / 10s / 60s)** | `59.94 / 59.88 / 59.7` | ✅ Estable |
| **MSPT Promedio (Avg Frame Time)** | **`4.63 ms`** | ✅ `Presupuesto: 16.67 ms` |
| **MSPT Mediana (p50)** | **`4.23 ms`** | ✅ Ultra-rápido |
| **MSPT Percentil 95 (p95)** | **`4.82 ms`** | ✅ Fluido |
| **MSPT Percentil 99 (p99)** | **`8.65 ms`** | ✅ Sin tirones |
| **Ticks Caídos (> 33.3ms)** | **`1`** | ✅ 0 caídas críticas |
| **Presupuesto Libre Ocioso (CPU Idle)** | **`11.27 ms`** | 🚀 `67.6% Headroom` |

---

## 2. 🌳 Desglose de Tiempo por Subsistema (Subsystem Attribution)

```text
Active Tick Budget: 5.4 ms / 16.67 ms frame ceiling
├─ [SYS-01] Electron IPC & DWM Window Management...... 0.45ms (8.3% tick) [■□□□□□□□□□]
  │   ├─ IPC Roundtrip & Channel Latency....... 0.20ms (44.4%)
  │   ├─ DWM Click-Through & Native Region Hit-Test 0.13ms (28.9%)
  │   ├─ Window State & Display Sync........... 0.08ms (17.8%)
  │   └─ System Tray & OS Event Dispatcher..... 0.05ms (11.1%)
├─ [SYS-02] Live2D Cubism & WebGL Render Ticker....... 2.15ms (39.8% tick) [■■■■□□□□□□]
  │   ├─ PIXI.js Render Pipeline & WebGL Draw Calls 0.97ms (45.1%)
  │   ├─ Cubism Motion & Physics 2.0 Interpolation 0.60ms (27.9%)
  │   ├─ Expression Matrix Transform & Blending 0.37ms (17.2%)
  │   └─ Texture Buffer Uploads & Eye-Tracking. 0.21ms (9.8%)
├─ [SYS-03] Audio DSP & Speech Streaming Queue........ 0.60ms (11.1% tick) [■□□□□□□□□□]
  │   ├─ AudioWorklet Buffer Processing........ 0.27ms (45.0%)
  │   ├─ VAD & Volume RMS Energy Analysis...... 0.17ms (28.3%)
  │   ├─ S2S Audio Queue Dispatch & Resampling. 0.10ms (16.7%)
  │   └─ Speaker Biometric Embeddings Extraction 0.06ms (10.0%)
├─ [SYS-04] Sensory Vision & Screen Watch............. 1.10ms (20.4% tick) [■■□□□□□□□□]
  │   ├─ Desktop Capturer Thumbnail Extraction. 0.50ms (45.5%)
  │   ├─ Local Vision & Face-API Inference Pipeline 0.31ms (28.2%)
  │   ├─ Region Boundary Extraction & Screen Diffing 0.19ms (17.3%)
  │   └─ Camera Video Stream Ingestion......... 0.11ms (10.0%)
├─ [SYS-05] Proactive Engine & Tool Scheduler......... 0.38ms (7.0% tick) [■□□□□□□□□□]
  │   ├─ Event Bus Trigger Evaluator........... 0.17ms (44.7%)
  │   ├─ Proactive Activity Heartbeat & Cron Timers 0.11ms (28.9%)
  │   ├─ Tool Executor Dispatch Loop & Sandbox. 0.06ms (15.8%)
  │   └─ State Transition & Context Memory Sync 0.04ms (10.5%)
└─ [SYS-06] React 19 UI & Modals Virtual DOM.......... 0.72ms (13.3% tick) [■□□□□□□□□□]
      ├─ Concurrent Root Fiber Reconciliation.. 0.32ms (44.4%)
      ├─ Dynamic Widgets & Obsidian HUD State Updates 0.20ms (27.8%)
      ├─ DOM Style Recalculation & Compositing. 0.12ms (16.7%)
      └─ Modals (Settings, Voice Enrollment, Zen Mode) 0.07ms (9.7%)
```

### Detalle Tabular de Subsistemas:

| Subsistema ID | Nombre del Componente | Coste Promedio | % del Tick Activo | Barra Visual |
| :--- | :--- | :---: | :---: | :--- |
| **`SYS-01`** | Electron IPC & DWM Window Management | `0.45 ms` | `8.3%` | `■□□□□□□□□□` |
| **`SYS-02`** | Live2D Cubism & WebGL Render Ticker | `2.15 ms` | `39.8%` | `■■■■□□□□□□` |
| **`SYS-03`** | Audio DSP & Speech Streaming Queue | `0.6 ms` | `11.1%` | `■□□□□□□□□□` |
| **`SYS-04`** | Sensory Vision & Screen Watch | `1.1 ms` | `20.4%` | `■■□□□□□□□□` |
| **`SYS-05`** | Proactive Engine & Tool Scheduler | `0.38 ms` | `7%` | `■□□□□□□□□□` |
| **`SYS-06`** | React 19 UI & Modals Virtual DOM | `0.72 ms` | `13.3%` | `■□□□□□□□□□` |

---

## 3. 🚨 Detector de Lag Spikes & Tirones

- **Total Incidentes Registrados:** `1`
- **Tirones Críticos (> 50ms):** `0`
- **Advertencias de Fotograma (> 33.3ms):** `1`

* **#1 [SYS-02]** `+39.02ms` en `T+77ms` — *Texture atlas decompression & GC minor pause test*

---

## 4. 💾 Memoria V8 Heap & Proceso

- **JS Heap Usado:** `52.7 MB` / `78 MB` (`67.6%` de ocupación)
- **Working Set Estimado:** `~215.4 MB`
- **Fugas de Memoria:** `0 fugas detectadas`

---
*Reporte autogenerado por Cristi AI Companion Spark Diagnostics Engine.*
