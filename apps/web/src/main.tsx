import '@fontsource-variable/manrope';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './ui-refresh.css';
import './settings-refresh.css';
import './brand.css';
import './lead-refinements.css';
import './intelligence.css';
import './lead-blade.css';
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

import './lead-workspace.css';
