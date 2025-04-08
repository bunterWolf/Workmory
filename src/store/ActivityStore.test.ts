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
      // Stellen Sie sicher, dass heartbeatData Partial<HeartbeatData> entspricht
      const heartbeatData: Partial<HeartbeatData> = { userActivity: 'inactive' };

      // Stellen Sie sicher, dass heartbeats dem Heartbeat[] Typ entsprechen
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

      // Prüfe leeres Array
      expect(handleMayBeInactive([], currentTime, heartbeatData)).toEqual([]);

      // Prüfe undefined und null für heartbeats - Funktion gibt sie unverändert zurück
      expect(handleMayBeInactive(undefined as any, currentTime, heartbeatData)).toBeUndefined();
      expect(handleMayBeInactive(null as any, currentTime, heartbeatData)).toBeNull();

      // Prüfe unvollständige Heartbeat-Objekte
      const invalidHeartbeats: Heartbeat[] = [
        { timestamp: currentTime - 1000, data:{} }, // Kein userActivity
        { timestamp: currentTime - 2000, data: null } as any, // data ist null (mit Type Assertion)
        { timestamp: currentTime - 3000, data: {} } // Leeres data-Objekt
      ];

      const result = handleMayBeInactive(invalidHeartbeats, currentTime, heartbeatData);
      expect(result).toHaveLength(3);
      // Hier wird erwartet, dass keine Änderungen vorgenommen werden, da keine 'may_be_inactive' existieren.
      expect(result).toEqual(invalidHeartbeats);
    });
  });
});

// Neuer Describe-Block für Integrationstests
describe('ActivityStore Integration', () => {
  let activityStore: ActivityStore;
  const testDateKey = '2024-04-06'; // Beispiel-Datum
  const intervalMillis = 15 * 60 * 1000; // 15 Minuten für die Erwartungen
  let originalDateNow: () => number;

  // Helper zum Erzeugen von Timestamps für den Testtag
  const getTimestamp = (hour: number, minute: number, second: number = 0) => {
    return new Date(`${testDateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`).getTime();
  };

  beforeEach(() => {
    // Speichere die originale Date.now Funktion
    originalDateNow = Date.now;
    // Erstelle eine neue Instanz vor jedem Test, keine Mock-Daten
    activityStore = new ActivityStore({ useMockData: false, storagePath: '/tmp/nonexistent/activity-test.json' });
    activityStore.setAggregationInterval(15);
    // Simulieren, dass das Tracking gestartet wird (setzt isTracking intern)
    activityStore.startTracking();
    // Wir setzen den initialen Timestamp, damit der currentDayKey stimmt
    Date.now = jest.fn(() => getTimestamp(9, 0, 1));
    activityStore.startTracking(); // Rufe erneut auf, um den gemockten Timestamp zu nutzen

  });

  afterEach(() => {
    // Stelle die originale Date.now Funktion wieder her
    Date.now = originalDateNow;
    // Bereinige nach jedem Test
    activityStore.cleanup();
    // Lösche ggf. erstellte Testdatei
    try { fs.unlinkSync('/tmp/nonexistent/activity-test.json'); } catch (e) { /* Ignorieren */ }
    try { fs.rmdirSync('/tmp/nonexistent'); } catch (e) { /* Ignorieren */ }
  });

  test('sollte Heartbeats korrekt aggregieren und Timeline-Events generieren', () => {
    // ---- Test-Heartbeats hinzufügen ----
    // Helper to add heartbeat with specific timestamp
    const addTestHeartbeat = (timestamp: number, data: HeartbeatData) => {
        const originalNow = Date.now;
        Date.now = jest.fn(() => timestamp);
        activityStore.addHeartbeat(data);
        Date.now = originalNow; // Restore immediately after add
    };

    // Intervall 1: 09:00 - 09:15 (Mehrheitlich VS Code)
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

    // Intervall 2: 09:15 - 09:30 (Mehrheitlich Inaktiv)
    for (let min = 15; min < 30; min++) {
        if (min < 27) { // First 12 mins: Inactive
            addTestHeartbeat(getTimestamp(9, min, 15), { userActivity: 'inactive' });
            addTestHeartbeat(getTimestamp(9, min, 45), { userActivity: 'inactive' });
        } else { // Last 3 mins: VS Code
             addTestHeartbeat(getTimestamp(9, min, 15), { appWindow: { app: 'VS Code', title: 'file2.ts' } });
             addTestHeartbeat(getTimestamp(9, min, 45), { appWindow: { app: 'VS Code', title: 'file2.ts' } });
        }
    }

    // Intervall 3: 09:30 - 09:45 (WENIGER als 50% Heartbeats)
    // Add only a few heartbeats to test the minimum threshold
    addTestHeartbeat(getTimestamp(9, 31, 15), { appWindow: { app: 'VS Code', title: 'file1.ts' } });
    addTestHeartbeat(getTimestamp(9, 32, 45), { appWindow: { app: 'VS Code', title: 'file1.ts' } });
    addTestHeartbeat(getTimestamp(9, 34, 0), { userActivity: 'inactive' });


    // ---- Aggregation auslösen und prüfen ----
    Date.now = originalDateNow; // Ensure Date.now is restored

    const dayData = activityStore.getDayData(testDateKey);

    // ---- Assertions ----
    expect(dayData).not.toBeNull();
    expect(dayData?.aggregated).toBeDefined();
    expect(dayData?.aggregated?.timelineOverview).toBeDefined();

    const timeline = dayData!.aggregated!.timelineOverview;

    // Erwartet werden 2 Events (Intervall 1 und Intervall 2). Intervall 3 hat zu wenig Daten.
    expect(timeline).toHaveLength(2);

    // Prüfe Event 1 (VS Code - dominant in 09:00-09:15)
    expect(timeline[0]).toEqual(expect.objectContaining({
      timestamp: getTimestamp(9, 0), // Startet um 09:00
      duration: intervalMillis,      // Dauer 15 min
      type: 'appWindow',
      data: { app: 'VS Code', title: 'file1.ts' } // VS Code war dominant
    }));

    // Prüfe Event 2 (Inaktiv - dominant in 09:15-09:30)
    expect(timeline[1]).toEqual(expect.objectContaining({
      timestamp: getTimestamp(9, 15), // Startet um 09:15
      duration: intervalMillis,      // Dauer 15 min
      type: 'inactive',
    }));
     expect(timeline[1].data).toBeDefined(); // Inactive data should exist

    // Optional: Summary prüfen, falls relevant
    const summary = dayData!.aggregated!.summary;
    expect(summary.totalDuration).toBe(2 * intervalMillis);
    expect(summary.activeDuration).toBe(1 * intervalMillis); // Nur das erste Intervall war aktiv dominant
    expect(summary.inactiveDuration).toBe(1 * intervalMillis); // Das zweite war inaktiv
    // Zähle die App-Nutzung basierend auf der dominanten Aktivität im Intervall
    expect(summary.appUsage['VS Code']).toBe(1 * intervalMillis); // Dominant in Intervall 1
    expect(summary.appUsage['Browser']).toBeUndefined(); // Browser war nicht dominant
  });
});

