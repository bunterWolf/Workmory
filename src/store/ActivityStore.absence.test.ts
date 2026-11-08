import fs from 'fs';
import ActivityStore, { Heartbeat } from './ActivityStore';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/jest-user-data'),
    getAppPath: jest.fn(() => '/mock/app/path'),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
}), { virtual: true });

const MIN = 60000;
const STORE_FILE = '/tmp/nonexistent/activity-absence-test.json';
const at = (iso: string) => new Date(iso).getTime(); // lokale Zeit, ohne Z

interface Phase { from: number; to: number; input?: boolean; sleep?: boolean; gap?: boolean }

describe('Abwesenheit und Ruhemodus', () => {
  let store: ActivityStore;
  let originalDateNow: () => number;

  const state = () => (store as any).activityState;

  // Heartbeats bei :15/:45 für Phasen in Minuten ab base. Status aus der Wandzeit seit der letzten Eingabe.
  function simulate(base: string, phases: Phase[], lastInputStart: number = at(base)): void {
    let lastInput = lastInputStart;
    for (const p of phases) {
      if (p.sleep) store.markSuspend(at(base) + p.from * MIN);
      if (p.sleep || p.gap) continue;
      for (let t = at(base) + p.from * MIN + 15000; t < at(base) + p.to * MIN; t += 30000) {
        if (p.input) lastInput = t;
        const idle = t - lastInput;
        Date.now = jest.fn(() => t);
        store.addHeartbeat({ userActivity: idle < 60000 ? 'active' : idle < 600000 ? 'may_be_inactive' : 'inactive' });
      }
    }
  }

  function statusCounts(fromIso: string, toIso: string) {
    const counts = { active: 0, may_be_inactive: 0, inactive: 0, total: 0 };
    for (const day of state().getAvailableDates()) {
      for (const hb of state().getHeartbeats(day) as Heartbeat[]) {
        if (hb.timestamp < at(fromIso) || hb.timestamp >= at(toIso)) continue;
        counts[hb.data.userActivity as 'active' | 'may_be_inactive' | 'inactive']++;
        counts.total++;
      }
    }
    return counts;
  }

  function startStoreAt(iso: string): void {
    Date.now = jest.fn(() => at(iso));
    store.startTracking();
  }

  beforeEach(() => {
    originalDateNow = Date.now;
    store = new ActivityStore({ useMockData: false, storagePath: STORE_FILE });
  });

  afterEach(() => {
    Date.now = originalDateNow;
    store.cleanup();
    try { fs.unlinkSync(STORE_FILE); } catch (e) { /* Ignorieren */ }
    try { fs.rmdirSync('/tmp/nonexistent'); } catch (e) { /* Ignorieren */ }
  });

  const BASE = '2026-03-04T08:00:00';
  const work = { from: 0, to: 60, input: true };

  test('8 min weg, dann 10 min Ruhemodus', () => {
    startStoreAt(BASE);
    simulate(BASE, [work, { from: 60, to: 68 }, { from: 68, to: 78, sleep: true }, { from: 78, to: 90, input: true }]);
    const c = statusCounts('2026-03-04T09:00:45', '2026-03-04T09:08:00');
    expect(c.total).toBeGreaterThan(0);
    expect(c.may_be_inactive).toBe(0);
    expect(c.inactive).toBe(c.total);
  });

  test('2 min weg, dann 3 min Ruhemodus', () => {
    startStoreAt(BASE);
    simulate(BASE, [work, { from: 60, to: 62 }, { from: 62, to: 65, sleep: true }, { from: 65, to: 80, input: true }]);
    const c = statusCounts(BASE, '2026-03-04T10:00:00');
    expect(c.may_be_inactive).toBeGreaterThan(0);
    expect(c.inactive).toBe(0);
  });

  test('Deckel sofort zu, 60 min', () => {
    startStoreAt(BASE);
    simulate(BASE, [work, { from: 60, to: 120, sleep: true }, { from: 120, to: 135, input: true }]);
    expect(statusCounts(BASE, '2026-03-04T11:00:00').inactive).toBe(0);
    expect(statusCounts('2026-03-04T09:00:30', '2026-03-04T10:00:00').total).toBe(0);
  });

  test('9 min weg ohne Ruhemodus', () => {
    startStoreAt(BASE);
    simulate(BASE, [work, { from: 60, to: 69 }, { from: 69, to: 80, input: true }]);
    const c = statusCounts(BASE, '2026-03-04T10:00:00');
    expect(c.may_be_inactive).toBeGreaterThan(0);
    expect(c.inactive).toBe(0);
  });

  test('Lücke ohne suspend zählt nicht', () => {
    startStoreAt(BASE);
    simulate(BASE, [work, { from: 60, to: 68 }, { from: 68, to: 78, gap: true }, { from: 78, to: 90, input: true }]);
    const c = statusCounts(BASE, '2026-03-04T10:00:00');
    expect(c.may_be_inactive).toBeGreaterThan(0);
    expect(c.inactive).toBe(0);
  });

  test('ignoriert suspend bei pausiertem Tracking', () => {
    startStoreAt(BASE);
    simulate(BASE, [work, { from: 60, to: 68 }]);
    Date.now = jest.fn(() => at('2026-03-04T09:08:00'));
    store.pauseTracking();
    store.markSuspend();
    startStoreAt('2026-03-04T09:18:00');
    simulate(BASE, [{ from: 78, to: 90, input: true }]);
    const c = statusCounts(BASE, '2026-03-04T10:00:00');
    expect(c.may_be_inactive).toBeGreaterThan(0);
    expect(c.inactive).toBe(0);
  });

  test('erster Heartbeat nach Aufwachen ist inactive', () => {
    startStoreAt(BASE);
    simulate(BASE, [work, { from: 60, to: 68 }, { from: 68, to: 78, sleep: true }, { from: 78, to: 79 }, { from: 79, to: 90, input: true }]);
    const c = statusCounts('2026-03-04T09:00:45', '2026-03-04T09:08:00');
    expect(c.may_be_inactive).toBe(0);
    expect(c.inactive).toBe(c.total);
  });

  test('Ruhemodus ohne active in der Historie', () => {
    startStoreAt(BASE);
    for (let i = 0; i < 3; i++) {
      Date.now = jest.fn(() => at(BASE) + 15000 + i * 30000);
      store.addHeartbeat({ userActivity: 'may_be_inactive' });
    }
    store.markSuspend(at(BASE) + 2 * MIN);
    Date.now = jest.fn(() => at(BASE) + 22 * MIN);
    expect(() => store.addHeartbeat({ userActivity: 'active' })).not.toThrow();
    expect(statusCounts(BASE, '2026-03-04T08:05:00').may_be_inactive).toBe(3);
  });

  test('über Mitternacht mit Ruhemodus', () => {
    const base = '2026-03-06T23:00:00';
    startStoreAt(base);
    simulate(base, [
      { from: 0, to: 52, input: true }, { from: 52, to: 62 },
      { from: 62, to: 510, sleep: true }, { from: 510, to: 540, input: true },
    ]);
    const before = statusCounts('2026-03-06T23:53:00', '2026-03-07T00:00:00');
    const after = statusCounts('2026-03-07T00:00:00', '2026-03-07T00:02:00');
    expect(before.total).toBeGreaterThan(0);
    expect(before.inactive).toBe(before.total);
    expect(after.total).toBeGreaterThan(0);
    expect(after.inactive).toBe(after.total);
    expect(statusCounts('2026-03-07T00:02:00', '2026-03-07T07:30:00').total).toBe(0);
  });

  test('Freitag bis Montag', () => {
    const base = '2026-03-06T16:00:00';
    startStoreAt(base);
    simulate(base, [
      { from: 0, to: 60, input: true }, { from: 60, to: 68 },
      { from: 68, to: 3840, sleep: true }, { from: 3840, to: 3870, input: true },
    ]);
    const c = statusCounts('2026-03-06T17:01:00', '2026-03-06T17:08:00');
    expect(c.total).toBeGreaterThan(0);
    expect(c.inactive).toBe(c.total);
    expect(statusCounts('2026-03-07T00:00:00', '2026-03-09T08:00:00').total).toBe(0);
  });
});
