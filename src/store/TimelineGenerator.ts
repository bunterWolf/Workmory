/**
 * Handles aggregation of heartbeat data into timeline events
 * Following the rules defined in the spec:
 * - Activities are aggregated in configurable time intervals (5, 10, or 15 minutes)
 * - Activities start/end at fixed times (e.g., XX:00, XX:15, XX:30, XX:45 for 15-min)
 * - Activities require heartbeats for at least half of the interval
 * - Activities are merged when consecutive with same type/content
 */

// Importiere benötigte Typen aus ActivityStore
// Stellen Sie sicher, dass diese Typen in ActivityStore.ts exportiert werden.
import { Heartbeat, TimelineEvent, AggregationSummary, HeartbeatData } from './ActivityStore';

// Definiere den Typ für das Aggregationsintervall
// EXPORT this type so it can be imported by ActivityStore
export type AggregationIntervalMinutes = 5 | 10 | 15;

// Typ für die internen Aktivitätsgruppen in determineDominantActivity
interface ActivityGroup {
    count: number;
    data: { type: string; data: any }; // Typ könnte spezifischer sein
}

// Typ für die Interval-Gruppen in groupHeartbeatsByInterval
interface IntervalGroups {
    [intervalStartTimestamp: number]: Heartbeat[];
}

export default class TimelineGenerator {
  // ---- CLASS PROPERTY DECLARATIONS ----
  // Make these public for testing purposes (consider refactoring tests later)
  public aggregationInterval: AggregationIntervalMinutes = 15;
  public intervalDuration: number = 15 * 60 * 1000;

  /**
   * Konstruktor. Akzeptiert optional ein initiales Intervall.
   * @param initialInterval - Das initiale Aggregationsintervall (5, 10 oder 15).
   */
  constructor(initialInterval?: AggregationIntervalMinutes) {
    if (initialInterval) {
        this.setAggregationInterval(initialInterval);
    } else {
        // Set default values if no initial interval provided
        this.aggregationInterval = 15;
        this.intervalDuration = this.aggregationInterval * 60 * 1000;
    }
  }
  
  /**
   * Set the aggregation interval
   * @param {AggregationIntervalMinutes} minutes - The interval size in minutes (5, 10, or 15)
   */
  setAggregationInterval(minutes: AggregationIntervalMinutes): void {
    // Type validation is implicitly handled by AggregationIntervalMinutes type
    // but keep runtime check for robustness if called from JS.
    if (![5, 10, 15].includes(minutes)) {
      // console.error(`Invalid interval set: ${minutes}. Must be 5, 10, or 15.`);
      // Keep existing interval or throw? Keeping existing for now.
      return;
    }
    // console.log(`TimelineGenerator: Setting aggregation interval to ${minutes} minutes.`);
    this.aggregationInterval = minutes;
    this.intervalDuration = minutes * 60 * 1000;
  }

  /**
   * Generate timeline events from heartbeats for a single day
   * @param {Heartbeat[]} heartbeats - Array of heartbeat objects for a day
   * @returns {TimelineEvent[]} Timeline events
   */
  generateTimelineEvents(heartbeats: Heartbeat[]): TimelineEvent[] {
    if (!heartbeats || !Array.isArray(heartbeats) || heartbeats.length === 0) {
      // console.log("[TimelineGenerator] generateTimelineEvents: No heartbeats received.");
      return [];
    }
    // console.log(`[TimelineGenerator] generateTimelineEvents: Received ${heartbeats.length} heartbeats.`);

    // Sort heartbeats by timestamp (ascending)
    const sortedHeartbeats = [...heartbeats].sort((a, b) => a.timestamp - b.timestamp);
    // console.log("[TimelineGenerator] Sorted Heartbeats:", JSON.stringify(sortedHeartbeats)); // Optional: very verbose

    // Group heartbeats into intervals
    const intervalGroups = this.groupHeartbeatsByInterval(sortedHeartbeats);
    // console.log("[TimelineGenerator] Interval Groups:", JSON.stringify(Object.keys(intervalGroups).reduce((acc, key) => { acc[key] = intervalGroups[parseInt(key)].length; return acc; }, {} as any))); // Log group keys and counts
    
    // Generate activities from interval groups
    const activities = this.generateActivities(intervalGroups);
    // console.log(`[TimelineGenerator] Generated ${activities.length} activities before merging.`);
    
    // Merge consecutive activities with same content
    const mergedActivities = this.mergeConsecutiveActivities(activities);
    // console.log(`[TimelineGenerator] Returning ${mergedActivities.length} merged activities.`);

    return mergedActivities;
  }

