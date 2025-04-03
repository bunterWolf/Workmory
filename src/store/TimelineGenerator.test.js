const TimelineGenerator = require('./TimelineGenerator');

describe('TimelineGenerator', () => {
  let generator;
  
  beforeEach(() => {
    generator = new TimelineGenerator();
    generator.setAggregationInterval(5); // Änderung auf 5-Minuten-Intervall
  });

  describe('Konfiguration und Initialisierung', () => {
    test('sollte mit 5-Minuten-Intervall initialisieren', () => {
      expect(generator.aggregationInterval).toBe(5);
      expect(generator.intervalDuration).toBe(5 * 60 * 1000);
    });

    test('sollte Intervall korrekt setzen', () => {
      generator.setAggregationInterval(5);
      expect(generator.aggregationInterval).toBe(5);
      expect(generator.intervalDuration).toBe(5 * 60 * 1000);
    });
  });

  describe('Heartbeat Gruppierung', () => {
    test('sollte Heartbeats korrekt in Intervalle gruppieren', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats = [
        { timestamp: baseTime }, // 10:00
        { timestamp: baseTime + 30000 }, // 10:00:30
        { timestamp: baseTime + 60000 }, // 10:01
        { timestamp: baseTime + 900000 } // 10:15
      ];

      const groups = generator.groupHeartbeatsByInterval(heartbeats);
      expect(Object.keys(groups)).toHaveLength(2);
      expect(groups[baseTime]).toHaveLength(3);
      expect(groups[baseTime + 900000]).toHaveLength(1);
    });

    test('sollte Timestamps korrekt zum nächsten Intervall runden', () => {
      const time = new Date('2024-03-20T10:07:30Z').getTime();
      const roundedTime = generator.roundToNearestInterval(time);
      expect(new Date(roundedTime).getMinutes()).toBe(5);
    });
  });

  describe('Aktivitätserkennung', () => {
    test('sollte die häufigste spezifische Aktivität in einem Intervall erkennen', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats = [
        // VS Code "test.js" (6 Heartbeats - mehr als 50% von 10)
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + (i * 30000),
          data: {
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        })),
        // Teams Meeting "Daily" (3 Heartbeats - weniger als 50%)
        ...Array(3).fill(null).map((_, i) => ({
          timestamp: baseTime + ((i + 6) * 30000),
          data: {
            teamsMeeting: { title: 'Daily', status: 'active' }
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

    test('sollte verschiedene Teams Meetings als separate Aktivitäten behandeln', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats = [
        // Meeting "Daily" (3 Heartbeats)
        ...Array(3).fill(null).map((_, i) => ({
          timestamp: baseTime + (i * 30000),
          data: {
            teamsMeeting: { title: 'Daily', status: 'active' }
          }
        })),
        // Meeting "Sprint Planning" (6 Heartbeats)
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + ((i + 3) * 30000),
          data: {
            teamsMeeting: { title: 'Sprint Planning', status: 'active' }
          }
        }))
      ];

      const result = generator.generateTimelineEvents(heartbeats);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('teamsMeeting');
      expect(result[0].data.title).toBe('Sprint Planning');
    });

    test('sollte Inaktivität korrekt in Timeline-Events umwandeln', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats = [
        // Aktiver Heartbeat
        {
          timestamp: baseTime,
          data: {
            userActivity: 'active',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        },
        // Bereits als inactive markierte Heartbeats (wie sie vom Store kommen würden)
        ...Array(4).fill(null).map((_, i) => ({
          timestamp: baseTime + ((i + 1) * 30000),
          data: {
            userActivity: 'inactive'
          }
        }))
      ];

      const result = generator.generateTimelineEvents(heartbeats);
      
      // Erwarte ein Event für die aktive Phase und eins für die inaktive Phase
      expect(result).toHaveLength(2);
      
      // Überprüfe das aktive Event
      expect(result[0]).toEqual({
        timestamp: baseTime,
        duration: generator.intervalDuration,
        type: 'appWindow',
        data: {
          app: 'VS Code',
          title: 'test.js'
        }
      });

      // Überprüfe das inaktive Event
      expect(result[1]).toEqual({
        timestamp: baseTime + generator.intervalDuration,
        duration: generator.intervalDuration,
        type: 'inactive',
        data: {}
      });
    });
  });

  describe('Aktivitätsaggregation', () => {
    test('sollte nur Aktivitäten mit genügend Heartbeats erstellen', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      // 5 Minuten Intervall erwartet 10 Heartbeats (alle 30 Sekunden)
      // Mindestens die Hälfte (5) werden benötigt
      const heartbeats = Array(4).fill(null).map((_, i) => ({
        timestamp: baseTime + (i * 30000),
        data: {
          appWindow: { app: 'VS Code', title: 'test.js' }
        }
      }));

      const result = generator.generateTimelineEvents(heartbeats);
      expect(result).toHaveLength(0);
    });

    test('sollte aufeinanderfolgende identische Aktivitäten zusammenführen', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats = [
        // Erste 5 Minuten
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + (i * 30000),
          data: {
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        })),
        // Zweite 5 Minuten
        ...Array(6).fill(null).map((_, i) => ({
          timestamp: baseTime + 300000 + (i * 30000),
          data: {
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        }))
      ];

      const result = generator.generateTimelineEvents(heartbeats);
      expect(result).toHaveLength(1);
      expect(result[0].duration).toBe(10 * 60 * 1000); // 10 Minuten
    });
  });

  describe('Edge Cases und Fehlerbehandlung', () => {
    test('sollte leere Heartbeat-Arrays behandeln', () => {
      expect(generator.generateTimelineEvents([])).toEqual([]);
      expect(generator.generateTimelineEvents(null)).toEqual([]);
      expect(generator.generateTimelineEvents(undefined)).toEqual([]);
    });

    test('sollte ungültige Heartbeat-Daten behandeln', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      const heartbeats = [
        {
          timestamp: baseTime,
          data: {} // Keine gültigen Aktivitätsdaten
        },
        {
          timestamp: baseTime + 30000,
          data: null
        },
        {
          timestamp: baseTime + 60000
          // Keine data Property
        }
      ];

      const result = generator.generateTimelineEvents(heartbeats);
      expect(result).toHaveLength(0);
    });

    test('sollte das aktuelle Intervall für die Aggregation verwenden', () => {
      const baseTime = new Date('2024-03-20T10:00:00Z').getTime();
      // Genug Heartbeats für 15 Minuten (30 Heartbeats)
      const heartbeats = Array(30).fill(null).map((_, i) => ({
        timestamp: baseTime + (i * 30000),
        data: {
          appWindow: { app: 'VS Code', title: 'test.js' }
        }
      }));

      // Setze 15-Minuten-Intervall
      generator.setAggregationInterval(15);
      
      const result = generator.generateTimelineEvents(heartbeats);
      
      // Mit 15-Minuten-Intervall sollte es nur ein Event geben
      expect(result).toHaveLength(1);
      expect(result[0].duration).toBe(15 * 60 * 1000);
    });
  });

  describe('Zusammenfassungsberechnung', () => {
    test('sollte korrekte Zusammenfassung für verschiedene Aktivitätstypen berechnen', () => {
      const events = [
        {
          timestamp: new Date('2024-03-20T10:00:00Z').getTime(),
          duration: 60 * 60 * 1000, // 1 Stunde
          type: 'teamsMeeting',
          data: { title: 'Daily', status: 'active' }
        },
        {
          timestamp: new Date('2024-03-20T11:00:00Z').getTime(),
          duration: 30 * 60 * 1000, // 30 Minuten
          type: 'inactive',
          data: { reason: 'User inactive' }
        },
        {
          timestamp: new Date('2024-03-20T11:30:00Z').getTime(),
          duration: 90 * 60 * 1000, // 1.5 Stunden
          type: 'appWindow',
          data: { app: 'VS Code', title: 'test.js' }
        }
      ];

      const summary = generator.calculateSummary(events);
      expect(summary.activeTrackingDuration).toBe(180 * 60 * 1000); // 3 Stunden total
      expect(summary.totalActiveDuration).toBe(150 * 60 * 1000); // 2.5 Stunden aktiv
      expect(summary.totalInactiveDuration).toBe(30 * 60 * 1000); // 30 Minuten inaktiv
      expect(summary.totalMeetingDuration).toBe(60 * 60 * 1000); // 1 Stunde Meeting
    });

    test('sollte leere Zusammenfassung für keine Events zurückgeben', () => {
      const summary = generator.calculateSummary([]);
      expect(summary).toEqual({
        activeTrackingDuration: 0,
        totalActiveDuration: 0,
        totalInactiveDuration: 0,
        totalMeetingDuration: 0
      });
    });
  });
}); 