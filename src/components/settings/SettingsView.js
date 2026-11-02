// Figma: Settings 84705:4120 (dark 84705:4351), toolbar 84699:2887
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from 'electron';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';
import SettingRow from './SettingRow';
import StoreLocationSetting from './StoreLocationSetting';
import './SettingsView.css';

/**
 * App settings, shown instead of the day view.
 * @param {Function} onBack - Called when the user leaves the settings
 */
export default function SettingsView({ onBack }) {
  const { t } = useTranslation();
  const [activityStorePath, setActivityStorePath] = useState(null);
  const [allowPrerelease, setAllowPrerelease] = useState(false);
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [appVersion, setAppVersion] = useState('');

  // Lade aktuelle Einstellungen
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const settings = await ipcRenderer.invoke('get-settings');
        setActivityStorePath(settings.activityStoreDirPath);
        setAllowPrerelease(settings.allowPrerelease);

        const autoLaunchSettings = await ipcRenderer.invoke('get-auto-launch-settings');
        setAutoLaunchEnabled(autoLaunchSettings.enabled);

        const version = await ipcRenderer.invoke('get-app-version');
        setAppVersion(version);
      } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
        setErrorMessage(t('errorLoadingSettings'));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [t]);

  // Beta-Release-Einstellung ändern
  const handleToggleBetaReleases = async (checked) => {
    try {
      const result = await ipcRenderer.invoke('update-beta-release-setting', checked);
      if (result.success) {
        setAllowPrerelease(checked);
      } else {
        setErrorMessage(t('errorChangingBetaSetting'));
      }
    } catch (error) {
      console.error('Fehler beim Ändern der Beta-Release-Einstellung:', error);
      setErrorMessage(t('errorChangingBetaSetting'));
    }
  };

  // Auto-Start-Einstellung ändern
  const handleToggleAutoLaunch = async (checked) => {
    try {
      const result = await ipcRenderer.invoke('update-auto-launch-settings', checked);
      if (result.success) {
        setAutoLaunchEnabled(checked);
      } else {
        setErrorMessage(t('errorChangingAutoLaunchSetting'));
      }
    } catch (error) {
      console.error('Fehler beim Ändern der Auto-Start-Einstellung:', error);
      setErrorMessage(t('errorChangingAutoLaunchSetting'));
    }
  };

  return (
    <section className="wm-settings">
      <header className="wm-settings-toolbar">
        <Button icon="arrow_back" onClick={onBack} ariaLabel={t('back')} title={t('back')} />
        <h1 className="wm-settings-title text-m-primary">{t('settings')}</h1>
      </header>

      <div className="wm-settings-content">
        {errorMessage && (
          <div className="wm-settings-error" role="alert">
            <span className="wm-settings-error-text text-m-primary">{errorMessage}</span>
            <Button label={t('close')} onClick={() => setErrorMessage('')} />
          </div>
        )}

        {loading ? (
          <div className="wm-settings-loading text-m-default">{t('loading')}</div>
        ) : (
          <>
            <SettingRow
              control={<Toggle on={autoLaunchEnabled} onChange={handleToggleAutoLaunch} ariaLabel={t('autoLaunch')} />}
              title={t('autoLaunch')}
              description={t('autoLaunchDescription')}
            />
            <SettingRow
              control={<Toggle on={allowPrerelease} onChange={handleToggleBetaReleases} ariaLabel={t('betaReleases')} />}
              title={t('betaReleases')}
              description={t('betaDescription')}
            />
            <StoreLocationSetting
              path={activityStorePath}
              onPathChange={setActivityStorePath}
              onError={setErrorMessage}
            />
          </>
        )}

        <div className="wm-settings-spacer" />

        {/* Placeholder only, not a link: the app is local-only */}
        <footer className="wm-settings-footer">
          <span className="text-m-default">{t('placeholderLink')}</span>
          {appVersion && <span className="wm-settings-version text-m-default">{t('version')} {appVersion}</span>}
        </footer>
      </div>
    </section>
  );
}
