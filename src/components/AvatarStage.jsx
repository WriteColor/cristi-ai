/**
 * Cristi AI - Live2D Avatar Stage
 * Dedicated stage for Live2D Cubism avatars.
 *
 * CRITICAL: The stage container itself is pointer-events: none.
 * Interaction is handled exclusively by the hitTarget inside Live2DCanvas.
 * This prevents the stage from blocking the toolbar, context menu, or any other UI overlay.
 */

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Live2DCanvas } from './Live2DCanvas.jsx';

export const AvatarStage = React.memo(forwardRef(function AvatarStage(
  {
    modelId = 'yanderegirl',
    gesture = 'idle',
    lipSyncValue = 0,
    isSpeaking = false,
    isListening = false,
    viewMode = 'torso',
    onModelClick,
    onModelContextMenu
  },
  ref
) {
  const live2dRef = useRef(null);

  useImperativeHandle(ref, () => ({
    moveTo: (pos, anim) => {
      if (live2dRef.current?.moveTo) live2dRef.current.moveTo(pos, anim);
      else if (live2dRef.current?.moveToPreset) live2dRef.current.moveToPreset(pos, anim);
    },
    moveToPreset: (pos, anim) => {
      if (live2dRef.current?.moveToPreset) live2dRef.current.moveToPreset(pos, anim);
    },
    switchModel: (id) => {
      if (live2dRef.current?.switchModel) live2dRef.current.switchModel(id);
    },
    getModel:      () => live2dRef.current?.getModel?.()      || null,
    getAdapter:    () => live2dRef.current?.getAdapter?.()    || null,
    getController: () => live2dRef.current?.getController?.() || null,
    reapplyLayout: () => live2dRef.current?.reapplyLayout?.(),
    triggerMotion: (group, index) => {
      if (live2dRef.current?.triggerMotion) live2dRef.current.triggerMotion(group, index);
    },
    triggerGesture: (gestureName, comment) => {
      if (live2dRef.current?.triggerGesture) live2dRef.current.triggerGesture(gestureName, comment);
    },
    getHitboxRect: () => {
      if (live2dRef.current?.getHitboxRect) return live2dRef.current.getHitboxRect();
      return null;
    }
  }));

  return (
    // pointer-events: none — la interacción la maneja el hitTarget dentro de Live2DCanvas
    <div
      className="avatar-stage live2d-mode w-full h-full relative z-[1]"
      style={{ pointerEvents: 'none' }}
    >
      <Live2DCanvas
        ref={live2dRef}
        modelId={modelId}
        gesture={gesture}
        lipSyncValue={lipSyncValue}
        isSpeaking={isSpeaking}
        isListening={isListening}
        viewMode={viewMode}
        onModelClick={onModelClick}
        onModelContextMenu={onModelContextMenu}
      />
    </div>
  );
}));

export default AvatarStage;
