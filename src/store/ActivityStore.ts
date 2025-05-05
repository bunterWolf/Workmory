import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import TimelineGenerator, { AggregationIntervalMinutes } from './TimelineGenerator';
import { ActivityPersistence } from './ActivityPersistence';
import { ActivityIpc } from './ActivityIpc';
import { ActivityState } from './ActivityState';
import { IntervalScheduler } from './IntervalScheduler';
import { AggregationManager } from './AggregationManager';
import { SettingsManager } from './SettingsManager';

// ---- TYPE DEFINITIONS ----

// Export this type so it can be shared
export interface AppWindowData {
  app: string;
  title: string;
}

export interface HeartbeatData {
  userActivity?: 'active' | 'may_be_inactive' | 'inactive'; // Be more specific
  appWindow?: AppWindowData | null; // Use the exported type
  // Add other potential properties from other watchers if known
  // teamsMeeting?: { title: string; status: string }; // Example if Teams watcher exists
}

export interface Heartbeat {
  timestamp: number;
  data: HeartbeatData;
}

// Define a more specific type for aggregated timeline events if possible
// For now, using 'any' as placeholder - Needs alignment with TimelineGenerator output
export interface TimelineEvent {
    timestamp: number;
    duration: number;
    type: string; // 'teamsMeeting', 'inactive', 'appWindow' etc.
    data: any; // Specific data depends on 'type'
}

// Define a more specific type for the summary if possible
// For now, using 'any' as placeholder - Needs alignment with TimelineGenerator output
export interface AggregationSummary {
     // Define structure based on TimelineGenerator output
    [key: string]: any;
}

// Type for the aggregated data structure (used in memory and returned by getDayData)
export interface AggregatedData {
    summary: AggregationSummary;
    timelineOverview: TimelineEvent[];
}

export interface DayData {
  heartbeats: Heartbeat[];
  // Aggregated is now optional in the interface, primarily generated on-the-fly
  // or held in the in-memory cache for the current day.
  // It's NOT persisted in the JSON file anymore.
  aggregated?: AggregatedData;
}

// StoreData now only persists heartbeats, not aggregated data
export interface StoreData {
  version: number;
  startTime: number;
  lastCleanup: number;
  aggregationInterval: 5 | 10 | 15; // Use literal types
  days: { [dateKey: string]: Pick<DayData, 'heartbeats'> }; // Only store heartbeats
}

export interface StoreOptions {
  useMockData: boolean;
  storagePath: string | null;
}


// ---- HELPER FUNCTION ----

/**
 * Behandelt may_be_inactive Heartbeats wenn ein inactive Status erkannt wurde
 * @param {Heartbeat[]} heartbeats - Liste von Heartbeats
 * @param {number} currentTimestamp - Timestamp des aktuellen Heartbeats
 * @param {HeartbeatData} heartbeatData - Daten des aktuellen Heartbeats
 * @returns {Heartbeat[]} Aktualisierte Liste von Heartbeats (kann dieselbe Referenz sein, wenn nichts geändert wurde)
 */
// Add type annotations
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

// ---- ACTIVITY STORE CLASS ----

/**
 * Orchestrates activity tracking, persistence, and IPC communication.
 * Delegates state management to ActivityState, timing to IntervalScheduler,
 * and aggregation/caching to AggregationManager.
 */
class ActivityStore {
  // ---- CLASS PROPERTY DECLARATIONS ----
  private options: StoreOptions;
  private dataFilePath: string;
  private timelineGenerator: TimelineGenerator;
  public persistence: ActivityPersistence;
  private ipcHandler: ActivityIpc;
  private activityState: ActivityState;
  private scheduler: IntervalScheduler;
  private aggregationManager: AggregationManager;
  public isTracking: boolean;
  private currentDayKey: string = '';
  private settingsManager: SettingsManager;

