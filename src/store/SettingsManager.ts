import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

// Die Struktur der Settings
export interface AppSettings {
  activityStoreDirPath: string | null; // null = Standard (userData)
  allowPrerelease: boolean;
  autoLaunchEnabled: boolean; // Neue Eigenschaft für Auto-Start
  onboardingCompleted: boolean; // Status des Onboarding-Prozesses
  permissionsGranted: { // Berechtigungsstatus
    accessibility: boolean;
    screenRecording: boolean;
  };
}

/**
 * Verwaltet die Anwendungseinstellungen, die in einer settings.json gespeichert werden
 */
export class SettingsManager {
  private settingsFilePath: string;
  private settings: AppSettings;

  constructor() {
    // Settings-Datei im userData-Verzeichnis speichern
    this.settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
    
    // Standardeinstellungen
    this.settings = {
      activityStoreDirPath: null,
      allowPrerelease: false,
      autoLaunchEnabled: false, // Standard: Auto-Start deaktiviert
      onboardingCompleted: false, // Standard: Onboarding nicht abgeschlossen
      permissionsGranted: {
        accessibility: false,
        screenRecording: false
      }
    };

    // Lade Einstellungen aus der Datei, wenn sie existiert
    this.loadSettings();
  }

  /**
   * Lädt die Einstellungen aus der settings.json Datei
   */
  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const fileContent = fs.readFileSync(this.settingsFilePath, 'utf8');
        const parsedSettings = JSON.parse(fileContent);
        
        // Nur bekannte Einstellungen übernehmen
        if (typeof parsedSettings === 'object' && parsedSettings !== null) {
          // activityStoreDirPath (kann string oder null sein)
          if ('activityStoreDirPath' in parsedSettings) {
            this.settings.activityStoreDirPath = parsedSettings.activityStoreDirPath;
          }
          
          // allowPrerelease (boolean)
          if ('allowPrerelease' in parsedSettings && 
              typeof parsedSettings.allowPrerelease === 'boolean') {
            this.settings.allowPrerelease = parsedSettings.allowPrerelease;
          }
          
          // autoLaunchEnabled (boolean)
          if ('autoLaunchEnabled' in parsedSettings && 
              typeof parsedSettings.autoLaunchEnabled === 'boolean') {
            this.settings.autoLaunchEnabled = parsedSettings.autoLaunchEnabled;
          }
          
          // onboardingCompleted (boolean)
          if ('onboardingCompleted' in parsedSettings && 
              typeof parsedSettings.onboardingCompleted === 'boolean') {
            this.settings.onboardingCompleted = parsedSettings.onboardingCompleted;
          }
          
          // permissionsGranted (object)
          if ('permissionsGranted' in parsedSettings && 
              typeof parsedSettings.permissionsGranted === 'object' &&
              parsedSettings.permissionsGranted !== null) {
            // Einzelne Berechtigungen prüfen
            const permissions = parsedSettings.permissionsGranted;
            
            if ('accessibility' in permissions && typeof permissions.accessibility === 'boolean') {
              this.settings.permissionsGranted.accessibility = permissions.accessibility;
            }
            
            if ('screenRecording' in permissions && typeof permissions.screenRecording === 'boolean') {
              this.settings.permissionsGranted.screenRecording = permissions.screenRecording;
            }
          }
        }
        
        console.log(`[Settings] Einstellungen geladen: ${JSON.stringify(this.settings)}`);
      } else {
        console.log('[Settings] Keine settings.json gefunden, verwende Standardeinstellungen');
      }
    } catch (error) {
      console.error('[Settings] Fehler beim Laden der Einstellungen:', error);
      // Bei einem Fehler werden die Standardeinstellungen beibehalten
    }
  }

  /**
   * Speichert die aktuellen Einstellungen in die settings.json Datei
   */
  private saveSettings(): void {
    try {
      const dirPath = path.dirname(this.settingsFilePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(this.settings, null, 2), 'utf8');
      console.log('[Settings] Einstellungen gespeichert');
    } catch (error) {
      console.error('[Settings] Fehler beim Speichern der Einstellungen:', error);
    }
  }

  /**
   * Gibt den aktuellen Wert für activityStoreDirPath zurück
   */
  getActivityStoreDirPath(): string | null {
    return this.settings.activityStoreDirPath;
  }

  /**
   * Setzt einen neuen Wert für activityStoreDirPath
   * @param dirPath Der neue Verzeichnispfad (oder null für Standard)
   */
  setActivityStoreDirPath(dirPath: string | null): void {
    this.settings.activityStoreDirPath = dirPath;
    this.saveSettings();
  }

  /**
   * Ermittelt den vollen Pfad zur activity-store.json
   */
  getActivityStoreFilePath(): string {
    const baseDir = this.settings.activityStoreDirPath || app.getPath('userData');
    return path.join(baseDir, 'chronflow-activity-store.json');
  }

  /**
   * Gibt den aktuellen Wert für allowPrerelease zurück
   */
  getAllowPrerelease(): boolean {
    return this.settings.allowPrerelease;
  }

  /**
   * Setzt einen neuen Wert für allowPrerelease
   * @param allow Ob Beta-Versionen erlaubt sind
   */
  setAllowPrerelease(allow: boolean): void {
    this.settings.allowPrerelease = allow;
    this.saveSettings();
  }

  /**
   * Gibt zurück, ob Auto-Start aktiviert ist
   */
  getAutoLaunchEnabled(): boolean {
    return this.settings.autoLaunchEnabled;
  }

  /**
   * Setzt einen neuen Wert für autoLaunchEnabled
   * @param enabled Ob Auto-Start aktiviert sein soll
   */
  setAutoLaunchEnabled(enabled: boolean): void {
    this.settings.autoLaunchEnabled = enabled;
    this.saveSettings();
  }

  /**
   * Gibt zurück, ob das Onboarding abgeschlossen wurde
   */
  getOnboardingCompleted(): boolean {
    return this.settings.onboardingCompleted;
  }

  /**
   * Setzt den Status des Onboarding-Prozesses
   * @param completed Ob das Onboarding abgeschlossen wurde
   */
  setOnboardingCompleted(completed: boolean): void {
    this.settings.onboardingCompleted = completed;
    this.saveSettings();
  }

  /**
   * Gibt den aktuellen Status der Berechtigungen zurück
   */
  getPermissionsGranted(): { accessibility: boolean; screenRecording: boolean } {
    return { ...this.settings.permissionsGranted };
  }

  /**
   * Setzt den Status der Berechtigungen
   * @param permissions Objekt mit dem Status der Berechtigungen
   */
  setPermissionsGranted(permissions: { accessibility: boolean; screenRecording: boolean }): void {
    this.settings.permissionsGranted = { ...permissions };
    this.saveSettings();
  }
} 