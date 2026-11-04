// Figma: Footer 2005:845
import React from 'react';
import { useTranslation } from 'react-i18next';
import DaySummary from './DaySummary';
import './Footer.css';

export default function Footer({ summary, isMockData }) {
  const { t } = useTranslation();

  return (
    <footer className="wm-footer">
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
    </footer>
  );
}
