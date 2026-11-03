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

  it('returns just the title for an empty app name', () => {
    expect(formatActivityTitle({ app: '', title: 'Workmory' })).toBe('Workmory');
    expect(formatActivityTitle({ title: 'Workmory' })).toBe('Workmory');
  });

  it('returns null (so the default text shows) without app and without title', () => {
    expect(formatActivityTitle({ app: '', title: '' })).toBeNull();
    expect(formatActivityTitle({})).toBeNull();
  });

  it('returns null without an app window', () => {
    expect(formatActivityTitle(null)).toBeNull();
  });
});
