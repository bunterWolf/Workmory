import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { ActivityPersistence } from './ActivityPersistence';
import { ActivityState } from './ActivityState';
import { DayData, Heartbeat, HeartbeatData, StoreData } from './ActivityStore';
import { DateManager } from './DateManager';
import { SettingsManager } from './SettingsManager';

/**
 * Behandelt may_be_inactive Heartbeats, wenn ein inactive Status erkannt wurde
 * @param heartbeats Liste von Heartbeats
 * @param currentTimestamp Timestamp des aktuellen Heartbeats
 * @param heartbeatData Daten des aktuellen Heartbeats
 * @returns Aktualisierte Liste von Heartbeats
 */
export function handleMayBeInactive(heartbeats: Heartbeat[], currentTimestamp: number, heartbeatData: HeartbeatData): Heartbeat[] {
  // Only proceed if the current heartbeat indicates inactivity and there are heartbeats to check
  if (!heartbeats || heartbeats.length === 0 || heartbeatData.userActivity !== 'inactive') {
    return heartbeats;
  }

  // Check if there are any 'may_be_inactive' heartbeats to potentially change
  const hasMayBeInactive = heartbeats.some(hb => hb.data?.userActivity === 'may_be_inactive');
  if (!hasMayBeInactive) {
    return heartbeats; // No changes needed
  }

  // Kopie der Heartbeats erstellen, da wir sie potenziell modifizieren
  const updatedHeartbeats = [...heartbeats];

  // Finde den Index des letzten 'active' Heartbeats *vor* dem aktuellen Inaktivitäts-Timestamp
  let lastActiveIndex = -1;
  for (let i = updatedHeartbeats.length - 1; i >= 0; i--) {
    const hb = updatedHeartbeats[i];
    // Skip heartbeats at or after the current inactive one
    if (hb.timestamp >= currentTimestamp) continue;

    // Found the last active period
    if (hb.data?.userActivity === 'active') {
      lastActiveIndex = i;
      break;
    }
  }

  let changed = false;
  // Alle 'may_be_inactive' Heartbeats *nach* dem letzten 'active' (oder vom Anfang an, falls keiner gefunden wurde)
  // und *vor* dem aktuellen Inaktivitäts-Timestamp zu 'inactive' konvertieren
  for (let i = lastActiveIndex + 1; i < updatedHeartbeats.length; i++) {
    const hb = updatedHeartbeats[i];
    // Stop when we reach the current heartbeat's timestamp
    if (hb.timestamp >= currentTimestamp) break;

    if (hb.data?.userActivity === 'may_be_inactive') {
      // Ensure data exists before spreading
      const existingData = hb.data || {};
      updatedHeartbeats[i] = {
        ...hb, // Spread the original heartbeat
        data: {
          ...existingData, // Spread its data
          userActivity: 'inactive' // Overwrite the status
        }
      };
      changed = true;
    }
  }

  // Return the updated array only if changes were made
  return changed ? updatedHeartbeats : heartbeats;
}

/**
 * Optionen für den ActivityStorage
 */
export interface StorageOptions {
  useMockData: boolean;
  storagePath: string | null;
}

/**
 * Verwaltet die Speicherung und das Laden von Aktivitätsdaten.
 * Verantwortlich für Persistenz, Datei-Management und Bereinigung alter Daten.
 */
export class ActivityStorage {
  private options: StorageOptions;
  private dataFilePath: string;
  private persistence: ActivityPersistence;
  private activityState: ActivityState;
  private dateManager: DateManager;
  private settingsManager: SettingsManager;

