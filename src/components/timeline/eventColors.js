// Event text color helpers: an event's ink color is the app's brand color with the
// EventInkMix token (Figma variable, --event-ink-mix) normal-blended on top.

const HEX_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;

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

// Normal blend of overlayHex (its alpha applies) over baseHex; returns lowercase '#rrggbb'.
// Per channel: out = base * (1 - a) + overlay * a, rounded.
export function blendOver(baseHex, overlayHex) {
  const base = parseHexColor(baseHex);
  const overlay = parseHexColor(overlayHex);
  const mix = (b, o) => Math.round(b * (1 - overlay.a) + o * overlay.a);
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(base.r, overlay.r))}${toHex(mix(base.g, overlay.g))}${toHex(mix(base.b, overlay.b))}`;
}

// Reads a CSS custom property (e.g. '--event-ink-mix') as currently resolved on :root.
export function readCssColorVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
