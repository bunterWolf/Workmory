// WindowChrome — macOS traffic lights or Windows caption buttons.
// Ported from the design bundle; wired to the window-* IPC handlers.
import React from 'react';
import { ipcRenderer } from 'electron';

const isMac = typeof process !== 'undefined' && process.platform === 'darwin';

const minimize = () => ipcRenderer.invoke('window-minimize');
const maximize = () => ipcRenderer.invoke('window-maximize');
const close = () => ipcRenderer.invoke('window-close');

const WindowChrome = () => {
  if (!isMac) {
    // Windows caption buttons
    return (
      <div className="wc-bar wc-bar-win" aria-label="Window controls">
        <div className="wc-win-drag" />
        <div className="wc-win-btns">
          <button className="wc-win-btn wc-win-min" onClick={minimize} aria-label="Minimieren" title="Minimieren">
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none" aria-hidden="true">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button className="wc-win-btn wc-win-max" onClick={maximize} aria-label="Maximieren" title="Maximieren">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </button>
          <button className="wc-win-btn wc-win-close" onClick={close} aria-label="Schließen" title="Schließen">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // macOS traffic lights
  return (
    <div className="wc-bar wc-bar-mac" aria-label="Window controls">
      <div className="wc-mac-lights">
        <button className="wc-mac-btn wc-mac-close" onClick={close} aria-label="Schließen" title="Schließen">
          <svg className="wc-mac-icon" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" stroke="#4d0000" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" stroke="#4d0000" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button className="wc-mac-btn wc-mac-min" onClick={minimize} aria-label="Minimieren" title="Minimieren">
          <svg className="wc-mac-icon" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <line x1="1.5" y1="4" x2="6.5" y2="4" stroke="#5a3a00" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button className="wc-mac-btn wc-mac-max" onClick={maximize} aria-label="Maximieren" title="Maximieren">
          <svg className="wc-mac-icon" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <polyline points="1.5,5.5 1.5,1.5 5.5,1.5" stroke="#1a3a00" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="6.5,2.5 6.5,6.5 2.5,6.5" stroke="#1a3a00" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WindowChrome;
