// Generates every app icon file from the one source drawing, resources/icon-source/icon.svg.
// Run `npm run icons` after changing the SVG and commit the generated files.
//
//   resources/icon.ico     Windows: exe, installer, shortcuts, taskbar, window (16-256 px)
//   resources/icon.png     1024 px, window icon outside Windows, Linux
//   resources/icon.icns    macOS app bundle (16-1024 px); the circle sits on Apple's
//                          icon grid (824 of 1024 px) so it matches the size of other Mac icons
//   resources/appx/*.png   Microsoft Store tiles (sizes fixed by the package manifest)

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.join(__dirname, '..');
const RESOURCES = path.join(ROOT, 'resources');
const SOURCE = fs.readFileSync(path.join(RESOURCES, 'icon-source', 'icon.svg'), 'utf8');
const SOURCE_SIZE = 1024; // viewBox of the source drawing

const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const MAC_ICON_SHARE = 824 / 1024; // Apple macOS icon grid: artwork 824 px on a 1024 px canvas
// ICNS chunk type -> pixel size (the @2x types share pixel sizes with the 1x ones)
const ICNS_TYPES = [
  ['icp4', 16], ['ic11', 32], ['icp5', 32], ['ic12', 64], ['icp6', 64], ['ic07', 128],
  ['ic13', 256], ['ic08', 256], ['ic14', 512], ['ic09', 512], ['ic10', 1024],
];
// Store tiles: canvas size and the circle's diameter in px
const APPX_TILES = [
  ['StoreLogo.png', 50, 50, 50],
  ['Square44x44Logo.png', 44, 44, 44],
  ['Square150x150Logo.png', 150, 150, 112],
  ['Wide310x150Logo.png', 310, 150, 112],
];

// Renders the icon centered on a transparent width x height canvas, the circle `diameter` px wide.
function render(width, height = width, diameter = Math.min(width, height)) {
  const units = SOURCE_SIZE / diameter; // source units per output pixel
  const viewW = width * units;
  const viewH = height * units;
  const viewBox = `${(SOURCE_SIZE - viewW) / 2} ${(SOURCE_SIZE - viewH) / 2} ${viewW} ${viewH}`;
  const svg = SOURCE.replace(/<svg[^>]*>/, (tag) => tag
    .replace(/\swidth="[^"]*"/, ` width="${width}"`)
    .replace(/\sheight="[^"]*"/, ` height="${height}"`)
    .replace(/\sviewBox="[^"]*"/, ` viewBox="${viewBox}"`));
  const image = new Resvg(svg, { fitTo: { mode: 'original' }, shapeRendering: 2 }).render();
  return { png: image.asPng(), rgba: image.pixels, width: image.width, height: image.height };
}

// ICO entry as 32-bit BMP (sizes below 256; the most compatible form, e.g. for NSIS)
function bmpEntry({ rgba, width, height }) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(width, 4);
  header.writeInt32LE(height * 2, 8); // XOR bitmap + AND mask
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = ((height - 1 - y) * width + x) * 4; // BMP rows run bottom-up, BGRA
      const alpha = rgba[src + 3];
      // resvg's pixels are premultiplied, ICO bitmaps use straight alpha
      const straight = (c) => (alpha ? Math.min(255, Math.round((c * 255) / alpha)) : 0);
      pixels[dst] = straight(rgba[src + 2]);
      pixels[dst + 1] = straight(rgba[src + 1]);
      pixels[dst + 2] = straight(rgba[src]);
      pixels[dst + 3] = alpha;
    }
  }
  const mask = Buffer.alloc(Math.ceil(width / 32) * 4 * height); // all 0: alpha decides
  return Buffer.concat([header, pixels, mask]);
}

function buildIco() {
  const entries = ICO_SIZES.map((size) => {
    const image = render(size);
    return { size, data: size >= 256 ? image.png : bmpEntry(image) };
  });
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at); // 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...entries.map((e) => e.data)]);
}

function buildIcns() {
  const chunks = ICNS_TYPES.map(([type, size]) => {
    const png = render(size, size, Math.round(size * MAC_ICON_SHARE)).png;
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, png]);
  });
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(8 + chunks.reduce((sum, c) => sum + c.length, 0), 4);
  return Buffer.concat([head, ...chunks]);
}

function write(relativePath, data) {
  fs.writeFileSync(path.join(RESOURCES, relativePath), data);
  console.log(`wrote resources/${relativePath}`);
}

write('icon.ico', buildIco());
write('icon.png', render(1024).png);
write('icon.icns', buildIcns());
for (const [name, width, height, diameter] of APPX_TILES) {
  write(path.join('appx', name), render(width, height, diameter).png);
}
