import { powerMonitor, BrowserWindow } from 'electron';
import { HeartbeatData } from '../store/ActivityStore';

// Define the possible user activity states
type UserActivityStatus = 'active' | 'may_be_inactive' | 'inactive';

/**
 * Watcher-Modul zur Erkennung von Benutzerinaktivität
 * Verwendet die native Electron powerMonitor API für systemweite Inaktivitätserkennung
 * 
 * Mögliche Status:
 * - "active": Benutzer war seit dem letzten Heartbeat aktiv
 * - "may_be_inactive": Benutzer war seit dem letzten Heartbeat inaktiv 
 * - "inactive": Benutzer war für die letzten fünf Heartbeats inaktiv
 */
export default class InactivityWatcher {
  // ---- CLASS PROPERTY DECLARATIONS ----
  // Declare the status property with its specific possible types
  private status: UserActivityStatus = 'active';

  constructor() {
    // Initial status is set in the declaration
  }

  /**
   * Initialisiert den Watcher
   * @param {BrowserWindow} [mainWindow] - Optional main window reference (not used).
   * @returns {Promise<void>}
   */
  async init(mainWindow?: BrowserWindow): Promise<void> {
    // Nothing specific needed for this watcher initialization
    console.log('InactivityWatcher initialized.');
    return Promise.resolve();
  }

  /**
   * Liefert die aktuellen Inaktivitätsdaten für den Heartbeat
   * @returns {Promise<Partial<HeartbeatData>>} Object containing userActivity status.
   */
  async getHeartbeatData(): Promise<Partial<HeartbeatData>> {
    try {
      // Hole die Systemweite Inaktivitätszeit in Sekunden
      const idleSeconds = powerMonitor.getSystemIdleTime();
      
      // Define thresholds
      const MAY_BE_INACTIVE_THRESHOLD = 30; // seconds
      const INACTIVE_THRESHOLD = 150; // seconds (2.5 minutes)

      // Bestimme den Status basierend auf der Inaktivitätszeit
      let newStatus: UserActivityStatus;
      if (idleSeconds < MAY_BE_INACTIVE_THRESHOLD) {
        newStatus = 'active';
      } else if (idleSeconds < INACTIVE_THRESHOLD) {
        newStatus = 'may_be_inactive';
      } else {
        newStatus = 'inactive';
      }

      // Update internal state
      this.status = newStatus;

      // Return data in the format expected by HeartbeatData
      return { userActivity: this.status };
    } catch (error) {
      console.error('Fehler beim Abrufen des Inaktivitätsstatus:', error);
      // Bei Fehler den letzten bekannten Status zurückgeben, um Lücken zu vermeiden?
      // Oder besser einen Fehlerstatus? Aktuell wird letzter Status behalten.
      return { userActivity: this.status };
    }
  }

  /**
   * Räumt Ressourcen auf
   */
  cleanup(): void {
    console.log('Cleaning up InactivityWatcher...');
    // Nothing specific to clean up for this watcher
    // Reset status to default perhaps?
    // this.status = 'active';
  }
} 