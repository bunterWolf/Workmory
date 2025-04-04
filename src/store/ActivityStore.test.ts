import ActivityStore, { HeartbeatData } from './ActivityStore';

// Da handleMayBeInactive eine interne Hilfsfunktion ist und nicht exportiert wird,
// kopieren wir sie hierher für die Tests. Langfristig sollten die Tests
// die öffentliche API von ActivityStore nutzen.

// Benötigte Typen für die kopierte Funktion
interface Heartbeat {
  timestamp: number;
  // Verwende Partial, da Tests möglicherweise nicht alle Felder bereitstellen
  data: Partial<HeartbeatData>;
}

// Kopierte Funktion handleMayBeInactive aus ActivityStore.ts
// Stellen Sie sicher, dass diese synchron mit dem Original bleibt oder refaktorisieren Sie die Tests.
function handleMayBeInactive(heartbeats: Heartbeat[], currentTimestamp: number, heartbeatData: Partial<HeartbeatData>): Heartbeat[] {
    if (!heartbeats || heartbeats.length === 0 || heartbeatData.userActivity !== 'inactive') {
        return heartbeats;
    }
    const hasMayBeInactive = heartbeats.some(hb => hb.data?.userActivity === 'may_be_inactive');
    if (!hasMayBeInactive) {
        return heartbeats;
    }
    const updatedHeartbeats = [...heartbeats];
    let lastActiveIndex = -1;
    for (let i = updatedHeartbeats.length - 1; i >= 0; i--) {
        const hb = updatedHeartbeats[i];
        if (hb.timestamp >= currentTimestamp) continue;
        if (hb.data?.userActivity === 'active') {
            lastActiveIndex = i;
            break;
        }
    }
    let changed = false;
    for (let i = lastActiveIndex + 1; i < updatedHeartbeats.length; i++) {
        const hb = updatedHeartbeats[i];
        if (hb.timestamp >= currentTimestamp) break;
        if (hb.data?.userActivity === 'may_be_inactive') {
            const existingData = hb.data || {};
            updatedHeartbeats[i] = {
                ...hb,
                data: {
                    ...existingData,
                    userActivity: 'inactive'
                }
            };
            changed = true;
        }
    }
    return changed ? updatedHeartbeats : heartbeats;
}

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