  /**
   * Creates an instance of ActivityStore.
   * Initializes state, persistence, aggregation, scheduling, and IPC components.
   * Loads existing data or initializes defaults based on options.
   * @param options Configuration options for the store (e.g., mock data, storage path).
   */
  constructor(options: Partial<StoreOptions> = {}) {
    this.options = {
      useMockData: options.useMockData ?? false,
      storagePath: options.storagePath ?? null
    };

    // Initialisiere Settings Manager
    this.settingsManager = new SettingsManager();

    // Wenn ein expliziter Pfad in den Optionen angegeben wurde, nutze diesen (für Tests),
    // ansonsten verwende den Pfad aus den Einstellungen
    this.dataFilePath = this.options.storagePath ||
      this.settingsManager.getActivityStoreFilePath();

    this.persistence = new ActivityPersistence(this.dataFilePath);
    this.timelineGenerator = new TimelineGenerator();
    this.currentDayKey = this.getDateKey(Date.now());
    this.isTracking = false;

    let initialData: StoreData | undefined;
    if (this.options.useMockData) {
      console.log("🧪 Initializing ActivityStore with mock data from file.");
      // Load from mock-data.json instead of generating
      try {
        // Path relative to the main process execution directory (dist/main)
        // Adjust this path if your build process places public/ differently
        const mockDataPath = path.join(__dirname, '../../public/mock-data.json');
        console.log(`[Store] Attempting to load mock data from: ${mockDataPath}`);
        if (fs.existsSync(mockDataPath)) {
            const mockDataContent = fs.readFileSync(mockDataPath, 'utf-8');
            initialData = JSON.parse(mockDataContent) as StoreData;
            console.log("[Store] Successfully loaded mock data from file.");
        } else {
            console.error(`[Store] Mock data file not found at: ${mockDataPath}. Falling back to empty state.`);
            // Optionally initialize with empty/default state or throw error
             initialData = undefined; // Or provide a default structure
        }
      } catch (error) {
        console.error("[Store] Error loading or parsing mock data file:", error);
        // Fallback or throw error
        initialData = undefined; // Or provide a default structure
      }
      this.activityState = new ActivityState(initialData);
      this.timelineGenerator.setAggregationInterval(this.activityState.getAggregationInterval());
    } else {
       console.log("💾 Initializing ActivityStore with persistent storage.");
       initialData = this.persistence.loadData() ?? undefined;
       this.activityState = new ActivityState(initialData);
       if (initialData) {
           console.log(`[Store] Data loaded via persistence layer.`);
       } else {
           console.log(`[Store] No valid data loaded, ActivityState initialized with defaults.`);
       }
       this.timelineGenerator.setAggregationInterval(this.activityState.getAggregationInterval());
       this.cleanupOldData();
    }

    this.aggregationManager = new AggregationManager(this.timelineGenerator, this.activityState);
    if (this.options.useMockData) {
        this.triggerTodaysAggregation();
    }

    const intervalCallback = this.handleIntervalEnd.bind(this);
    this.scheduler = new IntervalScheduler(this.activityState.getAggregationInterval(), intervalCallback);

    this.ipcHandler = new ActivityIpc(this);
    this.ipcHandler.registerHandlers();

    console.log(`ActivityStore initialized. Aggregation interval: ${this.activityState.getAggregationInterval()} minutes.`);
  }

  private handleIntervalEnd(): void {
      console.log(`[Store] Handling interval end triggered by scheduler.`);
      if (this.isTracking && !this.options.useMockData) {
          if (this.triggerTodaysAggregation()) {
             this.notifyDataUpdate(this.currentDayKey); 
          }
          this.saveToDisk();
      } else {
           console.log(`[Store] Skipping interval actions (tracking: ${this.isTracking}, mock: ${this.options.useMockData})`);
      }
  }

  private triggerTodaysAggregation(): boolean {
      this.currentDayKey = this.getDateKey(Date.now());
      console.log(`[Store] Triggering aggregation for today (${this.currentDayKey})...`);
      return this.aggregationManager.aggregateAndCacheDay(this.currentDayKey);
  }

  /**
   * Saves the current state (from ActivityState) to disk via ActivityPersistence.
   * Does nothing if using mock data.
   */
  saveToDisk(): void {
    // Guard clause: Don't save if using mock data
    if (this.options.useMockData) {
      return;
    }

    console.log(`[Store] Saving data to disk...`);
    try {
      this.persistence.saveData(this.activityState.getFullStoreData());
    } catch (error) {
      console.error(`[Store] Error saving data:`, error);
    }
  }

  /**
   * Starts the activity tracking process.
   * Sets the tracking flag, updates the current day key, clears any stale aggregation cache,
   * starts the interval scheduler (if not using mock data), and notifies listeners.
   */
  startTracking(): void {
    // Guard clause: Already tracking
    if (this.isTracking) {
      console.log('[Store] Tracking already active.');
      return;
    }

    console.log('[Store] Starting tracking...');
    this.isTracking = true;
    this.currentDayKey = this.getDateKey(Date.now());
    this.aggregationManager.clearCache(); // Clear cache on start

    // Start scheduler only if not using mock data
    if (!this.options.useMockData) {
        this.scheduler.start();
    }

    this.notifyTrackingStatusChange();
  }

  /**
   * Pauses the activity tracking process.
   * Clears the tracking flag, pauses the interval scheduler,
   * saves the current state to disk (if not using mock data), and notifies listeners.
   */
  pauseTracking(): void {
    // Guard clause: Not tracking
    if (!this.isTracking) {
        console.log('[Store] Tracking not active, cannot pause.');
        return;
    }

    console.log('[Store] Pausing tracking...');
    this.isTracking = false;
    this.scheduler.pause(); // Pause the scheduler

    // Save state only if not using mock data
    if (!this.options.useMockData) {
      this.saveToDisk();
    }

    this.notifyTrackingStatusChange();
  }

