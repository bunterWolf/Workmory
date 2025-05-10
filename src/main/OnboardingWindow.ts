import { BrowserWindow, systemPreferences } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as remoteMain from '@electron/remote/main';

/**
 * Verwaltet das Onboarding-Fenster der Anwendung
 */
export default class OnboardingWindow {
  private window: BrowserWindow | null = null;
  private onCloseCallback: (() => void) | null = null;

  /**
   * Erstellt ein neues Onboarding-Fenster
   * @returns Die BrowserWindow-Instanz oder null bei Fehler
   */
  createWindow(): BrowserWindow | null {
    try {
      // Fenster mit spezifischer Größe erstellen
      this.window = new BrowserWindow({
        width: 450,
        height: 550,
        resizable: false,
        frame: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        title: 'Chronflow Onboarding',
        backgroundColor: '#ffffff'
      });

      // Enable remote module for this window
      remoteMain.enable(this.window.webContents);

      // Onboarding-HTML laden
      const isDev = process.env.NODE_ENV === 'development';
      
      // In development mode, always load from dist directory
      const rendererPath = path.join(__dirname, '../../dist/onboarding.html');
      
      console.log(`Attempting to load onboarding from: ${rendererPath}`);
      this.window.loadURL(url.format({
        pathname: rendererPath,
        protocol: 'file:',
        slashes: true
      }));

      // DevTools im Entwicklungsmodus öffnen
      if (isDev) {
        this.window.webContents.openDevTools();
      }

      return this.window;
    } catch (error) {
      console.error('Fehler beim Erstellen des Onboarding-Fensters:', error);
      return null;
    }
  }

  /**
   * Setzt eine Callback-Funktion, die aufgerufen wird, wenn das Fenster geschlossen werden soll
   * @param callback Die Callback-Funktion
   */
  setOnCloseCallback(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  /**
   * Schließt das Onboarding-Fenster
   */
  close(): void {
    if (this.window) {
      this.onCloseCallback = null; // Verhindert das Auslösen des Callbacks
      this.window.close();
      this.window = null;
    }
  }

  /**
   * Prüft, ob das Fenster existiert und sichtbar ist
   */
  isVisible(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  /**
   * Gibt die BrowserWindow-Instanz zurück
   */
  getWindow(): BrowserWindow | null {
    return this.window;
  }
} 