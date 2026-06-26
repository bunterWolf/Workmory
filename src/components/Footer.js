import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icons';
import './Footer.css';

const Footer = ({ activeTime, inactiveTime, totalTime, isMockData, onOpenSettings }) => {
  const { t } = useTranslation();

  return (
    <footer className="wmk-footer">
      <span className="wmk-footer-summary wm-tnum">
        {totalTime} {t('totalShort')} &middot; {activeTime} {t('activeShort')} &middot; {inactiveTime} {t('inactiveShort')}
      </span>

      <div className="wmk-footer-right">
        {isMockData && <span className="wmk-footer-mock">{t('mockData')}</span>}
        <button
          className="wmk-footer-settings"
          onClick={onOpenSettings}
          aria-label={t('settings')}
          title={t('settings')}
        >
          <Icon.settings size={16} sw={1.5} />
        </button>
      </div>
    </footer>
  );
};

export default Footer;
