/**
 * Cristi AI - Tool Function Declarations for Gemini Multimodal Live API
 * Extended with: avatar movement, full system access, and screen capture tools.
 */

export const COMPANION_FUNCTION_DECLARATIONS = [
  // ─────────────────────────────────────────────────────────────────────
  // AVATAR CONTROL
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'trigger_companion_gesture',
    description: 'Activa un gesto, expresión facial o emoción en el avatar de la compañera virtual en pantalla.',
    parameters: {
      type: 'OBJECT',
      properties: {
        gesture: {
          type: 'STRING',
          enum: ['idle', 'happy', 'blush', 'surprised', 'waving', 'thinking', 'wink', 'pout', 'nod', 'dance', 'yandere', 'crazy'],
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
  // ACCESO TOTAL AL SISTEMA (VIA NEUTRALINO)
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
  // MEMORIA
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
  }
];

export function getLiveToolsConfig() {
  return [
    {
      functionDeclarations: COMPANION_FUNCTION_DECLARATIONS
    }
  ];
}
