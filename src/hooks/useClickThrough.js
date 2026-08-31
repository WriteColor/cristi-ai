import { useCallback } from 'react';
import { electronBridge } from '../services/desktop/ElectronBridge.js';

/**
 * useClickThrough
 *
 * The core hook for Desktop Mate-style selective click-through in Electron.
 *
 * Returns { interactiveProps, enableInteraction, disableInteraction }
 */
export function useClickThrough() {
  const enableInteraction = useCallback(() => {
    electronBridge.setIgnoreMouseEvents(false);
  }, []);

  const disableInteraction = useCallback(() => {
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
      onFocus: enableInteraction,
    },
  };
}

