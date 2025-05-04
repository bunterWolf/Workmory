import ActivityStore, { HeartbeatData, Heartbeat, handleMayBeInactive, StoreData, DayData, AggregatedData, AggregationSummary, TimelineEvent } from './ActivityStore';
import fs from 'fs';
import path from 'path';

// Restore the full mock for electron, including ipcMain and BrowserWindow
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/jest-user-data'), // Mock user data path
    getAppPath: jest.fn(() => '/mock/app/path'), // Add mock for getAppPath
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
    // Mock other potential BrowserWindow properties/methods if needed later
    // e.g., isDestroyed: jest.fn(() => false), webContents: { send: jest.fn() }
  },
}), { virtual: true });

describe('ActivityStore Utilities', () => {
  describe('handleMayBeInactive', () => {
    test('sollte may_be_inactive zu inactive umwandeln wenn userActivity inactive ist', () => {
      const currentTime = new Date('2024-03-20T10:05:00Z').getTime();
      // Ensure heartbeatData matches Partial<HeartbeatData>
      const heartbeatData: Partial<HeartbeatData> = { userActivity: 'inactive' };

      // Ensure heartbeats match the Heartbeat[] type
      const heartbeats: Heartbeat[] = [
        {
          timestamp: new Date('2024-03-20T10:00:00Z').getTime(),
          data: {
            userActivity: 'may_be_inactive',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        },
        {
          timestamp: new Date('2024-03-20T10:01:00Z').getTime(),
          data: {
            userActivity: 'active',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        },
        {
          timestamp: new Date('2024-03-20T10:02:00Z').getTime(),
          data: {
            userActivity: 'may_be_inactive',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        },
        {
          timestamp: new Date('2024-03-20T10:03:00Z').getTime(),
          data: {
            userActivity: 'may_be_inactive',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        },
        {
          timestamp: new Date('2024-03-20T10:04:00Z').getTime(),
          data: {
            userActivity: 'inactive'
          }
        }
      ];

      const result = handleMayBeInactive(heartbeats, currentTime, heartbeatData);

      expect(result[0].data.userActivity).toBe('may_be_inactive');
      expect(result[1].data.userActivity).toBe('active');
      expect(result[2].data.userActivity).toBe('inactive');
      expect(result[3].data.userActivity).toBe('inactive');
      expect(result[4].data.userActivity).toBe('inactive');
    });
    
    test('sollte keine Änderungen vornehmen wenn userActivity nicht inactive ist', () => {
      const currentTime = new Date('2024-03-20T10:05:00Z').getTime();
      const heartbeatData: Partial<HeartbeatData> = { userActivity: 'active' };

      const heartbeats: Heartbeat[] = [
        {
          timestamp: new Date('2024-03-20T10:00:00Z').getTime(),
          data: { userActivity: 'active' }
        },
        {
          timestamp: new Date('2024-03-20T10:01:00Z').getTime(),
          data: { userActivity: 'may_be_inactive' }
        },
        {
          timestamp: new Date('2024-03-20T10:02:00Z').getTime(),
          data: { userActivity: 'active' }
        },
        {
          timestamp: new Date('2024-03-20T10:03:00Z').getTime(),
          data: { userActivity: 'may_be_inactive' }
        },
        {
          timestamp: new Date('2024-03-20T10:04:00Z').getTime(),
          data: { userActivity: 'may_be_inactive' }
        }
      ];

      const result = handleMayBeInactive(heartbeats, currentTime, heartbeatData);

      expect(result).toEqual(heartbeats);
    });

    test('sollte mit leeren oder ungültigen Eingaben umgehen können', () => {
      const currentTime = Date.now();
      const heartbeatData: Partial<HeartbeatData> = { userActivity: 'inactive' };

      // Check empty array
      expect(handleMayBeInactive([], currentTime, heartbeatData)).toEqual([]);

      // Check undefined and null for heartbeats - function returns them unchanged
      expect(handleMayBeInactive(undefined as any, currentTime, heartbeatData)).toBeUndefined();
      expect(handleMayBeInactive(null as any, currentTime, heartbeatData)).toBeNull();

      // Check incomplete Heartbeat objects
      const invalidHeartbeats: Heartbeat[] = [
        { timestamp: currentTime - 1000, data:{} }, // No userActivity
        { timestamp: currentTime - 2000, data: null } as any, // data is null (with type assertion)
        { timestamp: currentTime - 3000, data: {} } // Empty data object
      ];

      const result = handleMayBeInactive(invalidHeartbeats, currentTime, heartbeatData);
      expect(result).toHaveLength(3);
      // It is expected here that no changes are made, as no 'may_be_inactive' exist.
      expect(result).toEqual(invalidHeartbeats);
    });
  });
});

describe('ActivityStore Integration', () => {
  let activityStore: ActivityStore;
  const testDateKey = '2024-04-06'; // Example date
  const intervalMillis = 15 * 60 * 1000; // 15 minutes for the expectations
  let originalDateNow: () => number;

  // Helper to generate timestamps for the test day
  const getTimestamp = (hour: number, minute: number, second: number = 0) => {
    return new Date(`${testDateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`).getTime();
  };

  beforeEach(() => {
    // Store the original Date.now function
    originalDateNow = Date.now;
    // Create a new instance before each test, no mock data
    activityStore = new ActivityStore({ useMockData: false, storagePath: '/tmp/nonexistent/activity-test.json' });
    activityStore.setAggregationInterval(15);
    // Simulate that tracking is started (sets isTracking internally)
    activityStore.startTracking();
    // We set the initial timestamp so that currentDayKey is correct
    Date.now = jest.fn(() => getTimestamp(9, 0, 1));
    activityStore.startTracking(); // Call again to use the mocked timestamp

  });

  afterEach(() => {
    // Restore the original Date.now function
    Date.now = originalDateNow;
    // Clean up after each test
    activityStore.cleanup();
    // Delete any created test file if necessary
    try { fs.unlinkSync('/tmp/nonexistent/activity-test.json'); } catch (e) { /* Ignorieren */ }
    try { fs.rmdirSync('/tmp/nonexistent'); } catch (e) { /* Ignorieren */ }
  });

  test('sollte Heartbeats korrekt aggregieren und Timeline-Events generieren', () => {
    // ---- Add test heartbeats ----
    // Helper to add heartbeat with specific timestamp
    const addTestHeartbeat = (timestamp: number, data: HeartbeatData) => {
        const originalNow = Date.now;
        Date.now = jest.fn(() => timestamp);
        activityStore.addHeartbeat(data);
        Date.now = originalNow; // Restore immediately after add
    };

    // Interval 1: 09:00 - 09:15 (Mostly VS Code)
    // Simulate ~30 heartbeats for the interval
    for (let min = 0; min < 15; min++) {
        // Add 2 heartbeats per minute (approx. 30s interval)
        if (min < 12) { // First 12 mins: VS Code
             addTestHeartbeat(getTimestamp(9, min, 15), { appWindow: { app: 'VS Code', title: 'file1.ts' } });
             addTestHeartbeat(getTimestamp(9, min, 45), { appWindow: { app: 'VS Code', title: 'file1.ts' } });
        } else { // Last 3 mins: Browser
            addTestHeartbeat(getTimestamp(9, min, 15), { appWindow: { app: 'Browser', title: 'docs' } });
            addTestHeartbeat(getTimestamp(9, min, 45), { appWindow: { app: 'Browser', title: 'docs' } });
        }
    }

    // Interval 2: 09:15 - 09:30 (Mostly Inactive)
    for (let min = 15; min < 30; min++) {
        if (min < 27) { // First 12 mins: Inactive
            addTestHeartbeat(getTimestamp(9, min, 15), { userActivity: 'inactive' });
            addTestHeartbeat(getTimestamp(9, min, 45), { userActivity: 'inactive' });
        } else { // Last 3 mins: VS Code
             addTestHeartbeat(getTimestamp(9, min, 15), { appWindow: { app: 'VS Code', title: 'file2.ts' } });
             addTestHeartbeat(getTimestamp(9, min, 45), { appWindow: { app: 'VS Code', title: 'file2.ts' } });
        }
    }

    // Interval 3: 09:30 - 09:45 (LESS than 50% heartbeats)
    // Add only a few heartbeats to test the minimum threshold
    addTestHeartbeat(getTimestamp(9, 31, 15), { appWindow: { app: 'VS Code', title: 'file1.ts' } });
    addTestHeartbeat(getTimestamp(9, 32, 45), { appWindow: { app: 'VS Code', title: 'file1.ts' } });
    addTestHeartbeat(getTimestamp(9, 34, 0), { userActivity: 'inactive' });


    // ---- Trigger aggregation and check ----
    Date.now = originalDateNow; // Ensure Date.now is restored

    const dayData = activityStore.getDayData(testDateKey);

    // ---- Assertions ----
    expect(dayData).not.toBeNull();
    expect(dayData?.aggregated).toBeDefined();
    expect(dayData?.aggregated?.timelineOverview).toBeDefined();

    const timeline = dayData!.aggregated!.timelineOverview;

    // Expect 2 events (Interval 1 and Interval 2). Interval 3 has too little data.
    expect(timeline).toHaveLength(2);

    // Check Event 1 (VS Code - dominant in 09:00-09:15)
    expect(timeline[0]).toEqual(expect.objectContaining({
      timestamp: getTimestamp(9, 0), // Starts at 09:00
      duration: intervalMillis,      // Duration 15 min
      type: 'appWindow',
      data: { app: 'VS Code', title: 'file1.ts' } // VS Code was dominant
    }));

    // Check Event 2 (Inactive - dominant in 09:15-09:30)
    expect(timeline[1]).toEqual(expect.objectContaining({
      timestamp: getTimestamp(9, 15), // Starts at 09:15
      duration: intervalMillis,      // Duration 15 min
      type: 'inactive',
    }));
     expect(timeline[1].data).toBeDefined(); // Inactive data should exist

    // Optional: Check summary if relevant
    const summary = dayData!.aggregated!.summary;
    expect(summary.totalDuration).toBe(2 * intervalMillis);
    expect(summary.activeDuration).toBe(1 * intervalMillis); // Only the first interval was actively dominant
    expect(summary.inactiveDuration).toBe(1 * intervalMillis); // The second was inactive
    // Count app usage based on the dominant activity in the interval
    expect(summary.appUsage['VS Code']).toBe(1 * intervalMillis); // Dominant in Interval 1
    expect(summary.appUsage['Browser']).toBeUndefined(); // Browser was not dominant
  });
});

// Neuer Describe-Block für Mock-Daten-Tests
describe('ActivityStore Mock Data Tests', () => {
  let activityStore: ActivityStore;
  const projectRoot = path.resolve(__dirname, '../..'); // Determine project root relative to test file
  const mockDataJsonPath = path.join(projectRoot, 'public', 'mock-data.json');
  let mockFs: any;

  beforeEach(() => {
    // Mock parts of fs (only existsSync for the path and others that do not read)
    mockFs = {
      existsSync: jest.fn((p) => {
        // Only return true for the specific mock data path the store looks for
        const expectedPath = path.normalize(mockDataJsonPath);
        return path.normalize(p) === expectedPath;
      }),
      // Mock other fs functions that ActivityStore might use to prevent side effects
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
      readFileSync: jest.requireActual('fs').readFileSync, // Explicitly use real readFileSync
      // Add mocks for other fs functions if ActivityStore uses them (e.g., unlinkSync, rmdirSync?)
    };
    // Use jest.doMock for fs as we need to partially mock it and use requireActual
    jest.doMock('fs', () => mockFs, { virtual: true });

    // Ensure path module is the real one now
    jest.dontMock('path');

    // Mock app.getPath & app.getAppPath
    const electron = require('electron');
    electron.app.getPath.mockReturnValue('/tmp/user-data-mock'); // For saving/loading state perhaps
    electron.app.getAppPath.mockReturnValue(projectRoot); // Point to the calculated project root

    // Initialize the store in mock mode
    // Important: Modules must be loaded *after* the jest.mock/doMock calls
    // Reset modules to ensure the new mocks are picked up
    jest.resetModules();
    const ActivityStoreActual = require('./ActivityStore').default;
    activityStore = new ActivityStoreActual({ useMockData: true }); // Should now load the real JSON
  });

  afterEach(() => {
    jest.resetModules(); // Important to reset mocks between tests
    jest.restoreAllMocks();
    jest.dontMock('fs'); // Clean up fs mocking status
  });

  it('Check 5 min aggregation', () => {
    activityStore.setAggregationInterval(5);
    const dayData = activityStore.getDayData('2024-01-01');

    expect(dayData).not.toBeNull();
    expect(dayData?.aggregated?.timelineOverview).toBeDefined();

    const timeline = dayData!.aggregated!.timelineOverview;
    const miniuteAsMillis = 60 * 1000;

    // Block 1 - Direct representation of mock data heartbeats
    expect(timeline[0]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:00:00.000Z').getTime(),
      duration:5 * miniuteAsMillis,
      type: 'appWindow',
      data: { app: 'Google Chrome', title: 'Aggregate to visible' }
    }));

    // Block 2 - Direct representation of mock data heartbeats
    expect(timeline[1]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:05:00.000Z').getTime(),
      duration: 5* miniuteAsMillis,
      type: 'appWindow',
      data: { app: 'Explorer', title: 'Aggregate to visible only for 5 min' }
    }));

    // Block 3 - Direct representation of mock data heartbeats
    expect(timeline[2]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:10:00.000Z').getTime(),
      duration: 5 * miniuteAsMillis,
      type: 'appWindow',
      data: { app: 'Google Chrome', title: 'Aggregate to visible' }
    }));

    // Block 4 - Direct representation of mock data heartbeats
    expect(timeline[3]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:15:00.000Z').getTime(),
      duration: 10 * miniuteAsMillis,
      type: 'inactive'
    }));

    // Block 5 - Direct representation of mock data heartbeats
    expect(timeline[4]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:25:00.000Z').getTime(),
      duration: 5 * miniuteAsMillis,
      type: 'appWindow',    
      data: { app: 'Excel', title: 'File A: Aggregate to visible' }
    }));

    // Block 6 - Direct representation of mock data heartbeats
    expect(timeline[5]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:30:00.000Z').getTime(),
      duration: 5 * miniuteAsMillis,
      type: 'appWindow',
      data: { app: 'Excel', title: 'File B: Aggregate to visible' } 
    }));

    // Block 7 - Direct representation of mock data heartbeats
    expect(timeline[6]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:35:00.000Z').getTime(),
      duration: 10 * miniuteAsMillis,
      type: 'appWindow',
      data: { app: 'Excel', title: 'File A: Aggregate to visible' }
    }));


    expect(dayData?.aggregated?.summary).toBeDefined();
    const summary = dayData!.aggregated!.summary;
    expect(summary.totalDuration).toBe(45 * miniuteAsMillis);
    expect(summary.activeDuration).toBe(35 * miniuteAsMillis);
    expect(summary.inactiveDuration).toBe(10 * miniuteAsMillis);
  });

  it('Check 15 min aggregation', () => {
    activityStore.setAggregationInterval(15);
    const dayData = activityStore.getDayData('2024-01-01');

    expect(dayData).not.toBeNull();
    expect(dayData?.aggregated?.timelineOverview).toBeDefined();

    const timeline = dayData!.aggregated!.timelineOverview;
    const miniuteAsMillis = 60 * 1000;

    // Block 1 - Aggregate
    expect(timeline[0]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:00:00.000Z').getTime(),
      duration: 15 * miniuteAsMillis,
      type: 'appWindow',
      data: { app: 'Google Chrome', title: 'Aggregate to visible' }
    }));

    // Block 2 - Aggregate to inactive
    expect(timeline[1]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:15:00.000Z').getTime(),
      duration: 15 * miniuteAsMillis,
      type: 'inactive'
    }));

    // Block 3 - Direct representation of mock data heartbeats
    expect(timeline[2]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:30:00.000Z').getTime(),
      duration: 15 * miniuteAsMillis,
      type: 'appWindow',    
      data: { app: 'Excel', title: 'File A: Aggregate to visible' }
    }));

    expect(dayData?.aggregated?.summary).toBeDefined();
    const summary = dayData!.aggregated!.summary;
    expect(summary.totalDuration).toBe(45 * miniuteAsMillis);
    expect(summary.activeDuration).toBe(30 * miniuteAsMillis);
    expect(summary.inactiveDuration).toBe(15 * miniuteAsMillis);
  });

});

