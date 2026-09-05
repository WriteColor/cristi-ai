import React, { useRef, useEffect } from 'react';
import {
  Heart,
  Bot,
  Gamepad2,
  Terminal,
  Coffee,
  User
} from 'lucide-react';
import SettingsApp from '../settings/SettingsApp.jsx';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';

/**
 * Predefined System Prompt Presets for Quick Persona Switching
 */
export const PERSONA_PRESETS = [
  {
    id: 'yandere',
    name: 'Cristi Yandere / Gótica (Por Defecto)',
    icon: Heart,
    color: '#f43f5e',
    prompt: 'Personalidad Yandere devota'
  },
  {
    id: 'ellen',
    name: 'Ellen Joe (Maid Tsundere)',
    icon: Coffee,
    color: '#38bdf8',
    prompt: 'Personalidad Ellen Joe'
  },
  {
    id: 'tsundere',
    name: 'Tsundere Clásica',
    icon: Bot,
    color: '#fbbf24',
    prompt: 'Personalidad Tsundere'
  },
  {
    id: 'hiyori',
    name: 'Hiyori (Alegre & Empática)',
    icon: User,
    color: '#34d399',
    prompt: 'Personalidad Alegre'
  },
  {
    id: 'gamer',
    name: 'Gamer Competitiva',
    icon: Gamepad2,
    color: '#a855f7',
    prompt: 'Personalidad Gamer'
  },
  {
    id: 'hacker',
    name: 'IA Hacker Táctica',
    icon: Terminal,
    color: '#06b6d4',
    prompt: 'Personalidad Hacker'
  }
];

/**
 * Cristi AI - Unified Settings Modal Dialog
 * 100% Tailwind CSS Architecture.
 * Re-uses SettingsApp for 100% feature parity across Standalone and In-App Modal.
 */
export function SettingsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
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

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        soundFxService.playClick();
        onClose?.();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
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
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sm-modal-title"
    >
      <SettingsApp isModal={true} onClose={onClose} />
    </div>
  );
}

export default React.memo(SettingsModal);
