import React from 'react';
import { useTranslation } from 'react-i18next';

const PrivacyStep = () => {
  const { t } = useTranslation();

  return (
    <div className="privacy-step">
      <h1>{t('onboarding.privacy.title')}</h1>
      <p>{t('onboarding.privacy.description')}</p>
      
      <div className="privacy-details">
        <h2>{t('onboarding.privacy.whatWeStore.title')}</h2>
        <ul>
          <li>{t('onboarding.privacy.whatWeStore.appNames')}</li>
          <li>{t('onboarding.privacy.whatWeStore.windowTitles')}</li>
          <li>{t('onboarding.privacy.whatWeStore.activityTimestamps')}</li>
        </ul>
        
        <h2>{t('onboarding.privacy.whereWeStore.title')}</h2>
        <p>{t('onboarding.privacy.whereWeStore.description')}</p>
        
        <h2>{t('onboarding.privacy.connections.title')}</h2>
        <p>{t('onboarding.privacy.connections.description')}</p>
      </div>
    </div>
  );
};

export default PrivacyStep; 