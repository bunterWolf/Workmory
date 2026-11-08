import { ActivityState } from './ActivityState';
import { backfillAbsence, findLastActiveTimestamp } from './AbsenceBackfill';

const at = (iso: string) => new Date(iso).getTime(); // lokale Zeit, ohne Z
const hb = (iso: string, userActivity: string) => ({ timestamp: at(iso), data: { userActivity } }) as any;
const statuses = (state: ActivityState, key: string) => state.getHeartbeats(key)!.map((h) => h.data.userActivity);

test('backfillAbsence erreicht den Vortag über Mitternacht', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-04', [hb('2026-03-04T23:55:00', 'active'), hb('2026-03-04T23:58:00', 'may_be_inactive'), hb('2026-03-04T23:59:30', 'may_be_inactive')]);
  state.setHeartbeats('2026-03-05', [hb('2026-03-05T00:01:00', 'may_be_inactive')]);
  backfillAbsence(state, at('2026-03-05T00:01:30'));
  expect(statuses(state, '2026-03-04')).toEqual(['active', 'inactive', 'inactive']);
  expect(statuses(state, '2026-03-05')).toEqual(['inactive']);
});

test('backfillAbsence hält an einer Lücke an (Workmory war nicht aktiv)', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-05', [hb('2026-03-05T16:00:00', 'may_be_inactive'), hb('2026-03-05T17:00:00', 'active'), hb('2026-03-05T17:02:00', 'may_be_inactive')]);
  state.setHeartbeats('2026-03-09', [hb('2026-03-09T08:00:00', 'may_be_inactive')]);
  backfillAbsence(state, at('2026-03-09T08:01:00'));
  expect(statuses(state, '2026-03-05')).toEqual(['may_be_inactive', 'active', 'may_be_inactive']); // 4-Tage-Lücke stoppt den Lauf
  expect(statuses(state, '2026-03-09')).toEqual(['inactive']);
});

test('backfillAbsence ohne active in der Historie wandelt alles davor um und wirft nicht', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-04', [hb('2026-03-04T10:00:00', 'may_be_inactive')]);
  expect(() => backfillAbsence(state, at('2026-03-04T10:00:30'))).not.toThrow();
  expect(statuses(state, '2026-03-04')).toEqual(['inactive']);
});

test('backfillAbsence hält an einer Lücke am selben Tag an', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-04', [hb('2026-03-04T10:00:00', 'active'), hb('2026-03-04T10:01:00', 'may_be_inactive'), hb('2026-03-04T10:06:00', 'may_be_inactive')]);
  backfillAbsence(state, at('2026-03-04T10:06:30'));
  expect(statuses(state, '2026-03-04')).toEqual(['active', 'may_be_inactive', 'inactive']);
});

test('backfillAbsence lässt Heartbeats ab untilTs unberührt', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-04', [hb('2026-03-04T10:00:00', 'active'), hb('2026-03-04T10:00:30', 'may_be_inactive'), hb('2026-03-04T10:01:00', 'may_be_inactive'), hb('2026-03-04T10:01:30', 'may_be_inactive')]);
  backfillAbsence(state, at('2026-03-04T10:01:00'));
  expect(statuses(state, '2026-03-04')).toEqual(['active', 'inactive', 'may_be_inactive', 'may_be_inactive']);
});

test('findLastActiveTimestamp sucht über Tage', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-04', [hb('2026-03-04T23:52:00', 'active')]);
  state.setHeartbeats('2026-03-05', [hb('2026-03-05T00:01:00', 'may_be_inactive')]);
  expect(findLastActiveTimestamp(state, at('2026-03-05T07:30:00'))).toBe(at('2026-03-04T23:52:00'));
  expect(findLastActiveTimestamp(state, at('2026-03-04T23:00:00'))).toBeNull();
});
