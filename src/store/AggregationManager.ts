import TimelineGenerator from './TimelineGenerator';
import { ActivityState } from './ActivityState';
import { AggregatedData, Heartbeat, TimelineEvent, AggregationSummary } from './ActivityStore'; // Assuming types are still exported from ActivityStore

/**
 * Manages the aggregation of heartbeat data and caching for the current day.
 */
export class AggregationManager {
    private timelineGenerator: TimelineGenerator;
    private activityState: ActivityState;
    private todayAggregationCache: { [dateKey: string]: AggregatedData | null } = {};
    private todayDateKey: string;

    /**
     * Creates an instance of AggregationManager.
     * @param timelineGenerator The TimelineGenerator instance to use for aggregation.
     * @param activityState The ActivityState instance to access heartbeat data.
     */
    constructor(timelineGenerator: TimelineGenerator, activityState: ActivityState) {
        this.timelineGenerator = timelineGenerator;
        this.activityState = activityState;
        this.todayDateKey = this.getDateKey(Date.now());
        // Initialize cache for today if data already exists (e.g., from mock data pre-aggregation)
        this.aggregateAndCacheDay(this.todayDateKey);
    }

    /**
     * Performs the core aggregation logic using TimelineGenerator.
     * @param heartbeats List of heartbeats for a specific day.
     * @returns Aggregated data or null if no heartbeats or aggregation fails.
     */
    public performAggregation(heartbeats: Heartbeat[]): AggregatedData | null {
        if (!heartbeats || heartbeats.length === 0) {
            return null;
        }
        try {
            const timelineEvents: TimelineEvent[] = this.timelineGenerator.generateTimelineEvents(heartbeats);
            const summary: AggregationSummary = this.timelineGenerator.calculateSummary(timelineEvents);
            return { summary, timelineOverview: timelineEvents };
        } catch (error) {
            console.error(`[AggregationManager] Error during aggregation:`, error);
            // Decide if throwing or returning null is better
            // Returning null might mask errors but keeps the app running
            return null; 
        }
    }

    /**
     * Gets aggregated data for a specific day, using the cache for today if possible.
     * Performs on-demand aggregation if not cached or for past days.
     * 
     * @param dateKey The date key (YYYY-MM-DD).
     * @returns Aggregated data or null.
     */
    public getAggregatedDataForDay(dateKey: string): AggregatedData | null {
        this.updateTodayKey(); // Ensure todayDateKey is current

        // Check cache only if it's today's date key
        if (dateKey === this.todayDateKey && this.todayAggregationCache[dateKey] !== undefined) {
            // console.log(`[AggregationManager] Returning cached data for today (${dateKey}).`);
            return this.todayAggregationCache[dateKey];
        }

        // If not today or not cached, perform aggregation
        console.log(`[AggregationManager] Performing on-demand aggregation for ${dateKey}.`);
        const heartbeats = this.activityState.getHeartbeats(dateKey);
        if (!heartbeats || heartbeats.length === 0) {
            // If it was today, ensure cache is cleared
            if (dateKey === this.todayDateKey) {
                 this.todayAggregationCache[dateKey] = null;
            }
            return null;
        }

        const aggregatedData = this.performAggregation(heartbeats);

        // Cache the result *only* if it's for today
        if (dateKey === this.todayDateKey) {
            console.log(`[AggregationManager] Caching aggregation result for today (${dateKey}).`);
            this.todayAggregationCache[dateKey] = aggregatedData;
        }

        return aggregatedData;
    }

    /**
      * Aggregates data for a specific day and updates the cache if it's today.
      * Returns true if the cached data for today was changed, false otherwise.
      * 
      * @param dateKey The date key (YYYY-MM-DD).
      * @returns boolean indicating if today's cache was updated.
      */
    public aggregateAndCacheDay(dateKey: string): boolean {
        this.updateTodayKey();
        let cacheUpdated = false;

        // Only cache for today's date
        if (dateKey !== this.todayDateKey) {
            console.log(`[AggregationManager] Skipping cache update for past/future date: ${dateKey}`);
            // We could still perform aggregation here if needed, but the primary goal is caching today
            return false; 
        }

        const heartbeats = this.activityState.getHeartbeats(dateKey);
        if (!heartbeats || heartbeats.length === 0) {
            if (this.todayAggregationCache[dateKey] !== null) {
                console.log(`[AggregationManager] Clearing cache for today (${dateKey}) due to no heartbeats.`);
                this.todayAggregationCache[dateKey] = null;
                cacheUpdated = true;
            }
            return cacheUpdated;
        }

        console.log(`[AggregationManager] Aggregating and potentially caching for today (${dateKey})...`);
        const newAggregatedData = this.performAggregation(heartbeats);

        // Check if data has changed compared to cache
        const oldCachedDataString = JSON.stringify(this.todayAggregationCache[dateKey]);
        const newAggregatedDataString = JSON.stringify(newAggregatedData);

        if (oldCachedDataString !== newAggregatedDataString) {
            console.log(`[AggregationManager] Updating cache for today (${dateKey}).`);
            this.todayAggregationCache[dateKey] = newAggregatedData;
            cacheUpdated = true;
        } else {
            // console.log(`[AggregationManager] Cache for today (${dateKey}) is already up-to-date.`);
        }

        return cacheUpdated;
    }

    /**
     * Clears the aggregation cache for today.
     */
    public clearCache(): void {
        console.log(`[AggregationManager] Clearing aggregation cache for date: ${this.todayDateKey}`);
        // Clear specific key rather than the whole object if other keys were ever stored (currently not)
        delete this.todayAggregationCache[this.todayDateKey]; 
    }

    /**
     * Updates the internally stored todayDateKey if the actual date has changed.
     * Clears the cache if the day rolls over.
     */
    private updateTodayKey(): void {
        const currentDateKey = this.getDateKey(Date.now());
        if (currentDateKey !== this.todayDateKey) {
            console.log(`[AggregationManager] Day changed. Old: ${this.todayDateKey}, New: ${currentDateKey}. Clearing cache.`);
            this.todayDateKey = currentDateKey;
            // Clear the *entire* cache when the day rolls over, as it only holds today's data
            this.todayAggregationCache = {}; 
        }
    }

    // Simple date key generation utility
    private getDateKey(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0];
    }
} 