/**
 * Command Pattern interface for all 45+ agentic tools.
 */

import { GeminiFunctionDeclaration } from './gemini.types';

export interface ToolExecutionContext {
  sessionId?: string;
  source?: string;
  onGestureTrigger?: (gesture: string, comment?: string) => void;
  onMotionTrigger?: (motionGroup: string, index?: number) => void;
  onAvatarMove?: (position: string, animation?: string) => void;
  onModelSwitch?: (modelType: string, modelId: string) => void;
  onToolExecutionStart?: (name: string, args: any) => void;
  onToolExecutionEnd?: (name: string, result: any) => void;
  onScreenRegionChange?: (region: { x_pct: number; y_pct: number; w_pct: number; h_pct: number }) => void;
  onScreenWatchChange?: (enabled: boolean) => void;
  getCameraSnapshot?: () => any;
  getVisionDetections?: () => any;
  getScreenCapture?: (region?: string) => Promise<string | null>;
  setScreenWatch?: (enabled: boolean) => void;

  // Convenient shorthand aliases
  triggerGesture?: (gesture: string, comment?: string) => void;
  triggerMotion?: (motionGroup: string, index?: number) => void;
  moveAvatar?: (position: string, animation?: string) => void;
  switchModel?: (modelId: string) => void;
  takeScreenshot?: (region?: string) => Promise<string | null>;
  captureRegion?: () => Promise<string | null>;
}

export interface IToolHandler<TArgs = any, TResult = any> {
  readonly name: string;
  readonly declaration: GeminiFunctionDeclaration;
  execute(args: TArgs, context: ToolExecutionContext): Promise<TResult>;
}
