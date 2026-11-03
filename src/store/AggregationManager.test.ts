import { AggregationManager } from './AggregationManager';
import { ActivityState } from './ActivityState';
import TimelineGenerator from './TimelineGenerator';
import { Heartbeat } from './ActivityStore';

/**
 * The "today" cache of AggregationManager must roll over at the user's LOCAL
 * midnight, using the same local YYYY-MM-DD key as ActivityStore stores
 * heartbeats under. All timestamps below are built from local date parts, so
 * the expectations hold in every timezone. In UTC they pass trivially; run
 * them with e.g. TZ=Europe/Berlin and TZ=Pacific/Honolulu to cover offsets on
 * both sides of UTC.
 */

/** Local wall-clock time on 2026-11-02/03 (month index 10 = November). */
const local = (day: number, hours: number, minutes: number, seconds = 0): number =>
    new Date(2026, 10, day, hours, minutes, seconds).getTime();

const HEARTBEAT_MS = 30 * 1000;

const heartbeatsBetween = (from: number, toExclusive: number, app: string): Heartbeat[] => {
    const result: Heartbeat[] = [];
    for (let t = from; t < toExclusive; t += HEARTBEAT_MS) {
        result.push({
            timestamp: t,
            data: { userActivity: 'active', appWindow: { app, title: `${app} window` } },
        } as Heartbeat);
    }
    return result;
};

describe('AggregationManager – local "today" date key', () => {
    let now: number;
    let state: ActivityState;
    let generator: TimelineGenerator;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        now = 0;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        state = new ActivityState();
        generator = new TimelineGenerator(5);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test.each([
        ['00:00:30', 0, 0, 30],
        ['00:30', 0, 30, 0],
        ['12:00', 12, 0, 0],
        ['23:30', 23, 30, 0],
        ['23:59:30', 23, 59, 30],
    ])('treats the local day as "today" at local %s (interval aggregation is not skipped)', (_label, h, m, s) => {
        now = local(3, h, m, s);
        const dayStart = local(3, 0, 0);
        state.setHeartbeats('2026-11-03', heartbeatsBetween(dayStart, now + 1, 'Editor'));

        const manager = new AggregationManager(generator, state);
        manager.clearCache();

        // ActivityStore.triggerTodaysAggregation passes its local key; this must be
        // recognised as today, otherwise no update is cached nor pushed to the UI.
        expect(manager.aggregateAndCacheDay('2026-11-03')).toBe(true);
    });

    test('rolls the cache over at local midnight, so yesterday is not served from a stale cache', () => {
        // Evening of Nov 2: the interval aggregation caches the day so far.
        now = local(2, 23, 50);
        state.setHeartbeats('2026-11-02', heartbeatsBetween(local(2, 23, 30), now, 'Editor'));
        const manager = new AggregationManager(generator, state);
        manager.aggregateAndCacheDay('2026-11-02');
        const snapshotAt2350 = manager.getAggregatedDataForDay('2026-11-02');

        // The last minutes of Nov 2 are tracked after that snapshot...
        const allOfNov2 = [
            ...state.getHeartbeats('2026-11-02')!,
            ...heartbeatsBetween(local(2, 23, 50), local(3, 0, 0), 'Browser'),
        ];
        state.setHeartbeats('2026-11-02', allOfNov2);

        // ...and after local midnight the store has moved on to Nov 3.
        now = local(3, 0, 30);
        state.setHeartbeats('2026-11-03', heartbeatsBetween(local(3, 0, 0), now, 'Editor'));
        manager.aggregateAndCacheDay('2026-11-03');

        const expected = generator.calculateSummary(generator.generateTimelineEvents(allOfNov2));
        expect(JSON.stringify(expected)).not.toEqual(JSON.stringify(snapshotAt2350!.summary)); // sanity

        expect(manager.getAggregatedDataForDay('2026-11-02')!.summary).toEqual(expected);
    });
});
