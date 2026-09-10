# Guia de Integracion de Spotify en Cristi AI Companion

Cristi AI cuenta con un sistema de integración musical diseñado en tres niveles que le permite reproducir canciones, álbumes, listas de reproducción y controlar la reproducción de medios tanto en la aplicación de escritorio de **Spotify Desktop** como en **Spotify Web**, respondiendo de forma natural a la voz de Ariel en llamadas en vivo o a comandos de texto.

---

## 📑 Índice
1. [Arquitectura de los 3 Niveles de Integración](#1-arquitectura-de-los-3-niveles-de-integración)
2. [Nivel 1: Modo Nativo de Escritorio (Listo sin Configuración)](#2-nivel-1-modo-nativo-de-escritorio-listo-sin-configuración)
3. [Nivel 2: Configuración de la API Oficial de Spotify (Recomendado)](#3-nivel-2-configuración-de-la-api-oficial-de-spotify-recomendado)
4. [Nivel 3: Modo Navegador Web Autónomo con Playwright](#4-nivel-3-modo-navegador-web-autónomo-con-playwright)
5. [Comandos de Voz y Conversación Natural](#5-comandos-de-voz-y-conversación-natural)
6. [Catálogo de Herramientas de IA (Function Calling)](#6-catálogo-de-herramientas-de-ia-function-calling)
7. [Preguntas Frecuentes y Solución de Problemas](#7-preguntas-frecuentes-y-solución-de-problemas)

---

## 1. Arquitectura de los 3 Niveles de Integración

Cristi combina tres tecnologías complementarias para garantizar que siempre pueda interactuar con tu música:

```
                  ┌──────────────────────────────────────────────────┐
                  │              Voz / Chat de Ariel                 │
                  └─────────────────────────┬────────────────────────┘
                                            │
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │            Cristi AI (Gemini Live)               │
                  │         Herramientas spotify_* y mcp_*           │
                  └─────────────┬──────────────────────┬─────────────┘
                                │                      │
           ┌────────────────────┴────────┐             └─────────────────────┐
           ▼                             ▼                                   ▼
┌───────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────────────┐
│   NIVEL 1: DESKTOP    │   │     NIVEL 2: WEB API      │   │      NIVEL 3: PLAYWRIGHT       │
│  - Teclas multimedia  │   │ - Búsqueda de pistas      │   │ - Control autónomo de Brave    │
│  - URIs spotify:      │   │ - Resolución de URIs      │   │ - Navegación open.spotify.com  │
│  - Títulos de ventana │   │ - Token Client Credentials│   │ - Clics e interacción web     │
└───────────────────────┘   └───────────────────────────┘   └────────────────────────────────┘
```

---

## 2. Nivel 1: Modo Nativo de Escritorio (Listo sin Configuración)

Este modo funciona **automáticamente desde el primer segundo**, sin necesidad de crear cuentas de desarrollador ni ingresar claves:

- **Detección de Proceso y Canción:** Cristi consulta el proceso `Spotify.exe` en Windows mediante PowerShell para leer el título de la ventana principal. Gracias a esto, sabe qué canción y qué artista están sonando en tiempo real.
- **Teclas Multimedia:** Controla la reproducción (Play, Pausa, Siguiente, Anterior, Subir/Bajar volumen) a través de eventos de entrada multimedia de Windows.
- **Protocolo de URI Nativo:** Si le pides una canción, Cristi puede invocar el protocolo del sistema `spotify:search:<cancion>` o `spotify:track:<id>` para abrirla instantáneamente en tu app de Spotify.

> **Requisito:** Tener instalada y abierta la aplicación oficial de Spotify para Windows.

---

## 3. Nivel 2: Configuración de la API Oficial de Spotify (Recomendado)

Configurar la **Spotify Web API** le da a Cristi superpoderes: antes de abrir Spotify, consulta el catálogo oficial de millones de canciones, identifica la pista exacta solicitada y la reproduce directamente mediante su URI único (`spotify:track:...`), sin errores de coincidencia.

Sigue estos sencillos pasos (toma menos de 3 minutos):

### Paso 3.1: Entrar al Spotify Developer Dashboard
1. Abre tu navegador Brave y entra a:  
   👉 [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Inicia sesión con tu cuenta habitual de Spotify (puede ser cuenta Free o Premium).

### Paso 3.2: Crear tu Aplicación de Spotify
1. En la esquina superior derecha, haz clic en el botón verde **"Create App"**.
2. Completa el formulario:
   - **App name:** `Cristi AI Companion`
   - **App description:** `Asistente de escritorio para reproducción y control musical de Ariel`
   - **Redirect URIs:** Escribe:
     ```text
     http://127.0.0.1:8888/callback
     https://open.spotify.com
     ```
   - **Which API/SDKs are you planning to use?:** Marca la casilla **Web API**.
3. Acepta los términos de servicio para desarrolladores y haz clic en **"Save"**.

### Paso 3.3: Obtener tus Credenciales
1. En el panel de tu nueva app, haz clic en la pestaña **"Settings"** (arriba a la derecha).
2. Verás dos campos clave:
   - **Client ID:** Una cadena alfanumérica de 32 caracteres (ej: `4c8b2f90...`). Cópiala.
   - **Client Secret:** Haz clic en el enlace **"View client secret"** para revelar el secreto y cópialo.

### Paso 3.4: Guardar las Credenciales en Cristi AI
1. En Cristi AI, abre la ventana de Ajustes:
   - Presiona el atajo `Ctrl + Shift + S`, o
   - Haz clic en el icono de engranaje **⚙️** en la barra flotante (HUD) o en el menú contextual.
2. En el panel lateral izquierdo, selecciona la pestaña **"Spotify & Música"** (icono de nota musical 🎵).
3. Pega tu **Spotify Client ID** en el campo correspondiente.
4. Pega tu **Spotify Client Secret** en el campo correspondiente.
5. En esa misma pantalla podrás ver el estado en vivo de Spotify (si está ejecutándose, la pista actual y el artista) y un botón de prueba rápida para verificar que el enlace funcione.
6. Haz clic en **"GUARDAR AJUSTES"** en la esquina inferior derecha.

¡Listo! Cristi ya cuenta con acceso directo al catálogo global de Spotify.

---

## 4. Nivel 3: Modo Navegador Web Autónomo con Playwright

Si no tienes instalada la aplicación de escritorio de Spotify o te encuentras en un equipo donde solo deseas usar el reproductor web:

1. Cristi cuenta con el servidor MCP de **Playwright** integrado, que controla de manera autónoma el navegador **Brave** (`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`).
2. Cuando le pides reproducir música en la web, Cristi puede:
   - Abrir una pestaña en `https://open.spotify.com`.
   - Escribir en la barra de búsqueda web.
   - Hacer clic en el botón de reproducción de la canción o lista deseada.
3. Puedes solicitarle explícitamente: *"Cristi, abre Spotify en el navegador y pon mi lista de reproducción"*.

---

## 5. Comandos de Voz y Conversación Natural

Cristi comprende lenguaje natural en español sin necesidad de comandos rígidos. Puedes pedirle lo siguiente mientras conversas con ella por llamada en vivo:

### 🎧 Reproducir Música
- *"Cristi, pon algo de música para programar."*
- *"Pon la canción Starboy de The Weeknd en Spotify."*
- *"Reproduce la lista de lofi hip hop."*
- *"Quiero escuchar a Daft Punk."*

### ⏸️ Control de Reproducción
- *"Pausa la música, por favor."*
- *"Reanuda la canción."*
- *"Pon la siguiente pista."* / *"Pasa de canción."*
- *"Regresa a la canción anterior."*

### ℹ️ Información de lo que suena
- *"¿Qué canción está sonando ahorita?"*
- *"¿De quién es esta canción?"*

### 🔊 Volumen
- *"Sube un poco el volumen de la música."*
- *"Baja el volumen que está muy alto."*

---

## 6. Catálogo de Herramientas de IA (Function Calling)

Gemini Live tiene a su disposición las siguientes funciones nativas para operar Spotify:

| Herramienta | Parámetros | Descripción |
| :--- | :--- | :--- |
| `spotify_play` | `query` (opcional), `uri` (opcional), `useWeb` (opcional) | Reproduce una canción o lista. Si no se especifican argumentos, reanuda la pista actual. |
| `spotify_pause` | Ninguno | Pausa la reproducción activa. |
| `spotify_next` | Ninguno | Salta a la siguiente canción de la cola. |
| `spotify_previous` | Ninguno | Vuelve a la pista previa. |
| `spotify_get_status` | Ninguno | Retorna el estado en vivo: si la app está abierta, si reproduce música, pista y artista. |
| `spotify_search` | `query` (requerido), `type` (opcional: track/album/artist/playlist) | Realiza búsquedas detalladas en el catálogo de Spotify. |
| `spotify_set_volume` | `direction` ('up' o 'down') | Ajusta el volumen de reproducción multimedia. |

---

## 7. Preguntas Frecuentes y Solución de Problemas

### ¿Es necesario tener Spotify Premium?
**No.** Tanto el control nativo de escritorio (Play, Pausa, Siguiente, Anterior, Búsqueda) como el reproductor web funcionan perfectamente con cuentas **Spotify Free**. En cuentas Free aplican las reglas habituales de publicidad de Spotify.

### Cristi dice que no encuentra la pista en la app de escritorio
Asegúrate de que la aplicación de Spotify esté abierta en Windows. Si no estaba abierta, la primera petición de Cristi iniciará el proceso de Spotify automáticamente.

### ¿Mis credenciales (Client ID y Client Secret) están seguras?
**Sí.** Se guardan de forma 100% local en tu equipo dentro del archivo `cristi-config.json` y nunca son enviadas a ningún servidor externo aparte de los endpoints oficiales de autenticación de `accounts.spotify.com`.

### ¿Puedo pedirle que ponga música mientras comparto pantalla o juego?
**Sí.** Gracias a la arquitectura desvinculada de audio y video con protección de congestión de sockets, Cristi puede reproducir música en Spotify y continuar hablando contigo mientras observa tu pantalla o tu cámara sin ninguna interferencia.