describe('ActivityStore Mock Data Tests', () => {
  describe('getDateKey', () => {
    // Instantiate the class or access the static method if needed
    // For instance methods, we need an instance
    const storeInstance = new ActivityStore({ useMockData: true }); // Use mock data to avoid file IO

    test('sollte den korrekten lokalen Datumsschlüssel für einen Zeitstempel am Mittag generieren', () => {
      const timestamp = new Date('2024-05-15T12:00:00Z').getTime(); // Mittag UTC
      const expectedKey = '2024-05-15'; // Sollte in den meisten westlichen Zeitzonen passen
      expect(storeInstance.getDateKey(timestamp)).toBe(expectedKey);
    });

    test('sollte den korrekten lokalen Datumsschlüssel für kurz vor Mitternacht lokal generieren', () => {
      // Konstruiere einen Zeitstempel, der 23:58 Uhr LOKALER Zeit entspricht
      const localDate = new Date();
      localDate.setHours(23, 58, 0, 0);
      const timestamp = localDate.getTime();
      
      // Erwarteter Schlüssel ist der Tag von localDate
      const year = localDate.getFullYear();
      const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
      const day = localDate.getDate().toString().padStart(2, '0');
      const expectedKey = `${year}-${month}-${day}`;

      expect(storeInstance.getDateKey(timestamp)).toBe(expectedKey);
    });

    test('sollte den korrekten lokalen Datumsschlüssel für kurz nach Mitternacht lokal generieren', () => {
      // Konstruiere einen Zeitstempel, der 00:02 Uhr LOKALER Zeit entspricht
      const localDate = new Date();
      localDate.setHours(0, 2, 0, 0);
      const timestamp = localDate.getTime();
      
      // Erwarteter Schlüssel ist der Tag von localDate
      const year = localDate.getFullYear();
      const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
      const day = localDate.getDate().toString().padStart(2, '0');
      const expectedKey = `${year}-${month}-${day}`;

      expect(storeInstance.getDateKey(timestamp)).toBe(expectedKey);
    });
  });
}); 