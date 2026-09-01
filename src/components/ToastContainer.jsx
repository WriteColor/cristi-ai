import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Terminal,
  Heart,
  X
} from 'lucide-react';
import { toastService } from '../services/toastService.js';
import { useClickThrough } from '../hooks/useClickThrough.js';

const TYPE_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  emotion: Heart,
  tool: Terminal,
  ai: Sparkles
};

const ToastItem = React.memo(({ t }) => {
  const IconComponent = TYPE_ICONS[t.type] || Info;

  useEffect(() => {
    let timer;
    if (t.duration && t.duration > 0) {
      timer = setTimeout(() => {
        toastService.dismiss(t.id);
      }, t.duration);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [t.duration, t.id]);

  return (
    <div
      className={`hud-toast-card hud-toast-${t.type}`}
      role="status"
      style={{
        transform: 'translateY(0)',
        opacity: 1,
        willChange: 'transform, opacity',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out'
      }}
    >
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />

      <div className="hud-toast-content">
        <div className="hud-toast-icon-box">
          <IconComponent size={15} />
        </div>

        <div className="hud-toast-body">
          <div className="hud-toast-header">
            <span className="hud-toast-title">{t.title}</span>
            {t.badge && (
              <span className="hud-toast-badge">{t.badge}</span>
            )}
          </div>
          {t.description && (
            <p className="hud-toast-desc">{t.description}</p>
          )}
        </div>

        <button
          type="button"
          className="hud-toast-dismiss"
          onClick={() => toastService.dismiss(t.id)}
          aria-label="Cerrar notificación"
        >
          <X size={13} />
        </button>
      </div>

      {t.duration > 0 && (
        <div
          className="hud-toast-progress"
          style={{ animationDuration: `${t.duration}ms` }}
        />
      )}
    </div>
  );
});

export const ToastContainer = React.memo(function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return toastService.subscribe((list) => {
      setToasts(list);
    });
  }, []);

  const { interactiveProps } = useClickThrough();

  if (toasts.length === 0) return null;

  return (
    <div className="hud-toast-viewport" aria-live="polite" role="region" aria-label="Notificaciones del sistema" {...interactiveProps}>
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
});
