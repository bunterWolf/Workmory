import { Heartbeat, StoreData, DayData } from './ActivityStore';

/**
 * Manages the in-memory state of the activity data.
 * Holds the raw heartbeats and related metadata, but performs no aggregation,
 * persistence, or complex logic.
 */
export class ActivityState {
    /** The raw underlying data structure containing all heartbeats and metadata. */
    public data: StoreData;

    /**
     * Initializes the state manager.
     * @param initialData Optional initial StoreData to load (e.g., from persistence).
     *                    If not provided, default empty data structure is created.
     */
    constructor(initialData?: StoreData) {
        if (initialData) {
            this.data = initialData;
        } else {
            // Initialize with default structure if no data is provided
            this.data = {
                version: 1,
                startTime: Date.now(),
                lastCleanup: 0,
                aggregationInterval: 15,
                days: {}
            };
        }
    }

    /**
     * Retrieves the list of heartbeats for a specific date.
     * @param dateKey The date in YYYY-MM-DD format.
     * @returns An array of Heartbeat objects or undefined if the day doesn't exist.
     */
    public getHeartbeats(dateKey: string): Heartbeat[] | undefined {
        return this.data.days[dateKey]?.heartbeats;
    }

    /**
     * Overwrites the list of heartbeats for a specific date.
     * Creates the day entry if it doesn't exist.
     * @param dateKey The date in YYYY-MM-DD format.
     * @param heartbeats The new array of Heartbeat objects.
     */
    public setHeartbeats(dateKey: string, heartbeats: Heartbeat[]): void {
        this.ensureDayExists(dateKey); // Ensure day object exists
        this.data.days[dateKey].heartbeats = heartbeats;
    }

    /**
     * Adds a single heartbeat to the specified date's list.
     * Creates the day entry if it doesn't exist.
     * Note: This directly mutates the internal heartbeats array.
     * @param dateKey The date in YYYY-MM-DD format.
     * @param heartbeat The Heartbeat object to add.
     */
    public addHeartbeat(dateKey: string, heartbeat: Heartbeat): void {
        this.ensureDayExists(dateKey);
        // Consider optimizing if direct push is always safe or if we need defensive copies
        this.data.days[dateKey].heartbeats.push(heartbeat);
    }

    /**
     * Retrieves the data structure for a specific day (currently only heartbeats).
     * @param dateKey The date in YYYY-MM-DD format.
     * @returns The day data object or undefined if the day doesn't exist.
     */
    public getDay(dateKey: string): Pick<DayData, 'heartbeats'> | undefined {
        return this.data.days[dateKey];
    }

    /**
     * Ensures that an entry for the given date key exists in the `days` object.
     * If it doesn't exist, it creates an empty entry.
     * @param dateKey The date in YYYY-MM-DD format.
     */
    public ensureDayExists(dateKey: string): void {
        if (!this.data.days[dateKey]) {
            this.data.days[dateKey] = {
                heartbeats: []
            };
        }
    }

    /**
     * Retrieves the entire `days` object containing all stored days and their heartbeats.
     * @returns The map of date keys to day data.
     */
    public getAllDaysData(): { [dateKey: string]: Pick<DayData, 'heartbeats'> } {
        return this.data.days;
    }

    /**
     * Replaces the entire `days` object.
     * Use with caution, primarily intended for loading data from persistence.
     * @param daysData The new map of date keys to day data.
     */
    public setAllDaysData(daysData: { [dateKey: string]: Pick<DayData, 'heartbeats'> }): void {
        this.data.days = daysData;
    }

    /**
     * Gets the configured aggregation interval.
     * @returns The interval in minutes (5, 10, or 15).
     */
    public getAggregationInterval(): 5 | 10 | 15 {
        return this.data.aggregationInterval;
    }

    /**
     * Sets the aggregation interval.
     * Validates the input and warns if invalid.
     * @param interval The interval in minutes (must be 5, 10, or 15).
     */
    public setAggregationInterval(interval: 5 | 10 | 15): void {
        if ([5, 10, 15].includes(interval)) {
             this.data.aggregationInterval = interval;
        } else {
            console.warn(`[ActivityState] Attempted to set invalid aggregation interval: ${interval}`);
        }
    }

    /**
     * Gets a sorted list of all available date keys (YYYY-MM-DD) for which data exists.
     * @returns An array of date strings.
     */
    public getAvailableDates(): string[] {
        // Filter to ensure only valid date keys are returned
        return Object.keys(this.data.days)
            .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key))
            .sort();
    }

    /**
     * Gets the timestamp of the last data cleanup operation.
     * @returns Timestamp in milliseconds since epoch.
     */
    public getLastCleanupTime(): number {
        return this.data.lastCleanup;
    }

    /**
     * Updates the timestamp of the last data cleanup operation to the current time.
     */
    public updateLastCleanupTime(): void {
        this.data.lastCleanup = Date.now();
    }

    /**
     * Gets the initial start time recorded in the data store.
     * @returns Timestamp in milliseconds since epoch.
     */
    public getStartTime(): number {
        return this.data.startTime;
    }

    /**
     * Retrieves the complete raw StoreData object.
     * Note: Returns a direct reference to the internal data for performance.
     * Avoid external mutation.
     * @returns The StoreData object.
     */
    public getFullStoreData(): StoreData {
        // Return a copy to prevent external mutation?
        // For now, returning the direct reference for simplicity/performance
        return this.data;
    }

    /**
     * Deletes all data associated with a specific date key.
     * @param dateKey The date in YYYY-MM-DD format.
     */
    public deleteDay(dateKey: string): void {
        delete this.data.days[dateKey];
    }

    /**
     * Sets the version number of the data store.
     * @param version The version number.
     */
    public setVersion(version: number): void {
        this.data.version = version;
    }

    /**
     * Sets the initial start time of the data store.
     * @param startTime Timestamp in milliseconds since epoch.
     */
    public setStartTime(startTime: number): void {
        this.data.startTime = startTime;
    }

    /**
     * Setzt die Daten des Stores vollständig neu.
     * Nützlich, wenn Daten aus einer anderen Quelle geladen werden.
     * @param data Die neuen StoreData
     */
    public setData(data: StoreData): void {
        this.data = data;
    }
} 