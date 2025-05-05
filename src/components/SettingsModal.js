import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from 'electron';
import './SettingsModal.css';

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
  const [loading, setLoading] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Lade aktuelle Einstellungen
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const settings = await ipcRenderer.invoke('get-settings');
        setActivityStorePath(settings.activityStoreDirPath);
        setDisplayPath(settings.activityStoreDirPath || t('defaultPath'));
        setAllowPrerelease(settings.allowPrerelease);
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
  const handleToggleBetaReleases = async (e) => {
    const checked = e.target.checked;
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

  // Fehlermeldung zurücksetzen
  const clearError = () => setErrorMessage('');

  if (!isOpen) return null;

  return (
    <div className="settings-modal-backdrop">
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2>{t('settings')}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-modal-content">
          {loading ? (
            <div className="loading">{t('loading')}</div>
          ) : (
            <>
              {/* Aktivitätsdatei-Pfad-Einstellung */}
              <div className="settings-section">
                <h3>{t('activityStoreLocation')}</h3>
                <div className="settings-control">
                  <div className="path-display" title={displayPath}>
                    {displayPath}
                  </div>
                  <div className="path-buttons">
                    <button onClick={handleChangeActivityStorePath}>
                      {t('changePath')}
                    </button>
                    {activityStorePath !== null && (
                      <button onClick={handleResetPath}>
                        {t('resetToDefault')}
                      </button>
                    )}
                  </div>
                </div>
                <p className="settings-description">
                  {t('activityStoreDescription')}
                </p>
              </div>

              {/* Beta-Releases-Einstellung */}
              <div className="settings-section">
                <h3>{t('betaReleases')}</h3>
                <div className="settings-control">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={allowPrerelease}
                      onChange={handleToggleBetaReleases}
                    />
                    {t('participateInBeta')}
                  </label>
                </div>
                <p className="settings-description">
                  {t('betaDescription')}
                </p>
              </div>

              {/* Fehlermeldung */}
              {errorMessage && (
                <div className="error-message">
                  {errorMessage}
                  <button className="error-close" onClick={clearError}>
                    &times;
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="settings-modal-footer">
          <button onClick={onClose}>{t('close')}</button>
        </div>
      </div>

      {/* Bestätigungsdialog für existierende Datei */}
      {confirmDialogOpen && (
        <div className="confirm-dialog-backdrop">
          <div className="confirm-dialog">
            <h3>{t('fileExistsTitle')}</h3>
            <p>{t('fileExistsMessage', { path: pendingPath })}</p>
            <div className="confirm-dialog-buttons">
              <button onClick={handleUseExistingFile}>
                {t('useExistingFile')}
              </button>
              <button onClick={handleCancelConfirmDialog}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal; 