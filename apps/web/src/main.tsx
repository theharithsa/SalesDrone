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
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
if ('serviceWorker' in navigator)
  window.addEventListener('load', () =>
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .catch(() => {}),
  );

import '@fontsource-variable/inter';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/lora';

import './material/fonts.css';
import './material/tokens.css';
import './material/base.css';
import './material/controls.css';
import './material/shell.css';
import './material/workspaces.css';
import './material/dashboard.css';
import './material/settings.css';
import './material/login.css';
