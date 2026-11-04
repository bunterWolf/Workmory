// Figma: Title bar 2061:4850 (settings caption button 84822:1653)
// Frameless-window title bar: settings button plus Windows caption buttons (minimize, close),
// or macOS traffic lights with the settings button on the right.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from 'electron';
import Icon from '../ui/Icon';
import './WindowTitleBar.css';

const isMac = typeof process !== 'undefined' && process.platform === 'darwin';

// Segoe Fluent Icons code points
const GLYPH_MINIMIZE = '';
const GLYPH_CLOSE = '';

const minimize = () => ipcRenderer.invoke('window-minimize');
const maximize = () => ipcRenderer.invoke('window-maximize'); // macOS only (traffic lights)
const close = () => ipcRenderer.invoke('window-close');

// isSettingsOpen: the settings view is shown; the button then leads back to the day view.
export default function WindowTitleBar({ isSettingsOpen = false, onToggleSettings }) {
  const { t } = useTranslation();
  const title = <span className="wm-titlebar-title text-m-primary">{t('appTitle')}</span>;
  const settingsButton = (
    <button
      type="button"
      className="wm-titlebar-button wm-titlebar-button-settings"
      onClick={onToggleSettings}
      aria-label={t('settings')}
      aria-pressed={isSettingsOpen}
      title={t('settings')}
    >
      <Icon name="more_horiz_20" size={20} />
    </button>
  );

  if (isMac) {
    return (
      <div className="wm-titlebar wm-titlebar-mac">
        <div className="wm-titlebar-lights">
          <button type="button" className="wm-titlebar-light wm-titlebar-light-close" onClick={close} aria-label={t('close')} title={t('close')}>
            <svg className="wm-titlebar-light-icon" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" stroke="#4d0000" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" stroke="#4d0000" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="wm-titlebar-light wm-titlebar-light-min" onClick={minimize} aria-label={t('minimize')} title={t('minimize')}>
            <svg className="wm-titlebar-light-icon" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <line x1="1.5" y1="4" x2="6.5" y2="4" stroke="#5a3a00" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="wm-titlebar-light wm-titlebar-light-max" onClick={maximize} aria-label={t('maximize')} title={t('maximize')}>
            <svg className="wm-titlebar-light-icon" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <polyline points="1.5,5.5 1.5,1.5 5.5,1.5" stroke="#1a3a00" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="6.5,2.5 6.5,6.5 2.5,6.5" stroke="#1a3a00" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {title}
        <div className="wm-titlebar-buttons">{settingsButton}</div>
      </div>
    );
  }

  return (
    <div className="wm-titlebar">
      {title}
      <div className="wm-titlebar-buttons">
        {settingsButton}
        <button type="button" className="wm-titlebar-button" onClick={minimize} aria-label={t('minimize')} title={t('minimize')}>
          {GLYPH_MINIMIZE}
        </button>
        <button type="button" className="wm-titlebar-button wm-titlebar-button-close" onClick={close} aria-label={t('close')} title={t('close')}>
          {GLYPH_CLOSE}
        </button>
      </div>
    </div>
  );
}
