import { deriveIconColor, readExeIcon, ReadAt } from './appIcon';

const RT_ICON = 3;
const RT_GROUP_ICON = 14;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DIB_HEADER = Buffer.from([0x28, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00]);

interface FrameSpec { size: number; bitCount?: number; id: number; data: Buffer; }

const png = (marker: number) => Buffer.concat([PNG_MAGIC, Buffer.from([marker])]);
const dib = () => Buffer.concat([DIB_HEADER, Buffer.alloc(8)]);

// A resource directory node: either a sub-directory (entries) or a leaf (raw bytes).
type ResNode = { entries: Array<{ id: number; named?: boolean; child: ResNode }> } | Buffer;

function groupResource(frames: FrameSpec[]): Buffer {
  const out = Buffer.alloc(6 + frames.length * 14);
  out.writeUInt16LE(1, 2); // type = icon
  out.writeUInt16LE(frames.length, 4);
  frames.forEach((f, i) => {
    const off = 6 + i * 14;
    out.writeUInt8(f.size === 256 ? 0 : f.size, off); // 0 means 256 in the format
    out.writeUInt8(f.size === 256 ? 0 : f.size, off + 1);
    out.writeUInt16LE(f.bitCount ?? 32, off + 6);
    out.writeUInt32LE(f.data.length, off + 8);
    out.writeUInt16LE(f.id, off + 12);
  });
  return out;
}

// Each resource is stored as id -> language -> bytes, like in a real executable.
const leaf = (id: number, data: Buffer, named = false) => ({
  id, named, child: { entries: [{ id: 1033, child: data }] } as ResNode,
});

function resourcesFor(groups: Array<{ id: number; named?: boolean; frames: FrameSpec[] }>): ResNode {
  const allFrames = groups.flatMap((g) => g.frames);
  return {
    entries: [
      { id: RT_ICON, child: { entries: allFrames.map((f) => leaf(f.id, f.data)) } },
      { id: RT_GROUP_ICON, child: { entries: groups.map((g) => leaf(g.id, groupResource(g.frames), g.named)) } },
    ],
  };
}

const SECTION_RVA = 0x2000;
const SECTION_FILE_OFFSET = 0x400; // differs from the RVA, so a missing RVA mapping fails the tests

function serializeResources(root: ResNode): Buffer {
  const dirs: Array<{ offset: number; node: Exclude<ResNode, Buffer> }> = [];
  const leaves: Array<{ entryOffset: number; data: Buffer }> = [];
  let cursor = 0;
  const plan = (node: Exclude<ResNode, Buffer>) => {
    dirs.push({ offset: cursor, node });
    cursor += 16 + node.entries.length * 8;
    node.entries.forEach((e) => { if (!Buffer.isBuffer(e.child)) plan(e.child); });
  };
  plan(root as Exclude<ResNode, Buffer>);

  const offsetOf = new Map<ResNode, number>();
  dirs.forEach((d) => offsetOf.set(d.node, d.offset));
  dirs.forEach((d) => d.node.entries.forEach((e) => {
    if (Buffer.isBuffer(e.child)) {
      offsetOf.set(e.child, cursor);
      leaves.push({ entryOffset: cursor, data: e.child });
      cursor += 16;
    }
  }));
  const dataStart = cursor;
  const total = dataStart + leaves.reduce((n, l) => n + l.data.length, 0);
  const out = Buffer.alloc(total);

  dirs.forEach(({ offset, node }) => {
    const named = node.entries.filter((e) => e.named).length;
    out.writeUInt16LE(named, offset + 12);
    out.writeUInt16LE(node.entries.length - named, offset + 14);
    node.entries.forEach((e, i) => {
      const entry = offset + 16 + i * 8;
      out.writeUInt32LE(e.named ? 0x80000000 : e.id, entry);
      const target = offsetOf.get(e.child)!;
      out.writeUInt32LE(Buffer.isBuffer(e.child) ? target : (0x80000000 | target) >>> 0, entry + 4);
    });
  });

  let dataCursor = dataStart;
  leaves.forEach(({ entryOffset, data }) => {
    out.writeUInt32LE(SECTION_RVA + dataCursor, entryOffset);
    out.writeUInt32LE(data.length, entryOffset + 4);
    data.copy(out, dataCursor);
    dataCursor += data.length;
  });
  return out;
}

