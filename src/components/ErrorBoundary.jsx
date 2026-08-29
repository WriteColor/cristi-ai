import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

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
          background: '#09090b',
          color: '#f4f4f5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 99999,
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: '520px',
            background: '#121218',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '16px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <ShieldAlert size={42} color="#f43f5e" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
              Se produjo un error inesperado en la interfaz
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '18px', lineHeight: 1.4 }}>
              {this.state.error?.message || 'Error de renderizado'}
            </p>
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: '#a855f7',
                border: 'none',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>Recargar Cristi AI</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
