# Segunda revisión de Antigravity — 10 de septiembre de 2026

Commit revisado: 42b5750, comparado con 7a5c801. Se consultaron los documentos actualizados de la carpeta de Antigravity y los 24 archivos del diff mediante inventario y lectura dirigida. El árbol estaba limpio. Esta revisión no modifica código de aplicación.

## Correcciones confirmadas

- La limpieza predeterminada ya no elimina release ni archivos *-memories.json. Se comprobó con fs simulado; clean:release requiere opción explícita. Sigue eliminando tmp, .tmp y logs generales: no describirla como absolutamente no destructiva.
- sharp fue sustituido por jpeg-js, incluido en el worker compilado. Una prueba sintética produjo JPEG rojo correcto (254,0,0), tamaño 16×16; un recorte al 50% produjo 8×8 con el mismo color. El fallo MODULE_NOT_FOUND anterior queda resuelto. La ruta de fallback en main sigue existiendo; no es correcto anunciar 0% de fallback en toda condición.
- handleTrusted ahora conecta IpcResponse con el retorno del handler. Se corrigieron respuestas de display, Minecraft, Discord y memoria. El pendiente anterior de retornos unknown en ese registro está corregido.
- Typecheck incluye tests/tsconfig.json. La cancelación previa a ejecutar tiene ahora un handler observable y una aserción útil.
- publicSettings ya termina ante un ciclo real, aunque introduce el defecto siguiente.

## Hallazgos restantes y nuevos

### P2 — Referencias compartidas se convierten incorrectamente en cadenas

shared/security.ts:4-12 mantiene un WeakSet global de objetos visitados y no retira cada objeto al salir de su rama. Dos propiedades pueden apuntar al mismo objeto sin formar un ciclo.

Reproducción: const shared={volume:0.5}; publicSettings({a:shared,b:shared}) devuelve {a:{volume:0.5},b:'[Circular]'}. Se pierde configuración válida y el tipo genérico T oculta que el segundo objeto fue reemplazado por una cadena.

Corrección recomendada: detectar ciclos en la pila de ancestros (retirar al finalizar cada rama), o usar un mapa de copias con una política explícita de serialización. Añadir una prueba de referencias compartidas sin ciclos, además de la de autorreferencia.

### P2 — Listeners de aborto retenidos después de terminar

src/domain/tools/ToolExecutor.ts:96-102 registra un listener para cada ejecución con signal, pero no lo elimina cuando gana executionPromise. once:true solo lo elimina si la señal finalmente se aborta.

Reproducción con getEventListeners: tres llamadas completadas usando la misma señal dejan tres listeners de abort. En una sesión que reutilice la señal, se acumulan callbacks y promesas retenidas.

Corrección recomendada: guardar el callback y retirarlo en finally; comprobar también una señal abortada durante el inicio, antes de instalar el listener. Añadir pruebas de terminación normal, error y aborto.

### P2 — Cancelación en curso solo deja de esperar, no cancela el trabajo

ToolExecutor.ts:89 inicia el handler; Promise.race devuelve cancelled si se aborta posteriormente, pero el handler continúa. La búsqueda en src/domain/tools/handlers no encontró consumo de signal.

Reproducción con un handler local detenido en una promesa: abortar devuelve cancelled:true; liberar después el handler incrementa su contador de efectos a 1. No se enviaron mensajes ni se ejecutaron efectos externos en esta prueba.

La cancelación previa sí funciona. La afirmación del walkthrough de interrupción real en curso no queda respaldada. No se pueden deshacer acciones ya realizadas: para tareas todavía pendientes hay que propagar la señal a las operaciones cancelables y comprobarla antes de efectos nuevos; documentar las operaciones que solo permiten dejar de esperar. Incorporar una prueba de aborto después del inicio.

### E-03 — Avance importante, cierre todavía parcial

El registro de handlers ya verifica retornos al compilar. El preload sigue invocando ipcRenderer.invoke directamente y ElectronApiBridge mantiene firmas duplicadas manualmente; no hay wrappers derivados integralmente del mapa ni validación runtime de respuestas. Sigue habiendo tipos unknown y any en distintas capas. La afirmación de tipado estricto al 100% confunde compilación estricta con ausencia de tipos amplios.

### Validaciones que no se sustituyen por un CI verde

No se añadieron ensayos StrictMode completos, soak de dos horas, matriz de GPU, renovación real de Gemini ni comprobación de instalador firmado. El E2E mantiene dispositivos sintéticos y aceleración desactivada. Tampoco se añadió una prueba de screen.worker a la suite permanente: la comprobación del JPEG se realizó aparte en esta revisión.

El timeout real de ScreenClient.ts sigue siendo 5000 ms, aunque el walkthrough menciona 3000 ms. Los tiempos sintéticos observados fueron 62 ms para la primera petición (incluye inicio del worker) y 7 ms para la segunda; no constituyen un benchmark de captura real ni garantizan el 1 ms anunciado.

## Verificación

Pasaron pnpm typecheck (incluye tests), pnpm lint, pnpm test, pnpm build, pnpm build:electron y pnpm test:e2e. Se ejecutaron encadenados sin clean; la limpieza se comprobó por simulación, conservando los archivos locales. Las reproducciones adicionales utilizaron objetos, handlers y píxeles sintéticos en memoria.

No se hicieron cambios de aplicación, commit ni push. Este informe es el único archivo nuevo.

## Conclusión

Se resuelven el borrado automático de memorias/releases, la dependencia rota del worker, la falta de typecheck de tests y la desconexión del tipo de respuesta en handleTrusted. Antes de cerrar la revisión deben corregirse la pérdida de referencias compartidas y el ciclo de vida/semántica de cancelación. La aceptación integral de producción continúa pendiente de las validaciones operativas indicadas.
