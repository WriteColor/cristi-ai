import { toolRegistry } from './index';
import type { ToolExecutionContext } from './IToolHandler';
import type { ScreenRegion } from '@/types/sensory.types';

/**
 * Adaptador / Facade para ToolRegistry que preserva compatibilidad hacia atrás
 * con el diseño anterior mientras delega toda la ejecución al catálogo de
 * herramientas basado en Command Pattern.
 */
export interface ToolExecutorOptions extends Partial<ToolExecutionContext> {
  [key: string]: unknown;
}

export class ToolExecutor {
  public context: ToolExecutionContext;
  public memoryKey = 'cristi_ai_user_memories';

  public onGestureTrigger?: (gesture: string, comment?: string) => void;
  public onMotionTrigger?: (motionGroup: string, index?: number) => void;
  public onAvatarMove?: (position: string, animation?: string) => void;
  public onModelSwitch?: (modelType: string, modelId: string) => void;
  public onToolExecutionStart?: (name: string, args: unknown) => void;
  public onToolExecutionEnd?: (name: string, result: unknown) => void;
  public onScreenRegionChange?: (region: ScreenRegion) => void;
  public onScreenWatchChange?: (active: boolean) => void;
  public getCameraSnapshot?: () => unknown;
  public getVisionDetections?: () => unknown;
  public getScreenCapture?: (region?: string) => Promise<string | null>;
  public setScreenWatch?: (active: boolean) => void;

  constructor(options: ToolExecutorOptions = {}) {
    const {
      onGestureTrigger = () => {},
      onMotionTrigger = () => {},
      onAvatarMove = () => {},
      onModelSwitch = () => {},
      onToolExecutionStart = () => {},
      onToolExecutionEnd = () => {},
      onScreenRegionChange = () => {},
      onScreenWatchChange = () => {},
      getCameraSnapshot = () => null,
      getVisionDetections = () => null,
      getScreenCapture = async () => null,
      setScreenWatch = () => {},
      ...rest
    } = options;

    this.onGestureTrigger = onGestureTrigger;
    this.onMotionTrigger = onMotionTrigger;
    this.onAvatarMove = onAvatarMove;
    this.onModelSwitch = onModelSwitch;
    this.onToolExecutionStart = onToolExecutionStart;
    this.onToolExecutionEnd = onToolExecutionEnd;
    this.onScreenRegionChange = onScreenRegionChange;
    this.onScreenWatchChange = onScreenWatchChange;
    this.getCameraSnapshot = getCameraSnapshot;
    this.getVisionDetections = getVisionDetections;
    this.getScreenCapture = getScreenCapture;
    this.setScreenWatch = setScreenWatch;

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
  }

  public async executeCalls(functionCalls: unknown[], isCallCancelled: (id?: string) => boolean = () => false) {
    return toolRegistry.executeCalls(functionCalls as never, { ...this.context, isCallCancelled });
  }

  public async executeTool(name: string, args: Record<string, unknown> = {}) {
    this.context.onToolExecutionStart?.(name, args);
    const result = await toolRegistry.executeTool(name, args, this.context);
    this.context.onToolExecutionEnd?.(name, result);
    return result;
  }

  public async executeSingleTool(name: string, args: Record<string, unknown> = {}) {
    return this.executeTool(name, args);
  }
}

export const toolExecutor = new ToolExecutor();
export default toolExecutor;
