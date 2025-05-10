import React from 'react';
import { useTranslation } from 'react-i18next';

const WelcomeStep = () => {
  const { t } = useTranslation();
  const isWindows = process.platform === 'win32';

  return (
    <div className="welcome-step">
      <h1>{t('onboarding.welcome.title')}</h1>
      <p>{t('onboarding.welcome.description')}</p>

      <div className="platform-info">
        {isWindows ? (
          <p>{t('onboarding.welcome.windows')}</p>
        ) : (
          <p>{t('onboarding.welcome.macOS')}</p>
        )}
      </div>
    </div>
  );
};

export default WelcomeStep; 