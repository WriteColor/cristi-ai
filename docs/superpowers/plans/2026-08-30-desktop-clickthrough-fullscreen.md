# Fullscreen Transparent Desktop Overlay & Native Click-Through Engine Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a native, zero-latency Click-Through (Clickpassthrough) engine and transparent fullscreen overlay for Cristi AI on Windows, allowing the Live2D avatar and widgets to float anywhere across the entire desktop while transparent space passes mouse clicks directly to underlying applications.

**Architecture:** A lightweight native Windows helper binary (~15KB) compiled with Windows built-in `csc.exe` uses Win32 `SetWindowLongPtr` (`WS_EX_TRANSPARENT`) and local IPC. React's `ClickThroughService` sends dynamic bounding boxes of interactive elements (avatar, dock, widgets, menus) in real-time. The helper tests cursor position and enables/disables click-through instantly.

**Tech Stack:** C# (Win32 P/Invoke via `csc.exe`), Neutralinojs native API, React 19, PixiJS Live2D.

---

### Task 1: Native Win32 Click-Through Helper Binary (`cristi_clickthrough_helper.cs`)

**Files:**
- Create: `src-native/cristi_clickthrough_helper.cs`
- Build Output: `bin/cristi_clickthrough_helper.exe`

- [ ] **Step 1: Write C# source code with Win32 P/Invoke for HWND lookup, `WS_EX_TRANSPARENT`, and local HTTP/IPC server**
- [ ] **Step 2: Compile with `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`**
- [ ] **Step 3: Verify binary builds cleanly and test basic execution**

---

### Task 2: Frontend `ClickThroughService.js` & Hitbox Tracking

**Files:**
- Create: `src/services/desktop/ClickThroughService.js`
- Modify: `src/services/desktop/index.js`
- Modify: `src/components/Live2DCanvas.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Implement `ClickThroughService` with local IPC connection and hitbox updater**
- [ ] **Step 2: Connect Live2D model bounds and UI elements in `App.jsx`**
- [ ] **Step 3: Test hitbox synchronization**

---

### Task 3: Fullscreen & Transparency Configuration in Neutralino & CSS

**Files:**
- Modify: `neutralino.config.json`
- Modify: `src/index.css`
- Modify: `src/components/ContextMenu.jsx`

- [ ] **Step 1: Configure `neutralino.config.json` window mode for borderless, transparent, fullscreen overlay**
- [ ] **Step 2: Add click-through toggle to Context Menu**
- [ ] **Step 3: Verify end-to-end functionality**
