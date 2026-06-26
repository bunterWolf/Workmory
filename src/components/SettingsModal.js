import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from 'electron';
import Icon from './Icons';
import './SettingsModal.css';

// Reusable toggle switch styled per the design system.
const Toggle = ({ on, onChange, label }) => (
  <label className="wmk-toggle-row">
    <button
      type="button"
      className={'wmk-toggle ' + (on ? 'is-on' : '')}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    />
    <span>{label}</span>
  </label>
);

/**
 * Ein Modal für App-Einstellungen
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Ob das Modal geöffnet ist
 * @param {Function} props.onClose - Callback, wenn das Modal geschlossen wird
 */
const SettingsModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activityStorePath, setActivityStorePath] = useState(null);
  const [displayPath, setDisplayPath] = useState(t('defaultPath')); 
  const [allowPrerelease, setAllowPrerelease] = useState(false);
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [appVersion, setAppVersion] = useState('');

  // Lade aktuelle Einstellungen
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const settings = await ipcRenderer.invoke('get-settings');
        setActivityStorePath(settings.activityStoreDirPath);
        setDisplayPath(settings.activityStoreDirPath || t('defaultPath'));
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

    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, t]);

  // Aktivitätsdatei-Pfad ändern
  const handleChangeActivityStorePath = async () => {
    try {
      const selectedPath = await ipcRenderer.invoke('open-directory-dialog');
      if (!selectedPath) return; // Dialog abgebrochen
      
      const result = await ipcRenderer.invoke('update-activity-store-path', selectedPath);
      
      if (result.fileExists) {
        // Datei existiert bereits, zeige Bestätigungsdialog
        setPendingPath(selectedPath);
        setConfirmDialogOpen(true);
      } else if (result.success) {
        // Pfad erfolgreich aktualisiert
        setActivityStorePath(selectedPath);
        setDisplayPath(selectedPath);
      } else {
        // Fehler beim Aktualisieren des Pfads
        setErrorMessage(t('errorChangingPath'));
      }
    } catch (error) {
      console.error('Fehler beim Ändern des Aktivitätsdatei-Pfads:', error);
      setErrorMessage(t('errorChangingPath'));
    }
  };
  
  // Pfad auf Standard zurücksetzen
  const handleResetPath = async () => {
    try {
      const result = await ipcRenderer.invoke('update-activity-store-path', null);
      if (result.success) {
        setActivityStorePath(null);
        setDisplayPath(t('defaultPath'));
      } else {
        setErrorMessage(t('errorChangingPath'));
      }
    } catch (error) {
      console.error('Fehler beim Zurücksetzen des Aktivitätsdatei-Pfads:', error);
      setErrorMessage(t('errorChangingPath'));
    }
  };
  
  // Existierende Datei verwenden
  const handleUseExistingFile = async () => {
    try {
      const result = await ipcRenderer.invoke('confirm-use-existing-activity-store', pendingPath);
      if (result.success) {
        setActivityStorePath(pendingPath);
        setDisplayPath(pendingPath);
      } else {
        setErrorMessage(t('errorUsingExistingFile'));
      }
    } catch (error) {
      console.error('Fehler beim Verwenden der existierenden Datei:', error);
      setErrorMessage(t('errorUsingExistingFile'));
    } finally {
      setConfirmDialogOpen(false);
      setPendingPath(null);
    }
  };
  
  // Bestätigungsdialog schließen
  const handleCancelConfirmDialog = () => {
    setConfirmDialogOpen(false);
    setPendingPath(null);
  };
  
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

  // Fehlermeldung zurücksetzen
  const clearError = () => setErrorMessage('');

  if (!isOpen) return null;

  return (
    <div className="wmk-modal-scrim" onClick={onClose}>
      <div className="wmk-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="wmk-modal-head">
          <h2 className="wm-h2">{t('settings')}</h2>
          <button className="wmk-ibtn" onClick={onClose} aria-label={t('close')} title={t('close')}>
            <Icon.close />
          </button>
        </div>

        <div className="wmk-modal-body">
          {loading ? (
            <div className="loading">{t('loading')}</div>
          ) : (
            <>
              {/* Aktivitätsdatei-Pfad-Einstellung */}
              <section className="wmk-section">
                <h3 className="wm-h3">{t('activityStoreLocation')}</h3>
                <div className="wmk-path" title={displayPath}>
                  <Icon.folder />
                  <span>{displayPath}</span>
                </div>
                <div className="wmk-path-actions">
                  <button className="wmk-btn wmk-btn-secondary" onClick={handleChangeActivityStorePath}>
                    {t('changePath')}
                  </button>
                  {activityStorePath !== null && (
                    <button className="wmk-btn wmk-btn-ghost" onClick={handleResetPath}>
                      {t('resetToDefault')}
                    </button>
                  )}
                </div>
                <p className="wmk-section-desc">{t('activityStoreDescription')}</p>
              </section>

              {/* Auto-Start-Einstellung */}
              <section className="wmk-section">
                <h3 className="wm-h3">{t('autoLaunch')}</h3>
                <Toggle on={autoLaunchEnabled} onChange={handleToggleAutoLaunch} label={t('autoLaunchEnabled')} />
                <p className="wmk-section-desc">{t('autoLaunchDescription')}</p>
              </section>

              {/* Beta-Releases-Einstellung */}
              <section className="wmk-section">
                <h3 className="wm-h3">{t('betaReleases')}</h3>
                <Toggle on={allowPrerelease} onChange={handleToggleBetaReleases} label={t('participateInBeta')} />
                <p className="wmk-section-desc">{t('betaDescription')}</p>
              </section>

              {/* Fehlermeldung */}
              {errorMessage && (
                <div className="wmk-error">
                  <span>{errorMessage}</span>
                  <button className="wmk-error-close" onClick={clearError} aria-label={t('close')}>
                    <Icon.close size={14} />
                  </button>
                </div>
              )}

              {/* App-Version */}
              {appVersion && (
                <div className="wmk-version wm-meta wm-tnum">
                  {t('version')} {appVersion}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bestätigungsdialog für existierende Datei */}
      {confirmDialogOpen && (
        <div className="wmk-modal-scrim" onClick={handleCancelConfirmDialog}>
          <div className="wmk-modal wmk-modal-confirm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="wmk-modal-body">
              <h3 className="wm-h3" style={{ marginBottom: 8 }}>{t('fileExistsTitle')}</h3>
              <p className="wmk-section-desc" style={{ marginBottom: 16 }}>{t('fileExistsMessage', { path: pendingPath })}</p>
              <div className="wmk-path-actions">
                <button className="wmk-btn wmk-btn-secondary" onClick={handleUseExistingFile}>
                  {t('useExistingFile')}
                </button>
                <button className="wmk-btn wmk-btn-ghost" onClick={handleCancelConfirmDialog}>
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal; 