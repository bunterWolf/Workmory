import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Footer.css';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const Footer = ({ activeTime, inactiveTime, totalTime, isMockData }) => {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState('');
  const [teamsUdpCount, setTeamsUdpCount] = useState(null);

  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.invoke('get-app-version').then((version) => {
        setAppVersion(version);
      }).catch(console.error);

      // Poll Teams UDP count every 2 seconds for live debugging
      const pollUdp = () => {
        ipcRenderer.invoke('get-teams-udp-count').then((count) => {
          setTeamsUdpCount(count);
        }).catch(() => setTeamsUdpCount(null));
      };
      pollUdp();
      const udpInterval = setInterval(pollUdp, 3000);
      return () => clearInterval(udpInterval);
    } else {
      console.warn('ipcRenderer not available to fetch app version.');
    }
  }, []);

  const getUdpBadgeStyle = (count) => {
    if (count === null || count < 0) return { background: '#555' };
    if (count <= 1) return { background: '#444' };
    if (count <= 5) return { background: '#b8860b' };
    return { background: '#6264A7' };
  };

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
        {teamsUdpCount !== null && (
          <span
            className="teams-udp-badge"
            style={getUdpBadgeStyle(teamsUdpCount)}
            title="Teams UDP Verbindungen (Debug)"
          >
            Teams UDP: {teamsUdpCount >= 0 ? teamsUdpCount : '?'}
          </span>
        )}
        {appVersion && (
          <span className="app-version">v{appVersion}</span>
        )}
      </div>
    </footer>
  );
};

export default Footer;
