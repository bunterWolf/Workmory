import fs from 'fs';
import path from 'path';
import { StoreData, DayData, Heartbeat, HeartbeatData, AppWindowData } from '../src/store/ActivityStore'; // Import types from ActivityStore
import { AggregationIntervalMinutes } from '../src/store/TimelineGenerator'; // Import type from TimelineGenerator

// --- Configuration ---
const OUTPUT_PATH = path.resolve(__dirname, '../public/mock-data.json');
const BASE_DATE_STR = '2025-01-01'; // Base date for relative times
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

// --- Helper Functions ---

/**
 * Parses time string HH:MM or HH:MM:SS relative to the base date string.
 * Returns timestamp in milliseconds UTC.
 */
function getTime(timeStr: string, dateStr: string = BASE_DATE_STR): number {
    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
    const date = new Date(`${dateStr}T00:00:00.000Z`); // Start of the day in UTC
    date.setUTCHours(hours, minutes, seconds, 0);
    return date.getTime();
}

/**
 * Generates a sequence of heartbeats within a specified time range.
 */
function generateHeartbeatSequence(
    startTimeStr: string,
    endTimeStr: string,
    activity: 'active' | 'inactive', // Explicit activity status
    appData: AppWindowData | null,    // App data (can be null)
    dateStr: string = BASE_DATE_STR
): Heartbeat[] {
    const startMs = getTime(startTimeStr, dateStr);
    const endMs = getTime(endTimeStr, dateStr);
    const heartbeats: Heartbeat[] = [];

    for (let ts = startMs; ts < endMs; ts += HEARTBEAT_INTERVAL_MS) {
        heartbeats.push({
            timestamp: ts,
            data: {
                userActivity: activity,
                appWindow: appData ? { ...appData } : null // Create copy or set null
            }
        });
    }
    return heartbeats;
}

// --- Main Generation Logic ---

function generateMockData(): StoreData {
    const allHeartbeats: Heartbeat[] = [];

    // --- Define Day 1: 2024-01-01 ---
    const date1 = '2024-01-01';

    allHeartbeats.push(...generateHeartbeatSequence(
        '08:00', '08:05',
        'active',
        {
            app: 'Google Chrome',
            title: 'Aggregate to visible'
        },
        date1)
    );

    allHeartbeats.push(...generateHeartbeatSequence(
        '08:05', '08:10',
        'active',
        {
            app: 'Explorer',
            title: 'Aggregate to visible only for 5 min'
        },
        date1)
    );

    allHeartbeats.push(...generateHeartbeatSequence(
        '08:10', '08:15',
        'active',
        {
            app: 'Google Chrome',
            title: 'Aggregate to visible'
        },
        date1)
    );

    allHeartbeats.push(...generateHeartbeatSequence(
        '08:15', '08:25',
        'inactive',
        {
            app: 'Google Chrome',
            title: 'Inactive App'
        },
        date1)
    );

    allHeartbeats.push(...generateHeartbeatSequence(
        '08:25', '08:30',
        'active',
        {
            app: 'Excel',
            title: 'File A: Aggregate to visible'
        },
        date1)
    );

    allHeartbeats.push(...generateHeartbeatSequence(
        '08:30', '08:35',
        'active',
        {
            app: 'Excel',
            title: 'File B: Aggregate to visible'
        },
        date1)
    );

    allHeartbeats.push(...generateHeartbeatSequence(
        '08:35', '08:45',
        'active',
        {
            app: 'Excel',
            title: 'File A: Aggregate to visible'
        },
        date1)
    );

    // --- Group Heartbeats by Day ---
    const daysData: { [dateKey: string]: DayData } = {};
    allHeartbeats.sort((a, b) => a.timestamp - b.timestamp); // Sort all heartbeats

    // --- Final Structure ---
    const finalData: StoreData = {
        version: 1,
        startTime: allHeartbeats[0]?.timestamp ?? Date.now(), // Use first heartbeat's time
        lastCleanup: getTime('23:00', date1), // Example cleanup time
        aggregationInterval: 5 as AggregationIntervalMinutes, // Explicitly cast or ensure type correctness
        days: {
            [date1]: { heartbeats: allHeartbeats }
        },
    };

    return finalData;
}

// --- Execution ---
try {
    const mockData = generateMockData();
    const jsonData = JSON.stringify(mockData, null, 2); // Pretty print JSON
    fs.writeFileSync(OUTPUT_PATH, jsonData, 'utf-8');
    console.log(`Successfully generated mock data at: ${OUTPUT_PATH}`);

    // Optional: Validate generated data structure/counts if needed
    const day1 = mockData.days['2024-01-01'];
    // const day2 = mockData.days['2024-01-02']; // day2 is not generated in this version
    console.log(`Day 1 Heartbeats: ${day1?.heartbeats?.length ?? 0}`);
    // console.log(`Day 2 Heartbeats: ${day2?.heartbeats?.length ?? 0}`); // day2 is not generated


} catch (error) {
    console.error("Error generating mock data:", error);
    process.exit(1); // Exit with error code
}

// Placeholder for potential future enhancements:
// - Function to add specific heartbeat patterns (e.g., gaps, bursts)
// - More complex activity data types (Teams meetings?)
// - Command-line arguments for configuration (e.g., different date ranges) 