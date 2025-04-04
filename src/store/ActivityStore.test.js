const { handleMayBeInactive } = require('./ActivityStore');

describe('ActivityStore Utilities', () => {
  describe('handleMayBeInactive', () => {
    test('sollte may_be_inactive zu inactive umwandeln wenn userActivity inactive ist', () => {
      const currentTime = new Date('2024-03-20T10:05:00Z').getTime();
      const heartbeatData = { userActivity: 'inactive' };
      
      // Beispiel Heartbeats mit Sequenz: active -> may_be_inactive -> may_be_inactive -> inactive
      const heartbeats = [
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
      
      expect(result[0].data.userActivity).toBe('may_be_inactive'); // Prüfe, may_be_inactive ohne direkten inaktiven Heartbeat nicht zu inactive umgewandelt wird
      expect(result[1].data.userActivity).toBe('active'); // Prüfe, ob active unverändert bleibt
      expect(result[2].data.userActivity).toBe('inactive'); // Prüfe, ob alle may_be_inactive zu inactive umgewandelt wurden
      expect(result[3].data.userActivity).toBe('inactive'); // Prüfe, ob alle may_be_inactive zu inactive umgewandelt wurden
      expect(result[4].data.userActivity).toBe('inactive'); // Prüfe, ob bereits als inactive markierte Heartbeats unverändert bleiben
    });
    
    test('sollte keine Änderungen vornehmen wenn userActivity nicht inactive ist', () => {
      const currentTime = new Date('2024-03-20T10:05:00Z').getTime();
      const heartbeatData = { userActivity: 'active' };
      
      // Beispiel mit zwei active -> may_be_inactive Sequenzen
      const heartbeats = [
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
      
      // Überprüfe dass alle Heartbeats unverändert bleiben
      expect(result).toEqual(heartbeats);
    });

    test('sollte mit leeren oder ungültigen Eingaben umgehen können', () => {
      const currentTime = Date.now();
      const heartbeatData = { userActivity: 'inactive' };
      
      // Prüfe leeres Array
      expect(handleMayBeInactive([], currentTime, heartbeatData)).toEqual([]);
      
      // Prüfe undefined
      expect(handleMayBeInactive(undefined, currentTime, heartbeatData)).toBeUndefined();
      
      // Prüfe null
      expect(handleMayBeInactive(null, currentTime, heartbeatData)).toBeNull();
      
      // Prüfe unvollständige Heartbeat-Objekte
      const invalidHeartbeats = [
        { timestamp: currentTime - 1000 }, // Kein data-Feld
        { timestamp: currentTime - 2000, data: null }, // data ist null
        { timestamp: currentTime - 3000, data: {} } // Leeres data-Objekt
      ];
      
      const result = handleMayBeInactive(invalidHeartbeats, currentTime, heartbeatData);
      expect(result).toHaveLength(3); // Sollte die gleiche Länge haben
      // Keine Fehler werfen
    });
  });
}); 