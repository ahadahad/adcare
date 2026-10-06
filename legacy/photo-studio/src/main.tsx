import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence / reroute benign TFLite WASM info messages that Emscripten outputs to stderr / console.error
if (typeof console !== 'undefined' && console.error) {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : (a && a.message) || '')).join(' ');
    if (
      msg.includes('Created TensorFlow Lite XNNPACK delegate') ||
      msg.includes('INFO: Created TensorFlow Lite') ||
      msg.trim().startsWith('INFO:')
    ) {
      if (console.info) {
        console.info(...args);
      }
      return;
    }
    originalConsoleError(...args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
