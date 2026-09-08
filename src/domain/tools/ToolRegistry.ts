import type { IToolHandler, ToolExecutionContext, GeminiFunctionDeclaration } from './IToolHandler';
import type { GeminiLiveToolCall, GeminiLiveToolResponse } from '@/types/gemini.types';
import { logger } from '@/services/logger.js';
import { mcpClientManager } from '@/services/mcp/MCPClientManager.js';

export class ToolRegistry {
  private readonly handlers = new Map<string, IToolHandler>();

  /**
   * Registra un nuevo manejador de herramienta (Command Pattern).
   */
  register(handler: IToolHandler): this {
    if (!handler || !handler.name) {
      throw new Error('ToolRegistry.register: El manejador debe tener un nombre válido.');
    }
    this.handlers.set(handler.name, handler);
    return this;
  }

  /**
   * Registra múltiples manejadores de herramientas a la vez.
   */
  registerMany(handlers: IToolHandler[]): this {
    if (Array.isArray(handlers)) {
      for (const handler of handlers) {
        this.register(handler);
      }
    }
    return this;
  }

  /**
   * Desregistra una herramienta por su nombre.
   */
  unregister(name: string): boolean {
    return this.handlers.delete(name);
  }

  /**
   * Obtiene el manejador de una herramienta por su nombre.
   */
  get(name: string): IToolHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Verifica si una herramienta está registrada.
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Retorna la lista completa de manejadores registrados.
   */
  getAllHandlers(): IToolHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Retorna todas las declaraciones de esquema para la API de Gemini Live.
   */
  getAllDeclarations(): GeminiFunctionDeclaration[] {
    return Array.from(this.handlers.values()).map(h => h.declaration);
  }

  /**
   * Retorna la cantidad total de herramientas registradas.
   */
  getToolsCount(): number {
    return this.handlers.size;
  }

  /**
   * Ejecuta una sola herramienta por nombre con aislamiento de fallos.
   */
  async executeTool(
    name: string,
    args: Record<string, any> = {},
    context: ToolExecutionContext = {}
  ): Promise<any> {
    if (!name || typeof name !== 'string') {
      return { status: 'error', message: 'Nombre de herramienta inválido.' };
    }

    const handler = this.handlers.get(name);
    if (handler) {
      try {
        return await handler.execute(args, context);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        logger.error('TOOL', `Error al ejecutar handler de "${name}":`, errorMsg);
        return {
          status: 'error',
          name,
          error: errorMsg,
          message: errorMsg
        };
      }
    }

    // Soporte para herramientas descubiertas dinámicamente vía servidores MCP conectados
    if (mcpClientManager && (mcpClientManager as any).discoveredTools?.has(name)) {
      try {
        return await (mcpClientManager as any).executeMCPTool(name, args);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        logger.error('TOOL', `Error ejecutando MCP tool "${name}":`, errorMsg);
        return {
          status: 'error',
          name,
          error: errorMsg,
          message: errorMsg
        };
      }
    }

    return {
      status: 'error',
      error: 'unknown_tool',
      name,
      message: `Herramienta "${name}" no reconocida.`
    };
  }

  /**
   * Ejecuta un lote de llamadas a herramientas con aislamiento individual de errores.
   * Si una herramienta falla, retorna el error estructurado sin tumbar las demás.
   */
  async executeCalls(
    calls: GeminiLiveToolCall[],
    context: ToolExecutionContext = {}
  ): Promise<GeminiLiveToolResponse[]> {
    if (!Array.isArray(calls)) return [];
    const responses: GeminiLiveToolResponse[] = [];

    for (const call of calls) {
      const { id, name, args } = call;
      context.onToolExecutionStart?.(name, args);
      logger.info('TOOL', `Ejecutando herramienta local "${name}"...`, args);

      let result: any;
      try {
        result = await this.executeTool(name, args || {}, context);
        logger.info('TOOL', `Resultado de "${name}":`, result);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        logger.error('TOOL', `Error crítico al ejecutar herramienta ${name}:`, errorMsg);
        result = {
          status: 'error',
          error: errorMsg,
          message: errorMsg
        };
      }

      context.onToolExecutionEnd?.(name, result);

      responses.push({
        id,
        name,
        response: {
          result,
          output: result
        }
      });
    }

    return responses;
  }
}
