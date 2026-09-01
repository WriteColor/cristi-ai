import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { electronBridge } from '../services/desktop/ElectronBridge.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó una excepción:', error, errorInfo);
    try {
      electronBridge.setIgnoreMouseEvents(false);
    } catch (_) {}
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 7, 10, 0.98)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 99999,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
        }}>
          <div style={{
            position: 'relative',
            maxWidth: '540px',
            width: '100%',
            background: 'rgba(12, 14, 22, 0.95)',
            border: '1px dotted rgba(244, 63, 94, 0.6)',
            borderRadius: '12px',
            padding: '32px 28px',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,0.9), 0 0 30px rgba(244, 63, 94, 0.15)'
          }}>
            <span className="hud-corner hud-corner-tl" />
            <span className="hud-corner hud-corner-tr" />
            <span className="hud-corner hud-corner-bl" />
            <span className="hud-corner hud-corner-br" />

            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px dotted rgba(244, 63, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#f43f5e'
            }}>
              <ShieldAlert size={26} />
            </div>

            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem',
              color: '#f43f5e',
              background: 'rgba(244, 63, 94, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px dotted rgba(244, 63, 94, 0.3)',
              display: 'inline-block',
              marginBottom: '10px'
            }}>
              DIAGNOSTIC // INTERFACE_EXCEPTION
            </span>

            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.01em' }}>
              Se produjo una interrupción en la interfaz
            </h2>

            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px dotted rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '10px 14px',
              margin: '14px 0 20px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.78rem',
              color: '#fda4af',
              textAlign: 'left',
              wordBreak: 'break-word'
            }}>
              {this.state.error?.message || 'Error de renderizado'}
            </div>

            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                color: '#ffffff',
                border: '1px dotted rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={14} />
              <span>Reinicializar Cristi AI</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
