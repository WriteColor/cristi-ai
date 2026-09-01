# Cristi AI Companion - Multi-Window Architecture Refactoring Plan

**Goal:** Refactor Cristi AI Companion from a monolithic transparent single-window architecture into a performant, decoupled **Multi-Window System** consisting of a lightweight **Transparent Companion Overlay** (60–240 FPS rock solid) and a dedicated hardware-accelerated **Native Control Panel Window** (`settings.html`).

**Architecture:** 
- **Window 1 (`MainWindow / Companion`):** Frameless, transparent, click-through overlay containing *only* the Live2D WebGL canvas, quick tactical HUD, subtitles, Camera PiP, and Telemetry HUD.
- **Window 2 (`SettingsWindow / Control Panel`):** Opaque, native window with dedicated hardware acceleration for all configuration: Models, Prompts, Live2D Catalog, Voice Biometrics, Vision Samples, Backgrounds, and Auto-Updates.
- **State Synchronization:** Bi-directional IPC Hub in `electron/main.cjs` broadcasting `config-updated` in O(1) time without reloads.
- **Style Isolation:** Separate `src/styles/companion.css` (<150 lines) from `src/styles/settings.css`.

**Tech Stack:** Electron 32, React 19, Vite 8, PixiJS, Live2D Cubism, Web Audio API, Gemini Multimodal Live WebSocket S2S.

---

## Task Breakdown & Workplan

### Task 1: Electron Multi-Window IPC Hub & Lifecycle Manager
**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/services/desktop/ElectronBridge.js`

- [ ] **Step 1:** Implement `createSettingsWindow()` in `electron/main.cjs` with single-instance focus.
- [ ] **Step 2:** Implement IPC handlers `open-settings-window`, `close-settings-window`, `get-app-config`, `save-app-config`, and broadcast `config-updated` to `mainWindow`.
- [ ] **Step 3:** Implement pause/resume hooks for companion rendering when settings window is active.
- [ ] **Step 4:** Expose clean IPC methods in `electron/preload.cjs` and `ElectronBridge.js`.

---

### Task 2: Vite Multi-Entry Configuration & HTML Entrypoints
**Files:**
- Modify: `vite.config.js`
- Create: `settings.html`
- Create: `src/settings-main.jsx`
- Modify: `index.html`

- [ ] **Step 1:** Configure `vite.config.js` with Rollup input points (`main: index.html`, `settings: settings.html`).
- [ ] **Step 2:** Create `settings.html` with obsidian styling and `#settings-root`.
- [ ] **Step 3:** Create `src/settings-main.jsx` mounting `SettingsApp`.

---

### Task 3: Dedicated Native Control Panel Application (`SettingsApp.jsx`)
**Files:**
- Create: `src/settings/SettingsApp.jsx`
- Create: `src/settings/tabs/ModelApiTab.jsx`
- Create: `src/settings/tabs/Live2dTab.jsx`
- Create: `src/settings/tabs/VoiceTab.jsx`
- Create: `src/settings/tabs/PersonaTab.jsx`
- Create: `src/settings/tabs/SceneTab.jsx`
- Create: `src/settings/tabs/UpdatesTab.jsx`
- Create: `src/styles/settings.css`

- [ ] **Step 1:** Assemble `SettingsApp.jsx` with native Obsidian split layout and tab navigation.
- [ ] **Step 2:** Integrate full persona prompt editor with dynamic auto-expanding textarea, presets, and default reset.
- [ ] **Step 3:** Integrate Voice Biometrics (Microphone calibration & Audio file upload) directly into the Voice tab.
- [ ] **Step 4:** Implement Save & Apply logic calling `electronBridge.saveConfig(newConfig)`.

---

### Task 4: Streamlined Companion Overlay (`src/App.jsx` & `companion.css`)
**Files:**
- Modify: `src/App.jsx`
- Create: `src/styles/companion.css`

- [ ] **Step 1:** Remove heavy modal code (`SettingsModal`, `VoiceEnrollmentModal`, backdrop containers) from `src/App.jsx`.
- [ ] **Step 2:** Connect `handleOpenSettings` and shortcut `Ctrl+,` to `electronBridge.openSettingsWindow()`.
- [ ] **Step 3:** Subscribe to `electronBridge.onConfigUpdated((newConfig) => setConfig(newConfig))`.
- [ ] **Step 4:** Build ultra-lightweight `src/styles/companion.css` for zero-reflow rendering.

---

### Task 5: Testing, Diagnostics & Production Installer
**Files:**
- Modify: `tests/test_electron_architecture.mjs`
- Test: `pnpm run test:diagnostics`
- Build: `pnpm run app:build`

- [ ] **Step 1:** Run architectural and IPC test suite verifying both entrypoints and IPC communication.
- [ ] **Step 2:** Build Vite bundle and verify both `dist/index.html` and `dist/settings.html`.
- [ ] **Step 3:** Compile production installer `Cristi-AI-Companion-Setup-1.0.0.exe`.
