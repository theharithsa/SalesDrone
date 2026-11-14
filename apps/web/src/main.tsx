import { reportRumFailure, installRumErrorHandlers } from './lib/rum';
import '@fontsource-variable/manrope';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch() { reportRumFailure('RENDER'); }
  render() {
    return this.state.error ? (
      <div className="startup">
        <h1>Something interrupted your workspace.</h1>
        <p>Your saved records are safe. Reload to try again.</p>
        <button onClick={() => window.location.reload()}>
          Reload SalesDrone
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {import.meta.env.VITE_DEPLOYMENT_ENVIRONMENT === 'pre-production' && (
        <aside aria-label="Environment" style={{
          padding: '0.4rem 1rem', textAlign: 'center',
          background: '#fff0c9', color: '#332503', fontWeight: 600,
        }}>Pre-production · Synthetic data</aside>
      )}
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
installRumErrorHandlers();
if ('serviceWorker' in navigator && import.meta.env.VITE_DEPLOYMENT_ENVIRONMENT !== 'pre-production')
  window.addEventListener('load', () =>
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .catch(() => {}),
  );

import '@fontsource-variable/inter';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/lora';
import '@fontsource-variable/open-sans';
import '@fontsource-variable/source-serif-4';
import '@fontsource/patrick-hand/latin-400.css';

import './material/fonts.css';
import './material/tokens.css';
import './material/base.css';
import './material/controls.css';
import './material/shell.css';
import './material/workspaces.css';
import './material/dashboard.css';
import './material/settings.css';
import './material/login.css';

import './material/personalization.css';
import './material/book.css';
