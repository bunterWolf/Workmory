// Figma: Footer 2005:845
import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import DaySummary from './DaySummary';
import './Footer.css';

export default function Footer({ summary, isMockData, onOpenSettings }) {
  const { t } = useTranslation();

  return (
    <footer className="wm-footer">
      <Button
        className="wm-footer-menu"
        icon="more_horiz_20"
        onClick={onOpenSettings}
        ariaLabel={t('settings')}
        title={t('settings')}
      />
      <div className="wm-footer-content">
        {isMockData && (
          <span className="wm-footer-mock text-m-default" title={t('mockData')}>
            {t('mockData')}
          </span>
        )}
        <DaySummary
          items={[
            { value: summary.active, label: t('summaryActive') },
            { value: summary.inactive, label: t('summaryInactive') },
            { value: summary.tracked, label: t('summaryTracked') },
          ]}
        />
      </div>
    </footer>
  );
}