  /**
   * Adds a new heartbeat to the store.
   * Handles day changes (saving previous day, updating current key).
   * Delegates the actual storage of the heartbeat to ActivityState.
   * Applies inactivation logic using `handleMayBeInactive`.
   * Note: Does not trigger immediate aggregation by default.
   * @param heartbeatData The data for the new heartbeat.
   */
  addHeartbeat(heartbeatData: HeartbeatData): void {
    // Guard clause: Not tracking
    if (!this.isTracking) {
      return;
    }

    const timestamp = Date.now();
    const newDateKey = this.getDateKey(timestamp);

    // Handle Day Change
    if (newDateKey !== this.currentDayKey) {
        this.handleDayChange(newDateKey);
    }

    // Update Heartbeats in State
    this.updateHeartbeats(timestamp, heartbeatData);
  }

  // --- Private helper methods for addHeartbeat ---

  private handleDayChange(newDateKey: string): void {
      console.log(`[Store] Day changed during heartbeat addition. Old: ${this.currentDayKey}, New: ${newDateKey}`);
      // Save previous day's state before switching keys
      if (!this.options.useMockData) {
          this.saveToDisk();
      }
      this.currentDayKey = newDateKey;
      // AggregationManager handles its cache internally, no need to clear here.
  }

  private updateHeartbeats(timestamp: number, heartbeatData: HeartbeatData): void {
      let dayHeartbeats = this.activityState.getHeartbeats(this.currentDayKey) || [];
      const potentiallyUpdatedHeartbeats = handleMayBeInactive([...dayHeartbeats], timestamp, heartbeatData);
      const newHeartbeat: Heartbeat = { timestamp, data: heartbeatData };
      potentiallyUpdatedHeartbeats.push(newHeartbeat);
      this.activityState.setHeartbeats(this.currentDayKey, potentiallyUpdatedHeartbeats);
  }

  // --- End of private helper methods ---

  /**
   * Generates a date key string (YYYY-MM-DD) from a timestamp.
   * IMPORTANT: Uses the *local* date components (year, month, day) of the timestamp.
   * This ensures that heartbeats are assigned to the correct calendar day from the user's perspective,
   * even if the timestamp occurs shortly after midnight local time but before midnight UTC.
   * Raw timestamps are stored in UTC (milliseconds since epoch), but grouping is done by local day.
   * @param timestamp Timestamp in milliseconds since epoch (UTC).
   * @returns The date key string in YYYY-MM-DD format based on local time.
   */
  getDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    // Use local date components to avoid timezone issues around midnight
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Notifies the renderer process about data updates for a specific day via IPC.
   * @param dateKey The date key (YYYY-MM-DD) for which data was updated.
   */
  notifyDataUpdate(dateKey: string): void {
    if (this.ipcHandler) {
        this.ipcHandler.notifyDataUpdate(dateKey);
    } else {
        console.warn("[Store] ipcHandler not initialized when trying to notifyDataUpdate.");
    }
  }

  /**
   * Notifies the renderer process about changes in the tracking status via IPC.
   */
  private notifyTrackingStatusChange(): void {
      if (this.ipcHandler) {
         this.ipcHandler.notifyTrackingStatusChange(this.isTracking);
      } else {
          console.warn("[Store] ipcHandler not initialized when trying to notifyTrackingStatusChange.");
      }
  }

  /**
   * Retrieves the data for a specific day, including heartbeats and aggregated data.
   * Gets heartbeats from ActivityState and aggregated data from AggregationManager.
   * Returns null if the date format is invalid or no heartbeats exist for the day.
   * @param dateKey Optional date key (YYYY-MM-DD). Defaults to the current day.
   * @returns A DayData object containing heartbeats and potentially aggregated data, or null.
   */
  getDayData(dateKey?: string | null): DayData | null {
    const targetDateKey = dateKey || this.getDateKey(Date.now());

    // Guard clause: Invalid date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)) {
        console.warn(`Invalid date key format requested: ${targetDateKey}`);
        return null;
    }

    // Get heartbeats first
    const dayHeartbeats = this.activityState.getHeartbeats(targetDateKey);

    // Guard clause: No heartbeats for this day
    if (!dayHeartbeats || dayHeartbeats.length === 0) {
        return null;
    }

    // Get aggregated data (might be null)
    const aggregatedData = this.aggregationManager.getAggregatedDataForDay(targetDateKey);

