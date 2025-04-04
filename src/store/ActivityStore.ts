import * as fs from 'fs';
import * as path from 'path';
import { app, ipcMain, BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import TimelineGenerator from './TimelineGenerator';
import { generateMockData } from './mockData';

// ---- TYPE DEFINITIONS ----

export interface HeartbeatData {
  userActivity?: 'active' | 'may_be_inactive' | 'inactive'; // Be more specific
  appWindow?: { app: string; title: string } | null;
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


export interface DayData {
  heartbeats: Heartbeat[];
  aggregated?: {
    summary: AggregationSummary; // Use defined interface
    timelineOverview: TimelineEvent[]; // Use defined interface
  };
}

export interface StoreData {
  version: number;
  startTime: number;
  lastCleanup: number;
  aggregationInterval: 5 | 10 | 15; // Use literal types
  days: { [dateKey: string]: DayData };
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
function handleMayBeInactive(heartbeats: Heartbeat[], currentTimestamp: number, heartbeatData: HeartbeatData): Heartbeat[] {
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
    // If we encounter an 'inactive' before an 'active', stop searching backwards in this segment
    if (hb.data?.userActivity === 'inactive') {
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
 * Manages activity data storage, aggregation, and persistence
 */
class ActivityStore {
  // ---- CLASS PROPERTY DECLARATIONS ----
  private options: StoreOptions;
  private dataFilePath: string;
  // Assuming TimelineGenerator class exists and is imported correctly
  private timelineGenerator: TimelineGenerator;
  public data: StoreData; // Public for easy access, consider making private with getters later
  public isTracking: boolean; // Public for main.js access check
  private autoSaveInterval: NodeJS.Timeout | null; // Use NodeJS.Timeout type


  /**
   * Initialize the ActivityStore
   * @param {Partial<StoreOptions>} options - Configuration options (allow partial input)
   */
  constructor(options: Partial<StoreOptions> = {}) { // Use Partial for optional constructor options
    // Provide default values using nullish coalescing
    this.options = {
      useMockData: options.useMockData ?? false,
      storagePath: options.storagePath ?? null
    };

    // Set up file paths
    this.dataFilePath = this.options.storagePath ||
      path.join(app.getPath('userData'), 'activity-data.json');

    // Initialize data structure first (needed potentially by TimelineGenerator)
    // Default structure if loading fails or no data exists
    this.data = {
      version: 1,
      startTime: Date.now(),
      lastCleanup: Date.now(),
      aggregationInterval: 15, // Default interval
      days: {}
    };

    // Tracking state initialization
    this.isTracking = false;
    this.autoSaveInterval = null;

    // Initialize timeline generator - NO constructor args
    this.timelineGenerator = new TimelineGenerator();


    // --- Data Loading / Mocking ---
    if (this.options.useMockData) {
      console.log("🧪 Initializing ActivityStore with mock data.");
      // Assuming generateMockData returns StoreData (now including aggregationInterval)
      this.data = generateMockData() as StoreData;
      // Removed the check for aggregationInterval as mockData now provides it.

      // Set interval in the generator instance from mock data
      this.timelineGenerator.setAggregationInterval(this.data.aggregationInterval);
    } else {
       console.log("💾 Initializing ActivityStore with persistent storage.");
      // Load data from disk if available (this might overwrite this.data)
      this.loadDataFromDisk();
       // Set interval in the generator instance based on loaded or default data
       // loadDataFromDisk ensures this.data.aggregationInterval is valid
       this.timelineGenerator.setAggregationInterval(this.data.aggregationInterval);
    }

    // Register IPC handlers after everything is initialized
    this.registerIpcHandlers();
    console.log(`ActivityStore initialized. Aggregation interval: ${this.data.aggregationInterval} minutes.`);
  }

  /**
   * Register IPC handlers for renderer communication
   */
  registerIpcHandlers() {
    // Don't register 'get-tracking-status' here to avoid duplicate with main.js
    // Add types for event and date arguments from electron
    ipcMain.handle('get-day-data', (event: IpcMainInvokeEvent, date: string | null | undefined): DayData | null => this.getDayData(date));
    ipcMain.handle('get-available-dates', (): string[] => this.getAvailableDates());
    // For ipcMain.on, the event type is IpcMainEvent, handler returns void
    ipcMain.on('start-tracking', (event: IpcMainEvent): void => this.startTracking());
    ipcMain.on('pause-tracking', (event: IpcMainEvent): void => this.pauseTracking());
  }

  /**
   * Load data from disk, ensuring data integrity and valid aggregation interval.
   * Overwrites `this.data` if valid data is found.
   */
  loadDataFromDisk(): void { // Add return type void
    if (!fs.existsSync(this.dataFilePath)) {
        console.log(`Data file not found at ${this.dataFilePath}, starting fresh.`);
        // Keep the default data initialized in the constructor
        return;
    }

    try {
        const fileData = fs.readFileSync(this.dataFilePath, 'utf8');
        // Use try-catch for JSON parsing
        let parsedData: any;
        try {
            parsedData = JSON.parse(fileData);
        } catch (parseError) {
            console.error(`Error parsing activity data JSON from ${this.dataFilePath}:`, parseError);
            // Keep default data initialized in constructor if parsing fails
            return; // Exit early
        }


        // Perform basic validation and migration if needed
        if (parsedData && typeof parsedData === 'object' && parsedData.version === 1 && typeof parsedData.days === 'object') {
           // Type assertion after validation
           this.data = parsedData as StoreData;
           console.log(`Activity data loaded successfully from ${this.dataFilePath}.`);
        } else {
            console.warn(`Loaded data from ${this.dataFilePath} is invalid, outdated, or missing required fields. Resetting to default.`);
            // Keep default this.data initialized in constructor
            // Optionally: Backup the invalid file before overwriting?
            // fs.renameSync(this.dataFilePath, `${this.dataFilePath}.invalid-${Date.now()}`);
        }


        // Ensure aggregationInterval exists and is valid *after* potentially loading data
        if (!this.data.aggregationInterval || ![5, 10, 15].includes(this.data.aggregationInterval)) {
           console.warn(`Loaded/default data has invalid aggregationInterval (${this.data.aggregationInterval}), correcting to 15.`);
           this.data.aggregationInterval = 15;
           // Persist the corrected interval immediately? Or wait for next save?
           // this.saveToDisk(); // Maybe not here, could cause loop if save fails?
        }

    } catch (error) {
      // Catch errors from fs.readFileSync
      console.error(`Error reading activity data file ${this.dataFilePath}:`, error);
      // Keep using default empty data structure initialized in constructor
    }
  }

  /**
   * Save data to disk
   */
  saveToDisk(): void { // Add return type void
    if (this.options.useMockData) {
      // console.log('Using mock data, not saving to disk'); // Optional logging
      return;
    }

    try {
      // Ensure the directory exists before writing
      const dirPath = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dirPath)) {
          console.log(`Creating directory: ${dirPath}`);
          fs.mkdirSync(dirPath, { recursive: true });
      }

      const dataString = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(this.dataFilePath, dataString, 'utf8');
      // console.log(`Activity data saved to ${this.dataFilePath}`); // Optional: reduce log verbosity
    } catch (error) {
      console.error(`Error saving activity data to ${this.dataFilePath}:`, error);
    }
  }

  /**
   * Get the current aggregation interval
   * @returns {number} The current aggregation interval in minutes (5, 10, or 15)
   */
  getAggregationInterval(): 5 | 10 | 15 { // Use literal type for return
    return this.data.aggregationInterval;
  }

  /**
   * Set a new aggregation interval and update all aggregated data
   * @param {number} interval - The new interval in minutes (5, 10, or 15)
   * @returns {void}
   */
  // Add literal type for interval argument, return type is void
  setAggregationInterval(interval: 5 | 10 | 15): void {
    // Validate interval (already typed, but keep check for robustness if called from JS)
    if (![5, 10, 15].includes(interval)) {
      console.error('Invalid interval passed to setAggregationInterval:', interval);
      return; // Or throw error
    }

    // Skip if no change
    if (interval === this.data.aggregationInterval) {
      console.log(`Aggregation interval is already ${interval} minutes. No change needed.`);
      return;
    }

    console.log(`Changing aggregation interval from ${this.data.aggregationInterval} to ${interval} minutes`);

    // Update interval in data object
    this.data.aggregationInterval = interval;

    // Update the timeline generator instance with the new interval
    this.timelineGenerator.setAggregationInterval(interval);

    // Re-aggregate all existing days using the new interval
    this.reaggregateDays();

    // Save changes (including new interval and reaggregated data)
    this.saveToDisk();
  }

  /**
   * Reaggregate all days with the current interval setting. Called after interval change.
   */
  reaggregateDays(): void { // Add return type void
    // Skip if using mock data
    if (this.options.useMockData) {
      console.log("Skipping reaggregation (using mock data).");
      return;
    }

    console.log('Reaggregating data for all days...');
    let daysProcessed = 0;
    // Re-process each day
    // Add type for dateKey argument in forEach callback
    Object.keys(this.data.days).forEach((dateKey: string) => {
      this.updateAggregatedData(dateKey); // This handles aggregation logic
      daysProcessed++;
    });
     // Notify renderer once after reaggregation is complete (if any days were processed)
     if (daysProcessed > 0) {
         this.notifyFullDataUpdate();
         console.log(`Reaggregation complete for ${daysProcessed} days.`);
     } else {
         console.log("No days found to reaggregate.");
     }
  }

   /**
    * Notify the renderer process that all data might have changed (e.g., after reaggregation)
    */
   notifyFullDataUpdate(): void {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length === 0) return;

        console.log("Notifying renderer(s) of full data update...");
        windows.forEach((window: BrowserWindow) => {
          // Add checks for window, webContents existence and destroyed status
          if (window && !window.isDestroyed() && window.webContents) {
             try {
                 // Use null or a specific flag to indicate full refresh needed on client-side
                 window.webContents.send('activity-data-updated', null);
             } catch (sendError) {
                 console.warn(`Failed to send activity-data-updated (full) to window ${window.id}:`, sendError);
             }
          }
        });
   }


  /**
   * Start autosave timer
   */
  startAutoSave(): void { // Add return type void
    if (this.autoSaveInterval) {
      // console.log('Autosave timer already running.'); // Optional log
      return; // Avoid multiple intervals
    }
    console.log('Starting autosave timer (every 5 minutes)...');
    // Save every 5 minutes
    this.autoSaveInterval = setInterval(() => {
      // console.log('Autosaving activity data...'); // Optional: reduce verbosity
      this.saveToDisk();
    }, 5 * 60 * 1000); // 5 minutes
    // Prevent Node.js from exiting if this is the only active timer
    this.autoSaveInterval.unref();
  }

  /**
   * Stop autosave timer
   */
  stopAutoSave(): void { // Add return type void
    if (this.autoSaveInterval) {
      console.log('Stopping autosave timer.');
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Start tracking activity
   */
  startTracking(): void { // Add return type void
    if (this.isTracking || this.options.useMockData) {
      const reason = this.isTracking ? 'already tracking' : 'using mock data';
      // console.log(`Start tracking request ignored (${reason}).`); // Can be noisy
      return;
    }

    console.log('Activity tracking started');
    this.isTracking = true;
    this.startAutoSave(); // Start saving periodically
  }

  /**
   * Pause tracking activity
   */
  pauseTracking(): void { // Add return type void
    if (!this.isTracking || this.options.useMockData) {
       const reason = !this.isTracking ? 'not tracking' : 'using mock data';
       // console.log(`Pause tracking request ignored (${reason}).`); // Can be noisy
      return;
    }

    console.log('Activity tracking paused');
    this.isTracking = false;
    this.stopAutoSave(); // Stop the timer
    console.log("Saving data on pause...");
    this.saveToDisk(); // Save current state immediately when pausing
  }

  /**
   * Add a heartbeat to the store
   * @param {HeartbeatData} heartbeatData - Data from watchers
   */
  // Add type for heartbeatData argument
  addHeartbeat(heartbeatData: HeartbeatData): void { // Add return type void
    if (!this.isTracking || this.options.useMockData) {
      // Avoid logging potentially frequent messages here unless debugging
      return;
    }

    const timestamp = Date.now();
    const dateKey = this.getDateKey(timestamp);

    // Ensure day object exists in the data structure for this date key
    this.ensureDayExists(dateKey);

    // Create heartbeat object
    const heartbeat: Heartbeat = { // Use Heartbeat type
      timestamp,
      // Defensively copy data to avoid modification issues if watchers reuse objects
      data: { ...heartbeatData }
    };

    // console.log('New Heartbeat:', heartbeat); // Debug log

    // Get the specific day's data reference
    const dayData = this.data.days[dateKey];

    // Add the new heartbeat
    dayData.heartbeats.push(heartbeat);

    // Process 'may_be_inactive' states *after* adding the new heartbeat
    // Pass the array directly; handleMayBeInactive returns the same array or a new one if changed
    const potentiallyUpdatedHeartbeats = handleMayBeInactive(
        dayData.heartbeats,
        timestamp, // Timestamp of the current heartbeat that might trigger the change
        heartbeatData // Data of the current heartbeat
    );
    // Update the array reference only if handleMayBeInactive actually modified it
    if (potentiallyUpdatedHeartbeats !== dayData.heartbeats) {
        // console.log("handleMayBeInactive updated heartbeats array."); // Debug log
        dayData.heartbeats = potentiallyUpdatedHeartbeats;
    }


    // Regenerate aggregated data for the affected day
    this.updateAggregatedData(dateKey);

    // Notify the renderer process of the update for this specific day
    this.notifyDataUpdate(dateKey);
  }

  /**
   * Get the date key (YYYY-MM-DD) for a timestamp
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} Date key
   */
  // Add type for timestamp argument
  getDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    // Use toISOString for consistency and simplicity, relies on UTC internally
    // If local time key is needed, use date.getFullYear(), getMonth()+1, getDate()
    return date.toISOString().split('T')[0];
  }

  /**
   * Ensure a day object exists in the data structure for a given date key
   * @param {string} dateKey - Date key (YYYY-MM-DD)
   */
  // Add type for dateKey argument
  ensureDayExists(dateKey: string): void { // Add return type void
    if (!this.data.days[dateKey]) {
      // console.log(`Creating new day entry for ${dateKey}`); // Debug log
      this.data.days[dateKey] = {
        heartbeats: []
        // Aggregated data will be added/updated by updateAggregatedData
      };
    }
  }


  /**
   * Update aggregated data for a specific day using the TimelineGenerator.
   * This is called after adding a heartbeat or reaggregating.
   * @param {string} dateKey - Date key (YYYY-MM-DD)
   */
  // Add type for dateKey argument
  updateAggregatedData(dateKey: string): void { // Add return type void
    const dayData = this.data.days[dateKey];

    // Ensure dayData actually exists before proceeding
    if (!dayData) {
        console.warn(`Attempted to update aggregated data for non-existent date key: ${dateKey}`);
        return;
    }


    // If there are no heartbeats, ensure aggregated data is removed
    if (!dayData.heartbeats || dayData.heartbeats.length === 0) {
        if (dayData.aggregated) {
           // console.log(`Clearing aggregated data for ${dateKey} (no heartbeats)`); // Debug log
           delete dayData.aggregated;
        }
      return;
    }

    // console.log(`Updating aggregated data for ${dateKey} with ${dayData.heartbeats.length} heartbeats...`); // Debug log
    try {
        // Generate timeline events using the current aggregation interval setting in the generator
        const timelineEvents = this.timelineGenerator.generateTimelineEvents(
          dayData.heartbeats // Pass the current heartbeats for the day
        );

        // Calculate summary based on the generated timeline events
        const summary = this.timelineGenerator.calculateSummary(timelineEvents);

        // Update the aggregated data field on the dayData object
        dayData.aggregated = {
          summary,
          timelineOverview: timelineEvents
        };
        // console.log(`Aggregated data updated for ${dateKey}. Summary keys: ${Object.keys(summary || {}).join(', ')}`); // Debug log
    } catch (error) {
        console.error(`Error updating aggregated data for ${dateKey}:`, error);
        // Decide how to handle aggregation errors: Clear aggregated data? Log and keep old?
        delete dayData.aggregated; // Safer option: remove potentially corrupt aggregation
    }
  }

  /**
   * Notify the renderer process of data updates for a specific day
   * @param {string} dateKey - Date key (YYYY-MM-DD)
   */
  // Add type for dateKey argument
  notifyDataUpdate(dateKey: string): void { // Add return type void
    // Get all browser windows - could be inefficient if many windows exist
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    // console.log(`Notifying renderer(s) of update for date: ${dateKey}`); // Debug log
    // Add type for window argument from electron
    windows.forEach((window: BrowserWindow) => {
      // Add checks for window, webContents existence and destroyed status
      if (window && !window.isDestroyed() && window.webContents) {
          try {
             window.webContents.send('activity-data-updated', dateKey);
          } catch (sendError) {
              console.warn(`Failed to send activity-data-updated to window ${window.id}:`, sendError);
          }
      }
    });
  }

  /**
   * Get data for a specific day
   * @param {string | null | undefined} dateKey - Date key (YYYY-MM-DD), defaults to today if null/undefined
   * @returns {DayData | null} Day data object or null if not found or invalid key
   */
  // Update type for dateKey argument and return type
  getDayData(dateKey?: string | null): DayData | null {
    // If no date provided or empty string, use today
    const targetDateKey = dateKey || this.getDateKey(Date.now());

    // Optional: Validate the format of the dateKey before lookup
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)) {
        console.warn(`Invalid date key format requested: ${targetDateKey}`);
        return null;
    }

    // Return a copy to prevent accidental modification? Deep copy needed if so.
    // For now, returning direct reference. Be careful on client-side.
    return this.data.days[targetDateKey] || null;
  }

  /**
   * Get a list of all available dates for which data exists
   * @returns {string[]} Array of date keys (YYYY-MM-DD) sorted chronologically
   */
  // Add return type string[]
  getAvailableDates(): string[] {
    // Filter for valid keys and sort
    return Object.keys(this.data.days)
           .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)) // Ensure valid date format keys
           .sort(); // Sort chronologically
  }

  /**
   * Clean up old data (older than 30 days) based on the date key.
   * Runs automatically at most once per day.
   */
  cleanupOldData(): void { // Add return type void
    if (this.options.useMockData) {
      return; // Don't clean up mock data
    }

    const now = Date.now();
    // Check last cleanup time (stored in this.data)
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (this.data.lastCleanup && this.data.lastCleanup > (now - oneDayMs)) {
      // console.log('Skipping old data cleanup (last run less than 24h ago)'); // Optional log
      return;
    }

    console.log('Running cleanup check for data older than 30 days...');
    const thirtyDaysAgoTimestamp = now - (30 * oneDayMs);
    const datesToDelete: string[] = [];

    // Find date keys representing dates older than 30 days
    for (const dateKey in this.data.days) {
       // Ensure it's a valid own property and matches YYYY-MM-DD format
       if (Object.prototype.hasOwnProperty.call(this.data.days, dateKey) && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
         try {
             // Compare the date represented by the key with the threshold
             // Date.parse is generally reliable for YYYY-MM-DD
             const dateTimestamp = Date.parse(dateKey);
             // Check if parsing succeeded and the date is before the threshold
             if (!isNaN(dateTimestamp) && dateTimestamp < thirtyDaysAgoTimestamp) {
                 datesToDelete.push(dateKey);
             }
         } catch (e) {
             // Catch potential errors with Date.parse, though unlikely for YYYY-MM-DD
             console.warn(`Invalid date key encountered during cleanup check: ${dateKey}`, e);
         }
       } else if (Object.prototype.hasOwnProperty.call(this.data.days, dateKey)) {
            // Log unexpected keys found in data.days
            console.warn(`Unexpected key format found in data.days during cleanup: ${dateKey}`);
       }
    }

    let needsSave = false;
    // Delete the identified old dates
    if (datesToDelete.length > 0) {
        console.log(`Cleaning up ${datesToDelete.length} days of old data: ${datesToDelete.join(', ')}`);
        datesToDelete.forEach(dateKey => {
          delete this.data.days[dateKey];
        });
        needsSave = true; // Need to save the data changes
    } else {
        // console.log('No old data found to clean up.'); // Optional log
    }


    // Update last cleanup time regardless of whether data was deleted, to prevent re-checking too soon
    this.data.lastCleanup = now;
    needsSave = true; // Need to save the updated timestamp

    // Save changes to disk if any data was deleted or timestamp was updated
    if (needsSave) {
        this.saveToDisk();
    }
  }

  /**
   * Clean up resources: stop tracking, save data, unregister IPC handlers.
   */
  cleanup(): void { // Add return type void
    console.log('Cleaning up ActivityStore...');
    this.pauseTracking(); // Ensures tracking is stopped, autosave is stopped, and final data is saved.

    // Unregister IPC handlers to prevent calls after cleanup
    ipcMain.removeHandler('get-day-data');
    ipcMain.removeHandler('get-available-dates');
    ipcMain.removeAllListeners('start-tracking');
    ipcMain.removeAllListeners('pause-tracking');

    console.log('ActivityStore cleaned up successfully.');
  }
}

// Export the class using ES module syntax
export default ActivityStore;
// Remove module.exports if it exists
// // module.exports = ActivityStore; // Remove CommonJS export
// // module.exports.handleMayBeInactive = handleMayBeInactive; // Remove CommonJS export