  /**
   * Group heartbeats into intervals based on the current aggregation setting.
   * @param {Heartbeat[]} heartbeats - Sorted array of heartbeat objects.
   * @returns {IntervalGroups} Map of interval start timestamps to heartbeats.
   */
  // Make public for testing (consider refactoring tests later)
  public groupHeartbeatsByInterval(heartbeats: Heartbeat[]): IntervalGroups {
    const intervalGroups: IntervalGroups = {};

    heartbeats.forEach((heartbeat: Heartbeat) => {
      // Ensure heartbeat and timestamp are valid before proceeding
      if (!heartbeat || typeof heartbeat.timestamp !== 'number') {
          // console.warn("Skipping invalid heartbeat in groupHeartbeatsByInterval:", heartbeat);
          return; // Skip this heartbeat
      }
      
      // --- Add detailed logging --- 
      // const inputTimestamp = heartbeat.timestamp;
      // const inputDateStr = new Date(inputTimestamp).toISOString();
      // console.log(`[TimelineGenerator] groupHeartbeatsByInterval: Processing heartbeat ${inputTimestamp} (${inputDateStr})`); 
      
      // Round down timestamp to the nearest interval start
      const intervalStart = this.roundToNearestInterval(heartbeat.timestamp);
      // const intervalStartDateStr = new Date(intervalStart).toISOString();
      // console.log(`[TimelineGenerator] groupHeartbeatsByInterval:   -> Rounded interval start: ${intervalStart} (${intervalStartDateStr})`);
      // --- End detailed logging ---

      if (!intervalGroups[intervalStart]) {
        intervalGroups[intervalStart] = [];
      }

      intervalGroups[intervalStart].push(heartbeat);
    });

    return intervalGroups;
  }

  /**
   * Round timestamp down to the nearest interval start time based on the current setting.
   * IMPORTANT: This calculation uses UTC minutes (`getUTCMinutes`, `setUTCMinutes`).
   * This means the aggregation intervals (e.g., 08:00-08:15, 08:15-08:30) are aligned with UTC,
   * not the user's local time. While simpler to implement, this might feel slightly offset
   * in the UI if the user is in a timezone significantly different from UTC.
   * The raw timestamp itself is UTC.
   * @param {number} timestamp - Timestamp in milliseconds (UTC).
   * @returns {number} Rounded timestamp in milliseconds (UTC).
   */
  // Make public for testing (consider refactoring tests later)
  public roundToNearestInterval(timestamp: number): number {
    const date = new Date(timestamp);
    const minutes = date.getUTCMinutes();
    const interval = this.aggregationInterval; // 5, 10, or 15

    // Calculate the start minute of the interval explicitly
    let intervalStartMinute: number;
    if (interval === 15) {
      if (minutes < 15) intervalStartMinute = 0;
      else if (minutes < 30) intervalStartMinute = 15;
      else if (minutes < 45) intervalStartMinute = 30;
      else intervalStartMinute = 45;
    } else if (interval === 10) {
      intervalStartMinute = Math.floor(minutes / 10) * 10;
    } else { // interval === 5
      intervalStartMinute = Math.floor(minutes / 5) * 5;
    }
    
    // Set UTC minutes, seconds, and milliseconds
    date.setUTCMinutes(intervalStartMinute, 0, 0); 
    
    return date.getTime();
  }

