import fs from 'fs';
import path from 'path';
import { StoreData, DayData, Heartbeat, HeartbeatData, AppWindowData } from '../src/store/ActivityStore'; // Import types from ActivityStore
import { AggregationIntervalMinutes } from '../src/store/TimelineGenerator'; // Import type from TimelineGenerator

// --- Configuration ---
const OUTPUT_PATH = path.resolve(__dirname, '../public/mock-data.json');
const BASE_DATE_STR = '2024-01-01'; // Base date for relative times
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
 * Generates a block of active appWindow heartbeats.
 */
function generateAppWindowBlock(
    startTimeStr: string,
    endTimeStr: string,
    appData: AppWindowData,
    dateStr: string = BASE_DATE_STR
): Heartbeat[] {
    const startMs = getTime(startTimeStr, dateStr);
    const endMs = getTime(endTimeStr, dateStr);
    const heartbeats: Heartbeat[] = [];

    for (let ts = startMs; ts < endMs; ts += HEARTBEAT_INTERVAL_MS) {
        heartbeats.push({
            timestamp: ts,
            data: {
                userActivity: 'active',
                appWindow: { ...appData } // Create copy
            }
        });
    }
    return heartbeats;
}

/**
 * Generates a block of inactive heartbeats.
 * Allows specifying optional appWindow data for some initial inactive heartbeats.
 */
function generateInactiveBlock(
    startTimeStr: string,
    endTimeStr: string,
    initialInactiveAppData: AppWindowData | null = null,
    initialCount: number = 0, // How many initial heartbeats should have app data before switching to null
    dateStr: string = BASE_DATE_STR
): Heartbeat[] {
    const startMs = getTime(startTimeStr, dateStr);
    const endMs = getTime(endTimeStr, dateStr);
    const heartbeats: Heartbeat[] = [];
    let currentCount = 0;

    for (let ts = startMs; ts < endMs; ts += HEARTBEAT_INTERVAL_MS) {
        let appWindow: AppWindowData | null = null;
        if (initialInactiveAppData && currentCount < initialCount) {
            appWindow = { ...initialInactiveAppData };
        }
        heartbeats.push({
            timestamp: ts,
            data: {
                userActivity: 'inactive',
                appWindow: appWindow
            }
        });
        currentCount++;
    }
    return heartbeats;
}

// --- Main Generation Logic ---

