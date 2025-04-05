import * as path from 'path';
import { app } from 'electron';
import TimelineGenerator, { AggregationIntervalMinutes } from './TimelineGenerator';
import { generateMockData } from './mockData';
import { ActivityPersistence } from './ActivityPersistence';
import { ActivityIpc } from './ActivityIpc';

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
 * Manages activity data storage, aggregation, and persistence
 */
class ActivityStore {
  // ---- CLASS PROPERTY DECLARATIONS ----
  private options: StoreOptions;
  private dataFilePath: string;
  private timelineGenerator: TimelineGenerator;
  private persistence: ActivityPersistence;
  private ipcHandler: ActivityIpc;
  public data: StoreData;
  public isTracking: boolean;
  private autoSaveInterval: NodeJS.Timeout | null;
  private periodicUpdateInterval: NodeJS.Timeout | null = null;
  private currentDayKey: string = '';
  private currentDayAggregatedData: AggregatedData | null = null;

  constructor(options: Partial<StoreOptions> = {}) {
    this.options = {
      useMockData: options.useMockData ?? false,
      storagePath: options.storagePath ?? null
    };

    this.dataFilePath = this.options.storagePath ||
      path.join(app.getPath('userData'), 'activity-data.json');

    this.persistence = new ActivityPersistence(this.dataFilePath);

    this.currentDayKey = this.getDateKey(Date.now());

    this.isTracking = false;
    this.autoSaveInterval = null;
    this.periodicUpdateInterval = null;
    this.timelineGenerator = new TimelineGenerator();

    if (this.options.useMockData) {
      console.log("🧪 Initializing ActivityStore with mock data.");
      this.data = generateMockData() as StoreData;
      this.timelineGenerator.setAggregationInterval(this.data.aggregationInterval);
      this.preAggregateMockData();
    } else {
       console.log("💾 Initializing ActivityStore with persistent storage.");
       const loadedData = this.persistence.loadData();
       if (loadedData) {
           this.data = loadedData;
           console.log(`[Store] Data loaded via persistence layer.`);
       } else {
           console.log(`[Store] No valid data loaded, initializing with defaults.`);
           this.data = {
               version: 1,
               startTime: Date.now(),
               lastCleanup: 0,
               aggregationInterval: 15,
               days: {}
           };
       }
       this.timelineGenerator.setAggregationInterval(this.data.aggregationInterval);
       this.cleanupOldData();
    }

    this.ipcHandler = new ActivityIpc(this);
    this.ipcHandler.registerHandlers();

    console.log(`ActivityStore initialized. Aggregation interval: ${this.data.aggregationInterval} minutes.`);
  }

  private preAggregateMockData(): void {
      console.log("🧪 Pre-aggregating mock data...");
      const todayKey = this.getDateKey(Date.now());
      for (const dateKey in this.data.days) {
          if (Object.prototype.hasOwnProperty.call(this.data.days, dateKey)) {
              const dayHeartbeats = this.data.days[dateKey]?.heartbeats;
              if (dayHeartbeats && dayHeartbeats.length > 0) {
                  try {
                      const aggregated = this.performAggregation(dayHeartbeats);
                      if (dateKey === todayKey) {
                          this.currentDayAggregatedData = aggregated;
                      }
                  } catch (error) {
                      console.error(`Error pre-aggregating mock data for ${dateKey}:`, error);
                  }
              }
          }
      }
      console.log("🧪 Mock data pre-aggregation complete.");
  }

  saveToDisk(): void {
    if (this.options.useMockData) {
      return;
    }

    if (this.autoSaveInterval) {
      clearTimeout(this.autoSaveInterval);
    }

    this.autoSaveInterval = setTimeout(() => {
      console.log(`[Store] Scheduling save via persistence layer...`);
      try {
        this.persistence.saveData(this.data);
      } catch (error) {
        console.error(`[Store] Error occurred while trying to schedule save:`, error);
      }
      this.autoSaveInterval = null;
    }, 500);
    this.autoSaveInterval.unref();
  }

  startTracking(): void {
    if (this.isTracking) {
      console.log('Tracking already active.');
      return;
    }
    console.log('Starting tracking...');
    this.isTracking = true;
    this.currentDayKey = this.getDateKey(Date.now());
    this.ensureDayExists(this.currentDayKey);

    if (!this.currentDayAggregatedData) {
        this.aggregateAndCacheCurrentDay();
    }

    this.startPeriodicAggregation();

    this.notifyTrackingStatusChange();
  }

