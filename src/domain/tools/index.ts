import { ToolRegistry } from './ToolRegistry';
import { avatarTools } from './handlers/avatarTools';
import { systemTools } from './handlers/systemTools';
import { computerTools } from './handlers/computerTools';
import { visionTools } from './handlers/visionTools';
import { audioTools } from './handlers/audioTools';
import { memoryTools } from './handlers/memoryTools';
import { widgetTools } from './handlers/widgetTools';
import { webTools } from './handlers/webTools';
import { gameTools } from './handlers/gameTools';
import { spotifyTools } from './handlers/spotifyTools';
import { mcpTools } from './handlers/mcpTools';

export * from './IToolHandler';
export * from './ToolRegistry';
export * from './handlers/avatarTools';
export * from './handlers/systemTools';
export * from './handlers/computerTools';
export * from './handlers/visionTools';
export * from './handlers/audioTools';
export * from './handlers/memoryTools';
export * from './handlers/widgetTools';
export * from './handlers/webTools';
export * from './handlers/gameTools';
export * from './handlers/spotifyTools';
export * from './handlers/mcpTools';

/**
 * Registro de herramientas preconfigurado con todas las herramientas agénticas de Cristi AI.
 */
export const toolRegistry = new ToolRegistry();

toolRegistry.registerMany([
  ...avatarTools,
  ...systemTools,
  ...computerTools,
  ...visionTools,
  ...audioTools,
  ...memoryTools,
  ...widgetTools,
  ...webTools,
  ...gameTools,
  ...spotifyTools,
  ...mcpTools
]);

export default toolRegistry;
