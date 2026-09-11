import React, { useRef, useEffect } from 'react';
import { SettingsApp } from '../settings/SettingsApp';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../domain/audio/SoundFxService.js';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Cristi AI - Unified Settings Modal Dialog
 * 100% Tailwind CSS Architecture.
 * Re-uses SettingsApp for 100% feature parity across Standalone and In-App Modal.
 */
export const SettingsModal: React.FC<SettingsModalProps> = React.memo(function SettingsModal({ isOpen, onClose }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { interactiveProps } = useClickThrough();

  // Play Sound FX on open
  useEffect(() => {
    if (isOpen) {
      soundFxService.playMenuOpen();
    }
  }, [isOpen]);

  // Focus Trap & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        soundFxService.playClick();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out] select-none"
      {...interactiveProps}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundFxService.playClick();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sm-modal-title"
    >
      <SettingsApp isModal={true} onClose={onClose} />
    </div>
  );
});

export default SettingsModal;
