import { HeartbeatData, Heartbeat } from './ActivityStore';
import { handleMayBeInactive } from './ActivityStorage';
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

describe('Activity Utilities', () => {
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