  /**
   * Erstellt eine Instanz von ActivityStorage.
   * @param options Konfigurationsoptionen für den Speicher.
   * @param dateManager DateManager-Instanz für datumsbezogene Operationen.
   * @param settingsManager SettingsManager-Instanz für Einstellungen.
   */
  constructor(options: Partial<StorageOptions> = {}, dateManager: DateManager, settingsManager: SettingsManager) {
    this.options = {
      useMockData: options.useMockData ?? false,
      storagePath: options.storagePath ?? null
    };

    this.dateManager = dateManager;
    this.settingsManager = settingsManager;

    // Wenn ein expliziter Pfad in den Optionen angegeben wurde, nutze diesen (für Tests),
    // ansonsten verwende den Pfad aus den Einstellungen
    this.dataFilePath = this.options.storagePath ||
      this.settingsManager.getActivityStoreFilePath();

    this.persistence = new ActivityPersistence(this.dataFilePath);
    
    let initialData: StoreData | undefined;
    if (this.options.useMockData) {
      console.log("[Storage] 🧪 Initializing with mock data from file.");
      // Load from mock-data.json instead of generating
      try {
        // Path relative to the main process execution directory (dist/main)
        const mockDataPath = path.join(__dirname, '../../public/mock-data.json');
        console.log(`[Storage] Attempting to load mock data from: ${mockDataPath}`);
        if (fs.existsSync(mockDataPath)) {
            const mockDataContent = fs.readFileSync(mockDataPath, 'utf-8');
            initialData = JSON.parse(mockDataContent) as StoreData;
            console.log("[Storage] Successfully loaded mock data from file.");
        } else {
            console.error(`[Storage] Mock data file not found at: ${mockDataPath}. Falling back to empty state.`);
            initialData = undefined;
        }
      } catch (error) {
        console.error("[Storage] Error loading or parsing mock data file:", error);
        initialData = undefined;
      }
    } else {
      console.log("[Storage] 💾 Initializing with persistent storage.");
      initialData = this.persistence.loadData() ?? undefined;
      if (initialData) {
        console.log(`[Storage] Data loaded via persistence layer.`);
      } else {
        console.log(`[Storage] No valid data loaded, initializing with defaults.`);
      }
    }

    this.activityState = new ActivityState(initialData);
  }

  /**
   * Speichert die aktuellen Daten auf die Festplatte via ActivityPersistence.
   * Unternimmt nichts, wenn mock-Daten verwendet werden.
   */
  saveToDisk(): void {
    // Guard clause: Don't save if using mock data
    if (this.options.useMockData) {
      return;
    }

    console.log(`[Storage] Saving data to disk...`);
    try {
      this.persistence.saveData(this.activityState.getFullStoreData());
    } catch (error) {
      console.error(`[Storage] Error saving data:`, error);
    }
  }

  /**
   * Ruft die Daten für einen bestimmten Tag ab, einschließlich Heartbeats und aggregierter Daten.
   * Erhält Heartbeats aus ActivityState und aggregierte Daten von AggregationManager.
   * Gibt null zurück, wenn das Datumsformat ungültig ist oder keine Heartbeats für den Tag existieren.
   * @param dateKey Optionaler Datums-Key (YYYY-MM-DD). Standardmäßig der aktuelle Tag.
   * @returns Ein DayData-Objekt, das Heartbeats und potenziell aggregierte Daten enthält, oder null.
   */
  getDayData(dateKey?: string | null): DayData | null {
    const targetDateKey = dateKey || this.dateManager.getDateKey(Date.now());
    const todayDateKey = this.dateManager.getDateKey(Date.now());

    // Guard clause: Invalid date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)) {
        console.warn(`[Storage] Invalid date key format requested: ${targetDateKey}`);
        return null;
    }

    // Get heartbeats first
    const dayHeartbeats = this.activityState.getHeartbeats(targetDateKey);

    // Guard clause: No heartbeats for this day
    if (!dayHeartbeats || dayHeartbeats.length === 0) {
        // Für den heutigen Tag geben wir ein leeres Objekt zurück, selbst wenn keine Daten vorhanden sind
        if (targetDateKey === todayDateKey) {
            return { heartbeats: [] };
        }
        return null;
    }

