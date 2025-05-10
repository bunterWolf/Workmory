import React from 'react';
import { useTranslation } from 'react-i18next';

const ScreenRecordingStep = ({ granted, onRequest, openSettings }) => {
  const { t } = useTranslation();

  return (
    <div className="screen-recording-step">
      <h1>{t('onboarding.screenRecording.title')}</h1>
      <p>{t('onboarding.screenRecording.description')}</p>
      
      <div className={`onboarding-permission ${granted ? 'onboarding-permission-granted' : ''}`}>
        <div className="onboarding-permission-icon">
          {granted ? '✅' : '🎥'}
        </div>
        <h2>{t('onboarding.screenRecording.permission.title')}</h2>
        <p>{t('onboarding.screenRecording.permission.description')}</p>
        
        {!granted ? (
          <div className="permission-buttons">
            <button onClick={onRequest}>
              {t('onboarding.screenRecording.requestPermission')}
            </button>
            <p className="permission-hint">
              {t('onboarding.screenRecording.hint')}
            </p>
            <button className="secondary-button" onClick={openSettings}>
              {t('onboarding.screenRecording.openSettings')}
            </button>
          </div>
        ) : (
          <div className="permission-success">
            <p className="success-message">{t('onboarding.screenRecording.granted')}</p>
          </div>
        )}
      </div>
      
      <div className="permission-help">
        <h3>{t('onboarding.screenRecording.help.title')}</h3>
        <p>{t('onboarding.screenRecording.help.description')}</p>
        <ol>
          <li>{t('onboarding.screenRecording.help.step1')}</li>
          <li>{t('onboarding.screenRecording.help.step2')}</li>
          <li>{t('onboarding.screenRecording.help.step3')}</li>
        </ol>
      </div>
      
      <div className="permission-note">
        <p>{t('onboarding.screenRecording.note')}</p>
      </div>
    </div>
  );
};

export default ScreenRecordingStep; 