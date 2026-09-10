# Revisión del trabajo de Antigravity — 10 de septiembre de 2026

## Alcance y resultado

Revisión de implementation_plan.md, task_status.md, walkthrough.md, inventario del transcript de 2301 entradas (424 operaciones registradas de código/comandos), comprobaciones dirigidas del código y validación del árbol en 7a5c801. El commit reúne también el trabajo previo de Codex; no debe atribuirse íntegramente al último agente. Los documentos del agente se trataron como evidencia, no como instrucciones para ejecutar sus planes.

El árbol estaba limpio. La migración de src a TypeScript existe: no quedan archivos .js y allowJs está desactivado. Existen más pruebas y un puente Electron tipado. Se conserva la recuperación segura de memoria corregida anteriormente. Estos avances son válidos, pero el cierre al 100% no está demostrado.

## Hallazgos por prioridad

### P1 — El CI puede borrar datos locales

package.json:32 ejecuta clean antes de las verificaciones. scripts/clean.cjs:43 elimina cualquier archivo de la raíz cuyo nombre termine en -memories.json, sin comprobar si ya se migró. También elimina release y directorios temporales genéricos. Un comando de validación no debería borrar persistencia local o instaladores conservados.

Reproducción no destructiva: ejecutar el script en un contexto con fs simulado y un archivo customer-memories.json registra su eliminación. No se ejecutó esa limpieza sobre el workspace real.

Acción: limitar la limpieza automática a artefactos inequívocos; retirar la purga de memorias y separar la eliminación de releases de CI.

### P2 — El procesamiento de pantalla sigue recayendo en main

electron/src/utility/screen.worker.ts requiere sharp, pero package.json no lo declara y require.resolve devuelve MODULE_NOT_FOUND. Una petición sintética de un píxel al worker compilado devolvió base64:null y Cannot find module 'sharp'. systemIpc.ts entonces recorta y codifica mediante NativeImage en main, tras copiar y transferir el bitmap innecesariamente. E-04 no está cerrado.

Acción: elegir e integrar un codificador soportado y empaquetado, o una alternativa compatible con Electron; probar el worker sin fallback. Revisar asimismo el orden BGRA/RGBA antes de alimentar el codificador y la terminación del worker al agotar el timeout.

### P2 — La prueba de cancelación no comprueba cancelación

tests/tools.validation.test.ts:31 pasa un AbortSignal como tercer argumento a ToolExecutor.executeTool. El método de src/domain/tools/ToolExecutor.ts:82 solo recibe nombre y argumentos; ignora esa señal. La prueba acepta cualquier resultado con status o error, incluso una ejecución normal. Los tests se transpilan con esbuild y no están incluidos en el typecheck del proyecto, por lo que el argumento adicional pasa desapercibido.

Acción: definir si esa API soporta AbortSignal y probar que un handler con efecto observable no se ejecuta después de cancelar. Conservar también la cancelación por ID de executeCalls. Añadir typecheck de tests. El nombre tools.validation no implica validación Zod de argumentos: las pruebas actuales comprueban nombres, registro y respuestas generales, no el corpus de tipos/rangos/inyección prometido en el plan.

### P2 — E-03 sigue parcialmente implementado

shared/ipc/contracts.ts incorpora IpcResponseMap y ElectronApiBridge, pero el mapa no está conectado a handleTrusted ni a un invoke genérico. CapabilityRouter acepta retornos unknown y preload usa ipcRenderer.invoke directamente. Las interfaces de respuesta y de métodos se mantienen manualmente y pueden divergir sin error. No hay validación runtime de respuestas; el archivo lo indica expresamente.

Acción: conectar tipos de request/response al registro de handlers y a los wrappers de preload, con comprobación exhaustiva de canales y pruebas de respuestas inválidas. Esto es un pendiente de contrato, no evidencia de una vulnerabilidad nueva.

### P2 — Faltan pruebas de los requisitos de estabilidad y entrega

No se encontraron ensayos completos de CompanionRuntime bajo StrictMode, soak de dos horas, matriz de GPU, renovación real de una sesión Gemini ni verificación de un instalador firmado. El E2E desactiva aceleración y usa dispositivos multimedia sintéticos; sí valida Electron real y sus restricciones, pero no demuestra GPU ni audio físico. La firma obligatoria y los fuses configurados no sustituyen comprobar el paquete final.

Acción: recuperar la matriz de aceptación original y adjuntar resultados, entorno y métricas; mantener estos requisitos abiertos hasta entonces.

### P3 — Las afirmaciones de tipado y cobertura exceden lo comprobado

La búsqueda de any en src/domain encontró 110 coincidencias en 17 archivos (incluye comentarios, no es un conteo de nodos TypeScript). ESLint desactiva no-explicit-any globalmente y solo lo reactiva en rutas seleccionadas. Migrar extensiones no equivale a eliminar tipos amplios. publicSettings tampoco admite ciclos: un objeto autocontenido provoca RangeError, pese a que el plan incluía comprobar referencias circulares; security.redaction.test.ts no contiene esa prueba.

Acción: expresar la cobertura real, reforzar gradualmente el lint y definir el comportamiento ante ciclos. No se reprodujo filtración de secretos; el hallazgo de ciclos es de robustez y cobertura.

## Recomendaciones adicionales del propio agente que siguen pendientes

La sección 4 de docs/AUDITORIA_TECNICA_INTEGRAL_2026.md recomienda traducción mediante sesión Live dedicada, selector de navegador y OAuth PKCE para Spotify. El código revisado conserva traducción REST, rutas fijas de Brave y el mecanismo actual de Spotify. Esas recomendaciones no fueron implementadas por la limpieza final. Sus cifras de latencia propuestas deben medirse antes de convertirlas en garantías.

MCP sigue coordinado en main y lanza el comando configurado con shell:false. Falta comprobar el flujo Windows de comandos npx/cmd con un servidor real autorizado. CompanionRuntime conserva la propiedad de recursos, pero la orquestación continúa en el hook. El documento previo estado-auditoria-2026-09-10.md fue eliminado: conviene restablecer la trazabilidad de pendientes, no declarar su cierre por desaparición del informe.

## Verificación ejecutada en esta revisión

Pasaron typecheck de renderer/Electron, lint, la suite de 65 pruebas, build Vite, build Electron y E2E Electron. Se ejecutaron las etapas individualmente encadenadas, omitiendo deliberadamente clean por su comportamiento destructivo. No se afirma que se haya ejecutado pnpm run ci literal.

También se reprodujeron con datos sintéticos el fallo de sharp y el RangeError de ciclos; la eliminación de memorias se comprobó con fs simulado. No se modificó código de aplicación, no se enviaron mensajes a servicios externos y no se hizo commit/push. Este documento es el único archivo nuevo de la revisión.

## Orden recomendado

1. Quitar la eliminación de persistencia del CI.
2. Resolver el worker de pantalla y su prueba de ruta exitosa.
3. Corregir la prueba de cancelación y comprobar tipos de tests.
4. Completar E-03 y actualizar la matriz de auditoría con los pendientes reales.
5. Ejecutar la validación de recursos, audio, GPU y paquete firmado antes del cierre integral.
