/**
 * Cristi AI - Tool Function Declarations for Gemini Multimodal Live API
 * Extended with: avatar movement, full system access, tactical HUD widgets, and screen capture tools.
 */

export const COMPANION_FUNCTION_DECLARATIONS = [
  // ─────────────────────────────────────────────────────────────────────
  // AVATAR CONTROL
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'trigger_companion_gesture',
    description: 'Activa un gesto, expresión facial o emoción en el avatar de la compañera virtual en pantalla adaptándose al modelo Live2D activo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        gesture: {
          type: 'STRING',
          enum: ['idle', 'happy', 'blush', 'love', 'surprised', 'yandere', 'crazy', 'thinking', 'wink', 'pout', 'angry', 'sad', 'smug', 'gamer', 'nod', 'dance', 'relaxed', 'waving'],
          description: 'El gesto o emoción que debe manifestar el avatar.'
        },
        comment: {
          type: 'STRING',
          description: 'Breve razón interna del cambio emocional (opcional).'
        }
      },
      required: ['gesture']
    }
  },
  {
    name: 'trigger_model_motion',
    description: 'Dispara una animación o pose de movimiento específica del modelo Live2D activo (ej: saludar, giro, tap en la cabeza, postura idle, pose de encanto).',
    parameters: {
      type: 'OBJECT',
      properties: {
        motion_group: {
          type: 'STRING',
          description: 'Nombre del grupo de animación (ej: "Idle", "Tap", "Flick", "MeiYan", "HuiShou", "DaiJi").'
        },
        index: {
          type: 'INTEGER',
          description: 'Índice de la animación dentro del grupo (por defecto 0).'
        }
      },
      required: ['motion_group']
    }
  },
  {
    name: 'move_avatar',
    description: 'Mueve el avatar de Cristi a una posición específica en pantalla con una animación opcional. Úsalo para expresar tu estado de ánimo, para acercarte al usuario o para moverte por capricho.',
    parameters: {
      type: 'OBJECT',
      properties: {
        position: {
          type: 'STRING',
          enum: ['center', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'random'],
          description: 'Posición destino en la pantalla.'
        },
        animation: {
          type: 'STRING',
          enum: ['none', 'bounce', 'float', 'shake', 'dance', 'slide'],
          description: 'Animación al llegar a la posición. Por defecto slide suave.'
        }
      },
      required: ['position']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // INFORMACIÓN DEL SISTEMA
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'get_current_time_and_date',
    description: 'Obtiene la hora actual exacta, fecha completa, día de la semana y zona horaria del sistema local.'
  },
  {
    name: 'get_weather',
    description: 'Consulta el clima actual o pronóstico de una ciudad dada o ubicación local.',
    parameters: {
      type: 'OBJECT',
      properties: {
        city: {
          type: 'STRING',
          description: 'Nombre de la ciudad o localidad a consultar. Si no se especifica, usa la ubicación del usuario.'
        }
      }
    }
  },
  {
    name: 'system_diagnostics',
    description: 'Obtiene métricas en tiempo real del sistema: CPU, RAM, procesos activos, FPS del avatar, estado del micrófono y cámara.'
  },

  // ─────────────────────────────────────────────────────────────────────
  // ACCESO TOTAL AL SISTEMA (VIA ELECTRON / POWERSHELL NATIVO)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'execute_system_command',
    description: 'Ejecuta cualquier comando en el sistema operativo Windows del usuario (PowerShell o cmd). Tienes acceso completo al sistema. Usa esto para abrir apps, gestionar archivos, consultar el sistema, ejecutar scripts, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: {
          type: 'STRING',
          description: 'El comando completo a ejecutar (ej: "Get-Process", "notepad.exe", "ipconfig /all", "dir C:\\").'
        },
        use_powershell: {
          type: 'BOOLEAN',
          description: 'Si es true, fuerza ejecución en PowerShell. Por defecto true.'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'read_file',
    description: 'Lee el contenido de cualquier archivo del sistema de archivos del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta absoluta del archivo a leer (ej: "C:\\Users\\jerem\\Documents\\nota.txt").'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Crea o sobreescribe un archivo en el sistema de archivos del usuario con el contenido especificado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta absoluta del archivo a crear o sobreescribir.'
        },
        content: {
          type: 'STRING',
          description: 'Contenido a escribir en el archivo.'
        },
        append: {
          type: 'BOOLEAN',
          description: 'Si es true, agrega el contenido al final sin borrar lo existente. Por defecto false.'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'Lista los archivos y carpetas de un directorio del sistema del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta absoluta del directorio a listar (ej: "C:\\Users\\jerem\\Desktop").'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'get_clipboard',
    description: 'Lee el contenido actual del portapapeles del sistema del usuario.'
  },
  {
    name: 'set_clipboard',
    description: 'Escribe texto en el portapapeles del sistema del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description: 'Texto a copiar al portapapeles.'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'get_running_processes',
    description: 'Lista los procesos activos en el sistema del usuario con nombre, PID y uso de memoria.'
  },
  {
    name: 'kill_process',
    description: 'Termina un proceso en ejecución por su nombre o PID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pid_or_name: {
          type: 'STRING',
          description: 'Nombre del proceso (ej: "notepad.exe") o PID numérico a terminar.'
        }
      },
      required: ['pid_or_name']
    }
  },
  {
    name: 'open_file_or_folder',
    description: 'Abre cualquier archivo local o carpeta del sistema operativo directamente en el Explorador de Windows o con su aplicación predeterminada.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Ruta absoluta o relativa del archivo o carpeta a abrir (ej: "C:\\Users\\jerem\\Downloads", "C:\\React-Nextjs-Projects").'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'open_system_app_or_link',
    description: 'Abre un enlace web, aplicación o archivo usando el programa predeterminado del sistema.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'URL completa a abrir, o ruta a una aplicación/archivo del sistema (ej: "https://youtube.com", "C:\\Windows\\notepad.exe").'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'computer_action',
    description: 'Ejecuta acciones interactivas de uso de la computadora (Computer Use): clic de ratón, escritura de texto, presionar teclas, scroll o captura de pantalla.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['mouse_click', 'type_text', 'press_key', 'mouse_scroll', 'take_screenshot'],
          description: 'La acción de interfaz a realizar.'
        },
        coordinate: {
          type: 'ARRAY',
          items: { type: 'INTEGER' },
          description: '[x, y] coordenadas en píxeles de la pantalla para mouse_click.'
        },
        text: {
          type: 'STRING',
          description: 'Texto a escribir si la acción es "type_text".'
        },
        key: {
          type: 'STRING',
          description: 'Tecla a presionar (ej: "Enter", "Tab", "Escape", "Control+s") si action es "press_key".'
        },
        scroll_amount: {
          type: 'INTEGER',
          description: 'Cantidad de scroll vertical (positivo hacia abajo, negativo hacia arriba).'
        }
      },
      required: ['action']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // VISIÓN DE PANTALLA
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'capture_screen_snapshot',
    description: 'Captura un fotograma de la pantalla del usuario en este momento y te lo envía para que puedas ver qué está haciendo o qué hay en la pantalla. Puedes especificar qué región ver.',
    parameters: {
      type: 'OBJECT',
      properties: {
        region: {
          type: 'STRING',
          enum: ['full', 'active_region', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'],
          description: 'Qué parte de la pantalla capturar. "full" para toda la pantalla, "active_region" para el área de visión configurada.'
        }
      }
    }
  },
  {
    name: 'set_screen_watch',
    description: 'Activa o desactiva la vigilancia continua de la pantalla del usuario. Cuando está activa, recibirás frames periódicos de la pantalla automáticamente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        enabled: {
          type: 'BOOLEAN',
          description: 'true para activar la vigilancia continua, false para detenerla.'
        }
      },
      required: ['enabled']
    }
  },
  {
    name: 'set_screen_region',
    description: 'Define programáticamente el área de visión de Cristi en pantalla (en porcentaje del tamaño de la ventana). El área se destacará con un borde visual violeta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x_pct: {
          type: 'NUMBER',
          description: 'Posición horizontal del borde izquierdo como porcentaje de la pantalla (0–100).'
        },
        y_pct: {
          type: 'NUMBER',
          description: 'Posición vertical del borde superior como porcentaje de la pantalla (0–100).'
        },
        w_pct: {
          type: 'NUMBER',
          description: 'Ancho del área como porcentaje de la pantalla (0–100).'
        },
        h_pct: {
          type: 'NUMBER',
          description: 'Alto del área como porcentaje de la pantalla (0–100).'
        }
      },
      required: ['x_pct', 'y_pct', 'w_pct', 'h_pct']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // CÁMARA Y RECONOCIMIENTO VISUAL
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'analyze_visual_scene',
    description: 'Solicita un análisis de la cámara del usuario para inspeccionar qué está viendo, objetos, posturas o expresiones.',
    parameters: {
      type: 'OBJECT',
      properties: {
        focus_target: {
          type: 'STRING',
          description: 'Elemento específico a observar (ej: "expresión del usuario", "lo que sostiene", "entorno").'
        }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // AUDIO EXTERNO / LOOPBACK
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'start_desktop_audio_capture',
    description: 'Inicia la captura etiquetada del audio de una pantalla o ventana compartida para análisis o traducción. Solicita el selector nativo de Chromium y no mezcla ese audio con el micrófono.',
    parameters: {
      type: 'OBJECT',
      properties: {
        source_id: {
          type: 'STRING',
          description: 'Etiqueta estable del origen, por ejemplo game_loopback, spotify o system_loopback.'
        },
        keep_video_track: {
          type: 'BOOLEAN',
          description: 'Conserva la pista de vídeo del selector cuando también se necesita visión.'
        },
        translate: {
          type: 'BOOLEAN',
          description: 'Activa el procesamiento de traducción por lotes para este origen de audio.'
        },
        target_language: {
          type: 'STRING',
          description: 'Idioma destino ISO (por ejemplo es, en, ja).'
        },
        aggregate_ms: {
          type: 'NUMBER',
          description: 'Duración aproximada del lote de audio, entre 200 y 1200 ms.'
        }
      }
    }
  },
  {
    name: 'stop_desktop_audio_capture',
    description: 'Detiene la captura de audio externo y libera inmediatamente sus pistas y AudioWorklet.'
  },
  {
    name: 'desktop_audio_capture_status',
    description: 'Devuelve el estado y el número de frames de la captura de audio externo.'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MEMORIA PERMANENTE
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'manage_memory',
    description: 'Guarda o recupera un recuerdo, nota o preferencia del usuario en la memoria local permanente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['save', 'get', 'list'],
          description: '"save" para guardar, "get" para recuperar, "list" para listar recuerdos.'
        },
        key: {
          type: 'STRING',
          description: 'Clave o concepto a recordar (ej: "nombre_mascota").'
        },
        value: {
          type: 'STRING',
          description: 'Información a almacenar cuando action es "save".'
        }
      },
      required: ['action']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // WIDGETS TÁCTICOS Y NOTIFICACIONES
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'set_reminder',
    description: 'Crea y fija un recordatorio interactivo táctico en la pantalla para el usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Título o contenido del recordatorio.'
        },
        time: {
          type: 'STRING',
          description: 'Hora programada (ej: "14:30"). Si se omite, se usa la hora actual.'
        },
        tag: {
          type: 'STRING',
          description: 'Etiqueta de categoría (ej: "Trabajo", "Salud", "Cristi").'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'set_alarm',
    description: 'Programa una alarma o alerta temporizada visual y sonora en el escritorio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        time: {
          type: 'STRING',
          description: 'Hora de la alarma en formato HH:mm (ej: "08:30").'
        },
        label: {
          type: 'STRING',
          description: 'Etiqueta o razón de la alarma.'
        }
      },
      required: ['time']
    }
  },
  {
    name: 'show_tactical_widget',
    description: 'Muestra una tarjeta táctica HUD flotante en pantalla con información, datos o alertas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
          enum: ['info', 'warning', 'reminder', 'status', 'weather'],
          description: 'Tipo de widget táctico.'
        },
        title: {
          type: 'STRING',
          description: 'Título principal del widget.'
        },
        content: {
          type: 'STRING',
          description: 'Contenido o texto detallado.'
        },
        duration: {
          type: 'INTEGER',
          description: 'Duración en pantalla en milisegundos (por defecto 10000).'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'dismiss_tactical_widget',
    description: 'Descarta u oculta un widget táctico específico mostrado en pantalla por su identificador.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Identificador del widget a descartar.'
        }
      },
      required: ['id']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // MEMORIA CONTEXTUAL Y PERSISTENTE
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'remember_fact',
    description: 'Guarda un dato, preferencia, lección o recuerdo permanente sobre el usuario en tu base de memoria a largo plazo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        key: {
          type: 'STRING',
          description: 'Concepto clave o identificador corto (ej: "comida_favorita", "proyecto_actual", "cumpleaños").'
        },
        content: {
          type: 'STRING',
          description: 'El recuerdo detallado o afirmación que deseas fijar en tu memoria.'
        },
        category: {
          type: 'STRING',
          enum: ['fact', 'preference', 'relationship', 'task', 'minecraft', 'conversation'],
          description: 'Categoría del recuerdo (por defecto "fact").'
        },
        importance: {
          type: 'NUMBER',
          description: 'Nivel de importancia de 0.1 a 1.0.'
        }
      },
      required: ['key', 'content']
    }
  },
  {
    name: 'search_memory',
    description: 'Busca en tu banco de memoria permanente recuerdos y notas almacenadas sobre el usuario o temas pasados.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Palabras clave o frase a buscar en la memoria.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'delete_memory',
    description: 'Elimina un recuerdo obsoleto de tu base de memoria.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id_or_key: {
          type: 'STRING',
          description: 'ID o clave del recuerdo a olvidar.'
        }
      },
      required: ['id_or_key']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // NAVEGACIÓN Y BÚSQUEDA WEB (BRAVE BROWSER)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'search_internet',
    description: 'Realiza una búsqueda en internet en tiempo real para obtener información actualizada, noticias, guías o datos de la web.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'La consulta o términos de búsqueda.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'browse_web_page',
    description: 'Visita una página web específica y extrae su texto limpio y contenido para leerlo y responder al usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'La URL completa de la página web a consultar (ej: "https://es.wikipedia.org/wiki/...").'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'open_in_brave_browser',
    description: 'Abre una URL directamente en el navegador Brave en el escritorio del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'La URL a abrir en Brave Browser.'
        }
      },
      required: ['url']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // MINECRAFT COMPANION (AIRI INSPIRED)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'minecraft_connect',
    description: 'Conecta tu bot compañero al servidor de Minecraft del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        host: { type: 'STRING', description: 'Dirección IP o host del servidor (por defecto "localhost").' },
        port: { type: 'INTEGER', description: 'Puerto del servidor (por defecto 25565).' },
        username: { type: 'STRING', description: 'Nombre de usuario del bot (por defecto "Cristi_AI").' }
      }
    }
  },
  {
    name: 'minecraft_disconnect',
    description: 'Desconecta tu bot del servidor de Minecraft.'
  },
  {
    name: 'minecraft_get_status',
    description: 'Consulta tu estado en el juego: vida, hambre, coordenadas (X, Y, Z), dimensión y jugadores cercanos.'
  },
  {
    name: 'minecraft_chat',
    description: 'Envía un mensaje de texto en el chat público de Minecraft.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: { type: 'STRING', description: 'El mensaje a enviar al chat del juego.' }
      },
      required: ['message']
    }
  },
  {
    name: 'minecraft_move_to',
    description: 'Navega autónomamente y camina hacia unas coordenadas X, Y, Z específicas en Minecraft.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'INTEGER', description: 'Coordenada X.' },
        y: { type: 'INTEGER', description: 'Coordenada Y.' },
        z: { type: 'INTEGER', description: 'Coordenada Z.' }
      },
      required: ['x', 'y', 'z']
    }
  },
  {
    name: 'minecraft_follow_player',
    description: 'Sigue automáticamente y acompaña a un jugador específico en Minecraft.',
    parameters: {
      type: 'OBJECT',
      properties: {
        player_name: { type: 'STRING', description: 'Nombre del jugador a seguir.' }
      },
      required: ['player_name']
    }
  },
  {
    name: 'minecraft_stop_moving',
    description: 'Detiene inmediatamente el movimiento o navegación del bot en Minecraft.'
  },
  {
    name: 'minecraft_mine_block',
    description: 'Mina o rompe un bloque en las coordenadas X, Y, Z especificadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'INTEGER', description: 'Coordenada X del bloque.' },
        y: { type: 'INTEGER', description: 'Coordenada Y del bloque.' },
        z: { type: 'INTEGER', description: 'Coordenada Z del bloque.' }
      },
      required: ['x', 'y', 'z']
    }
  },
  {
    name: 'minecraft_place_block',
    description: 'Coloca un bloque en las coordenadas X, Y, Z especificadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'INTEGER', description: 'Coordenada X.' },
        y: { type: 'INTEGER', description: 'Coordenada Y.' },
        z: { type: 'INTEGER', description: 'Coordenada Z.' },
        block_name: { type: 'STRING', description: 'Nombre del bloque en el inventario (ej: "cobblestone", "dirt", "torch").' }
      },
      required: ['x', 'y', 'z', 'block_name']
    }
  },
  {
    name: 'minecraft_attack_entity',
    description: 'Ataca a una entidad hostil o criatura cercana en Minecraft.',
    parameters: {
      type: 'OBJECT',
      properties: {
        entity_name: { type: 'STRING', description: 'Nombre o tipo de la entidad a atacar (ej: "zombie", "skeleton", "creeper").' }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // DISCORD COMPANION (AIRI INSPIRED)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'discord_send_message',
    description: 'Envía un mensaje de texto o respuesta a un canal de Discord configurado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        channel_id: { type: 'STRING', description: 'ID del canal de Discord destino.' },
        content: { type: 'STRING', description: 'Texto del mensaje a enviar.' }
      },
      required: ['channel_id', 'content']
    }
  },
  {
    name: 'discord_set_status',
    description: 'Actualiza el mensaje de estado y actividad de tu bot de Discord (ej: "Jugando con Ariel").',
    parameters: {
      type: 'OBJECT',
      properties: {
        status_text: { type: 'STRING', description: 'El texto de estado.' },
        activity_type: { type: 'STRING', enum: ['Playing', 'Listening', 'Watching'], description: 'Tipo de actividad.' }
      },
      required: ['status_text']
    }
  },
  {
    name: 'discord_voice_join',
    description: 'Conecta a Cristi a un canal de voz de Discord para escuchar participantes y enviar audio traducido cuando corresponda.',
    parameters: {
      type: 'OBJECT',
      properties: {
        guild_id: { type: 'STRING', description: 'ID del servidor de Discord.' },
        channel_id: { type: 'STRING', description: 'ID del canal de voz o stage.' },
        translate: { type: 'BOOLEAN', description: 'Activa traducción por lotes de participantes.' },
        target_language: { type: 'STRING', description: 'Idioma destino ISO (por ejemplo es, en, ja).' },
        output_route: {
          type: 'STRING',
          enum: ['local', 'discord_voice'],
          description: 'Ruta de salida de la traducción: local reproduce en el equipo; discord_voice devuelve el audio al canal.'
        }
      },
      required: ['guild_id', 'channel_id']
    }
  },
  {
    name: 'discord_voice_leave',
    description: 'Desconecta a Cristi del canal de voz de Discord y libera el decodificador.'
  },
  {
    name: 'discord_voice_status',
    description: 'Devuelve el estado de la conexión de voz de Discord.'
  },

  // ─────────────────────────────────────────────────────────────────────
  // CONTROL DE AVATAR (LIVE2D)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'switch_avatar_model',
    description: 'Cambia el modelo de avatar Live2D de Cristi en tiempo real.',
    parameters: {
      type: 'OBJECT',
      properties: {
        model_id: {
          type: 'STRING',
          description: 'Identificador del modelo Live2D oficial (ej: "yanderegirl", "ellen", "toki", "ruan_mei", "hiyori", "jane_doe", "miara", "icegirl").'
        }
      },
      required: ['model_id']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // REPRODUCCIÓN Y CONTROL DE MÚSICA EN SPOTIFY (DESKTOP / WEB API / PLAYWRIGHT)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'spotify_play',
    description: 'Reproduce música en Spotify (aplicación de escritorio o web). Si indicas una canción, artista o playlist, la busca y reproduce de inmediato; si no indicas nada, reanuda la música o conmuta Play.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Canción, artista, álbum o estilo musical a reproducir (ej: "Lofi beats", "Deftones - Be Quiet and Drive", "The Weeknd").'
        },
        uri: {
          type: 'STRING',
          description: 'URI directa de Spotify si se dispone de ella (ej: "spotify:track:..." o "spotify:playlist:...").'
        },
        use_web: {
          type: 'BOOLEAN',
          description: 'Fuerza la reproducción a través del reproductor web de Spotify con Playwright.'
        }
      }
    }
  },
  {
    name: 'spotify_pause',
    description: 'Pausa la reproducción actual de música en Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'spotify_next',
    description: 'Salta a la siguiente pista o canción en Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'spotify_previous',
    description: 'Vuelve a la canción o pista anterior en Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'spotify_get_status',
    description: 'Consulta qué canción y artista se están reproduciendo actualmente en Spotify y el estado de la aplicación.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'spotify_search',
    description: 'Busca canciones, artistas, álbumes o playlists en el catálogo de Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Término de búsqueda musical.'
        },
        type: {
          type: 'STRING',
          enum: ['track', 'artist', 'album', 'playlist'],
          description: 'Tipo de elemento a buscar.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'spotify_set_volume',
    description: 'Ajusta el volumen de la música en Spotify hacia arriba o hacia abajo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        direction: {
          type: 'STRING',
          enum: ['up', 'down'],
          description: 'Dirección del ajuste de volumen ("up" para subir, "down" para bajar).'
        }
      },
      required: ['direction']
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // NAVEGACIÓN Y AUTOMATIZACIÓN WEB AVANZADA (PLAYWRIGHT MCP)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'playwright_navigate',
    description: 'Navega a cualquier sitio web o aplicación web completa usando Playwright en el navegador Brave con control autónomo total.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'La URL completa de destino (ej: "https://open.spotify.com", "https://youtube.com", "https://github.com").'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'playwright_click',
    description: 'Hace clic en un elemento interactivo, botón, enlace, pestaña o selector en la página web controlada por Playwright.',
    parameters: {
      type: 'OBJECT',
      properties: {
        selector: {
          type: 'STRING',
          description: 'Selector CSS, texto o XPath del elemento a cliquear.'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'playwright_fill',
    description: 'Escribe o rellena un campo de texto, barra de búsqueda o formulario en la página web actual.',
    parameters: {
      type: 'OBJECT',
      properties: {
        selector: {
          type: 'STRING',
          description: 'Selector CSS del campo a rellenar.'
        },
        value: {
          type: 'STRING',
          description: 'El texto o valor que se desea introducir.'
        }
      },
      required: ['selector', 'value']
    }
  },
  {
    name: 'playwright_press',
    description: 'Presiona una tecla del teclado en la página web activa (ej: "Enter", "Tab", "Escape", "ArrowDown").',
    parameters: {
      type: 'OBJECT',
      properties: {
        key: {
          type: 'STRING',
          description: 'Nombre de la tecla a pulsar.'
        },
        selector: {
          type: 'STRING',
          description: 'Selector CSS opcional del elemento enfocado.'
        }
      },
      required: ['key']
    }
  },
  {
    name: 'playwright_screenshot',
    description: 'Toma una captura de pantalla visual de la página web que Playwright está controlando.',
    parameters: {
      type: 'OBJECT',
      properties: {
        full_page: {
          type: 'BOOLEAN',
          description: 'Si es true, captura la página web completa con scroll.'
        }
      }
    }
  },
  {
    name: 'playwright_get_content',
    description: 'Extrae el contenido de texto legible o HTML de la página web actual o de un contenedor específico.',
    parameters: {
      type: 'OBJECT',
      properties: {
        selector: {
          type: 'STRING',
          description: 'Selector CSS opcional para extraer solo ese bloque de contenido.'
        }
      }
    }
  },
  {
    name: 'playwright_evaluate',
    description: 'Ejecuta código JavaScript directamente en el contexto del navegador y devuelve el resultado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        script: {
          type: 'STRING',
          description: 'Código JavaScript a evaluar en la ventana del navegador.'
        }
      },
      required: ['script']
    }
  },
  {
    name: 'playwright_close',
    description: 'Cierra la sesión activa del navegador Playwright.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  }
];

export const TOOLS_DEFINITIONS = COMPANION_FUNCTION_DECLARATIONS;

export function getLiveToolsConfig(customMcpDeclarations = []) {
  const allDeclarations = [
    ...COMPANION_FUNCTION_DECLARATIONS,
    ...(Array.isArray(customMcpDeclarations) ? customMcpDeclarations : [])
  ];

  return [
    {
      functionDeclarations: allDeclarations
    }
  ];
}