// Smallest valid PE image that holds the given resource section (null: no resource table).
function buildPe(resources: ResNode | null, optionalMagic = 0x20b): Buffer {
  const section = resources ? serializeResources(resources) : Buffer.alloc(0);
  const peOffset = 0x40;
  const dataDirsAt = optionalMagic === 0x20b ? 112 : 96;
  const optionalSize = dataDirsAt + 16 * 8;
  const out = Buffer.alloc(SECTION_FILE_OFFSET + section.length);
  out.write('MZ', 0, 'latin1');
  out.writeUInt32LE(peOffset, 0x3c);
  out.write('PE\0\0', peOffset, 'latin1');
  out.writeUInt16LE(1, peOffset + 6); // number of sections
  out.writeUInt16LE(optionalSize, peOffset + 20);
  const optional = peOffset + 24;
  out.writeUInt16LE(optionalMagic, optional);
  if (resources) {
    out.writeUInt32LE(SECTION_RVA, optional + dataDirsAt + 2 * 8);
    out.writeUInt32LE(section.length, optional + dataDirsAt + 2 * 8 + 4);
  }
  const header = optional + optionalSize;
  out.write('.rsrc', header, 'latin1');
  out.writeUInt32LE(section.length, header + 8); // virtual size
  out.writeUInt32LE(SECTION_RVA, header + 12);
  out.writeUInt32LE(section.length, header + 16); // raw size
  out.writeUInt32LE(SECTION_FILE_OFFSET, header + 20);
  section.copy(out, SECTION_FILE_OFFSET);
  return out;
}

const readerFor = (file: Buffer): ReadAt => async (offset, length) => file.subarray(offset, offset + length);
const read = (file: Buffer, size = 32) => readExeIcon(readerFor(file), size);

describe('readExeIcon', () => {
  test('returns the PNG bytes when the matching frame is a PNG (Office-style icon)', async () => {
    const frame32 = png(32);
    const file = buildPe(resourcesFor([{ id: 1, frames: [
      { size: 16, id: 8, data: png(16) },
      { size: 32, id: 5, data: frame32 },
      { size: 48, id: 3, data: png(48) },
    ] }]));
    expect(await read(file)).toEqual({ kind: 'png', png: frame32, width: 32 });
  });

  test('reports a bitmap when the matching frame is a DIB, even if a larger PNG exists', async () => {
    const file = buildPe(resourcesFor([{ id: 2, frames: [
      { size: 32, id: 1, data: dib() },
      { size: 256, id: 2, data: png(0) },
    ] }]));
    expect(await read(file)).toEqual({ kind: 'bitmap' });
  });

  test('picks the frame for the requested size, not the first one', async () => {
    const frame48 = png(48);
    const file = buildPe(resourcesFor([{ id: 1, frames: [
      { size: 32, id: 1, data: dib() },
      { size: 48, id: 2, data: frame48 },
    ] }]));
    expect(await read(file, 48)).toEqual({ kind: 'png', png: frame48, width: 48 });
  });

  test('prefers the highest bit depth among frames of the same size', async () => {
    const file = buildPe(resourcesFor([{ id: 1, frames: [
      { size: 32, bitCount: 8, id: 1, data: png(8) },
      { size: 32, bitCount: 32, id: 2, data: dib() },
    ] }]));
    expect(await read(file)).toEqual({ kind: 'bitmap' });
  });

  test('falls back to the closest size when the exact size is missing', async () => {
    const frame48 = png(48);
    const file = buildPe(resourcesFor([{ id: 1, frames: [
      { size: 16, id: 1, data: dib() },
      { size: 48, id: 2, data: frame48 },
      { size: 256, id: 3, data: dib() },
    ] }]));
    expect(await read(file, 40)).toEqual({ kind: 'png', png: frame48, width: 48 });
  });

  test('reads a width of 0 in the group directory as 256', async () => {
    const frame256 = png(0);
    const file = buildPe(resourcesFor([{ id: 1, frames: [{ size: 256, id: 1, data: frame256 }] }]));
    expect(await read(file, 256)).toEqual({ kind: 'png', png: frame256, width: 256 });
  });

  test('uses the first icon group, like Explorer does', async () => {
    const first = png(1);
    const file = buildPe(resourcesFor([
      { id: 1, frames: [{ size: 32, id: 1, data: first }] },
      { id: 5, frames: [{ size: 32, id: 2, data: dib() }] },
    ]));
    expect(await read(file)).toEqual({ kind: 'png', png: first, width: 32 });
  });

  test('accepts a named first icon group', async () => {
    const first = png(1);
    const file = buildPe(resourcesFor([{ id: 0, named: true, frames: [{ size: 32, id: 1, data: first }] }]));
    expect(await read(file)).toEqual({ kind: 'png', png: first, width: 32 });
  });

  test('handles 32-bit (PE32) executables', async () => {
    const frame = png(32);
    const file = buildPe(resourcesFor([{ id: 1, frames: [{ size: 32, id: 1, data: frame }] }]), 0x10b);
    expect(await read(file)).toEqual({ kind: 'png', png: frame, width: 32 });
  });

  test('reports no icon for an executable without icon resources (LockApp-style)', async () => {
    const onlyOther: ResNode = { entries: [{ id: 16, child: { entries: [leaf(1, Buffer.from('version'))] } }] };
    expect(await read(buildPe(onlyOther))).toEqual({ kind: 'none' });
  });

  test('reports no icon for an executable without a resource table', async () => {
    expect(await read(buildPe(null))).toEqual({ kind: 'none' });
  });

  test('reports no icon for a file that is not an executable', async () => {
    expect(await read(Buffer.from('this is not a program, just some text in a file'))).toEqual({ kind: 'none' });
  });

  test('reports no icon when a group refers to a frame that does not exist', async () => {
    const file = buildPe({
      entries: [
        { id: RT_ICON, child: { entries: [leaf(99, png(1))] } },
        { id: RT_GROUP_ICON, child: { entries: [leaf(1, groupResource([{ size: 32, id: 7, data: png(1) }]))] } },
      ],
    });
    expect(await read(file)).toEqual({ kind: 'none' });
  });

  test('reports no icon for an implausibly large frame instead of reading it', async () => {
    const file = buildPe(resourcesFor([{ id: 1, frames: [{ size: 32, id: 1, data: png(1) }] }]));
    const huge = 0x7fffffff;
    const sizeField = file.indexOf(png(1));
    // The frame's data entry stores its length right after its RVA; locate it via the RVA.
    const rva = SECTION_RVA + (sizeField - SECTION_FILE_OFFSET);
    for (let i = SECTION_FILE_OFFSET; i + 8 <= file.length; i += 4) {
      if (file.readUInt32LE(i) === rva) file.writeUInt32LE(huge, i + 4);
    }
    const lengths: number[] = [];
    const spy: ReadAt = async (offset, length) => { lengths.push(length); return file.subarray(offset, offset + length); };
    expect(await readExeIcon(spy, 32)).toEqual({ kind: 'none' });
    expect(Math.max(...lengths)).toBeLessThan(huge);
  });
});

