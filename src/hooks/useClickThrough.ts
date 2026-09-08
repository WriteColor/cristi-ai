import { useCallback } from 'react';
import { electronBridge } from '../services/desktop/ElectronBridge.js';

export interface InteractiveProps {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPointerEnter: () => void;
  onPointerDown: () => void;
  onMouseDown: () => void;
  onFocus: () => void;
}

export interface UseClickThroughReturn {
  enableInteraction: () => void;
  disableInteraction: () => void;
  interactiveProps: InteractiveProps;
}

/**
 * useClickThrough
 *
 * Core hook for selective click-through in Electron on Windows.
 * Implements mouse passthrough via setIgnoreMouseEvents with forward forwarding.
 */
export function useClickThrough(): UseClickThroughReturn {
  const enableInteraction = useCallback(() => {
    electronBridge.setIgnoreMouseEvents(false);
  }, []);

  const disableInteraction = useCallback(() => {
    if (electronBridge._interactionLockCount > 0) return;
    electronBridge.setIgnoreMouseEvents(true, { forward: true });
  }, []);

  return {
    enableInteraction,
    disableInteraction,
    interactiveProps: {
      onMouseEnter: enableInteraction,
      onMouseLeave: disableInteraction,
      onPointerEnter: enableInteraction,
      onPointerDown: enableInteraction,
      onMouseDown: enableInteraction,
      onFocus: enableInteraction
    }
  };
}

export default useClickThrough;