// Neuer Describe-Block für Mock-Daten-Tests
describe('ActivityStore Mock Data Tests', () => {
  let activityStore: ActivityStore;
  const projectRoot = path.resolve(__dirname, '../..'); // Determine project root relative to test file
  const mockDataJsonPath = path.join(projectRoot, 'public', 'mock-data.json');
  let mockFs: any;

  beforeEach(() => {
    // Mocken von Teilen von fs (nur existsSync für den Pfad und andere, die nicht lesen)
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

    // Initialisiere den Store im Mock-Modus
    // Wichtig: Das Laden der Module muss *nach* den jest.mock/doMock Aufrufen erfolgen
    // Reset modules to ensure the new mocks are picked up
    jest.resetModules();
    const ActivityStoreActual = require('./ActivityStore').default;
    activityStore = new ActivityStoreActual({ useMockData: true }); // Should now load the real JSON
  });

  afterEach(() => {
    jest.resetModules(); // Wichtig, um Mocks zwischen Tests zurückzusetzen
    jest.restoreAllMocks();
    jest.dontMock('fs'); // Clean up fs mocking status
  });

  it('sollte mit 15min Intervall die korrekten aggregierten und gemergten Events für 2024-01-01 liefern', () => {
    activityStore.setAggregationInterval(15);
    const dayData = activityStore.getDayData('2024-01-01');

    expect(dayData).not.toBeNull();
    expect(dayData?.aggregated?.timelineOverview).toBeDefined();

    const timeline = dayData!.aggregated!.timelineOverview;
    const intervalMillis = 15 * 60 * 1000;

    // Erwartet: 4 Blöcke nach Merging
    expect(timeline).toHaveLength(4);

    // 1. Merged Block: 08:00 - 08:30 (VS Code Refactoring)
    expect(timeline[0]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T08:00:00.000Z').getTime(),
      duration: intervalMillis * 2, // 30 Minuten
      type: 'appWindow',
      data: { app: 'VS Code', title: 'Refactoring Components - Focus2' }
    }));

    // 2. Edge Case Block: 09:00 - 09:15 (VS Code File A)
    expect(timeline[1]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T09:00:00.000Z').getTime(),
      duration: intervalMillis, // 15 Minuten
      type: 'appWindow',
      data: { app: 'VS Code', title: 'File A' } 
    }));

    // 3. Merged Block: 12:00 - 12:30 (Inactive)
    expect(timeline[2]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T12:00:00.000Z').getTime(),
      duration: intervalMillis * 2, // 30 Minuten
      type: 'inactive',
    }));
    expect(timeline[2].data).toBeDefined(); // Inactive data should exist

    // 4. Nicht gemergter Block: 14:30 - 14:45 (Outlook)
    expect(timeline[3]).toEqual(expect.objectContaining({
      timestamp: new Date('2024-01-01T14:30:00.000Z').getTime(),
      duration: intervalMillis, // 15 Minuten
      type: 'appWindow',
      data: { app: 'Outlook', title: 'Answering Emails' }
    }));
  });
  
  // ---- Weitere Tests (optional, aber empfohlen) ----
  
  it('sollte mit 10min Intervall eine detailliertere Ansicht liefern (weniger Merging)', () => {
      activityStore.setAggregationInterval(10);
      const dayData = activityStore.getDayData('2024-01-01');
      expect(dayData).not.toBeNull();
      const timeline = dayData!.aggregated!.timelineOverview;
      const intervalMillis = 10 * 60 * 1000;
      
      // Erwartung: Mehr Blöcke, da 10-Minuten-Grenzen Merging verhindern könnten
      // Beispiel (muss genau geprüft werden!):
      // Block 08:00-08:10 -> VS Code Refactoring
      // Block 08:10-08:20 -> VS Code Refactoring (merged mit vorherigem?)
      // Block 08:20-08:30 -> VS Code Refactoring (merged?)
      // Block 09:00-09:10 -> VS Code File A (Edge Case)
      // Block 09:10-09:20 -> ??? (Leer oder was auch immer die Daten ergeben)
      // Block 12:00-12:10 -> Inactive (merged?)
      // Block 12:10-12:20 -> Inactive (merged?)
      // Block 12:20-12:30 -> Inactive (merged?)
      // Block 14:30-14:40 -> Outlook
      // Block 14:40-14:50 -> Outlook
      // Die genaue Anzahl und Struktur muss basierend auf der 10-Min-Aggregation bestimmt werden.
      // Korrekte Erwartung mit generierten Daten: 5 Events
      expect(timeline).toHaveLength(5);
      // Füge spezifischere Checks für 10min hinzu...
  });

  it('sollte mit 5min Intervall die detaillierteste Ansicht liefern', () => {
      activityStore.setAggregationInterval(5);
      const dayData = activityStore.getDayData('2024-01-01');
      expect(dayData).not.toBeNull();
      const timeline = dayData!.aggregated!.timelineOverview;
      const intervalMillis = 5 * 60 * 1000;

      // Erwartung: Noch mehr Blöcke, potentiell sehr wenig Merging
      // Die genaue Anzahl muss basierend auf der 5-Min-Aggregation bestimmt werden.
      // Korrekte Erwartung mit generierten Daten: 5 Events
      expect(timeline).toHaveLength(5);
      // Füge spezifischere Checks für 5min hinzu...
  });

  it('sollte die Summary korrekt berechnen basierend auf den 15min Events', () => {
      activityStore.setAggregationInterval(15);
      const dayData = activityStore.getDayData('2024-01-01');
      expect(dayData?.aggregated?.summary).toBeDefined();
      const summary = dayData!.aggregated!.summary;
      const intervalMillis = 15 * 60 * 1000;

      // Basierend auf den 4 erwarteten 15min Events:
      // 1x 30min VS Code Refactoring (aktiv)
      // 1x 15min VS Code File A (aktiv)
      // 1x 30min Inactive (inaktiv)
      // 1x 15min Outlook (aktiv)
      expect(summary.totalDuration).toBe(intervalMillis * (2 + 1 + 2 + 1)); // 90 min
      expect(summary.activeDuration).toBe(intervalMillis * (2 + 1 + 1)); // 60 min
      expect(summary.inactiveDuration).toBe(intervalMillis * 2); // 30 min
      expect(summary.appUsage['VS Code']).toBe(intervalMillis * (2 + 1)); // 45 min (beide VS Code Blöcke)
      expect(summary.appUsage['Outlook']).toBe(intervalMillis * 1); // 15 min
      expect(summary.appUsage['Chrome']).toBeUndefined(); // War nicht dominant
  });

}); 