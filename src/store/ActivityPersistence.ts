import * as fs from 'fs';
import * as path from 'path';
// Importiere den benötigten Typ aus ActivityStore (kann von hier importiert werden, da es nur ein Typ ist)
import { StoreData, DayData } from './ActivityStore';

/**
 * Handles loading and saving of activity data (StoreData) to/from a JSON file.
 */
export class ActivityPersistence {
    private dataFilePath: string;

    /**
     * Creates an instance of ActivityPersistence.
     * @param dataFilePath The full path to the JSON file used for storage.
     */
    constructor(dataFilePath: string) {
        if (!dataFilePath) {
            throw new Error('ActivityPersistence requires a valid dataFilePath.');
        }
        this.dataFilePath = dataFilePath;
    }

    /**
     * Loads the activity data from the JSON file.
     * Performs validation on the loaded data.
     * @returns The loaded and validated StoreData object, or null if the file doesn't exist or data is invalid.
     */
    loadData(): StoreData | null {
        if (!fs.existsSync(this.dataFilePath)) {
            console.log(`[Persistence] Data file not found at ${this.dataFilePath}, starting fresh.`);
            return null;
        }

        try {
            const fileData = fs.readFileSync(this.dataFilePath, 'utf8');
            let parsedData: any;
            try {
                parsedData = JSON.parse(fileData);
            } catch (parseError) {
                console.error(`[Persistence] Error parsing activity data JSON from ${this.dataFilePath}:`, parseError);
                this.backupInvalidFile('parse-error');
                return null; // Treat parse error as invalid data
            }

            // --- Validation ---
            if (!parsedData || typeof parsedData !== 'object') {
                console.warn(`[Persistence] Loaded data from ${this.dataFilePath} is not a valid object. Resetting.`);
                this.backupInvalidFile('invalid-object');
                return null;
            }

            if (parsedData.version !== 1) {
                 console.warn(`[Persistence] Loaded data from ${this.dataFilePath} has wrong version (${parsedData.version}). Resetting.`);
                 this.backupInvalidFile('wrong-version');
                return null;
            }

            if (!parsedData.days || typeof parsedData.days !== 'object') {
                console.warn(`[Persistence] Loaded data from ${this.dataFilePath} is missing or has invalid 'days' field. Resetting.`);
                this.backupInvalidFile('invalid-days');
                return null;
            }

            // Validate aggregationInterval
            const validIntervals: (5 | 10 | 15)[] = [5, 10, 15];
            if (!parsedData.aggregationInterval || !validIntervals.includes(parsedData.aggregationInterval)) {
                console.warn(`[Persistence] Invalid or missing aggregationInterval (${parsedData.aggregationInterval}) in loaded data. Applying default (15).`);
                parsedData.aggregationInterval = 15; // Apply default, don't discard data for this
            }

            // Validate lastCleanup timestamp
            if (typeof parsedData.lastCleanup !== 'number' || parsedData.lastCleanup < 0) {
                console.warn(`[Persistence] Invalid or missing lastCleanup timestamp (${parsedData.lastCleanup}). Applying default (0).`);
                parsedData.lastCleanup = 0; // Apply default
            }

            // Validate startTime timestamp
             if (typeof parsedData.startTime !== 'number' || parsedData.startTime <= 0) {
                console.warn(`[Persistence] Invalid or missing startTime timestamp (${parsedData.startTime}). Applying default (now).`);
                parsedData.startTime = Date.now(); // Apply default
            }

            // Validate days structure (ensure only heartbeats are present)
            const validatedDays: { [dateKey: string]: Pick<DayData, 'heartbeats'> } = {};
            let invalidDayStructureFound = false;
            for (const dateKey in parsedData.days) {
                if (Object.prototype.hasOwnProperty.call(parsedData.days, dateKey)) {
                     if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                        console.warn(`[Persistence] Invalid date key format found in loaded days data: ${dateKey}. Skipping key.`);
                        continue; // Skip invalid keys
                    }
                    const dayFromFile = parsedData.days[dateKey];
                    // We expect an object with ONLY a 'heartbeats' array.
                    if (dayFromFile && typeof dayFromFile === 'object' && Array.isArray(dayFromFile.heartbeats) && Object.keys(dayFromFile).length === 1) {
                        validatedDays[dateKey] = { heartbeats: dayFromFile.heartbeats };
                    } else {
                        console.warn(`[Persistence] Invalid structure or extra fields found for day ${dateKey}. Expecting only { heartbeats: [...] }. Skipping day.`);
                        // We might still load other valid days, but flag this issue.
                        invalidDayStructureFound = true;
                        // If strict loading is desired, we could return null here.
                        // For now, we try to load as much valid data as possible.
                    }
                }
            }

            const validatedData: StoreData = {
                version: parsedData.version,
                startTime: parsedData.startTime,
                lastCleanup: parsedData.lastCleanup,
                aggregationInterval: parsedData.aggregationInterval,
                days: validatedDays
            };

            console.log(`[Persistence] Activity data loaded successfully from ${this.dataFilePath}. ${invalidDayStructureFound ? 'Some invalid day structures were skipped.' : ''}`);
            return validatedData;

        } catch (error) {
            console.error(`[Persistence] Unexpected error reading or validating activity data file ${this.dataFilePath}:`, error);
             this.backupInvalidFile('read-error');
            return null;
        }
    }

    /**
     * Saves the provided StoreData object to the JSON file.
     * Ensures only necessary fields (version, startTime, lastCleanup, aggregationInterval, days with heartbeats) are saved.
     * @param data The StoreData object to save.
     */
    saveData(data: StoreData): void {
        if (!data) {
            console.error('[Persistence] Attempted to save null or undefined data.');
            return;
        }

        try {
            // Prepare the data to be saved, ensuring only allowed fields are included.
            const dataToSave: StoreData = {
                version: data.version,
                startTime: data.startTime,
                lastCleanup: data.lastCleanup,
                aggregationInterval: data.aggregationInterval,
                days: {} // Initialize empty days
            };

            // Populate days, ensuring only 'heartbeats' array is saved per day.
            for (const dateKey in data.days) {
                if (Object.prototype.hasOwnProperty.call(data.days, dateKey) && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                    const dayData = data.days[dateKey];
                    // Ensure heartbeats is an array before saving.
                    if (dayData && Array.isArray(dayData.heartbeats)) {
                        dataToSave.days[dateKey] = { heartbeats: dayData.heartbeats };
                    } else {
                        console.warn(`[Persistence] Attempted to save invalid day data structure for ${dateKey}. Skipping day.`);
                    }
                } else if (Object.prototype.hasOwnProperty.call(data.days, dateKey)){
                    console.warn(`[Persistence] Attempted to save day data with invalid key: ${dateKey}. Skipping key.`);
                }
            }

            // Ensure the directory exists
            const dirPath = path.dirname(this.dataFilePath);
            if (!fs.existsSync(dirPath)) {
                console.log(`[Persistence] Creating directory: ${dirPath}`);
                fs.mkdirSync(dirPath, { recursive: true });
            }

            const jsonData = JSON.stringify(dataToSave, null, 2); // Pretty print JSON
            fs.writeFileSync(this.dataFilePath, jsonData, 'utf8');
            // console.log(`[Persistence] Activity data saved successfully to ${this.dataFilePath}.`); // Optional success log
        } catch (error) {
            console.error(`[Persistence] Error saving activity data to ${this.dataFilePath}:`, error);
        }
    }

    /**
     * Attempts to back up an invalid data file.
     * @param suffix A suffix to append to the backup filename (e.g., 'parse-error').
     */
    private backupInvalidFile(suffix: string): void {
         if (!fs.existsSync(this.dataFilePath)) return; // No file to back up
        try {
            const backupPath = `${this.dataFilePath}.invalid-${suffix}-${Date.now()}`;
            fs.renameSync(this.dataFilePath, backupPath);
            console.log(`[Persistence] Backed up invalid data file to ${backupPath}`);
        } catch (renameError) {
            console.error(`[Persistence] Failed to back up invalid data file ${this.dataFilePath}:`, renameError);
        }
    }
}