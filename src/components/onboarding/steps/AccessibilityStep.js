import React from 'react';
import { useTranslation } from 'react-i18next';

const AccessibilityStep = ({ granted, onRequest, openSettings }) => {
  const { t } = useTranslation();

  return (
    <div className="accessibility-step">
      <h1>{t('onboarding.accessibility.title')}</h1>
      <p>{t('onboarding.accessibility.description')}</p>
      
      <div className={`onboarding-permission ${granted ? 'onboarding-permission-granted' : ''}`}>
        <div className="onboarding-permission-icon">
          {granted ? '✅' : '🔒'}
        </div>
        <h2>{t('onboarding.accessibility.permission.title')}</h2>
        <p>{t('onboarding.accessibility.permission.description')}</p>
        
        {!granted ? (
          <div className="permission-buttons">
            <button onClick={onRequest}>
              {t('onboarding.accessibility.requestPermission')}
            </button>
            <p className="permission-hint">
              {t('onboarding.accessibility.hint')}
            </p>
            <button className="secondary-button" onClick={openSettings}>
              {t('onboarding.accessibility.openSettings')}
            </button>
          </div>
        ) : (
          <div className="permission-success">
            <p className="success-message">{t('onboarding.accessibility.granted')}</p>
          </div>
        )}
      </div>
      
      <div className="permission-help">
        <h3>{t('onboarding.accessibility.help.title')}</h3>
        <p>{t('onboarding.accessibility.help.description')}</p>
        <ol>
          <li>{t('onboarding.accessibility.help.step1')}</li>
          <li>{t('onboarding.accessibility.help.step2')}</li>
          <li>{t('onboarding.accessibility.help.step3')}</li>
        </ol>
      </div>
    </div>
  );
};

export default AccessibilityStep; 