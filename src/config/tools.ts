/**
 * Cristi AI - Tool Function Declarations for Gemini Multimodal Live API.
 * Sincronizado dinámicamente con el catálogo Command Pattern de src/domain/tools/.
 */

import { toolRegistry } from '@/domain/tools/index';
import type { GeminiFunctionDeclaration } from '@/domain/tools/IToolHandler';

export interface LiveToolsConfig {
  functionDeclarations: GeminiFunctionDeclaration[];
}

export const COMPANION_FUNCTION_DECLARATIONS: GeminiFunctionDeclaration[] = toolRegistry.getAllDeclarations();
export const TOOLS_DEFINITIONS = COMPANION_FUNCTION_DECLARATIONS;

export function getLiveToolsConfig(customMcpDeclarations: GeminiFunctionDeclaration[] = []): LiveToolsConfig[] {
  const allDeclarations: GeminiFunctionDeclaration[] = [
    ...toolRegistry.getAllDeclarations(),
    ...(Array.isArray(customMcpDeclarations) ? customMcpDeclarations : [])
  ];

  return [
    {
      functionDeclarations: allDeclarations
    }
  ];
}

export function getToolDeclaration(name: string): GeminiFunctionDeclaration | undefined {
  return toolRegistry.get(name)?.declaration;
}

export default COMPANION_FUNCTION_DECLARATIONS;