  /**
   * Generate activities from interval groups
   * @param {IntervalGroups} intervalGroups - Map of interval start timestamps to heartbeats
   * @returns {TimelineEvent[]} Activities
   */
  generateActivities(intervalGroups: IntervalGroups): TimelineEvent[] {
    const activities: TimelineEvent[] = [];
    // Restore original threshold now that mock data is denser
    const MIN_HEARTBEATS_RATIO = 0.5; 
    // console.log(`[TimelineGenerator] generateActivities: Using MIN_HEARTBEATS_RATIO=${MIN_HEARTBEATS_RATIO}`);

    Object.entries(intervalGroups).forEach(([intervalStartStr, intervalHeartbeats]: [string, Heartbeat[]]) => {
      if (!Array.isArray(intervalHeartbeats) || intervalHeartbeats.length === 0) return;
      const intervalStartTime = parseInt(intervalStartStr, 10);
      if (isNaN(intervalStartTime)) return;

      const expectedHeartbeats = this.aggregationInterval * 2;
      const minimumRequiredHeartbeats = Math.ceil(expectedHeartbeats * MIN_HEARTBEATS_RATIO);
      // console.log(`[TimelineGenerator] Interval ${new Date(intervalStartTime).toISOString()}: Found ${intervalHeartbeats.length} heartbeats (min required: ${minimumRequiredHeartbeats}).`);

      if (intervalHeartbeats.length >= minimumRequiredHeartbeats) {
        // console.log(`[TimelineGenerator] Interval ${new Date(intervalStartTime).toISOString()}: Processing for dominant activity...`);
        const dominantActivity = this.determineDominantActivity(intervalHeartbeats);
        // console.log(`[TimelineGenerator] Interval ${new Date(intervalStartTime).toISOString()}: Dominant activity = ${JSON.stringify(dominantActivity)}`);

        if (dominantActivity) {
            activities.push({
              timestamp: intervalStartTime,
              duration: this.intervalDuration,
              type: dominantActivity.type,
              data: dominantActivity.data
            });
        } else {
            // console.warn(`[TimelineGenerator] No dominant activity determined for interval starting at ${new Date(intervalStartTime).toISOString()}`);
        }
      } else {
          // console.log(`[TimelineGenerator] Interval ${new Date(intervalStartTime).toISOString()}: Skipping due to insufficient heartbeats.`);
      }
    });

    return activities;
  }

  /**
   * Determine the dominant activity within a set of heartbeats for a single interval.
   * Groups heartbeats by type and specific data (e.g., app+title).
   * @param {Heartbeat[]} heartbeats - Array of heartbeat objects for the interval.
   * @returns {{ type: string; data: any } | null} Object with dominant type/data, or null if none found.
   */
  private determineDominantActivity(heartbeats: Heartbeat[]): { type: string; data: any } | null {
    const activityGroups: { [key: string]: ActivityGroup } = {};
    // console.log("[TimelineGenerator] determineDominantActivity: Input heartbeats:", JSON.stringify(heartbeats)); // Optional: Verbose

    heartbeats.forEach((heartbeat: Heartbeat) => {
      if (!heartbeat || !heartbeat.data) {
        // console.log("[TimelineGenerator] determineDominantActivity: Skipping heartbeat with missing data.");
        return;
      }

      let activityKey: string | undefined;
      let activityType: string | undefined;
      let specificData: any = {};

      // --- Determine activity type and key based on heartbeat data --- 

      // Check for Inactivity
      if (heartbeat.data.userActivity === 'inactive') { 
        activityType = 'inactive';
        specificData = { reason: 'User inactive' }; 
        activityKey = 'inactive';
      }
      // Check for Active Application Window
      else if (heartbeat.data.appWindow && heartbeat.data.appWindow.app && heartbeat.data.appWindow.title) {
        activityType = 'appWindow';
        specificData = { app: heartbeat.data.appWindow.app, title: heartbeat.data.appWindow.title };
        activityKey = `app:${specificData.app}:${specificData.title}`;
      }
      // Add other activity types here

      // If an activity type was identified, count it
      if (typeof activityKey === 'string' && typeof activityType === 'string') {
        if (!activityGroups[activityKey]) {
          activityGroups[activityKey] = {
            count: 0,
            data: { type: activityType, data: specificData } 
          };
        }
        activityGroups[activityKey].count++;
      }
    });

    // console.log("[TimelineGenerator] determineDominantActivity: Calculated groups:", JSON.stringify(activityGroups));

    // Find the most frequent specific activity group
    let maxCount = 0;
    let dominantActivityData: { type: string; data: any } | null = null;

    Object.values(activityGroups).forEach((group: ActivityGroup) => {
      if (group.count > maxCount) {
        maxCount = group.count;
        dominantActivityData = group.data;
      }
    });

    // Return the dominant activity's type and data, or null if no groups were found
    return dominantActivityData; 
  }

