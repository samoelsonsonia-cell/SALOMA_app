import React from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Erreur inattendue de chargement.'
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#150D2E',
            color: '#F1F5F9',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: '380px',
              width: '100%',
              backgroundColor: '#1D1240',
              border: '2px solid #7C3AED',
              borderRadius: '24px',
              padding: '24px'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                margin: '0 auto 14px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '24px',
                color: '#FFFFFF'
              }}
            >
              S
            </div>
            <h1 style={{fontSize: '18px', fontWeight: 900, marginBottom: '8px'}}>
              SALOMA - Récupération
            </h1>
            <p style={{fontSize: '12px', color: '#C4B5FD', marginBottom: '16px'}}>
              {this.state.message || 'Une erreur d’affichage est survenue.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(90deg, #7C3AED, #8B5CF6)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Recharger SALOMA
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}

try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    registerSW({immediate: false});
  }
} catch {
  // Ignore service worker registration failures in restricted iframes
}
