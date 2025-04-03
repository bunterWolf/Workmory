import React from 'react';
import { useTranslation } from 'react-i18next';
import './Footer.css';

const Footer = ({ activeTime, inactiveTime, totalTime, isMockData }) => {
  const { t } = useTranslation();
  
  return (
    <footer className="footer">
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
    </footer>
  );
};

export default Footer; 