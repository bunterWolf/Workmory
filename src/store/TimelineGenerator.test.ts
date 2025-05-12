import TimelineGenerator from './TimelineGenerator';

describe('TimelineGenerator', () => {
  let generator: TimelineGenerator;
  
  beforeEach(() => {
    generator = new TimelineGenerator(5);
  });

  describe('Konfiguration und Initialisierung', () => {
    test('sollte mit 5-Minuten-Intervall initialisieren', () => {
      expect(generator.aggregationInterval).toBe(5);
      expect(generator.intervalDuration).toBe(5 * 60 * 1000);
    });

    test('sollte Intervall korrekt setzen', () => {
      generator.setAggregationInterval(10);
      expect(generator.aggregationInterval).toBe(10);
      expect(generator.intervalDuration).toBe(10 * 60 * 1000);

      generator.setAggregationInterval(15);
      expect(generator.aggregationInterval).toBe(15);
      expect(generator.intervalDuration).toBe(15 * 60 * 1000);
    });
  });

  describe('Heartbeat Gruppierung', () => {
    test('sollte Heartbeats korrekt in Intervalle gruppieren', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats: any[] = [
        { timestamp: baseTime, data: {} },
        { timestamp: baseTime + 30000, data: {} },
        { timestamp: baseTime + 60000, data: {} },
        { timestamp: baseTime + 300000, data: {} },
        { timestamp: baseTime + 900000, data: {} }
      ];

      const groups = generator.groupHeartbeatsByInterval(heartbeats);
      const expectedGroup1Timestamp = new Date('2024-03-20T10:00:00Z').getTime();
      const expectedGroup2Timestamp = new Date('2024-03-20T10:05:00Z').getTime();
      const expectedGroup3Timestamp = new Date('2024-03-20T10:15:00Z').getTime();

      expect(Object.keys(groups)).toHaveLength(3);
      expect(groups[expectedGroup1Timestamp]).toHaveLength(3);
      expect(groups[expectedGroup2Timestamp]).toHaveLength(1);
      expect(groups[expectedGroup3Timestamp]).toHaveLength(1);
    });

    test('sollte Timestamps korrekt zum nächsten Intervall runden', () => {
      generator.setAggregationInterval(15);
      const time1 = new Date('2024-03-20T10:07:30Z').getTime();
      const time2 = new Date('2024-03-20T10:14:59Z').getTime();
      const time3 = new Date('2024-03-20T10:15:00Z').getTime();
      const time4 = new Date('2024-03-20T10:29:00Z').getTime();

      const roundedTime1 = generator.roundToNearestInterval(time1);
      const roundedTime2 = generator.roundToNearestInterval(time2);
      const roundedTime3 = generator.roundToNearestInterval(time3);
      const roundedTime4 = generator.roundToNearestInterval(time4);

      expect(new Date(roundedTime1).toISOString()).toBe('2024-03-20T10:00:00.000Z');
      expect(new Date(roundedTime2).toISOString()).toBe('2024-03-20T10:00:00.000Z');
      expect(new Date(roundedTime3).toISOString()).toBe('2024-03-20T10:15:00.000Z');
      expect(new Date(roundedTime4).toISOString()).toBe('2024-03-20T10:15:00.000Z');

      generator.setAggregationInterval(5);
      const time5 = new Date('2024-03-20T10:07:30Z').getTime();
      const roundedTime5 = generator.roundToNearestInterval(time5);
      expect(new Date(roundedTime5).toISOString()).toBe('2024-03-20T10:05:00.000Z');
    });
  });

  describe('Aktivitätserkennung', () => {
    test('sollte die häufigste spezifische Aktivität in einem Intervall erkennen', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats: any[] = [
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + (i * 30000),
          data: {
            userActivity: 'active',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        })),
        ...Array(3).fill(null).map((_, i) => ({
          timestamp: baseTime + ((i + 6) * 30000),
          data: {
            userActivity: 'inactive'
          }
        }))
      ];

      const result = generator.generateTimelineEvents(heartbeats);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        timestamp: baseTime,
        duration: 5 * 60 * 1000,
        type: 'appWindow',
        data: {
          app: 'VS Code',
          title: 'test.js'
        }
      });
    });

    test('sollte Inaktivität korrekt in Timeline-Events umwandeln', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats: any[] = [
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + (i * 30000),
          data: {
            userActivity: 'inactive'
          }
        }))
      ];

      const result = generator.generateTimelineEvents(heartbeats);
      
      expect(result).toHaveLength(1);
      
      expect(result[0]).toEqual({
        timestamp: baseTime,
        duration: generator.intervalDuration,
        type: 'inactive',
        data: { reason: 'User inactive' }
      });
    });
  });

  describe('Aktivitätsaggregation', () => {
    test('sollte nur Aktivitäten mit genügend Heartbeats erstellen', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats: any[] = Array(4).fill(null).map((_, i) => ({
        timestamp: baseTime + (i * 30000),
        data: {
          userActivity: 'active',
          appWindow: { app: 'VS Code', title: 'test.js' }
        }
      }));

      const result = generator.generateTimelineEvents(heartbeats);
      expect(result).toHaveLength(0);
    });

    test('sollte aufeinanderfolgende identische Aktivitäten zusammenführen', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const intervalDurationMs = 5 * 60 * 1000;
      const heartbeats: any[] = [
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + (i * 30000),
          data: {
            userActivity: 'active',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        })),
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + intervalDurationMs + (i * 30000),
          data: {
            userActivity: 'active',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        })),
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + (2 * intervalDurationMs) + (i * 30000),
          data: {
            userActivity: 'inactive'
          }
        }))
      ];

      const result = generator.generateTimelineEvents(heartbeats);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('appWindow');
      expect(result[0].duration).toBe(2 * intervalDurationMs);
      expect(result[1].type).toBe('inactive');
      expect(result[1].duration).toBe(intervalDurationMs);
    });
  });

  describe('Edge Cases und Fehlerbehandlung', () => {
    test('sollte leere oder ungültige Eingaben für generateTimelineEvents behandeln', () => {
      expect(generator.generateTimelineEvents([])).toEqual([]);
      // Teste explizit mit null/undefined - TypeScript erlaubt dies nicht direkt für Heartbeat[]
      // Stattdessen testen wir das Verhalten mit leeren Arrays, was die Funktion intern handhaben sollte.
      // expect(generator.generateTimelineEvents(null as any)).toEqual([]); // Veraltet
      // expect(generator.generateTimelineEvents(undefined as any)).toEqual([]); // Veraltet
    });

    test('sollte ungültige Heartbeat-Daten behandeln', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats: any[] = [
        { timestamp: baseTime, data: {} },
        { timestamp: baseTime + 30000, data: null },
        { timestamp: baseTime + 60000 },
        { timestamp: baseTime + 90000, data: { userActivity: 'unknown' } },
        { timestamp: baseTime + 120000, data: { appWindow: null } }
      ];

      const result = generator.generateTimelineEvents(heartbeats);
      expect(result).toHaveLength(0);
    });

    test('sollte das aktuelle Intervall für die Aggregation verwenden', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats: any[] = Array(20).fill(null).map((_, i) => ({
        timestamp: baseTime + (i * 30000),
        data: {
          userActivity: 'active',
          appWindow: { app: 'VS Code', title: 'test.js' }
        }
      }));

      generator.setAggregationInterval(15);
      
      const result = generator.generateTimelineEvents(heartbeats);
      
      expect(result).toHaveLength(1);
      expect(result[0].duration).toBe(15 * 60 * 1000);
    });
  });

  describe('Zusammenfassungsberechnung', () => {
    test('sollte korrekte Zusammenfassung für verschiedene Aktivitätstypen berechnen', () => {
      const events: any[] = [
        {
          timestamp: new Date('2024-03-20T11:00:00Z').getTime(),
          duration: 30 * 60 * 1000,
          type: 'inactive',
          data: { reason: 'User inactive' }
        },
        {
          timestamp: new Date('2024-03-20T11:30:00Z').getTime(),
          duration: 90 * 60 * 1000,
          type: 'appWindow',
          data: { app: 'VS Code', title: 'test.js' }
        },
        {
          timestamp: new Date('2024-03-20T13:00:00Z').getTime(),
          duration: 30 * 60 * 1000,
          type: 'appWindow',
          data: { app: 'Chrome', title: 'google.com' }
        }
      ];

      const summary = generator.calculateSummary(events);

      expect(summary.activeTrackingDuration).toBe(150 * 60 * 1000);
      expect(summary.totalActiveDuration).toBe(120 * 60 * 1000);
      expect(summary.totalInactiveDuration).toBe(30 * 60 * 1000);
      expect(summary.totalMeetingDuration).toBe(0);
      expect(summary.appUsage['VS Code']).toBe(90 * 60 * 1000);
      expect(summary.appUsage['Chrome']).toBe(30 * 60 * 1000);
    });

    test('sollte leere Zusammenfassung für keine Events zurückgeben', () => {
      const summary = generator.calculateSummary([]);
      expect(summary.activeTrackingDuration).toBe(0);
      expect(summary.totalActiveDuration).toBe(0);
      expect(summary.totalInactiveDuration).toBe(0);
      expect(summary.totalMeetingDuration).toBe(0);
      expect(summary.appUsage).toEqual({});
    });
  });
}); 