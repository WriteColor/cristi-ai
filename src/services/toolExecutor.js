import { toolRegistry } from '@/domain/tools/index.js';

/**
 * Adaptador / Facade para ToolRegistry que preserva compatibilidad hacia atrás
 * con el diseño anterior mientras delega toda la ejecución al catálogo de
 * herramientas basado en Command Pattern.
 */
export class ToolExecutor {
  constructor({
    onGestureTrigger,
    onMotionTrigger,
    onAvatarMove,
    onModelSwitch,
    onToolExecutionStart,
    onToolExecutionEnd,
    onScreenRegionChange,
    onScreenWatchChange,
    getCameraSnapshot,
    getVisionDetections,
    getScreenCapture,
    setScreenWatch,
    ...rest
  } = {}) {
    this.context = {
      onGestureTrigger,
      onMotionTrigger,
      onAvatarMove,
      onModelSwitch,
      onToolExecutionStart,
      onToolExecutionEnd,
      onScreenRegionChange,
      onScreenWatchChange,
      getCameraSnapshot,
      getVisionDetections,
      getScreenCapture,
      setScreenWatch,
      ...rest
    };

    this.onGestureTrigger = onGestureTrigger || (() => {});
    this.onMotionTrigger = onMotionTrigger || (() => {});
    this.onAvatarMove = onAvatarMove || (() => {});
    this.onModelSwitch = onModelSwitch || (() => {});
    this.onToolExecutionStart = onToolExecutionStart || (() => {});
    this.onToolExecutionEnd = onToolExecutionEnd || (() => {});
    this.onScreenRegionChange = onScreenRegionChange || (() => {});
    this.onScreenWatchChange = onScreenWatchChange || (() => {});
    this.getCameraSnapshot = getCameraSnapshot || (() => null);
    this.getVisionDetections = getVisionDetections || (() => null);
    this.getScreenCapture = getScreenCapture || (() => null);
    this.setScreenWatch = setScreenWatch || (() => {});
    this.memoryKey = 'cristi_ai_user_memories';
  }

  async executeCalls(functionCalls) {
    return toolRegistry.executeCalls(functionCalls, this.context);
  }

  async executeTool(name, args = {}) {
    return toolRegistry.executeTool(name, args, this.context);
  }

  async executeSingleTool(name, args = {}) {
    return toolRegistry.executeTool(name, args, this.context);
  }
}

export const toolExecutor = new ToolExecutor();
export default toolExecutor;