    // Construct result (no aggregation here - that will be handled by AggregationService)
    const result: DayData = { heartbeats: dayHeartbeats };
    return result;
  }

  /**
   * Speichert oder aktualisiert Heartbeats für einen bestimmten Tag.
   * @param dateKey Der Datums-Key für den Tag.
   * @param heartbeats Die Heartbeats, die gespeichert werden sollen.
   */
  setHeartbeats(dateKey: string, heartbeats: Heartbeat[]): void {
    this.activityState.setHeartbeats(dateKey, heartbeats);
  }

  /**
   * Fügt einen neuen Heartbeat zu den Daten für einen bestimmten Tag hinzu.
   * Wendet die may_be_inactive-Logik an und aktualisiert die Heartbeats.
   * 
   * @param timestamp Der Zeitstempel des neuen Heartbeats
   * @param heartbeatData Die Daten für den neuen Heartbeat
   * @param dateKey Der Datums-Key für den Tag
   */
  addHeartbeat(timestamp: number, heartbeatData: HeartbeatData, dateKey: string): void {
    // Bestehende Heartbeats für den Tag abrufen
    let dayHeartbeats = this.activityState.getHeartbeats(dateKey) || [];
    
    // Neuen Heartbeat erstellen
    const newHeartbeat: Heartbeat = { timestamp, data: heartbeatData };
    
    // Heartbeats aktualisieren (inklusive may_be_inactive-Logik)
    if (heartbeatData.userActivity === 'inactive') {
      // Wende may_be_inactive-Logik an, wenn ein 'inactive' Status erkannt wurde
      const updatedHeartbeats = handleMayBeInactive([...dayHeartbeats], timestamp, heartbeatData);
      updatedHeartbeats.push(newHeartbeat);
      this.activityState.setHeartbeats(dateKey, updatedHeartbeats);
    } else {
      // Einfach den neuen Heartbeat hinzufügen
      dayHeartbeats.push(newHeartbeat);
      this.activityState.setHeartbeats(dateKey, dayHeartbeats);
    }
  }
  
  /**
   * Ruft eine sortierte Liste verfügbarer Datums-Keys (YYYY-MM-DD) von ActivityState ab.
   * Beinhaltet immer das heutige Datum, unabhängig davon, ob Daten dafür existieren.
   * @returns Ein Array von Datumsstrings.
   */
  getAvailableDates(): string[] {
    // Basis-Daten aus ActivityState erhalten
    const storedDates = this.activityState.getAvailableDates();
    
    // Heutigen Tag hinzufügen
    const todayDateKey = this.dateManager.getDateKey(Date.now());
    const datesSet = new Set(storedDates);
    datesSet.add(todayDateKey);
    
    // Sortiert zurückgeben
    return Array.from(datesSet).sort();
  }

  /**
   * Prüft auf Daten, die älter als 30 Tage sind, und entfernt sie.
   * Delegiert das Löschen an ActivityState.
   * Aktualisiert den Zeitstempel der letzten Bereinigung in ActivityState und speichert die Daten.
   * Läuft höchstens einmal pro Tag.
   * Unternimmt nichts, wenn mock-Daten verwendet werden.
   */
  cleanupOldData(): void {
    // Guard clause: Using mock data
    if (this.options.useMockData) {
      return;
    }

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Guard clause: Already cleaned up within the last day
    if (this.activityState.getLastCleanupTime() > (now - oneDayMs)) {
      return;
    }

    console.log('[Storage] Running cleanup check for data older than 30 days...');
    const thirtyDaysAgoTimestamp = now - (30 * oneDayMs);
    const datesToDelete: string[] = this.getDatesOlderThan(thirtyDaysAgoTimestamp);

    // Guard clause: No dates to delete
    if (datesToDelete.length === 0) {
        console.log('[Storage] No old data found to clean up.');
        // Still update cleanup time even if nothing was deleted
        this.activityState.updateLastCleanupTime();
        this.saveToDisk(); 
        return;
    }

    // Perform deletion
    console.log(`[Storage] Cleaning up ${datesToDelete.length} days of old data: ${datesToDelete.join(', ')}`);
    const todayKey = this.dateManager.getDateKey(Date.now());
    datesToDelete.forEach(dateKey => {
      this.activityState.deleteDay(dateKey);
    });

    // Update cleanup time and save
    this.activityState.updateLastCleanupTime();
    console.log("[Storage] Saving data after cleanup check.");
    this.saveToDisk();
  }

  // Helper for cleanupOldData
  // IMPORTANT: This function determines dates to delete based on comparing the *UTC* midnight
  // timestamp of the dateKey with the UTC threshold timestamp.
  // This means cleanup happens based on UTC days, not local days.
  private getDatesOlderThan(timestampThreshold: number): string[] {
    const datesToDelete: string[] = [];
    for (const dateKey of this.activityState.getAvailableDates()) {
        try {
            const dateTimestamp = Date.parse(dateKey + 'T00:00:00Z');
            if (!isNaN(dateTimestamp) && dateTimestamp < timestampThreshold) {
                datesToDelete.push(dateKey);
            }
        } catch (e) {
            console.warn(`[Storage] Invalid date key encountered during cleanup check: ${dateKey}`, e);
        }
    }
    return datesToDelete;
  }

  /**
   * Aktualisiert den Speicherort des ActivityStorage
   * @param newDirPath Der neue Verzeichnispfad (oder null für Standard)
   * @returns true wenn erfolgreich, false wenn ein Fehler auftrat
   */
  updateStoragePath(newDirPath: string | null): boolean {
    try {
      // Ermittle den alten und neuen vollständigen Dateipfad
      const oldFilePath = this.dataFilePath;
      const newFilePath = newDirPath 
        ? path.join(newDirPath, 'chronflow-activity-store.json')
        : path.join(app.getPath('userData'), 'chronflow-activity-store.json');
      
      // Prüfe, ob die Datei am neuen Pfad existiert
      const fileExistsAtNewPath = fs.existsSync(newFilePath);
      
      // Wenn die alte Datei existiert und die neue nicht, verschiebe die Datei
      if (fs.existsSync(oldFilePath) && !fileExistsAtNewPath) {
        // Stelle sicher, dass das Zielverzeichnis existiert
        const dirPath = path.dirname(newFilePath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Lies die alte Datei und schreibe sie an den neuen Ort
        const data = fs.readFileSync(oldFilePath);
        fs.writeFileSync(newFilePath, data);
        
        // Lösche die alte Datei, wenn sie verschieden ist
        if (oldFilePath !== newFilePath) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      // Aktualisiere die Pfade im SettingsManager und im Store
      this.settingsManager.setActivityStoreDirPath(newDirPath);
      this.dataFilePath = newFilePath;
      
      // Aktualisiere die Persistence mit dem neuen Pfad
      this.persistence = new ActivityPersistence(this.dataFilePath);
      
      // Lade die Daten neu
      const data = this.persistence.loadData();
      if (data) {
        this.activityState.setData(data);
      }
      
      return true;
    } catch (error) {
      console.error(`[Storage] Fehler beim Aktualisieren des Speicherpfads:`, error);
      return false;
    }
  }

  /**
   * Aktualisiert den Speicherort des ActivityStorage und lädt die existierende Datei
   * @param newDirPath Der neue Verzeichnispfad
   * @returns true wenn erfolgreich, false wenn ein Fehler auftrat
   */
  useExistingStoreFile(newDirPath: string): boolean {
    try {
      // Setzte den neuen Pfad
      this.settingsManager.setActivityStoreDirPath(newDirPath);
      
      // Aktualisiere den Dateipfad
      this.dataFilePath = path.join(newDirPath, 'chronflow-activity-store.json');
      
      // Aktualisiere den Persistence-Layer
      this.persistence = new ActivityPersistence(this.dataFilePath);
      
      // Lade die Daten aus der existierenden Datei
      const data = this.persistence.loadData();
      if (data) {
        this.activityState.setData(data);
      }
      
      return true;
    } catch (error) {
      console.error('[Storage] Fehler beim Laden der existierenden Datei:', error);
      return false;
    }
  }

  /**
   * Gibt die Version der Datenspeicherung zurück.
   */
  getStoreVersion(): number {
    return this.activityState.getFullStoreData().version;
  }

  /**
   * Führt Bereinigungsarbeiten durch, wenn der Store heruntergefahren wird.
   * Stoppt alle Timer und führt eine letzte Speicherung auf die Festplatte durch (wenn keine mock-Daten verwendet werden).
   */
  cleanup(): void {
    console.log("[Storage] Cleaning up ActivityStorage...");

    // Save only if not using mock data
    if (!this.options.useMockData) {
        console.log("[Storage] Performing final save before exit...");
        this.saveToDisk();
    }
    console.log("[Storage] ActivityStorage cleanup complete.");
  }

  /**
   * Gibt den ActivityState für direkten Zugriff zurück.
   * HINWEIS: Diese Methode sollte nur verwendet werden, wenn absolut notwendig,
   * da sie die Abstraktion des Storage-Layers durchbricht.
   */
  getActivityState(): ActivityState {
    return this.activityState;
  }
} 