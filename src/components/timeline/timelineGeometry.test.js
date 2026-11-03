import {
  MIN_BLOCK_HEIGHT,
  EVENT_OFFSET_Y,
  MIN_EVENT_HEIGHT,
  GRID_STEP_MIN,
  getHourHeight,
  getTimeRange,
  getGridMarks,
  getEventGeometry,
  getScrollTarget,
} from './timelineGeometry';

// Local-time timestamps: the geometry code uses getHours()/getMinutes(),
// so the tests must not depend on the machine's timezone.
const at = (h, m = 0) => new Date(2026, 0, 5, h, m).getTime();
const MIN = 60 * 1000;
const ev = (startH, startM, durationMin) => ({ timestamp: at(startH, startM), duration: durationMin * MIN });
const hm = (h, m = 0) => h * 60 + m; // minutes since local midnight

// 10 min interval: 144 px per hour
const PX = 2.4;
const range = (opts) => getTimeRange({ events: [], trackingBlock: null, isToday: false, pxPerMin: PX, viewportContentHeight: 0, ...opts });

describe('getHourHeight', () => {
  it('exposes the minimum block height', () => {
    expect(MIN_BLOCK_HEIGHT).toBe(24);
  });

  it('scales inversely with the aggregation interval', () => {
    expect(getHourHeight(5)).toBe(288);
    expect(getHourHeight(10)).toBe(144);
    expect(getHourHeight(15)).toBe(96);
  });
});

describe('getTimeRange', () => {
  it('starts at the first block and ends with the last one (no extra empty time)', () => {
    // 09:00–10:00 and 11:00–11:30
    expect(range({ events: [ev(9, 0, 60), ev(11, 0, 30)] })).toEqual({ startMin: hm(9), endMin: hm(11, 30) });
  });

  it('includes the running block today, also before or after the events', () => {
    const block = ev(14, 10, 10);
    expect(range({ trackingBlock: block, isToday: true })).toEqual({ startMin: hm(14, 10), endMin: hm(14, 20) });
    expect(range({ events: [ev(9, 0, 60)], trackingBlock: block, isToday: true })).toEqual({ startMin: hm(9), endMin: hm(14, 20) });
    expect(range({ events: [ev(15, 0, 60)], trackingBlock: ev(8, 0, 10), isToday: true })).toEqual({ startMin: hm(8), endMin: hm(16) });
  });

  it('ignores the running block when the day is not today', () => {
    expect(range({ events: [ev(9, 0, 60)], trackingBlock: ev(14, 10, 10), isToday: false })).toEqual({ startMin: hm(9), endMin: hm(10) });
  });

  it('keeps an event that ends exactly at midnight inside the day', () => {
    expect(range({ events: [ev(23, 0, 60)] }).endMin).toBe(hm(24));
  });

  it('fills a short day to the viewport in whole blocks without causing a scroll', () => {
    // 09:00–09:30 = 72 px; viewport content 300 px → 12 blocks of 24 px = 288 px = 120 min
    const r = range({ events: [ev(9, 0, 30)], viewportContentHeight: 300 });
    expect(r).toEqual({ startMin: hm(9), endMin: hm(11) });
    expect((r.endMin - r.startMin) * PX).toBeLessThanOrEqual(300);
  });

  it('never shrinks a range that is taller than the viewport', () => {
    expect(range({ events: [ev(9, 0, 240)], viewportContentHeight: 300 })).toEqual({ startMin: hm(9), endMin: hm(13) });
  });

  it('fills upward when the end is already at midnight', () => {
    // 23:00–23:30 → 120 min fit, end clamped at 24:00 → start moves up to 22:00
    expect(range({ events: [ev(23, 0, 30)], viewportContentHeight: 300 })).toEqual({ startMin: hm(22), endMin: hm(24) });
  });

  it('keeps every event on a whole pixel for 5/10/15 min intervals, also when filling', () => {
    for (const interval of [5, 10, 15]) {
      const px = getHourHeight(interval) / 60;
      const events = [ev(9, interval, interval), ev(10, 0, 2 * interval), ev(23, 60 - interval, interval)];
      for (const viewportContentHeight of [0, 301, 5000]) {
        const { startMin } = range({ events, pxPerMin: px, viewportContentHeight });
        events.forEach((e) => expect(Number.isInteger(getEventGeometry(e, startMin, px).top)).toBe(true));
      }
    }
  });
});

describe('getGridMarks', () => {
  it('uses a 30 min grid', () => {
    expect(GRID_STEP_MIN).toBe(30);
  });

  it('returns hour lines and half-hour markers inside the range, starting at the first grid minute', () => {
    expect(getGridMarks(hm(8, 50), hm(10, 30), PX)).toEqual([
      { minute: hm(9), top: 24, isHour: true },
      { minute: hm(9, 30), top: 96, isHour: false },
      { minute: hm(10), top: 168, isHour: true },
    ]);
  });

  it('puts the hour line at the top when the range starts on the hour (Figma: event 1px below it)', () => {
    expect(getGridMarks(hm(9), hm(10), PX)[0]).toEqual({ minute: hm(9), top: 0, isHour: true });
  });

  it('places marks on whole pixels for interval-aligned starts', () => {
    for (const interval of [5, 10, 15]) {
      const px = getHourHeight(interval) / 60;
      getGridMarks(hm(8, interval), hm(12), px).forEach((m) => expect(Number.isInteger(m.top)).toBe(true));
    }
  });
});

describe('getEventGeometry (Figma rules)', () => {
  it('exposes the event offset and minimum height', () => {
    expect(EVENT_OFFSET_Y).toBe(1);
    expect(MIN_EVENT_HEIGHT).toBe(14);
  });

  it('sits 1px below its grid line and uses the full duration as height', () => {
    // 09:30 is 90 min after 08:00 -> 90 * 1.6 = 144, + 1px offset = 145; 15 min * 1.6 = 24
    expect(getEventGeometry(ev(9, 30, 15), hm(8), 1.6)).toEqual({ top: 145, height: 24 });
  });

  it('measures from a half-hour range start', () => {
    // 09:00 is 30 min after 08:30 -> 30 * 2.4 = 72, + 1 = 73
    expect(getEventGeometry(ev(9, 0, 10), hm(8, 30), 2.4)).toEqual({ top: 73, height: 24 });
  });

  it('gives a 5 min block at the 5 min interval the full 24px', () => {
    // getHourHeight(5) = 288 -> 4.8 px/min; 5 min * 4.8 = 24
    expect(getEventGeometry(ev(9, 0, 5), hm(8), 4.8).height).toBe(24);
  });

  it('floors the height at 14px for very short events', () => {
    expect(getEventGeometry(ev(9, 30, 1), hm(8), 1.6).height).toBe(14);
  });
});

describe('getScrollTarget', () => {
  it('scrolls so the block bottom sits padY above the viewport bottom', () => {
    // 30 + 500 + 24 + 30 - 300 = 284
    expect(getScrollTarget({ blockTop: 500, blockHeight: 24, viewportHeight: 300, padY: 30 })).toBe(284);
  });

  it('does not scroll when the block is already near the top', () => {
    expect(getScrollTarget({ blockTop: 10, blockHeight: 24, viewportHeight: 300, padY: 30 })).toBe(0);
  });

  it('never returns a negative offset when the content is smaller than the viewport', () => {
    expect(getScrollTarget({ blockTop: 50, blockHeight: 24, viewportHeight: 800, padY: 30 })).toBe(0);
  });
});
