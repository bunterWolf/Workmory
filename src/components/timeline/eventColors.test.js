import { parseHexColor, blendOver } from './eventColors';

describe('parseHexColor', () => {
  it('parses #rrggbb with full alpha', () => {
    expect(parseHexColor('#4750cb')).toEqual({ r: 71, g: 80, b: 203, a: 1 });
  });

  it('parses #rrggbbaa with alpha in 0..1', () => {
    expect(parseHexColor('#ff57571a')).toEqual({ r: 255, g: 87, b: 87, a: 26 / 255 });
  });

  it('is case-insensitive', () => {
    expect(parseHexColor('#FF5757')).toEqual({ r: 255, g: 87, b: 87, a: 1 });
  });

  it.each(['red', '#fff', '#12345', '#1234567', '4750cb', '#gggggg', ''])(
    'throws for invalid input %p',
    (input) => {
      expect(() => parseHexColor(input)).toThrow(Error);
    }
  );
});

describe('blendOver', () => {
  // Light scheme: EventInkMix = #00000066, dark scheme: #ffffff66
  it.each([
    ['#4750cb', '#00000066', '#2b307a'],
    ['#4750cb', '#ffffff66', '#9196e0'],
    ['#1a73e8', '#00000066', '#10458b'],
    ['#1a73e8', '#ffffff66', '#76abf1'],
    ['#d77655', '#00000066', '#814733'],
    ['#0f773d', '#ffffff66', '#6fad8b'],
  ])('blends %s with %s to %s', (base, overlay, expected) => {
    expect(blendOver(base, overlay)).toBe(expected);
  });

  it('returns the base for a fully transparent overlay', () => {
    expect(blendOver('#4750cb', '#ffffff00')).toBe('#4750cb');
  });

  it('returns the overlay for a fully opaque overlay', () => {
    expect(blendOver('#4750cb', '#ABCDEF')).toBe('#abcdef');
  });
});
