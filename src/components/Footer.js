import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Footer.css';

// Import ipcRenderer if not already globally available (depends on your setup)
// If contextIsolation is false (as seen in main.ts), require might work directly.
// For better practice with contextIsolation:true, use a preload script.
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const Footer = ({ activeTime, inactiveTime, totalTime, isMockData }) => {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.invoke('get-app-version').then((version) => {
        setAppVersion(version);
      }).catch(console.error); // Add basic error handling
    } else {
      console.warn('ipcRenderer not available to fetch app version.');
    }
    // Cleanup function is not strictly necessary here, but good practice
    // return () => { /* Potential cleanup if needed */ }; 
  }, []); // Empty dependency array means this runs once on mount

  return (
    <footer className="footer">
      <div className="footer-left">
        <div className="summary-stat">
          <div className="summary-value">{totalTime}</div>
          <div className="summary-label">{t('totalTime')}</div>
        </div>
        
        <div className="summary-stat">
          <div className="summary-value">{activeTime}</div>
          <div className="summary-label">{t('activeTime')}</div>
        </div>
        
        <div className="summary-stat">
          <div className="summary-value">{inactiveTime}</div>
          <div className="summary-label">{t('inactiveTime')}</div>
        </div>
        
        {isMockData && (
          <div className="mock-data-info">
            {t('mockData')}
          </div>
        )}
      </div>
      <div className="footer-right">
        {appVersion && (
          <span className="app-version">v{appVersion}</span>
        )}
      </div>
    </footer>
  );
};

export default Footer; 