    // Construct result
    const result: DayData = { heartbeats: dayHeartbeats };
    if (aggregatedData) {
        result.aggregated = aggregatedData;
    }
    return result;
  }

  /**
   * Retrieves a sorted list of available date keys (YYYY-MM-DD) from ActivityState.
   * @returns An array of date strings.
   */
  getAvailableDates(): string[] {
    return this.activityState.getAvailableDates();
  }

  /**
   * Checks for and removes data older than 30 days.
   * Delegates deletion to ActivityState and cache clearing to AggregationManager if needed.
   * Updates the last cleanup timestamp in ActivityState and saves data.
   * Runs at most once per day.
   * Does nothing if using mock data.
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

    console.log('[Store] Running cleanup check for data older than 30 days...');
    const thirtyDaysAgoTimestamp = now - (30 * oneDayMs);
    const datesToDelete: string[] = this.getDatesOlderThan(thirtyDaysAgoTimestamp);

    // Guard clause: No dates to delete
    if (datesToDelete.length === 0) {
        console.log('[Store] No old data found to clean up.');
        // Still update cleanup time even if nothing was deleted
        this.activityState.updateLastCleanupTime();
        this.saveToDisk(); 
        return;
    }

    // Perform deletion
    console.log(`[Store] Cleaning up ${datesToDelete.length} days of old data: ${datesToDelete.join(', ')}`);
    const todayKey = this.getDateKey(Date.now());
    datesToDelete.forEach(dateKey => {
      this.activityState.deleteDay(dateKey);
      // Clear aggregation cache only if today's data is deleted
      if (dateKey === todayKey) {
          this.aggregationManager.clearCache();
      }
    });

    // Update cleanup time and save
    this.activityState.updateLastCleanupTime();
    console.log("[Store] Saving data after cleanup check.");
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
              console.warn(`[Store] Invalid date key encountered during cleanup check: ${dateKey}`, e);
          }
      }
      return datesToDelete;
  }

  /**
   * Performs cleanup actions when the store is being shut down.
   * Stops the interval scheduler and performs a final save to disk (if not using mock data).
   */
  cleanup(): void {
    console.log("[Store] Cleaning up ActivityStore...");
    this.scheduler.cleanup();

    // Save only if not using mock data
    if (!this.options.useMockData) {
        console.log("[Store] Performing final save before exit...");
        this.saveToDisk();
    }
    console.log("[Store] ActivityStore cleanup complete.");
  }

  /**
   * Gets the currently configured aggregation interval (from TimelineGenerator/ActivityState).
   * @returns The interval in minutes (5, 10, or 15).
   */
  getAggregationInterval(): AggregationIntervalMinutes {
      return this.timelineGenerator.aggregationInterval;
  }

  /**
   * Sets the aggregation interval.
   * Updates the interval in TimelineGenerator, ActivityState, and IntervalScheduler.
   * Clears the aggregation cache, triggers immediate re-aggregation for the current day,
   * saves the state, and notifies listeners.
   * @param interval The new interval in minutes (must be 5, 10, or 15).
   */
  setAggregationInterval(interval: AggregationIntervalMinutes): void {
      // Guard clause: Invalid interval
      if (![5, 10, 15].includes(interval)) {
        console.error('[Store] Invalid interval passed to setAggregationInterval:', interval);
        return;
      }

      // Guard clause: Interval hasn't changed
      if (interval === this.timelineGenerator.aggregationInterval) {
        console.log(`[Store] Aggregation interval is already ${interval}. No change needed.`);
        return;
      }

      console.log(`[Store] Changing aggregation interval to ${interval} minutes.`);

      // Update components
      this.timelineGenerator.setAggregationInterval(interval);
      this.activityState.setAggregationInterval(interval);
      this.scheduler.setInterval(interval);

      // Clear cache
      this.aggregationManager.clearCache();
      console.log(`[Store] Cleared aggregation cache due to interval change.`);

      // Trigger aggregation, notify, and save (if not mock)
      if (!this.options.useMockData) {
          if (this.triggerTodaysAggregation()) {
             this.notifyDataUpdate(this.currentDayKey); // Notify only if data changed
          }
          this.saveToDisk();
      } else {
          // Still notify if using mock data, as aggregation might change appearance
          this.notifyDataUpdate(this.currentDayKey);
      }
  }

  /**
   * Gibt den SettingsManager zurück
   */
  getSettingsManager(): SettingsManager {
    return this.settingsManager;
  }

  /**
   * Aktualisiert den Speicherort des ActivityStore
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
      console.error(`[Store] Fehler beim Aktualisieren des Speicherpfads:`, error);
      return false;
    }
  }

  /**
   * Aktualisiert den Speicherort des ActivityStore und lädt die existierende Datei
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
      console.error('[Store] Fehler beim Laden der existierenden Datei:', error);
      return false;
    }
  }
}

export default ActivityStore;