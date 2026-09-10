import type { IToolHandler } from '../IToolHandler';
import { memoryService } from '../../integrations/memory/MemoryService.js';

export const manageMemoryHandler: IToolHandler = {
  name: 'manage_memory',
  declaration: {
    name: 'manage_memory',
    description: 'Gestiona la memoria persistente a largo plazo sobre Ariel (tu creador) y tus experiencias. Permite almacenar hechos nuevos, gustos, proyectos, actualizar información o buscar recuerdos relevantes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['store', 'update', 'recall', 'invalidate', 'get_recent'],
          description: 'Acción de memoria a realizar: "store" para guardar un recuerdo nuevo, "update" para actualizarlo, "recall" para buscar información previa, "invalidate" para marcarlo obsoleto.'
        },
        key: {
          type: 'STRING',
          description: 'Clave o tema conciso del recuerdo (ej: "comida_favorita", "proyecto_actual", "coordenadas_casa").'
        },
        content: {
          type: 'STRING',
          description: 'Contenido detallado y claro del recuerdo a fijar en la memoria.'
        },
        category: {
          type: 'STRING',
          enum: ['fact', 'preference', 'relationship', 'task', 'minecraft', 'conversation'],
          description: 'Categoría del recuerdo (hecho objetivo, preferencia, relación emocional, tarea pendiente, etc.).'
        },
        importance: {
          type: 'NUMBER',
          description: 'Nivel de relevancia de 0.1 a 1.0 (por defecto 0.8).'
        },
        reason: {
          type: 'STRING',
          description: 'Motivo o contexto en caso de actualización o invalidación (opcional).'
        },
        query: {
          type: 'STRING',
          description: 'Término de búsqueda cuando action es "recall".'
        },
        id: {
          type: 'STRING',
          description: 'Identificador específico del recuerdo (opcional).'
        }
      },
      required: ['action']
    }
  },
  async execute(args: any) {
    return await memoryService.manageMemory(args);
  }
};

export const rememberFactHandler: IToolHandler = {
  name: 'remember_fact',
  declaration: {
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
  async execute(args: { key?: string; content?: string; category?: string; importance?: number }) {
    if (!args?.content) {
      return { status: 'error', message: 'Contenido de memoria requerido.' };
    }
    const memory = await memoryService.remember({
      key: args.key,
      content: args.content,
      category: args.category || 'fact',
      importance: args.importance || 0.8
    });
    return {
      status: 'success',
      action: 'remembered',
      memory,
      message: `Dato fijado en la memoria permanente: "${args?.key}"`
    };
  }
};

export const searchMemoryHandler: IToolHandler = {
  name: 'search_memory',
  declaration: {
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
  async execute(args: { query?: string }) {
    const query = args?.query || '';
    const found = memoryService.search(query);
    return {
      status: 'success',
      query,
      resultsCount: found.length,
      memories: found
    };
  }
};

export const deleteMemoryHandler: IToolHandler = {
  name: 'delete_memory',
  declaration: {
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
  async execute(args: { id_or_key?: string }) {
    const target = args?.id_or_key || '';
    const removed = await memoryService.deleteMemory(target);
    return {
      status: removed ? 'success' : 'not_found',
      message: removed ? `Recuerdo "${target}" eliminado.` : `No se encontró recuerdo con ID/clave "${target}".`
    };
  }
};

export const memoryTools: IToolHandler[] = [
  manageMemoryHandler,
  rememberFactHandler,
  searchMemoryHandler,
  deleteMemoryHandler
];
