import { useCallback } from 'react';
import { electronBridge } from '../services/desktop/ElectronBridge';

/**
 * useClickThrough
 *
 * The core hook for Desktop Mate-style selective click-through in Electron.
 *
 * Returns { interactiveProps } — an object of event handlers to spread on any
 * element that should block click-through when hovered.
 *
 * How it works:
 *   1. Electron window starts with setIgnoreMouseEvents(true, { forward: true })
 *      → clicks pass through to desktop, but mousemove events still reach the renderer
 *   2. When the cursor enters an interactive element:
 *      → setIgnoreMouseEvents(false) → window receives all mouse events normally
 *   3. When the cursor leaves the interactive element:
 *      → setIgnoreMouseEvents(true, { forward: true }) → back to click-through mode
 *
 * Usage:
 *   const { interactiveProps } = useClickThrough();
 *   <div {...interactiveProps}>Any interactive content</div>
 *
 * This pattern is used by Desktop Mate, Open-LLM-VTuber, and similar apps.
 */
export function useClickThrough() {
  const enableInteraction = useCallback(() => {
    // Make window fully interactive (receives clicks, mouse events)
    electronBridge.setIgnoreMouseEvents(false);
  }, []);

  const disableInteraction = useCallback(() => {
    // Return to click-through with forward:true so mousemove still arrives
    // at the renderer, allowing future mouseenter/mouseleave events to fire
    electronBridge.setIgnoreMouseEvents(true, { forward: true });
  }, []);

  return {
    interactiveProps: {
      onMouseEnter: enableInteraction,
      onMouseLeave: disableInteraction,
    },
  };
}
