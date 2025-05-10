import React from 'react';
import { useTranslation } from 'react-i18next';

const CompletionStep = () => {
  const { t } = useTranslation();

  return (
    <div className="completion-step">
      <h1>{t('onboarding.completion.title')}</h1>
      <p>{t('onboarding.completion.description')}</p>
      
      <div className="completion-checkpoints">
        <div className="checkpoint">
          <div className="checkpoint-icon">✅</div>
          <div className="checkpoint-text">
            <h3>{t('onboarding.completion.checkpoints.setup.title')}</h3>
            <p>{t('onboarding.completion.checkpoints.setup.description')}</p>
          </div>
        </div>
        
        <div className="checkpoint">
          <div className="checkpoint-icon">✅</div>
          <div className="checkpoint-text">
            <h3>{t('onboarding.completion.checkpoints.privacy.title')}</h3>
            <p>{t('onboarding.completion.checkpoints.privacy.description')}</p>
          </div>
        </div>
        
        <div className="checkpoint">
          <div className="checkpoint-icon">✅</div>
          <div className="checkpoint-text">
            <h3>{t('onboarding.completion.checkpoints.permissions.title')}</h3>
            <p>{t('onboarding.completion.checkpoints.permissions.description')}</p>
          </div>
        </div>
      </div>
      
      <div className="completion-note">
        <h2>{t('onboarding.completion.ready.title')}</h2>
        <p>{t('onboarding.completion.ready.description')}</p>
      </div>
    </div>
  );
};

export default CompletionStep; 