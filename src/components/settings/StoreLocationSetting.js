// Figma: SettingRow 84699:2276 (row pattern; Figma has no store-location design yet, see spec 7.5)
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from 'electron';
import SettingRow from './SettingRow';
import Button from '../ui/Button';
import './StoreLocationSetting.css';

/**
 * Where the activity file lives: change, reset to default, or adopt an existing file.
 * @param {string|null} path - Custom directory, or null for the default location
 * @param {Function} onPathChange - Called with the new directory (or null after a reset)
 * @param {Function} onError - Called with a translated error message
 */
export default function StoreLocationSetting({ path, onPathChange, onError }) {
  const { t } = useTranslation();
  // Selected directory that already contains an activity file; waits for the user's decision.
  const [pendingPath, setPendingPath] = useState(null);
  const displayPath = path || t('defaultPath');

  // Aktivitätsdatei-Pfad ändern
  const handleChange = async () => {
    try {
      const selectedPath = await ipcRenderer.invoke('open-directory-dialog');
      if (!selectedPath) return; // Dialog abgebrochen

      const result = await ipcRenderer.invoke('update-activity-store-path', selectedPath);

      if (result.fileExists) {
        // Datei existiert bereits, Bestätigung anzeigen
        setPendingPath(selectedPath);
      } else if (result.success) {
        // Pfad erfolgreich aktualisiert
        onPathChange(selectedPath);
      } else {
        // Fehler beim Aktualisieren des Pfads
        onError(t('errorChangingPath'));
      }
    } catch (error) {
      console.error('Fehler beim Ändern des Aktivitätsdatei-Pfads:', error);
      onError(t('errorChangingPath'));
    }
  };

  // Pfad auf Standard zurücksetzen
  const handleReset = async () => {
    try {
      const result = await ipcRenderer.invoke('update-activity-store-path', null);
      if (result.success) {
        onPathChange(null);
      } else {
        onError(t('errorChangingPath'));
      }
    } catch (error) {
      console.error('Fehler beim Zurücksetzen des Aktivitätsdatei-Pfads:', error);
      onError(t('errorChangingPath'));
    }
  };

  // Existierende Datei verwenden
  const handleUseExisting = async () => {
    try {
      const result = await ipcRenderer.invoke('confirm-use-existing-activity-store', pendingPath);
      if (result.success) {
        onPathChange(pendingPath);
      } else {
        onError(t('errorUsingExistingFile'));
      }
    } catch (error) {
      console.error('Fehler beim Verwenden der existierenden Datei:', error);
      onError(t('errorUsingExistingFile'));
    } finally {
      setPendingPath(null);
    }
  };

  // Bestätigung abbrechen
  const handleCancelConfirm = () => setPendingPath(null);

  return (
    <SettingRow title={t('activityStoreLocation')} description={t('activityStoreDescription')}>
      <div className="wm-store-path text-m-default" title={displayPath}>{displayPath}</div>
      <div className="wm-store-actions">
        <Button label={t('changePath')} onClick={handleChange} />
        {path !== null && <Button label={t('resetToDefault')} onClick={handleReset} />}
      </div>
      {pendingPath !== null && (
        <div className="wm-store-confirm" role="alertdialog" aria-label={t('fileExistsTitle')}>
          <div className="wm-store-confirm-title text-m-primary">{t('fileExistsTitle')}</div>
          <div className="wm-store-confirm-message text-m-default">{t('fileExistsMessage', { path: pendingPath })}</div>
          <div className="wm-store-actions">
            <Button label={t('useExistingFile')} onClick={handleUseExisting} />
            <Button label={t('cancel')} onClick={handleCancelConfirm} />
          </div>
        </div>
      )}
    </SettingRow>
  );
}
