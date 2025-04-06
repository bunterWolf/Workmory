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
  private intervalEndTimer: NodeJS.Timeout | null = null;
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

    console.log(`[Store] Saving data to disk...`);
    try {
      this.persistence.saveData(this.data);
    } catch (error) {
      console.error(`[Store] Error saving data:`, error);
    }
  }

  startTracking(): void {
    if (this.isTracking) {
      console.log('Tracking already active.');
      return;
    }
    console.log('Starting tracking...');
    this.isTracking = true;
    this.currentDayKey = this.getDateKey(Date.now());

    this.scheduleNextIntervalEndAction();

    this.notifyTrackingStatusChange();
  }

  pauseTracking(): void {
    if (!this.isTracking) {
      return;
    }
    console.log('Pausing tracking...');
    this.isTracking = false;

    if (this.intervalEndTimer) {
        clearTimeout(this.intervalEndTimer);
        this.intervalEndTimer = null;
        console.log("[Store] Interval end timer stopped.");
    }

    this.saveToDisk();

    this.notifyTrackingStatusChange();
  }

  private calculateNextIntervalEnd(now: number): number {
    const intervalMinutes = this.timelineGenerator.aggregationInterval;
    const intervalMillis = intervalMinutes * 60 * 1000;
    const nextIntervalStart = Math.ceil(now / intervalMillis) * intervalMillis;
    return nextIntervalStart;
  }

  private scheduleNextIntervalEndAction(): void {
      if (!this.isTracking || this.options.useMockData) {
          return;
      }

      if (this.intervalEndTimer) {
          clearTimeout(this.intervalEndTimer);
      }

      const now = Date.now();
      const nextIntervalEndTime = this.calculateNextIntervalEnd(now);
      const delay = nextIntervalEndTime - now;

      if (delay < 0) {
          console.warn(`[Store] Calculated delay is negative (${delay}ms). Scheduling for immediate run.`);
          this.performIntervalEndActions();
          return;
      }

      console.log(`[Store] Scheduling next interval action in ${delay} ms (at ${new Date(nextIntervalEndTime).toISOString()})`);

      this.intervalEndTimer = setTimeout(() => {
          this.performIntervalEndActions();
      }, delay);
      this.intervalEndTimer.unref();
  }

  private performIntervalEndActions(): void {
      if (!this.isTracking) {
          console.warn("[Store] performIntervalEndActions called while not tracking. Skipping.");
          return;
      }

      console.log(`[Store] Performing actions for interval end at ${new Date().toISOString()}`);

      this.aggregateAndCacheCurrentDay();

      this.saveToDisk();

      this.scheduleNextIntervalEndAction();
  }

  private aggregateAndCacheCurrentDay(): void {
    if (this.options.useMockData) return;

    const dateKey = this.currentDayKey;
    const dayHeartbeats = this.data.days[dateKey]?.heartbeats;

    if (!dayHeartbeats || dayHeartbeats.length === 0) {
      if (this.currentDayAggregatedData !== null) {
           this.currentDayAggregatedData = null;
           this.notifyDataUpdate(dateKey);
           console.log(`[Store] Cleared aggregation cache for ${dateKey} as no heartbeats exist.`);
      }
      return;
    }

    console.log(`[Store] Aggregating ${dayHeartbeats.length} heartbeats for ${dateKey}...`);
    try {
        const newAggregatedData = this.performAggregation(dayHeartbeats);

        const hasChanged = JSON.stringify(this.currentDayAggregatedData) !== JSON.stringify(newAggregatedData);

        if (hasChanged) {
            this.currentDayAggregatedData = newAggregatedData;
            console.log(`[Store] Aggregation cache updated for ${dateKey}.`);
            this.notifyDataUpdate(dateKey);
        } else {
        }
    } catch (error) {
      console.error(`[Store] Error during aggregation for ${dateKey}:`, error);
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
           console.error(`[Store] Error in TimelineGenerator during aggregation:`, error);
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
             const dateTimestamp = Date.parse(dateKey + 'T00:00:00Z');
             if (!isNaN(dateTimestamp) && dateTimestamp < thirtyDaysAgoTimestamp) {
                 datesToDelete.push(dateKey);
             }
         } catch (e) {
             console.warn(`[Store] Invalid date key encountered during cleanup check: ${dateKey}`, e);
         }
       } else if (Object.prototype.hasOwnProperty.call(this.data.days, dateKey)) {
            console.warn(`[Store] Unexpected key format found in data.days during cleanup: ${dateKey}`);
       }
    }

    let needsSave = false;
    if (datesToDelete.length > 0) {
        console.log(`[Store] Cleaning up ${datesToDelete.length} days of old data: ${datesToDelete.join(', ')}`);
        datesToDelete.forEach(dateKey => {
          delete this.data.days[dateKey];
        });
        needsSave = true;
    } else {
    }

    this.data.lastCleanup = now;
    needsSave = true;

    if (needsSave) {
        console.log("[Store] Saving data after cleanup check.");
        this.saveToDisk();
    }
  }

  cleanup(): void {
    console.log("[Store] Cleaning up ActivityStore...");
    if (this.intervalEndTimer) {
        clearTimeout(this.intervalEndTimer);
        this.intervalEndTimer = null;
    }
    if (!this.options.useMockData) {
        console.log("[Store] Performing final save before exit...");
        this.saveToDisk();
    }
    console.log("[Store] ActivityStore cleanup complete.");
  }

  getAggregationInterval(): AggregationIntervalMinutes {
      return this.timelineGenerator.aggregationInterval;
  }

  setAggregationInterval(interval: AggregationIntervalMinutes): void {
      if (![5, 10, 15].includes(interval)) {
        console.error('[Store] Invalid interval passed to setAggregationInterval:', interval);
        return;
      }

      if (interval === this.timelineGenerator.aggregationInterval) {
        console.log(`[Store] Aggregation interval is already ${interval}. No change needed.`);
        return;
      }

      console.log(`[Store] Changing aggregation interval to ${interval} minutes.`);

      this.timelineGenerator.setAggregationInterval(interval);
      this.data.aggregationInterval = interval;

      this.currentDayAggregatedData = null;
      console.log(`[Store] Cleared aggregation cache for ${this.currentDayKey} due to interval change.`);

      if (this.isTracking) {
          console.log("[Store] Rescheduling interval timer due to interval change...");
          if (this.intervalEndTimer) {
              clearTimeout(this.intervalEndTimer);
              this.intervalEndTimer = null;
          }
          this.aggregateAndCacheCurrentDay();
          this.scheduleNextIntervalEndAction();
      }

      this.saveToDisk();
      this.notifyDataUpdate(this.currentDayKey);
  }
}

export default ActivityStore;