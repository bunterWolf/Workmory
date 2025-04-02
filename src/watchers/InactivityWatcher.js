const { powerMonitor } = require('electron');

/**
 * Watcher-Modul zur Erkennung von Benutzerinaktivität
 * Verwendet die native Electron powerMonitor API für systemweite Inaktivitätserkennung
 * 
 * Mögliche Status:
 * - "active": Benutzer war seit dem letzten Heartbeat aktiv
 * - "may_be_inactive": Benutzer war seit dem letzten Heartbeat inaktiv 
 * - "inactive": Benutzer war für die letzten fünf Heartbeats inaktiv
 */
class InactivityWatcher {
  constructor() {
    this.status = 'active';
  }

  /**
   * Initialisiert den Watcher
   */
  async init() {
    return Promise.resolve();
  }

  /**
   * Liefert die aktuellen Inaktivitätsdaten für den Heartbeat
   * @returns {Promise<{userActivity: string}>}
   */
  async getHeartbeatData() {
    try {
      // Hole die Systemweite Inaktivitätszeit in Sekunden
      const idleSeconds = powerMonitor.getSystemIdleTime();
      
      // Bestimme den Status basierend auf der Inaktivitätszeit
      if (idleSeconds < 30) {
        this.status = 'active';
      } else if (idleSeconds < 150) { // 2.5 Minuten (5 Heartbeats)
        this.status = 'may_be_inactive';
      } else {
        this.status = 'inactive';
      }

      return { userActivity: this.status };
    } catch (error) {
      console.error('Fehler beim Abrufen des Inaktivitätsstatus:', error);
      return { userActivity: this.status }; // Behalte letzten bekannten Status bei
    }
  }

  /**
   * Räumt Ressourcen auf
   */
  cleanup() {
    // Keine spezielle Bereinigung notwendig
  }
}

module.exports = InactivityWatcher; 