# Directrices de Desarrollo, Arquitectura y Mantenimiento — Cristi AI Companion

Este documento establece las normas obligatorias de ingeniería de software, arquitectura de sistemas, gestión de dependencias, tipado, validación y mantenimiento para el repositorio **Cristi AI Companion**.

---

## 1. Principios de Diseno Arquitectonico

El sistema sigue un modelo de cuatro capas estrictamente desacopladas para garantizar aislamiento de privilegios, resiliencia y cero jank en la interfaz grafica:

```
[ Capa 1: UI & Renderer (React 19 + PixiJS 7) ]
                      │
                      ▼
[ Capa 2: Preload Security Bridge (contextBridge + safeContracts) ]
                      │
                      ▼
[ Capa 3: Main Process & Capability Router (Electron 43 + Node 24) ]
                      │
                      ▼
[ Capa 4: Dedicated Worker Threads (SQLite WAL, DesktopCapturer, Playwright) ]
```

### Reglas Inmutables de Capas:
1. **Aislamiento de Privilegios:**
   - Las ventanas de Electron se configuran siempre con `contextIsolation: true`, `sandbox: true` y `nodeIntegration: false`.
   - Prohibido exponer el modulo `remote`, `ipcRenderer.sendSync` o el objeto `ipcRenderer` completo al objeto global `window`.
2. **Contratos IPC Centralizados:**
   - Toda comunicacion entre Renderer y Main debe estar definida y tipada en `shared/contracts.ts`.
   - Prohibido enviar cadenas arbitrarias como nombres de canal. Todo canal debe pasar por la lista blanca de `channelAllowed(channel, windowKind)`.
3. **Descarga de Tareas Pesadas a Hilos Dedicados:**
   - Ningun procesamiento intensivo (consultas complejas de base de datos, compresion de capturas de pantalla, automatizacion de Playwright) puede ejecutarse en el Event Loop principal de Electron ni en el hilo de renderizado de React.
   - Cada subsistema pesado debe residir en un `Worker` dedicado en `electron/src/utility/`.

---

## 2. Politica de Gestor de Paquetes y Dependencias

1. **Uso Exclusivo de pnpm:**
   - Esta TERMINANTEMENTE PROHIBIDO el uso de `npm` o `yarn`. Se debe utilizar exclusivamente `pnpm` (y `pnpm dlx` para sustituir a `npx`).
   - Todo cambio en dependencias debe reflejarse en `package.json` y actualizar `pnpm-lock.yaml` de forma reproducible.
2. **Criterio de Ingestion de Nuevas Librerias:**
   - Antes de anadir cualquier dependencia, se debe verificar si la funcionalidad ya esta provista por la API estandar de Node.js 24 (ej: `node:sqlite`, `node:worker_threads`, `node:crypto`, `node:test`).
   - Prohibido anadir wrappers redundantes (ej: PostCSS/Autoprefixer cuando Tailwind v4 se compila directamente con `@tailwindcss/vite`).

---

## 3. Politica de Tipado y Calidad de Codigo (TypeScript)

1. **Modo Estricto Total:**
   - Tanto `tsconfig.json` del renderer como `electron/tsconfig.json` deben mantener `strict: true` y `allowJs: false`.
   - Prohibido el uso de `any` en codigo de dominio (`src/domain/`) y contratos (`shared/`). Si se requiere deserializar payloads externos, se debe utilizar `unknown` junto con esquemas de validacion en tiempo de ejecucion con Zod.
2. **Validacion Estricta de Entradas:**
   - Todos los argumentos recibidos por herramientas (`IToolHandler`) deben validarse contra su esquema antes de iniciar la ejecucion.
   - Las rutas de archivo deben pasar obligatoriamente por `validateRelativePath()` y `PathPolicy.resolveWithin()` para impedir ataques de cruce de directorios (Directory Traversal o escapes por symlink/junction).

---

## 4. Politica de Salidas de Consola y Logs Profesionales

1. **Formato Estandarizado de Mensajes:**
   - Todos los logs del sistema deben generarse a traves del servicio `logger` o mediante prefijos estructurados:
     `[TIMESTAMP] [TAG] Mensaje explicativo`
   - En scripts de entorno y terminal se deben utilizar exclusivamente etiquetas tecnicas:
     `[OK]`, `[INFO]`, `[WARN]`, `[FAIL]`, `[INPUT]`
2. **Prohibicion de Emojis Decorativos:**
   - Queda estrictamente prohibido el uso de emojis decorativos en logs de consola, mensajes de depuracion, nombres de clases o cabeceras de documentacion tecnica.
3. **Sanitizacion Obligatoria de Credenciales:**
   - Todo texto, URL o estructura de datos que vaya a escribirse en logs o enviarse a consolas publicas debe procesarse con `redactText()` y `publicSettings()` para asegurar que API Keys, tokens de acceso o contrasenas queden sustituidos por `[REDACTED]`.

---

## 5. Compuertas de Calidad y Pipeline de Integracion Continua (CI)

Antes de fusionar codigo o publicar una version, se debe ejecutar y superar el pipeline completo de 7 compuertas con:

```bash
pnpm run ci
```

Las 7 compuertas obligatorias son:
1. **`pnpm run clean`**: Purga de artefactos compilados, temporales y caches locales.
2. **`pnpm run typecheck`**: Verificacion estricta de tipos de TypeScript en Renderer (`tsc --noEmit`) y Electron (`tsc -p electron/tsconfig.json --noEmit`).
3. **`pnpm run lint`**: Analisis estatico con ESLint sobre `src`, `electron/src`, `shared` y configuraciones.
4. **`pnpm run test`**: Suite completa de pruebas unitarias y de aislamiento (65+ pruebas con 0 fallos).
5. **`pnpm run build`**: Compilacion del bundle de produccion de Vite con Rolldown / esbuild.
6. **`pnpm run build:electron`**: Compilacion y empaquetado de procesos Main y Preloads aislados.
7. **`pnpm run test:e2e`**: Prueba de extremo a extremo en entorno Electron headless validando IPC, seguridad de canario y protocolos.

---

## 6. Mantenimiento y Sincronizacion de Documentacion Viva

1. **Documentacion como Especificacion de la Verdad:**
   - La documentacion tecnica almacenada en `docs/` debe reflejar fielmente el codigo existente y probado.
   - Prohibido documentar caracteristicas no soportadas o simuladas. Si una funcion es experimental o requiere integraciones futuras, debe indicarse explicitamente con su estado real.
2. **Actualizacion Atomica:**
   - Cada modificacion que altere la firma de una herramienta, el protocolo de audio, el esquema de persistencia de SQLite o las rutas de configuracion debe acompanarse de la actualizacion inmediata del documento correspondiente en `docs/`.
