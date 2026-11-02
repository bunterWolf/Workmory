import formatActivityTitle from './formatActivityTitle';

describe('formatActivityTitle', () => {
  it('joins app and window title with " · "', () => {
    expect(formatActivityTitle({ app: 'Figma', title: 'Workmory' })).toBe('Figma · Workmory');
  });

  it('falls back to the app name for an empty title', () => {
    expect(formatActivityTitle({ app: 'Figma', title: '' })).toBe('Figma');
  });

  it('falls back to the app name for a missing title', () => {
    expect(formatActivityTitle({ app: 'Figma' })).toBe('Figma');
  });

  it('returns null without an app window', () => {
    expect(formatActivityTitle(null)).toBeNull();
  });
});
