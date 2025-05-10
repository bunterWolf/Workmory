import { systemPreferences, shell } from 'electron';
import { execSync } from 'child_process';
import * as os from 'os';

/**
 * Interface für den Berechtigungsstatus
 */
export interface PermissionStatus {
  accessibility: boolean;
  screenRecording: boolean;
}

/**
 * Verwaltet die Systemberechtigungen, die für die App benötigt werden
 */
export class PermissionsManager {
  /**
   * Prüft den aktuellen Status aller benötigten Berechtigungen
   * @returns Status der Berechtigungen
   */
  async checkPermissions(): Promise<PermissionStatus> {
    // Prüfe, ob wir auf macOS sind
    if (process.platform !== 'darwin') {
      // Auf anderen Plattformen werden keine speziellen Berechtigungen benötigt
      return {
        accessibility: true,
        screenRecording: true
      };
    }

    return {
      accessibility: await this.checkAccessibilityPermission(),
      screenRecording: await this.checkScreenRecordingPermission()
    };
  }

  /**
   * Prüft, ob die Accessibility-Berechtigung erteilt wurde
   * @returns true, wenn die Berechtigung erteilt wurde
   */
  private async checkAccessibilityPermission(): Promise<boolean> {
    try {
      // systemPreferences.isTrustedAccessibilityClient gibt es nur unter macOS
      return systemPreferences.isTrustedAccessibilityClient(false);
    } catch (error) {
      console.error('Fehler beim Prüfen der Accessibility-Berechtigung:', error);
      return false;
    }
  }

  /**
   * Prüft, ob die Screen Recording-Berechtigung erteilt wurde
   * @returns true, wenn die Berechtigung erteilt wurde
   */
  private async checkScreenRecordingPermission(): Promise<boolean> {
    try {
      return systemPreferences.getMediaAccessStatus('screen') === 'granted';
    } catch (error) {
      console.error('Fehler beim Prüfen der Screen Recording-Berechtigung:', error);
      return false;
    }
  }

  /**
   * Fordert die Accessibility-Berechtigung an
   * @returns true, wenn die Berechtigung erfolgreich angefordert wurde
   */
  async requestAccessibilityPermission(): Promise<boolean> {
    // Auf macOS können wir die Berechtigung nur manuell anfordern
    if (process.platform !== 'darwin') {
      return true;
    }

    try {
      // Öffne die Systemeinstellungen für Bedienungshilfen
      await this.openAccessibilityPreferences();
      
      // Wir können nicht automatisch überprüfen, ob die Berechtigung erteilt wurde
      // Der Benutzer muss manuell die App zur Liste hinzufügen
      return await this.checkAccessibilityPermission();
    } catch (error) {
      console.error('Fehler beim Anfordern der Accessibility-Berechtigung:', error);
      return false;
    }
  }

  /**
   * Fordert die Screen Recording-Berechtigung an
   * @returns true, wenn die Berechtigung erfolgreich angefordert wurde
   */
  async requestScreenRecordingPermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true;
    }

    try {
      // Wir können nicht direkt die Screen Recording-Berechtigung über askForMediaAccess anfordern,
      // da 'screen' nicht unterstützt wird. Stattdessen öffnen wir die Systemeinstellungen.
      await this.openScreenRecordingPreferences();
      
      // Kurz warten, damit der Benutzer Zeit hat, die Berechtigung zu erteilen
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Prüfen, ob die Berechtigung erteilt wurde
      return await this.checkScreenRecordingPermission();
    } catch (error) {
      console.error('Fehler beim Anfordern der Screen Recording-Berechtigung:', error);
      return false;
    }
  }

  /**
   * Öffnet die Systemeinstellungen für Bedienungshilfen (nur macOS)
   */
  async openAccessibilityPreferences(): Promise<void> {
    if (process.platform !== 'darwin') {
      return;
    }

    try {
      // In macOS Catalina und neuer
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    } catch (error) {
      console.error('Fehler beim Öffnen der Accessibility-Einstellungen:', error);
      
      // Alternativer Ansatz bei Fehler
      try {
        execSync('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
      } catch (fallbackError) {
        console.error('Alternativer Ansatz zum Öffnen der Einstellungen fehlgeschlagen:', fallbackError);
      }
    }
  }

  /**
   * Öffnet die Systemeinstellungen für Bildschirmaufnahme (nur macOS)
   */
  async openScreenRecordingPreferences(): Promise<void> {
    if (process.platform !== 'darwin') {
      return;
    }

    try {
      // In macOS Catalina und neuer
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    } catch (error) {
      console.error('Fehler beim Öffnen der Screen Recording-Einstellungen:', error);
      
      // Alternativer Ansatz bei Fehler
      try {
        execSync('open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"');
      } catch (fallbackError) {
        console.error('Alternativer Ansatz zum Öffnen der Einstellungen fehlgeschlagen:', fallbackError);
      }
    }
  }
} 