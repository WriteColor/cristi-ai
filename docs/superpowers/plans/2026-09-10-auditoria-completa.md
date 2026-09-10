# Plan de Implementación: Cierre Total de la Auditoría Técnica — Cristi AI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar al 100% las soluciones técnicas recomendadas en la auditoría de Cristi AI (`auditoria-cristi-ai.md`), eliminando servicios obsoletos y simulados, erradicando los tipos `any` en la capa bridge de Electron, migrando componentes centrales a TypeScript estricto, endureciendo ESLint y verificando la integridad total mediante CI.

**Architecture:** Se eliminan los restos de ejecución de terminal simulada en el renderer (`VirtualTerminalService`), se tipa exhaustivamente `ElectronBridge.ts` consumiendo los contratos IPC seguros ya definidos en `shared/ipc/contracts.ts`, y se migran `ToolExecutor`, `ModelManager` y `ConfigManager` a TypeScript estricto sin dependencias híbridas residuales.

**Tech Stack:** TypeScript 5.8, Node.js 22, Electron 43.6.0, React 19, Vite 8, Zustand, ESLint 9, Zod.

**Spec:** `docs/audit_reference/auditoria-cristi-ai.md` y `docs/estado-auditoria-2026-09-10.md`.

## Global Constraints

- **Gestor de paquetes:** NUNCA usar `npm`. Usar `pnpm` exclusivamente (y `pnpm dlx` para binarios).
- **Seguridad IPC:** Todo canal IPC en Electron debe validarse con schemas Zod y `handleTrusted` / `onTrusted` con chequeo de emisor y ventana permitida.
- **Tipado Estricto:** Prohibido el uso de `any` en los componentes migrados y vigilados por TypeScript y ESLint.
- **Cero fugas de secretos:** Ninguna credencial privada (Gemini, Spotify, Discord) debe ser accesible por el renderer ni persistida en texto plano.

---

### Task 1: Retiro de `VirtualTerminalService` y saneamiento de servicios obsoletos

**Files:**
- Delete: `src/services/desktop/VirtualTerminalService.js`
- Modify: `src/app/serviceRegistry.ts:20-30`

**Interfaces:**
- Consumes: N/A
- Produces: Eliminación de la interfaz simulada de PowerShell; las herramientas ya utilizan `electronBridge.systemExecute({ kind })`.

- [ ] **Step 1: Eliminar `src/services/desktop/VirtualTerminalService.js`**
- [ ] **Step 2: Remover la re-exportación de `VirtualTerminalService` en `src/app/serviceRegistry.ts`**
- [ ] **Step 3: Ejecutar `pnpm run typecheck:renderer` para comprobar que ningún componente requiera el servicio**
- [ ] **Step 4: Ejecutar `pnpm run ci` para confirmar que las pruebas siguen pasando**

---

### Task 2: Tipado estricto y eliminación de `any` en `ElectronBridge.ts`

**Files:**
- Modify: `src/services/desktop/ElectronBridge.ts`
- Reference: `electron/src/preload.ts`, `shared/ipc/contracts.ts`

**Interfaces:**
- Consumes: `ElectronApiBridge` de `electron/src/preload.ts`, tipos auxiliares (`DisplayInfo`, `ProcessMemoryInfo`, `ScreenRegion`, `FileRequest`) de `shared/ipc/contracts.ts`.
- Produces: Instancia `electronBridge` 100% tipada, sin `any`, con métodos fuertemente tipados para Minecraft, Discord, captura de pantalla, audio nativo y configuración.

- [ ] **Step 1: Importar interfaces tipadas en `ElectronBridge.ts` y sustituir `(window as any)` por una comprobación segura de `ElectronApiBridge`**
- [ ] **Step 2: Reemplazar los 30+ usos de `any` en los métodos y callbacks de eventos de `ElectronBridge.ts`**
- [ ] **Step 3: Ejecutar `pnpm run typecheck:renderer` y verificar 0 errores de tipado**
- [ ] **Step 4: Añadir suite de prueba `tests/bridge.test.ts` para validar fallback web y propagación**

---

### Task 3: Migración a TypeScript de `ToolExecutor`, `ModelManager` y `ConfigManager`

**Files:**
- Create: `src/domain/tools/ToolExecutor.ts`
- Delete: `src/domain/tools/ToolExecutor.js`
- Create: `src/domain/gemini/ModelManager.ts`
- Delete: `src/domain/gemini/ModelManager.js`
- Create: `src/infrastructure/config/ConfigManager.ts`
- Delete: `src/infrastructure/config/ConfigManager.js`
- Modify: `src/app/serviceRegistry.ts`

**Interfaces:**
- Consumes: `toolRegistry` de `src/domain/tools/index.ts`, `publicSettings` de `shared/security.ts`.
- Produces: Implementaciones TypeScript con tipos para manifiestos de modelos (`AI_MODELS_REGISTRY`), contexto de ejecución de herramientas (`ToolExecutionContext`) y perfiles de configuración de la app.

- [ ] **Step 1: Migrar `ToolExecutor.js` a `ToolExecutor.ts` con tipos completos**
- [ ] **Step 2: Migrar `ModelManager.js` a `ModelManager.ts` con tipos completos**
- [ ] **Step 3: Migrar `ConfigManager.js` a `ConfigManager.ts` con tipos completos**
- [ ] **Step 4: Actualizar `src/app/serviceRegistry.ts` para importar los módulos `.ts`**
- [ ] **Step 5: Ejecutar `pnpm run typecheck:renderer` y asegurar compilación limpia**

---

### Task 4: Endurecimiento de ESLint

**Files:**
- Modify: `eslint.config.js`

**Interfaces:**
- Consumes: Configuración ESLint flat existente.
- Produces: Cobertura estricta para `src/domain/tools/**/*.ts`, `src/domain/gemini/ModelManager.ts`, `src/infrastructure/config/ConfigManager.ts` y `src/services/desktop/ElectronBridge.ts`.

- [ ] **Step 1: Actualizar la lista de archivos bajo la regla estricta en `eslint.config.js`**
- [ ] **Step 2: Ejecutar `pnpm run lint` y corregir cualquier advertencia o error emergente**

---

### Task 5: Ampliación de Pruebas Unitarias y Validación CI

**Files:**
- Create: `tests/bridge.test.ts`
- Create: `tests/tool-executor.test.ts`
- Modify: `scripts/run-tests.mjs`
- Modify: `docs/estado-auditoria-2026-09-10.md`

**Interfaces:**
- Consumes: Suites de tests con `node:test` y `node:assert`.
- Produces: Verificación automatizada de bridge y tool executor; informe de auditoría actualizado.

- [ ] **Step 1: Implementar `tests/bridge.test.ts` y `tests/tool-executor.test.ts`**
- [ ] **Step 2: Registrar nuevos tests en `scripts/run-tests.mjs`**
- [ ] **Step 3: Ejecutar suite de pruebas completa `pnpm test`**
- [ ] **Step 4: Ejecutar pipeline completo `pnpm run ci` (typechecks, lint, tests, build, build:electron, test:e2e)**
- [ ] **Step 5: Actualizar `docs/estado-auditoria-2026-09-10.md` reflejando el cierre técnico de todos los hallazgos**
