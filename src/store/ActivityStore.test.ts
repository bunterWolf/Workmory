import ActivityStore, { HeartbeatData, Heartbeat, StoreData, DayData, AggregatedData, AggregationSummary, TimelineEvent } from './ActivityStore';
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

  test('Abwesenheit über Mitternacht wird im Vortag inaktiv', () => {
    const at = (iso: string) => new Date(iso).getTime(); // lokale Zeit, ohne Z
    const lastInput = at('2026-03-04T23:55:00');
    const end = at('2026-03-05T00:40:45');
    Date.now = jest.fn(() => at('2026-03-04T23:50:00'));
    activityStore.startTracking();
    for (let t = at('2026-03-04T23:50:15'); t <= end; t += 30000) {
      const idle = Math.max(0, t - lastInput);
      Date.now = jest.fn(() => t);
      activityStore.addHeartbeat({ userActivity: idle < 60000 ? 'active' : idle < 600000 ? 'may_be_inactive' : 'inactive' });
    }
    const state = (activityStore as any).activityState;
    const dayBefore = state.getHeartbeats('2026-03-04') as Heartbeat[];
    const afterInput = dayBefore.filter((h) => h.timestamp > at('2026-03-04T23:56:00'));
    expect(afterInput.length).toBeGreaterThan(0);
    expect(afterInput.some((h) => h.data.userActivity === 'may_be_inactive')).toBe(false);
    expect(afterInput.every((h) => h.data.userActivity === 'inactive')).toBe(true);
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
    expect(summary.activeTrackingDuration).toBe(2 * intervalMillis);
    expect(summary.totalActiveDuration).toBe(1 * intervalMillis); // Only the first interval was actively dominant
    expect(summary.totalInactiveDuration).toBe(1 * intervalMillis); // The second was inactive
    expect(summary.totalMeetingDuration).toBe(0);
    // Count app usage based on the dominant activity in the interval
    expect(summary.appUsage['VS Code']).toBe(1 * intervalMillis); // Dominant in Interval 1
    expect(summary.appUsage['Browser']).toBeUndefined(); // Browser was not dominant
  });

  describe('getLatestAppWindow', () => {
    const addAt = (timestamp: number, data: HeartbeatData) => {
      Date.now = jest.fn(() => timestamp);
      activityStore.addHeartbeat(data);
    };

    test('liefert das letzte vorhandene appWindow von heute (Heartbeat ohne appWindow wird uebersprungen)', () => {
      addAt(getTimestamp(9, 1, 15), { appWindow: { app: 'VS Code', title: 'a.ts' } });
      addAt(getTimestamp(9, 1, 45), { appWindow: { app: 'Chrome', title: 'x' } });
      addAt(getTimestamp(9, 2, 15), { userActivity: 'inactive' });

      expect(activityStore.getLatestAppWindow()).toEqual({ app: 'Chrome', title: 'x' });
    });

    test('liefert null ohne Heartbeats', () => {
      expect(activityStore.getLatestAppWindow()).toBeNull();
    });

    test('veraendert die gespeicherten Heartbeats nicht', () => {
      addAt(getTimestamp(9, 1, 15), { appWindow: { app: 'VS Code', title: 'a.ts' } });
      addAt(getTimestamp(9, 1, 45), { userActivity: 'inactive' });

      const before = JSON.parse(JSON.stringify(activityStore.getDayData(testDateKey)?.heartbeats));
      activityStore.getLatestAppWindow();
      const after = activityStore.getDayData(testDateKey)?.heartbeats;

      expect(before).toHaveLength(2);
      expect(after).toHaveLength(2);
      expect(after).toEqual(before);
    });
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
    expect(summary.activeTrackingDuration).toBe(45 * miniuteAsMillis);
    expect(summary.totalActiveDuration).toBe(35 * miniuteAsMillis);
    expect(summary.totalInactiveDuration).toBe(10 * miniuteAsMillis);
    expect(summary.totalMeetingDuration).toBe(0);
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
    expect(summary.activeTrackingDuration).toBe(45 * miniuteAsMillis);
    expect(summary.totalActiveDuration).toBe(30 * miniuteAsMillis);
    expect(summary.totalInactiveDuration).toBe(15 * miniuteAsMillis);
    expect(summary.totalMeetingDuration).toBe(0);
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
describe('ActivityStore Aufräumen', () => {
  test('Aufräumen nach 30 Tagen rechnet in lokalen Tagen', () => {
    const realNow = Date.now;
    Date.now = () => new Date('2026-03-05T00:30:00').getTime();
    const store = new ActivityStore({ useMockData: false, storagePath: '/tmp/nonexistent/activity-test.json' });
    try {
      (store as any).activityState.setData({ version: 1, startTime: 0, lastCleanup: 0, aggregationInterval: 15, days: { '2026-02-03': { heartbeats: [] }, '2026-02-04': { heartbeats: [] } } });
      store.cleanupOldData();
      expect(store.getAvailableDates()).toEqual(['2026-02-04']);
    } finally {
      Date.now = realNow;
      store.cleanup();
    }
  });
});
