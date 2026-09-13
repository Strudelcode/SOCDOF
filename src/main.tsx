import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initPlatformEnvironment } from './lib/platform';

// Initialize platform title and favicon
initPlatformEnvironment();

// Prevent unwanted touchpad pinch-to-zoom and Ctrl+wheel zoom on the web application
if (typeof window !== 'undefined') {
  // Prevent Ctrl+Wheel / Trackpad pinch zoom
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent iOS / Safari trackpad gesture zoom
  window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
}

function mountApp() {
  const container = document.getElementById('root');
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

