import ActivityStore, { HeartbeatData, Heartbeat, handleMayBeInactive } from './ActivityStore';

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