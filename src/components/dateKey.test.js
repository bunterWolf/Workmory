import { toLocalDateKey, getYesterdayDateKey } from './dateKey';

// All dates are built from local components, so the tests hold in any timezone.
describe('toLocalDateKey', () => {
  it('uses the local date just after local midnight (not the UTC date)', () => {
    expect(toLocalDateKey(new Date(2026, 2, 29, 0, 30))).toBe('2026-03-29');
  });

  it('uses the local date late in the evening', () => {
    expect(toLocalDateKey(new Date(2026, 2, 29, 23, 59, 59))).toBe('2026-03-29');
  });

  it('zero-pads month and day', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
    expect(toLocalDateKey(new Date(2026, 8, 9, 12))).toBe('2026-09-09');
  });

  it('does not pad double-digit month and day', () => {
    expect(toLocalDateKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31');
  });

  it('defaults to the current date', () => {
    const now = new Date();
    expect(toLocalDateKey()).toBe(toLocalDateKey(now));
  });
});

describe('getYesterdayDateKey', () => {
  it('crosses a month boundary', () => {
    expect(getYesterdayDateKey(new Date(2026, 3, 1, 0, 30))).toBe('2026-03-31');
  });

  it('crosses a year boundary', () => {
    expect(getYesterdayDateKey(new Date(2026, 0, 1, 12))).toBe('2025-12-31');
  });

  it('is the previous calendar day across a DST change (local date arithmetic)', () => {
    expect(getYesterdayDateKey(new Date(2026, 2, 29, 0, 30))).toBe('2026-03-28');
    expect(getYesterdayDateKey(new Date(2026, 2, 30, 0, 30))).toBe('2026-03-29');
    expect(getYesterdayDateKey(new Date(2026, 9, 25, 0, 30))).toBe('2026-10-24');
    expect(getYesterdayDateKey(new Date(2026, 9, 26, 0, 30))).toBe('2026-10-25');
  });

  it('does not mutate the given date', () => {
    const now = new Date(2026, 3, 1, 12);
    getYesterdayDateKey(now);
    expect(toLocalDateKey(now)).toBe('2026-04-01');
  });
});
