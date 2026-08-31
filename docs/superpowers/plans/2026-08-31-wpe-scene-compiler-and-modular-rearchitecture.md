# Wallpaper Engine WebGL Shader Scene Compiler & Global Modular Rearchitecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a native WebGL Shader Scene Compiler for Wallpaper Engine animated scenes and perform a full modular rearchitecture of the project into domain-driven modules with a 3-layer design token system.

**Architecture:** WebGL 2.0 / WebGL 1.0 GPU shader pipeline for live animated Wallpaper Engine scenes (`scene.pkg`), coupled with a clean domain-driven directory structure (`src/modules/*`, `src/core/*`, `src/shared/*`, `src/styles/*`) and barrel exports.

**Tech Stack:** React 19, WebGL, GLSL Shaders, Electron, CSS Design Tokens, Vite.

**Spec:** [implementation_plan.md](file:///C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/implementation_plan.md)

## Global Constraints
- Node package manager: strictly `pnpm`. Never use or install `npm`.
- Browser: Brave browser (`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`).
- Zero broken imports: Provide unified barrel exports in `src/components/index.js` and `src/services/index.js`.
- 120 FPS compatibility and zero CPU overhead on GPU shaders.

---

### Task 1: WebGL Shader Engine & Scene Compiler for Wallpaper Engine
**Files:**
- Create: `src/modules/scenes/wpe/wpeShaderEngine.js`
- Create: `src/modules/scenes/wpe/wpeSceneCompiler.js`
- Modify: `server/wpePkgExtractor.cjs`

- [ ] **Step 1: Implement WebGL Shader Engine (`wpeShaderEngine.js`)**
- [ ] **Step 2: Implement Multi-Layer Scene Compiler (`wpeSceneCompiler.js`)**
- [ ] **Step 3: Test WebGL shader compilation and layer blending**

---

### Task 2: BackgroundScene Integration & Sizing
**Files:**
- Modify: `src/components/BackgroundScene.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Connect `wpeSceneCompiler` canvas to `BackgroundScene.jsx`**
- [ ] **Step 2: Apply full-screen uncropped containment & cover geometry**
- [ ] **Step 3: Verify with Playwright audit**

---

### Task 3: Global Modular Directory Restructuring
**Files:**
- Create: `src/core/*`
- Create: `src/modules/avatar/*`
- Create: `src/modules/scenes/*`
- Create: `src/modules/ai/*`
- Create: `src/modules/hud/*`
- Create: `src/modules/settings/*`
- Create: `src/modules/desktop/*`
- Create: `src/shared/*`
- Create: `src/styles/*` (3-layer design tokens)
- Update: `src/components/index.js`, `src/services/index.js`, `src/App.jsx`

- [ ] **Step 1: Create modular directory structure and move files**
- [ ] **Step 2: Modularize styles into `src/styles/` with 3-layer tokens**
- [ ] **Step 3: Update barrel exports and imports across all modules**
- [ ] **Step 4: Execute full Playwright E2E and Electron audit**
