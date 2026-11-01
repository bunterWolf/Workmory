import {
  MIN_BLOCK_HEIGHT,
  EVENT_OFFSET_Y,
  MIN_EVENT_HEIGHT,
  getHourHeight,
  getHalfHourOffset,
  getHourRange,
  getEventGeometry,
} from './timelineGeometry';

// Local-time timestamps: the geometry code uses getHours()/getMinutes(),
// so the tests must not depend on the machine's timezone.
const at = (h, m = 0) => new Date(2026, 0, 5, h, m).getTime();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const ev = (startH, startM, durationMin) => ({ timestamp: at(startH, startM), duration: durationMin * MIN });

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

describe('getHourRange', () => {
  it('defaults to 8-12 without events and without tracking block', () => {
    expect(getHourRange({ events: [], trackingBlock: null, isToday: true })).toEqual({ minHour: 8, maxHour: 12 });
  });

  it('centers on the tracking block when there are no events (today)', () => {
    const trackingBlock = { timestamp: at(14, 10), duration: 15 * MIN };
    expect(getHourRange({ events: [], trackingBlock, isToday: true })).toEqual({ minHour: 13, maxHour: 16 });
  });

  it('ignores the tracking block when there are no events and it is not today', () => {
    const trackingBlock = { timestamp: at(14, 10), duration: 15 * MIN };
    expect(getHourRange({ events: [], trackingBlock, isToday: false })).toEqual({ minHour: 8, maxHour: 12 });
  });

  it('pads one hour before the first event and rounds the last end up to the next hour', () => {
    const events = [ev(9, 0, 60), ev(11, 0, 30)];
    expect(getHourRange({ events, trackingBlock: null, isToday: false })).toEqual({ minHour: 8, maxHour: 12 });
  });

  it('enforces a minimum span of 3 hours', () => {
    const events = [ev(9, 0, 10)];
    // start 9 -> min 8; end hour 9 + 1 = 10 -> raised to min + 3 = 11
    expect(getHourRange({ events, trackingBlock: null, isToday: false })).toEqual({ minHour: 8, maxHour: 11 });
  });

  it('extends maxHour by half the longest event hours when an event is longer than 4h', () => {
    const events = [ev(9, 0, 6 * 60)];
    // end 15:00 -> 16; longest 6h > 4 -> min(23, 16 + 3) = 19
    expect(getHourRange({ events, trackingBlock: null, isToday: false })).toEqual({ minHour: 8, maxHour: 19 });
  });

  it('does not extend for an event of exactly 4h', () => {
    const events = [ev(9, 0, 4 * 60)];
    // end 13:00 -> 14; longest 4h is not > 4
    expect(getHourRange({ events, trackingBlock: null, isToday: false })).toEqual({ minHour: 8, maxHour: 14 });
  });

  it('clamps minHour at 0 for events just after midnight', () => {
    const events = [ev(0, 10, 20)];
    expect(getHourRange({ events, trackingBlock: null, isToday: false }).minHour).toBe(0);
  });

  it('clamps maxHour at 23 for events ending late in the evening', () => {
    const events = [ev(23, 0, 50)];
    expect(getHourRange({ events, trackingBlock: null, isToday: false }).maxHour).toBe(23);
  });

  it('widens the range to include the tracking block today', () => {
    const events = [ev(9, 0, 60)];
    const trackingBlock = { timestamp: at(15, 0), duration: 15 * MIN };
    expect(getHourRange({ events, trackingBlock, isToday: true })).toEqual({ minHour: 8, maxHour: 17 });
  });

  it('ignores the tracking block when it is not today', () => {
    const events = [ev(9, 0, 60)];
    const trackingBlock = { timestamp: at(15, 0), duration: 15 * MIN };
    expect(getHourRange({ events, trackingBlock, isToday: false })).toEqual({ minHour: 8, maxHour: 11 });
  });
});

describe('getEventGeometry (Figma rules)', () => {
  it('exposes the event offset and minimum height', () => {
    expect(EVENT_OFFSET_Y).toBe(1);
    expect(MIN_EVENT_HEIGHT).toBe(14);
  });

  it('sits 1px below the hour line and uses the full duration as height', () => {
    // 09:30 is 90 min after 08:00 -> 90 * 1.6 = 144, + 1px offset = 145; 15 min * 1.6 = 24
    expect(getEventGeometry(ev(9, 30, 15), 8, 1.6)).toEqual({ top: 145, height: 24 });
  });

  it('gives a 5 min block at the 5 min interval the full 24px', () => {
    // getHourHeight(5) = 288 -> 4.8 px/min; 5 min * 4.8 = 24
    expect(getEventGeometry(ev(9, 0, 5), 8, 4.8).height).toBe(24);
  });

  it('floors the height at 14px for very short events', () => {
    expect(getEventGeometry(ev(9, 30, 1), 8, 1.6).height).toBe(14);
  });
});

describe('getHalfHourOffset', () => {
  it('returns half the hour height, rounded', () => {
    expect(getHalfHourOffset(144)).toBe(72);
    expect(getHalfHourOffset(143)).toBe(72);
    expect(getHalfHourOffset(288)).toBe(144);
    expect(getHalfHourOffset(96)).toBe(48);
  });
});
