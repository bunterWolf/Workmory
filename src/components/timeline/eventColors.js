// Event colors, computed in OKLCH so they look equally light to the human eye. Only the hue comes
// from the app's brand color; lightness and chroma of background and text come from tokens. So
// every app gets the same perceived lightness and nearly the same contrast, whatever its color.

const HEX_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
const NEUTRAL_CHROMA = 0.01; // below this a brand color is gray and has no meaningful hue
const GAMUT_TOLERANCE = 1e-4;

// True for a '#rrggbb' / '#rrggbbaa' string; never throws (parseHexColor is the strict variant).
export function isHexColor(value) {
  return typeof value === 'string' && HEX_RE.test(value);
}

// Parses '#rrggbb' or '#rrggbbaa' (case-insensitive) into channels 0..255 and alpha 0..1.
export function parseHexColor(hex) {
  const match = HEX_RE.exec(hex);
  if (!match) {
    throw new Error(`Invalid hex color: ${JSON.stringify(hex)}`);
  }
  const [, r, g, b, a] = match;
  return {
    r: parseInt(r, 16),
    g: parseInt(g, 16),
    b: parseInt(b, 16),
    a: a === undefined ? 1 : parseInt(a, 16) / 255,
  };
}

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

// Converts a hex color to OKLCH: l 0..1, c from 0, h in degrees 0..360.
export function hexToOklch(hex) {
  const { r, g, b } = parseHexColor(hex);
  const [R, G, B] = [r, g, b].map((v) => toLinear(v / 255));
  const L = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const M = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const S = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const labA = 1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S;
  const labB = 0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S;
  return {
    l: 0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S,
    c: Math.hypot(labA, labB),
    h: ((Math.atan2(labB, labA) * 180) / Math.PI + 360) % 360,
  };
}

function oklchToLinearRgb(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

const isInGamut = (rgb) => rgb.every((v) => v >= -GAMUT_TOLERANCE && v <= 1 + GAMUT_TOLERANCE);

// Largest chroma <= c that sRGB can show at this lightness and hue. Lowering the chroma keeps
// lightness and hue intact, unlike clipping the channels.
function fitChroma(l, c, h) {
  if (isInGamut(oklchToLinearRgb(l, c, h))) return c;
  let low = 0;
  let high = c;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (isInGamut(oklchToLinearRgb(l, mid, h))) low = mid;
    else high = mid;
  }
  return low;
}

// Converts OKLCH to a lowercase '#rrggbb', lowering the chroma if sRGB cannot show the color.
export function oklchToHex(l, c, h) {
  const rgb = oklchToLinearRgb(l, fitChroma(l, c, h), h);
  const toHex = (v) => Math.round(Math.min(1, Math.max(0, fromLinear(Math.max(0, v)))) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${rgb.map(toHex).join('')}`;
}

// An app event's brand color: from its icon, or the default event color if there is none.
export function resolveAppColor(iconColor, defaultColor) {
  return isHexColor(iconColor) ? iconColor : defaultColor;
}

// Background and text color of an app event, or null if the brand color or a token is invalid.
export function eventPalette(brandColor, tokens) {
  if (!isHexColor(brandColor) || !Object.values(tokens).every(Number.isFinite)) return null;
  const { c, h } = hexToOklch(brandColor);
  const tint = c < NEUTRAL_CHROMA ? 0 : 1; // a gray brand color stays gray instead of getting a random hue
  return {
    background: oklchToHex(tokens.backgroundLightness, tokens.backgroundChroma * tint, h),
    text: oklchToHex(tokens.textLightness, tokens.textChroma * tint, h),
  };
}

// Reads a CSS custom property (e.g. '--event-default') as currently resolved on :root.
export function readCssColorVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Reads the palette tokens of the current color scheme from tokens.css.
export function readEventPaletteTokens() {
  const read = (name) => parseFloat(readCssColorVar(name));
  return {
    backgroundLightness: read('--event-bg-lightness'),
    backgroundChroma: read('--event-bg-chroma'),
    textLightness: read('--event-text-lightness'),
    textChroma: read('--event-text-chroma'),
  };
}
