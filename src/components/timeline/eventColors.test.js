import fs from 'fs';
import path from 'path';
import { eventPalette, hexToOklch, isHexColor, oklchToHex, parseHexColor, resolveAppColor } from './eventColors';

describe('resolveAppColor', () => {
  it('uses the brand color when the icon yielded one', () => {
    expect(resolveAppColor('#4750cb', '#737373')).toBe('#4750cb');
  });

  it.each([null, undefined, '', 'red'])('uses the default event color for %p', (input) => {
    expect(resolveAppColor(input, '#737373')).toBe('#737373');
  });
});

describe('isHexColor', () => {
  it.each(['#4750cb', '#FF5757', '#ff57571a'])('accepts %p', (input) => {
    expect(isHexColor(input)).toBe(true);
  });

  it.each(['red', '#fff', '', undefined, null, 42, 'rgb(1,2,3)'])('rejects %p without throwing', (input) => {
    expect(isHexColor(input)).toBe(false);
  });
});

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

describe('hexToOklch', () => {
  it('matches the reference values of pure red', () => {
    const { l, c, h } = hexToOklch('#ff0000');
    expect(l).toBeCloseTo(0.628, 3);
    expect(c).toBeCloseTo(0.2577, 3);
    expect(h).toBeCloseTo(29.23, 1);
  });

  it.each([['#ffffff', 1], ['#000000', 0]])('gives %s the lightness %d and no chroma', (hex, l) => {
    expect(hexToOklch(hex).l).toBeCloseTo(l, 3);
    expect(hexToOklch(hex).c).toBeCloseTo(0, 3);
  });
});

describe('oklchToHex', () => {
  it.each(['#2980e7', '#f5c133', '#000000', '#ffffff', '#737373'])('round-trips %s', (hex) => {
    const { l, c, h } = hexToOklch(hex);
    expect(oklchToHex(l, c, h)).toBe(hex);
  });

  it('lowers the chroma of a color outside sRGB and keeps its hue', () => {
    const hex = oklchToHex(0.93, 0.3, 255); // a pale blue cannot be that vivid
    const result = hexToOklch(hex);
    expect(result.l).toBeCloseTo(0.93, 2);
    expect(result.c).toBeLessThan(0.05);
    expect(Math.abs(result.h - 255)).toBeLessThan(3);
  });
});

const tokensCss = fs.readFileSync(path.join(__dirname, '../../styles/tokens.css'), 'utf8');
const [lightCss, darkCss] = tokensCss.split('@media (prefers-color-scheme: dark)');

function tokensFrom(css) {
  const read = (name) => parseFloat(new RegExp(`${name}:\\s*([0-9.]+)`).exec(css)[1]);
  return {
    backgroundLightness: read('--event-bg-lightness'),
    backgroundChroma: read('--event-bg-chroma'),
    textLightness: read('--event-text-lightness'),
    textChroma: read('--event-text-chroma'),
  };
}

function contrast(hexA, hexB) {
  const luminance = (hex) => {
    const { r, g, b } = parseHexColor(hex);
    const [R, G, B] = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('eventPalette', () => {
  const light = tokensFrom(lightCss);
  const dark = tokensFrom(darkCss);

  it.each([
    ['Word', '#2980e7', light, '#d9e9ff', '#1e4d87'],
    ['Word', '#2980e7', dark, '#1e2c3f', '#b3d4ff'],
    ['Explorer', '#f5c133', light, '#f2e7ce', '#614900'],
    ['Explorer', '#f5c133', dark, '#342a13', '#ebce8c'],
  ])('derives both colors of %s from the hue of %s', (_, brand, tokens, background, text) => {
    expect(eventPalette(brand, tokens)).toEqual({ background, text });
  });

  it.each([
    ['light', light, '#e8e8e8', '#4d4d4d'],
    ['dark', dark, '#2b2b2b', '#d1d1d1'],
  ])('keeps a gray brand color neutral in %s mode', (_, tokens, background, text) => {
    expect(eventPalette('#737373', tokens)).toEqual({ background, text });
  });

  it('ignores how light or vivid the brand color is, only its hue counts', () => {
    const pale = eventPalette(oklchToHex(0.8, 0.05, 150), light);
    const vivid = eventPalette(oklchToHex(0.5, 0.15, 150), light);
    // Hex rounding shifts the two brand hues very slightly, so channels may differ by a step or two.
    ['background', 'text'].forEach((key) => {
      const [a, b] = [parseHexColor(pale[key]), parseHexColor(vivid[key])];
      ['r', 'g', 'b'].forEach((channel) => expect(Math.abs(a[channel] - b[channel])).toBeLessThanOrEqual(2));
    });
  });

  it.each([
    ['a missing color', null, light],
    ['an invalid color', 'red', light],
    ['a token that is not a number', '#2980e7', { ...light, textChroma: NaN }],
  ])('returns null for %s', (_, brand, tokens) => {
    expect(eventPalette(brand, tokens)).toBeNull();
  });

  describe.each([['light', light], ['dark', dark]])('with the %s tokens, across all hues', (_, tokens) => {
    const palettes = Array.from({ length: 72 }, (__, i) => eventPalette(oklchToHex(0.7, 0.1, i * 5), tokens));

    it('keeps text readable (WCAG AA, 4.5:1)', () => {
      palettes.forEach((p) => expect(contrast(p.background, p.text)).toBeGreaterThanOrEqual(4.5));
    });

    it('keeps the contrast nearly the same for every brand color', () => {
      const values = palettes.map((p) => contrast(p.background, p.text));
      expect(Math.max(...values) - Math.min(...values)).toBeLessThan(1);
    });

    it('gives every text and every background the same lightness', () => {
      palettes.forEach((p) => {
        expect(Math.abs(hexToOklch(p.text).l - tokens.textLightness)).toBeLessThan(0.01);
        expect(Math.abs(hexToOklch(p.background).l - tokens.backgroundLightness)).toBeLessThan(0.01);
      });
    });
  });
});
