const { updateInactiveHeartbeats } = require('./ActivityStore');

describe('ActivityStore Utilities', () => {
  describe('updateInactiveHeartbeats', () => {
    test('sollte may_be_inactive zu inactive umwandeln', () => {
      const currentTime = new Date('2024-03-20T10:05:00Z').getTime();
      
      // Beispiel Heartbeats mit Sequenz: active -> may_be_inactive -> may_be_inactive -> inactive
      const heartbeats = [
        {
          timestamp: new Date('2024-03-20T10:00:00Z').getTime(),
          data: {
            userActivity: 'active',
            appWindow: { app: 'VS Code', title: 'test.js' }
          }
        },
        {
          timestamp: new Date('2024-03-20T10:01:00Z').getTime(),
          data: {
            userActivity: 'may_be_inactive',
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
            userActivity: 'inactive'
          }
        }
      ];
      
      const result = updateInactiveHeartbeats(heartbeats, currentTime);
      
      // Prüfe, ob alle may_be_inactive zu inactive umgewandelt wurden
      expect(result[1].data.userActivity).toBe('inactive');
      expect(result[2].data.userActivity).toBe('inactive');
      
      // Prüfe, ob active unverändert bleibt
      expect(result[0].data.userActivity).toBe('active');
      
      // Prüfe, ob bereits als inactive markierte Heartbeats unverändert bleiben
      expect(result[3].data.userActivity).toBe('inactive');
    });
    
    test('sollte Sequenz von active zu may_be_inactive korrekt handeln', () => {
      const currentTime = new Date('2024-03-20T10:05:00Z').getTime();
      
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
      
      const result = updateInactiveHeartbeats(heartbeats, currentTime);
      
      // Überprüfe nur die may_be_inactive nach dem letzten active
      expect(result[0].data.userActivity).toBe('active');
      expect(result[1].data.userActivity).toBe('may_be_inactive'); // Bleibt unverändert, da vor einem aktiven Heartbeat
      expect(result[2].data.userActivity).toBe('active');
      expect(result[3].data.userActivity).toBe('inactive'); // wird umgewandelt
      expect(result[4].data.userActivity).toBe('inactive'); // wird umgewandelt
    });
    
    test('sollte mit leeren oder ungültigen Eingaben umgehen können', () => {
      const currentTime = Date.now();
      
      // Prüfe leeres Array
      expect(updateInactiveHeartbeats([], currentTime)).toEqual([]);
      
      // Prüfe undefined
      expect(updateInactiveHeartbeats(undefined, currentTime)).toBeUndefined();
      
      // Prüfe null
      expect(updateInactiveHeartbeats(null, currentTime)).toBeNull();
      
      // Prüfe unvollständige Heartbeat-Objekte
      const invalidHeartbeats = [
        { timestamp: currentTime - 1000 }, // Kein data-Feld
        { timestamp: currentTime - 2000, data: null }, // data ist null
        { timestamp: currentTime - 3000, data: {} } // Leeres data-Objekt
      ];
      
      const result = updateInactiveHeartbeats(invalidHeartbeats, currentTime);
      expect(result).toHaveLength(3); // Sollte die gleiche Länge haben
      // Keine Fehler werfen
    });
  });
}); 