  pauseTracking(): void {
    if (!this.isTracking) {
      return;
    }
    console.log('Pausing tracking...');
    this.isTracking = false;

    this.stopPeriodicAggregation();

    if (this.autoSaveInterval) {
      clearTimeout(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    this.saveToDisk();

    this.notifyTrackingStatusChange();
  }

  private startPeriodicAggregation(): void {
      if (this.periodicUpdateInterval) {
          console.warn("Periodic aggregation interval already running.");
      return;
    }
      console.log("Starting periodic aggregation timer (check every minute, run every 5 minutes)...");

      this.periodicUpdateInterval = setInterval(() => {
          if (!this.isTracking) {
              this.stopPeriodicAggregation();
              return;
          }

          const now = new Date();
          const currentMinute = now.getMinutes();
          const currentKey = this.getDateKey(now.getTime());

          if (currentKey !== this.currentDayKey) {
              console.log(`Day changed during tracking. Old: ${this.currentDayKey}, New: ${currentKey}`);
              this.currentDayKey = currentKey;
              this.currentDayAggregatedData = null;
              this.ensureDayExists(this.currentDayKey);
              this.aggregateAndCacheCurrentDay();
          }

          if (currentMinute % 5 === 0) {
              console.log(`Performing periodic aggregation for ${this.currentDayKey} at minute ${currentMinute}...`);
              this.aggregateAndCacheCurrentDay();
          }

      }, 60 * 1000);
      this.periodicUpdateInterval.unref();
  }

  private stopPeriodicAggregation(): void {
      if (this.periodicUpdateInterval) {
          console.log("Stopping periodic aggregation timer.");
          clearInterval(this.periodicUpdateInterval);
          this.periodicUpdateInterval = null;
    }
  }

  private aggregateAndCacheCurrentDay(): void {
      const dayData = this.data.days[this.currentDayKey];
      if (!dayData || !dayData.heartbeats || dayData.heartbeats.length === 0) {
          if (this.currentDayAggregatedData !== null) {
              this.currentDayAggregatedData = null;
              this.notifyDataUpdate(this.currentDayKey);
          return;
        }
      }

      try {
          const aggregated = this.performAggregation(dayData.heartbeats);
          if (JSON.stringify(aggregated) !== JSON.stringify(this.currentDayAggregatedData)) {
              this.currentDayAggregatedData = aggregated;
              this.notifyDataUpdate(this.currentDayKey);
          }
      } catch (error) {
          console.error(`Error during aggregation for ${this.currentDayKey}:`, error);
          if (this.currentDayAggregatedData !== null) {
               this.currentDayAggregatedData = null;
               this.notifyDataUpdate(this.currentDayKey);
          }
      }
  }

   private performAggregation(heartbeats: Heartbeat[]): AggregatedData | null {
       if (!heartbeats || heartbeats.length === 0) {
           return null;
       }
       try {
           const timelineEvents = this.timelineGenerator.generateTimelineEvents(heartbeats);
           const summary = this.timelineGenerator.calculateSummary(timelineEvents);
           return { summary, timelineOverview: timelineEvents };
       } catch (error) {
           throw error;
       }
   }

  addHeartbeat(heartbeatData: HeartbeatData): void {
    if (!this.isTracking) {
      return;
    }

    const timestamp = Date.now();
    const dateKey = this.getDateKey(timestamp);

    if (dateKey !== this.currentDayKey) {
        console.log(`Day changed during heartbeat addition. Old: ${this.currentDayKey}, New: ${dateKey}`);
        this.saveToDisk();
        this.currentDayKey = dateKey;
        this.currentDayAggregatedData = null;
    }

    this.ensureDayExists(dateKey);

    let dayHeartbeats = this.data.days[dateKey].heartbeats;

    const potentiallyUpdatedHeartbeats = handleMayBeInactive([...dayHeartbeats], timestamp, heartbeatData);

    const newHeartbeat: Heartbeat = { timestamp, data: heartbeatData };

    potentiallyUpdatedHeartbeats.push(newHeartbeat);

    this.data.days[dateKey].heartbeats = potentiallyUpdatedHeartbeats;

    this.saveToDisk();
  }

  getDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  }

  ensureDayExists(dateKey: string): void {
    if (!this.data.days[dateKey]) {
      this.data.days[dateKey] = {
        heartbeats: []
      };
    }
  }

  notifyDataUpdate(dateKey: string): void {
    if (this.ipcHandler) {
        this.ipcHandler.notifyDataUpdate(dateKey);
    } else {
        console.warn("[Store] ipcHandler not initialized when trying to notifyDataUpdate.");
    }
  }

  private notifyTrackingStatusChange(): void {
      if (this.ipcHandler) {
         this.ipcHandler.notifyTrackingStatusChange(this.isTracking);
      } else {
          console.warn("[Store] ipcHandler not initialized when trying to notifyTrackingStatusChange.");
      }
  }

  getDayData(dateKey?: string | null): DayData | null {
    const targetDateKey = dateKey || this.getDateKey(Date.now());

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)) {
        console.warn(`Invalid date key format requested: ${targetDateKey}`);
        return null;
    }