describe('deriveIconColor', () => {
  const bgra = (...pixels: Array<[number, number, number, number]>) =>
    Buffer.from(pixels.flatMap(([r, g, b, a]) => [b, g, r, a]));

  test('returns the color of a saturated icon', () => {
    expect(deriveIconColor(bgra([0, 0, 255, 255]))).toBe('#0000ff');
  });

  test('weights saturated pixels over neutral ones', () => {
    expect(deriveIconColor(bgra([255, 0, 0, 255], [128, 128, 128, 255]))).toBe('#ff0000');
  });

  test('takes the most common hue of a multicolored logo instead of mixing all colors', () => {
    const icon = bgra(
      [255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255],
      [0, 255, 0, 255], [0, 255, 0, 255],
      [0, 0, 255, 255], [0, 0, 255, 255],
    );
    expect(deriveIconColor(icon)).toBe('#ff0000');
  });

  test('averages only the shades of the dominant hue (gradient icon)', () => {
    const icon = bgra(
      [0, 0, 200, 255], [0, 0, 240, 255], [0, 0, 220, 255],
      [255, 128, 0, 255],
    );
    // Weighted by chroma squared: (200^3 + 240^3 + 220^3) / (200^2 + 240^2 + 220^2) = 222.4
    expect(deriveIconColor(icon)).toBe('#0000de');
  });

  test('treats reds on both sides of hue 0 as one color', () => {
    const icon = bgra(
      [255, 0, 21, 255], [255, 0, 21, 255],
      [255, 21, 0, 255], [255, 21, 0, 255],
      [0, 255, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255],
    );
    expect(deriveIconColor(icon)).toBe('#ff0b0b');
  });

  test('prefers a few vivid pixels over many faintly tinted ones', () => {
    const faint = Array.from({ length: 50 }, () => [160, 154, 144, 255] as [number, number, number, number]);
    expect(deriveIconColor(bgra(...faint, [0, 0, 255, 255]))).toBe('#0000ff');
  });

  test('returns null for an icon that is only faintly tinted', () => {
    expect(deriveIconColor(bgra([160, 154, 144, 255], [150, 146, 140, 255]))).toBeNull();
  });

  test('ignores semi-transparent edge pixels', () => {
    expect(deriveIconColor(bgra([255, 0, 0, 100], [255, 0, 0, 100], [0, 0, 255, 255]))).toBe('#0000ff');
  });

  test('returns null for a grayscale icon, which has no brand color', () => {
    expect(deriveIconColor(bgra([128, 128, 128, 255], [20, 20, 20, 255]))).toBeNull();
  });

  test('returns null for a fully transparent icon', () => {
    expect(deriveIconColor(bgra([255, 0, 0, 0]))).toBeNull();
  });

  test('returns null for an empty bitmap', () => {
    expect(deriveIconColor(Buffer.alloc(0))).toBeNull();
  });
});
