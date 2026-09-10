# Integral Stabilization & Clean Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean, audit, refactor, and stabilize the Cristi AI repository to a production-grade, fully reproducible, strictly typed, and comprehensively tested state.

**Architecture:** Layered modular architecture separating UI/Renderer (React 19 + Vite 8), Preload Security Bridge, Main Process Router (Electron 43), and Dedicated Node.js Worker Threads (`memory.worker.ts`, `screenCapture.worker.ts`, `playwright.worker.ts`).

**Tech Stack:** Electron 43.6, Node 24.20, React 19.2, TypeScript 5.7, Vite 8, pnpm 9.

**Spec:** [docs/AUDITORIA_TECNICA_INTEGRAL_2026.md](file:///c:/React-Nextjs-Projects/Cristi%20AI/docs/AUDITORIA_TECNICA_INTEGRAL_2026.md) and [docs/ARCHITECTURE.md](file:///c:/React-Nextjs-Projects/Cristi%20AI/docs/ARCHITECTURE.md)

## Global Constraints

- NEVER use `npm`. Use `pnpm` exclusively (and `pnpm dlx` for npx).
- Zero `any` in TypeScript domain code.
- Professional logging only: no decorative emojis in console outputs, comments, or documentation titles.
- Zero leftover caches, build artifacts, or temporary files.

---

### Task 1: Repository Hygiene & Artifact Purge

**Files:**
- Delete: `backup_pre_refactor_clean.zip`
- Delete: `cristi-memories.json`
- Delete: `docs/audit_reference/`
- Delete: `docs/estado-auditoria-2026-09-10.md`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: Existing files and dependencies.
- Produces: Clean git status and streamlined `package.json` without `postcss`/`autoprefixer`.

- [ ] **Step 1: Delete temporary and legacy artifacts**
- [ ] **Step 2: Update `.gitignore` with strict patterns**
- [ ] **Step 3: Remove unused `postcss` and `autoprefixer` from `package.json`**
- [ ] **Step 4: Run `pnpm install` to update `pnpm-lock.yaml`**

---

### Task 2: Scripts Modernization & Developer Ergonomics

**Files:**
- Create: `scripts/clean.cjs`
- Modify: `scripts/run-tests.mjs`
- Modify: `scripts/setup-clean-env.cjs`
- Modify: `scripts/postinstall-setup.cjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Test files in `tests/`, electron build scripts.
- Produces: Granular test runner with keyword filter, clean build scripts, professional terminal logging.

- [ ] **Step 1: Create `scripts/clean.cjs` to purge build artifacts and caches**
- [ ] **Step 2: Update `scripts/run-tests.mjs` with filtering and temp cleanup in finally block**
- [ ] **Step 3: Update `scripts/setup-clean-env.cjs` with standardized tags ([OK], [WARN], [INFO])**
- [ ] **Step 4: Update `scripts/postinstall-setup.cjs` with clean outputs**
- [ ] **Step 5: Verify scripts work (`node scripts/clean.cjs`, `pnpm test`)**

---

### Task 3: Professional Codebase Policy & Normalization

**Files:**
- Modify: `src/domain/sensory/VisionDetectionService.ts`
- Modify: `src/domain/sensory/LocalVisionService.ts`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/TOOLS_AND_CAPABILITIES.md`
- Modify: `docs/INSTALLATION_GUIDE.md`
- Modify: `docs/GUIA_INTEGRACION_SPOTIFY.md`
- Modify: `docs/SHORTCUTS_AND_CONTROLS.md`
- Modify: `docs/AUDITORIA_TECNICA_INTEGRAL_2026.md`

**Interfaces:**
- Consumes: Sensory services and documentation files.
- Produces: Professional, emoji-free diagnostics and clean documentation.

- [ ] **Step 1: Replace emojis in `VisionDetectionService.ts` with structured indicators**
- [ ] **Step 2: Remove emojis in `LocalVisionService.ts` log**
- [ ] **Step 3: Standardize titles in all documentation files**

---

### Task 4: Granular Subsystem Test Expansion

**Files:**
- Create: `tests/tools.validation.test.ts`
- Create: `tests/spotify.resilience.test.ts`
- Create: `tests/proactive.scheduler.test.ts`
- Create: `tests/security.redaction.test.ts`

**Interfaces:**
- Consumes: `toolSchemas.ts`, `ToolExecutor.ts`, `SpotifyService.ts`, `ProactiveScheduler.ts`, `security.ts`.
- Produces: 4 comprehensive test suites targeting edge cases, negative values, malformed inputs, and security boundaries.

- [ ] **Step 1: Write `tests/tools.validation.test.ts`**
- [ ] **Step 2: Write `tests/spotify.resilience.test.ts`**
- [ ] **Step 3: Write `tests/proactive.scheduler.test.ts`**
- [ ] **Step 4: Write `tests/security.redaction.test.ts`**
- [ ] **Step 5: Run all test suites and verify 100% pass rate**

---

### Task 5: Architectural Governance & Maintenance Guidelines

**Files:**
- Create: `docs/DEVELOPMENT_GUIDELINES.md`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: Audited architecture and engineering requirements.
- Produces: Binding rules for module creation, dependency management, strict TypeScript, CI gates, and documentation synchronization.

- [ ] **Step 1: Create `docs/DEVELOPMENT_GUIDELINES.md`**
- [ ] **Step 2: Update `CONTRIBUTING.md`**

---

### Task 6: Full Pipeline Verification, Diff Review, Commit & Push

**Files:**
- All modified/created files.

- [ ] **Step 1: Run `pnpm run clean`**
- [ ] **Step 2: Run `pnpm run ci`**
- [ ] **Step 3: Inspect `git status` and `git diff`**
- [ ] **Step 4: Commit with descriptive message and push to origin**
