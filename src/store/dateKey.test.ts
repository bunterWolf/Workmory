import { toLocalDateKey } from './dateKey';
import { AggregationManager } from './AggregationManager';
import TimelineGenerator from './TimelineGenerator';
import { ActivityState } from './ActivityState';

test('toLocalDateKey nutzt das lokale Datum', () => {
  expect(toLocalDateKey(new Date('2026-03-05T00:30:00').getTime())).toBe('2026-03-05');
  expect(toLocalDateKey(new Date('2026-03-04T23:59:59').getTime())).toBe('2026-03-04');
});

test('AggregationManager behandelt den lokalen Tag kurz nach Mitternacht als heute', () => {
  const realNow = Date.now;
  const now = new Date('2026-03-05T00:30:00').getTime();
  Date.now = () => now;
  try {
    const state = new ActivityState();
    const manager = new AggregationManager(new TimelineGenerator(5), state); // Cache für heute: null
    // 10 Heartbeats im abgeschlossenen Intervall 00:10–00:15 ergeben einen Block
    const base = new Date('2026-03-05T00:10:15').getTime();
    state.setHeartbeats('2026-03-05', Array.from({ length: 10 }, (_, i) => (
      { timestamp: base + i * 30000, data: { userActivity: 'active', appWindow: { app: 'VS Code', title: 'a.ts' } } } as any)));
    expect(manager.aggregateAndCacheDay('2026-03-05')).toBe(true); // heute: Cache wird aktualisiert (mit UTC-Schlüssel: false)
  } finally {
    Date.now = realNow;
  }
});