  /**
   * Merge consecutive activities with same content
   * @param {TimelineEvent[]} activities - Array of activity objects
   * @returns {TimelineEvent[]} Merged activities
   */
  mergeConsecutiveActivities(activities: TimelineEvent[]): TimelineEvent[] {
    if (!activities || activities.length <= 1) {
      // console.log("[TimelineGenerator] mergeConsecutiveActivities: No activities or only one, returning as is.");
      return activities;
    }
    
    // console.log(`[TimelineGenerator] mergeConsecutiveActivities: Starting merge process with ${activities.length} activities.`);
    const result: TimelineEvent[] = [];
    let current = { ...activities[0] }; // Work with a copy to avoid modifying the original in loops
    
    for (let i = 1; i < activities.length; i++) {
      const next = activities[i];
      // console.log(`[TimelineGenerator] merge: Comparing current (ends ${new Date(current.timestamp + current.duration).toISOString()}) type=${current.type} with next (starts ${new Date(next.timestamp).toISOString()}) type=${next.type}`);
      
      // Check if activities are consecutive
      const areConsecutive = current.timestamp + current.duration === next.timestamp;
      let areSameData = false;
      if (areConsecutive && current.type === next.type) {
          areSameData = this.isSameActivityData(current.data, next.data, current.type);
          // console.log(`[TimelineGenerator] merge:   Consecutive and same type. isSameActivityData returned: ${areSameData}`);
      } else {
          // console.log(`[TimelineGenerator] merge:   Not consecutive or different types.`);
      }

      if (areConsecutive && current.type === next.type && areSameData) {
        // console.log(`[TimelineGenerator] merge:   Merging next into current.`);
        // Merge by extending the duration
        current.duration += next.duration;
      } else {
        // console.log(`[TimelineGenerator] merge:   No merge. Pushing current to results.`);
        // Add the current activity to results and move to next
        result.push(current);
        current = { ...next }; // Start next block with a copy of the next activity
      }
    }
    
    // Add the last activity
    // console.log(`[TimelineGenerator] merge: Pushing final 'current' activity to results.`);
    result.push(current);
    // console.log(`[TimelineGenerator] mergeConsecutiveActivities: Finished merge process. Returning ${result.length} activities.`);
    
    return result;
  }

  /**
   * Check if activity data objects are equivalent
   * @param {any} data1 - First activity data
   * @param {any} data2 - Second activity data
   * @param {string} type - Activity type
   * @returns {boolean} True if data is equivalent
   */
  isSameActivityData(data1: any, data2: any, type: string): boolean {
    let result = false;
    if (!data1 || !data2) {
      result = false;
    } else {
      switch (type) {
        case 'teamsMeeting':
          result = data1.title === data2.title && data1.status === data2.status;
          break;
          
        case 'inactive':
          result = true; // All inactive periods are considered the same
          break;
          
        case 'appWindow':
          result = data1.app === data2.app && data1.title === data2.title;
          break;
          
        default:
          result = false;
      }
    }
    // console.log(`[TimelineGenerator] isSameActivityData (type: ${type}): Comparing ${JSON.stringify(data1)} and ${JSON.stringify(data2)} -> Result: ${result}`);
    return result;
  }

  // Make public for testing
  public calculateSummary(timelineEvents: TimelineEvent[]): AggregationSummary {
    const summary: AggregationSummary = {
      totalDuration: 0,
      activeDuration: 0,
      inactiveDuration: 0,
      appUsage: {},
    };
    
    if (!timelineEvents || timelineEvents.length === 0) {
      return summary;
    }
    
    // Calculate total tracking duration (sum of all events)
    timelineEvents.forEach((event: TimelineEvent) => {
      summary.totalDuration += event.duration;
      
      switch (event.type) {
        case 'teamsMeeting':
          summary.activeDuration += event.duration;
          summary.inactiveDuration += event.duration;
          break;
          
        case 'inactive':
          summary.inactiveDuration += event.duration;
          break;
          
        case 'appWindow':
          summary.activeDuration += event.duration;
          if (event.data && typeof event.data.app === 'string') {
            const appName = event.data.app;
            summary.appUsage[appName] = (summary.appUsage[appName] || 0) + event.duration;
          }
          break;
      }
    });
    
    return summary;
  }
} 