function generateMockData(): StoreData {
    const allHeartbeats: Heartbeat[] = [];

    // --- Define Day 1: 2024-01-01 ---
    const date1 = '2024-01-01';
    // Block 1 & 2: 08:00-08:30 (VS Code Refactoring) - Merged for simplicity
    allHeartbeats.push(
        ...generateAppWindowBlock('08:00', '08:30', { app: 'VS Code', title: 'Refactoring Components - Focus2' }, date1)
    );

    // Block 3: 09:00-09:15 (Edge Case: VSCode A vs Chrome B)
    // Need manual generation for mixed heartbeats
    const block3Start = getTime('09:00', date1);
    const block3End = getTime('09:15', date1);
    const vsCodeA = { app: 'VS Code', title: 'File A' };
    const chromeB = { app: 'Chrome', title: 'Docs B' };
    let vsCodeCount = 0;
    let chromeCount = 0;
    const targetVsCode = 8; // Target for dominance scenario
    const targetChrome = 7;
    for (let ts = block3Start; ts < block3End; ts += HEARTBEAT_INTERVAL_MS) {
        // Alternate to ensure counts are met, prioritize VS Code slightly if needed at the end
        // This ensures 8 VSCode, 7 Chrome within the 15 heartbeats (15min / 30s = 30 heartbeats theoretical max, we aim for ~15 for the test)
        // Let's simplify and alternate, then maybe add one at the end if counts don't match
        const totalSlots = Math.floor((block3End - block3Start) / HEARTBEAT_INTERVAL_MS);
        const isEvenSlot = ((ts - block3Start) / HEARTBEAT_INTERVAL_MS) % 2 === 0;

        // Crude alternation - might need refinement if exact counts are critical and interval isn't perfect
        if (isEvenSlot && vsCodeCount < targetVsCode) {
             allHeartbeats.push({ timestamp: ts, data: { userActivity: 'active', appWindow: vsCodeA } });
             vsCodeCount++;
        } else if (!isEvenSlot && chromeCount < targetChrome) {
            allHeartbeats.push({ timestamp: ts, data: { userActivity: 'active', appWindow: chromeB } });
            chromeCount++;
        } else if (vsCodeCount < targetVsCode) { // Fill remaining slots if needed
             allHeartbeats.push({ timestamp: ts, data: { userActivity: 'active', appWindow: vsCodeA } });
             vsCodeCount++;
        } else if (chromeCount < targetChrome) {
             allHeartbeats.push({ timestamp: ts, data: { userActivity: 'active', appWindow: chromeB } });
             chromeCount++;
        }
        // Make sure we don't exceed 15 for the original test case that needed exactly 15
         if (vsCodeCount + chromeCount >= 15) break;
    }
     // Ensure exactly 15 heartbeats were added for this block if the loop finished early
     // (This logic might be slightly off, needs verification during testing)
     console.log(`Block 3 counts: VSCode=${vsCodeCount}, Chrome=${chromeCount}`);


    // Block 4 & 5: 12:00-12:30 (Inactive) - Merged for simplicity
    allHeartbeats.push(
        ...generateInactiveBlock('12:00', '12:30', null, 0, date1)
        // Note: Original data had some variation (Chrome title, System Screensaver)
        // For simplicity, keeping it pure inactive for now. Can be added back if needed.
    );

    // Block 6: 14:30-14:45 (Outlook)
    // Original data had a title change mid-way. Simulating that:
    allHeartbeats.push(
        ...generateAppWindowBlock('14:30', '14:39:30', { app: 'Outlook', title: 'Answering Emails' }, date1) // ~9.5 mins
    );
     allHeartbeats.push(
        ...generateAppWindowBlock('14:39:30', '14:45:00', { app: 'Outlook', title: 'Checking Calendar' }, date1) // ~5.5 mins
    );


    // --- Define Day 2: 2024-01-02 ---
    const date2 = '2024-01-02';
    // Block 1: 08:00-08:15 (VS Code Refactoring/Running Tests)
    allHeartbeats.push(
        ...generateAppWindowBlock('08:00', '08:08:30', { app: 'VS Code', title: 'Refactoring Components - Focus2' }, date2)
    );
    allHeartbeats.push(
        ...generateAppWindowBlock('08:08:30', '08:10:00', { app: 'VS Code', title: 'Running Tests - Focus2' }, date2)
    );
     allHeartbeats.push(
        ...generateAppWindowBlock('08:10:00', '08:15:00', { app: 'VS Code', title: 'Refactoring Components - Focus2' }, date2)
    );

    // Block 2: 12:00-12:15 (Inactive)
    allHeartbeats.push(
        ...generateInactiveBlock('12:00', '12:15', { app: 'System Settings', title: 'Checking Updates' }, 2, date2) // 2 initial with app data
    );


    // --- Group Heartbeats by Day ---
    const daysData: { [dateKey: string]: DayData } = {};
    allHeartbeats.sort((a, b) => a.timestamp - b.timestamp); // Sort all heartbeats

    allHeartbeats.forEach(hb => {
        const dateKey = new Date(hb.timestamp).toISOString().split('T')[0];
        if (!daysData[dateKey]) {
            daysData[dateKey] = { heartbeats: [] };
        }
        daysData[dateKey].heartbeats.push(hb);
    });

    // --- Final Structure ---
    const finalData: StoreData = {
        version: 1,
        startTime: allHeartbeats[0]?.timestamp ?? Date.now(), // Use first heartbeat's time
        lastCleanup: getTime('23:00', date1), // Example cleanup time
        aggregationInterval: 15 as AggregationIntervalMinutes, // Explicitly cast or ensure type correctness
        days: daysData,
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
    const day2 = mockData.days['2024-01-02'];
    console.log(`Day 1 Heartbeats: ${day1?.heartbeats?.length ?? 0}`);
    console.log(`Day 2 Heartbeats: ${day2?.heartbeats?.length ?? 0}`);


} catch (error) {
    console.error("Error generating mock data:", error);
    process.exit(1); // Exit with error code
}

// Placeholder for potential future enhancements:
// - Function to add specific heartbeat patterns (e.g., gaps, bursts)
// - More complex activity data types (Teams meetings?)
// - Command-line arguments for configuration (e.g., different date ranges) 