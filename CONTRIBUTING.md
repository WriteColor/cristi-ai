# 🤝 Guía de Contribución para Cristi AI Companion

¡Gracias por tu interés en contribuir a **Cristi AI Companion**! Este proyecto es una plataforma de código abierto de alto rendimiento para asistentes virtuales de escritorio con avatares Live2D e inteligencia artificial multimodal en tiempo real.

---

## 📜 Código de Conducta
Mantenemos una comunidad abierta, respetuosa e inclusiva. Por favor, asegúrate de mantener un tono constructivo y profesional en issues, discusiones y Pull Requests.

---

## 🛠️ Entorno de Desarrollo y Requisitos

### 1. Gestor de Paquetes Exclusivo: pnpm
> ⚠️ **Regla Crítica:** Este proyecto utiliza **estrictamente pnpm**. No utilices 
pm ni yarn bajo ninguna circunstancia.

Para habilitar pnpm en tu sistema:
`powershell
corepack enable
corepack prepare pnpm@latest --activate
`

### 2. Puesta en Marcha en 1 Clic
* Ejecuta setup.bat (Windows Explorer) o .\setup.ps1 (PowerShell).
* O manualmente:
  `powershell
  pnpm install
  pnpm run setup:env
  `

---

## 🏛️ Estándares de Arquitectura y Rendimiento

Al desarrollar nuevas características o refactorizar:

1. **Rendimiento de la UI & Zero-Lag:**
   * Nunca utilices ackdrop-filter: blur(...) sobre ventanas transparentes de Electron. Usa colores alfa Obsidian (gba(13, 14, 21, 0.96)).
   * Envuelve los componentes y modales con React.memo para evitar re-renderizados innecesarios del árbol.
2. **Ciclo de Vida de Live2D & WebGL:**
   * Nunca acoples el ciclo de vida del canvas WebGL a estados reactivos dinámicos (isSpeaking, isListening, etc.).
   * Libera siempre los recursos de modelos y texturas con model.destroy({ children: true, texture: true, baseTexture: true }).
3. **Fronteras IPC Seguras & No Bloqueantes:**
   * Todos los handlers de Electron IPC en electron/main.cjs deben manejar errores con 	ry/catch y timeouts estrictos.
   * Utiliza la API nativa de captura desktopCapturer en lugar de invocar subprocesos bloqueantes.
4. **Protección de Credenciales & Privacidad:**
   * Nunca hagas hardcoding de claves de API en el código fuente.
   * Todas las credenciales deben cargarse desde variables de entorno (.env) o el gestor persistente de ajustes del usuario.

---

## 🧪 Verificación y Diagnósticos Obligatorios

Antes de abrir un Pull Request o enviar cambios, debes verificar que todas las suites de diagnóstico pasen al 100%:

`powershell
pnpm run build
pnpm run test:diagnostics
`

Debe mostrar: **12/12 SUITES COMPLETADAS CON ÉXITO (100% PASS)**.

---

## 🚀 Proceso de Pull Request

1. Haz un Fork del repositorio: [https://github.com/WriteColor/cristi-ai](https://github.com/WriteColor/cristi-ai)
2. Crea tu rama de características: git checkout -b feature/mi-mejora
3. Realiza tus cambios asegurando formato limpio y pruebas verdes.
4. Haz commit siguiendo conventional commits: git commit -m "feat: descripción clara"
5. Haz push a tu repositorio y abre un Pull Request hacia la rama master.

---

## 📄 Licencia
Al contribuir al proyecto, aceptas que tus contribuciones se licencien bajo la [Licencia MIT](LICENSE).
