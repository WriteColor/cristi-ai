# Multi-Live2D Model Dynamic Architecture & Per-Model Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Cristi AI into an extensible multi-model Live2D platform capable of dynamically loading, analyzing, adapting, and controlling multiple distinct Cubism models (YandereGirl, IceGirl, Hiyori, Miara, Toki, Ellen, Jane Doe, Ruan Mei) with isolated capability profiles, semantic action resolution, settings UI model selector, and hot-swapping without page reload.

**Architecture:** A three-tier decoupled pipeline: (1) Capability Discovery & Semantic Action Engine in `Live2DModelRegistry`, (2) Universal Capability Adapter with Lerp Smoothing in `Live2DAdapter` & `Live2DController`, and (3) Dynamic Canvas Lifecycle & UI Model Selector in `Live2DCanvas` and `SettingsModal`.

**Tech Stack:** React 19, Pixi.js v7, pixi-live2d-display/cubism4, Web Audio API, Gemini Live API, Tailwind CSS / Shadcn Dark Minimalist Tokens, Playwright.

**Spec:** User prompt requirements for multi-model Live2D integration, security auditing, semantic abstraction, and settings UI selector.

## Global Constraints

- Never assume parameters or capabilities exist across different models; always resolve via the active model's capability profile.
- Treat external model archives as untrusted; never execute binaries/scripts.
- Ensure hot-swapping cleans up all WebGL resources, listeners, tickers, and model instances without memory leaks.
- Maintain persistent settings via `localStorage` under `cristi_ai_settings_v1`.
- Always use `pnpm` and Brave browser (`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`) for testing.

---

### Task 1: Comprehensive Model Registry & Semantic Action Engine

**Files:**
- Modify: `src/services/live2d/Live2DModelRegistry.js`
- Create: `src/services/live2d/models/index.js` (and per-model profiles)
- Test: `tests/playwright/test_multi_model_switching.mjs`

**Interfaces:**
- Consumes: Model profiles from `src/services/live2d/models/`
- Produces: `Live2DModelRegistry.getModel(id)`, `Live2DModelRegistry.resolveAction(modelId, actionName)`

- [ ] **Step 1: Write model profiles and registry with semantic action resolver**
- [ ] **Step 2: Verify all 8 model profiles load and resolve semantic actions (happy, blush, wink, yandere, etc.)**
- [ ] **Step 3: Export updated Live2D module barrel**

---

### Task 2: Live2DAdapter & Live2DController Multi-Model Adaptation

**Files:**
- Modify: `src/services/live2d/Live2DAdapter.js`
- Modify: `src/services/live2d/Live2DController.js`

**Interfaces:**
- Consumes: `Live2DModel` instance and `ModelProfile`
- Produces: `adapter.applySemanticAction(actionName)`, `controller.update(deltaMs)`

- [ ] **Step 1: Update Live2DAdapter to execute semantic actions with graceful degradation**
- [ ] **Step 2: Update Live2DController to bind to the active model profile and clamp kinetics to active capabilities**
- [ ] **Step 3: Test parameter application without throwing on missing parameters**

---

### Task 3: Seamless Model Hot-Swapping in Live2DCanvas

**Files:**
- Modify: `src/components/Live2DCanvas.jsx`

**Interfaces:**
- Consumes: `modelId` prop and `onModelLoaded` callback
- Produces: Complete WebGL destruction of previous model, instantiation of new model, adapter re-attachment

- [ ] **Step 1: Implement lifecycle teardown in `Live2DCanvas.jsx` (ticker remove, model.destroy, canvas clear)**
- [ ] **Step 2: Implement smooth loading transition and capability announcement**
- [ ] **Step 3: Expose hot-swap API on `window.__cristiAvatar.switchModel(modelId)`**

---

### Task 4: Avatar / Live2D Model Selector in Settings Modal

**Files:**
- Modify: `src/components/SettingsModal.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `config.live2dModelId`, `live2dModelRegistry.getAllModels()`
- Produces: Visual grid selector, active model inspection card, model switcher with instant persistence

- [ ] **Step 1: Add "Avatar" tab to `SettingsModal.jsx` with active model card and capability chips**
- [ ] **Step 2: Add responsive grid of all 8 Live2D models with thumbnails and switch triggers**
- [ ] **Step 3: Wire persistence in `src/App.jsx` (`config.live2dModelId` in localStorage)**

---

### Task 5: Automated E2E Multi-Model Verification & Video Recording

**Files:**
- Create: `tests/playwright/test_multi_model_switching.mjs`

- [ ] **Step 1: Build test script to cycle through multiple models via UI and API**
- [ ] **Step 2: Verify zero WebGL errors, proper lip-sync, and kinetic responses on all models**
- [ ] **Step 3: Record HD video demonstration in `tests/videos/multi_model_live2d_demo.webm`**