    const dayHeartbeats = this.data.days[targetDateKey]?.heartbeats;

    if (!dayHeartbeats) {
        return null;
    }

    let aggregatedData: AggregatedData | null = null;

    if (targetDateKey === this.currentDayKey && this.currentDayAggregatedData) {
        aggregatedData = this.currentDayAggregatedData;
    } else {
        try {
            aggregatedData = this.performAggregation(dayHeartbeats);
             if (targetDateKey === this.currentDayKey) {
                 this.currentDayAggregatedData = aggregatedData;
             }
        } catch (error) {
            console.error(`Error during on-demand aggregation for ${targetDateKey}:`, error);
            return { heartbeats: dayHeartbeats };
        }
    }

    const result: DayData = {
        heartbeats: dayHeartbeats
    };
    if (aggregatedData) {
        result.aggregated = aggregatedData;
    }

    return result;
  }

  getAvailableDates(): string[] {
    return Object.keys(this.data.days)
           .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key))
           .sort();
  }

  cleanupOldData(): void {
    if (this.options.useMockData) {
      return;
    }

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (this.data.lastCleanup && this.data.lastCleanup > (now - oneDayMs)) {
      return;
    }

    console.log('Running cleanup check for data older than 30 days...');
    const thirtyDaysAgoTimestamp = now - (30 * oneDayMs);
    const datesToDelete: string[] = [];

    for (const dateKey in this.data.days) {
       if (Object.prototype.hasOwnProperty.call(this.data.days, dateKey) && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
         try {
             const dateTimestamp = Date.parse(dateKey);
             if (!isNaN(dateTimestamp) && dateTimestamp < thirtyDaysAgoTimestamp) {
                 datesToDelete.push(dateKey);
             }
         } catch (e) {
             console.warn(`Invalid date key encountered during cleanup check: ${dateKey}`, e);
         }
       } else if (Object.prototype.hasOwnProperty.call(this.data.days, dateKey)) {
            console.warn(`Unexpected key format found in data.days during cleanup: ${dateKey}`);
       }
    }

    let needsSave = false;
    if (datesToDelete.length > 0) {
        console.log(`Cleaning up ${datesToDelete.length} days of old data: ${datesToDelete.join(', ')}`);
        datesToDelete.forEach(dateKey => {
          delete this.data.days[dateKey];
        });
        needsSave = true;
    } else {
    }

    this.data.lastCleanup = now;
    needsSave = true;

    if (needsSave) {
        this.saveToDisk();
    }
  }

  cleanup(): void {
    console.log('[Store] Cleaning up ActivityStore...');
    this.pauseTracking();

    this.stopPeriodicAggregation();

    if (this.ipcHandler) {
        this.ipcHandler.cleanup();
    }

    console.log('[Store] ActivityStore cleaned up successfully.');
  }

  getAggregationInterval(): AggregationIntervalMinutes {
      return this.timelineGenerator.aggregationInterval;
  }

  setAggregationInterval(interval: AggregationIntervalMinutes): void {
      if (![5, 10, 15].includes(interval)) {
        console.error('Invalid interval passed to setAggregationInterval:', interval);
        return;
      }

      if (interval === this.timelineGenerator.aggregationInterval) {
        return;
      }

      console.log(`Changing aggregation interval to ${interval} minutes.`);

      this.data.aggregationInterval = interval;

      this.timelineGenerator.setAggregationInterval(interval);

      this.currentDayAggregatedData = null;
      console.log(`Cleared aggregation cache for ${this.currentDayKey} due to interval change.`);

      if (this.isTracking) {
          console.log("Triggering immediate aggregation for current day with new interval...");
          this.aggregateAndCacheCurrentDay();
      }

      this.saveToDisk();
  }
}

export default ActivityStore;