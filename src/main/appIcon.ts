// Reads an app's icon straight from the resources of its Windows executable.
//
// Needed because app.getFileIcon cannot decode PNG-compressed icon frames: Chromium loads them
// inside its sandbox and silently returns the generic Windows icon instead. Office apps store
// every size as PNG, so they would all show that generic icon. It also returns the generic icon
// for executables without an icon (e.g. LockApp.exe); this reader tells those apart.

const RT_ICON = 3;
const RT_GROUP_ICON = 14;
const RESOURCE_TABLE_INDEX = 2;
const PE32_MAGIC = 0x10b;
const PE32_PLUS_MAGIC = 0x20b;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Real icon frames are far smaller; a larger value means a corrupt file, which must not trigger a huge read.
const MAX_RESOURCE_BYTES = 16 * 1024 * 1024;
const HUE_BUCKETS = 12;
const MIN_ALPHA = 128; // more transparent pixels are only anti-aliased edges
const MIN_CHROMA = 24; // below this a pixel reads as gray, not as a color

export type ReadAt = (offset: number, length: number) => Promise<Buffer>;

export type ExeIcon =
  | { kind: 'none' } // the executable has no usable icon
  | { kind: 'bitmap' } // uncompressed frame: app.getFileIcon can load it
  | { kind: 'png'; png: Buffer; width: number };

interface Section { rva: number; size: number; fileOffset: number; }
interface DirEntry { id: number | null; isDirectory: boolean; offset: number; }
interface IconFrame { width: number; bitCount: number; iconId: number; }

async function readResourceTable(readAt: ReadAt): Promise<{ rootOffset: number; sections: Section[] } | null> {
  const dos = await readAt(0, 64);
  if (dos.length < 64 || dos.toString('latin1', 0, 2) !== 'MZ') return null;
  const peOffset = dos.readUInt32LE(0x3c);
  const pe = await readAt(peOffset, 26);
  if (pe.length < 26 || pe.toString('latin1', 0, 4) !== 'PE\0\0') return null;

  const sectionCount = pe.readUInt16LE(6);
  const optionalSize = pe.readUInt16LE(20);
  const magic = pe.readUInt16LE(24);
  if (magic !== PE32_MAGIC && magic !== PE32_PLUS_MAGIC) return null;
  const optionalOffset = peOffset + 24;
  const tableEntry = (magic === PE32_PLUS_MAGIC ? 112 : 96) + RESOURCE_TABLE_INDEX * 8;
  if (optionalSize < tableEntry + 8) return null;
  const resourceRva = (await readAt(optionalOffset + tableEntry, 4)).readUInt32LE(0);
  if (resourceRva === 0) return null;

  const headers = await readAt(optionalOffset + optionalSize, sectionCount * 40);
  const sections: Section[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const at = i * 40;
    sections.push({
      rva: headers.readUInt32LE(at + 12),
      size: Math.max(headers.readUInt32LE(at + 8), headers.readUInt32LE(at + 16)),
      fileOffset: headers.readUInt32LE(at + 20),
    });
  }
  const rootOffset = rvaToFileOffset(sections, resourceRva);
  return rootOffset === null ? null : { rootOffset, sections };
}

function rvaToFileOffset(sections: Section[], rva: number): number | null {
  const section = sections.find((s) => rva >= s.rva && rva < s.rva + s.size);
  return section ? section.fileOffset + (rva - section.rva) : null;
}

async function readDirectory(readAt: ReadAt, rootOffset: number, offset: number): Promise<DirEntry[]> {
  const header = await readAt(rootOffset + offset, 16);
  const count = header.readUInt16LE(12) + header.readUInt16LE(14);
  const raw = await readAt(rootOffset + offset + 16, count * 8);
  const entries: DirEntry[] = [];
  for (let i = 0; i < count; i++) {
    const name = raw.readUInt32LE(i * 8);
    const target = raw.readUInt32LE(i * 8 + 4);
    entries.push({
      id: name & 0x80000000 ? null : name, // named entries sort first, like in EnumResourceNames
      isDirectory: (target & 0x80000000) !== 0,
      offset: target & 0x7fffffff,
    });
  }
  return entries;
}

// Resources are stored as type -> id -> language -> data. Returns the data's file location.
async function locateResource(
  readAt: ReadAt,
  table: { rootOffset: number; sections: Section[] },
  entry: DirEntry
): Promise<{ fileOffset: number; size: number } | null> {
  const languages = await readDirectory(readAt, table.rootOffset, entry.offset);
  if (languages.length === 0 || languages[0].isDirectory) return null;
  const data = await readAt(table.rootOffset + languages[0].offset, 8);
  const size = data.readUInt32LE(4);
  const fileOffset = rvaToFileOffset(table.sections, data.readUInt32LE(0));
  if (fileOffset === null || size > MAX_RESOURCE_BYTES) return null;
  return { fileOffset, size };
}

function parseIconGroup(group: Buffer): IconFrame[] {
  const count = group.readUInt16LE(4);
  const frames: IconFrame[] = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 14;
    frames.push({
      width: group.readUInt8(at) || 256, // 0 stands for 256 in the format
      bitCount: group.readUInt16LE(at + 6),
      iconId: group.readUInt16LE(at + 12),
    });
  }
  return frames;
}

function selectFrame(frames: IconFrame[], targetSize: number): IconFrame | null {
  const distance = (f: IconFrame) => Math.abs(f.width - targetSize);
  return frames.reduce<IconFrame | null>((best, f) => {
    if (!best) return f;
    if (distance(f) !== distance(best)) return distance(f) < distance(best) ? f : best;
    if (f.width !== best.width) return f.width > best.width ? f : best;
    return f.bitCount > best.bitCount ? f : best;
  }, null);
}

// Finds the frame closest to targetSize (px) in the executable's first icon group, the one
// Explorer shows. Rejects only on unreadable or truncated files.
export async function readExeIcon(readAt: ReadAt, targetSize: number): Promise<ExeIcon> {
  const none: ExeIcon = { kind: 'none' };
  const table = await readResourceTable(readAt);
  if (!table) return none;

  const types = await readDirectory(readAt, table.rootOffset, 0);
  const groupType = types.find((t) => t.id === RT_GROUP_ICON && t.isDirectory);
  const iconType = types.find((t) => t.id === RT_ICON && t.isDirectory);
  if (!groupType || !iconType) return none;

  const groups = await readDirectory(readAt, table.rootOffset, groupType.offset);
  if (groups.length === 0 || !groups[0].isDirectory) return none;
  const groupLocation = await locateResource(readAt, table, groups[0]);
  if (!groupLocation) return none;
  const frame = selectFrame(
    parseIconGroup(await readAt(groupLocation.fileOffset, groupLocation.size)),
    targetSize
  );
  if (!frame) return none;

  const icons = await readDirectory(readAt, table.rootOffset, iconType.offset);
  const icon = icons.find((i) => i.id === frame.iconId && i.isDirectory);
  if (!icon) return none;
  const location = await locateResource(readAt, table, icon);
  if (!location) return none;

  const head = await readAt(location.fileOffset, PNG_MAGIC.length);
  if (!head.equals(PNG_MAGIC)) return { kind: 'bitmap' };
  return { kind: 'png', png: await readAt(location.fileOffset, location.size), width: frame.width };
}

// Derives an app's brand color from its icon's BGRA pixels: the most common hue, weighted by
// chroma so vivid pixels count more than faintly tinted ones. Mixing all colors instead would turn
// multicolored logos into a muddy gray. Returns null if there is no such color (grayscale, faintly
// tinted or fully transparent icon); the event then uses the default color.
export function deriveIconColor(bgra: Buffer): string | null {
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i + 3 < bgra.length; i += 4) {
    const B = bgra[i], G = bgra[i + 1], R = bgra[i + 2], A = bgra[i + 3];
    if (A < MIN_ALPHA) continue;
    const max = Math.max(R, G, B);
    const chroma = max - Math.min(R, G, B);
    if (chroma < MIN_CHROMA) continue;
    const sector = max === R ? (G - B) / chroma + 6 : max === G ? (B - R) / chroma + 2 : (R - G) / chroma + 4;
    const bucket = buckets[Math.floor((sector / 6) * HUE_BUCKETS) % HUE_BUCKETS];
    const w = chroma * chroma * (A / 255);
    bucket.weight += w; bucket.r += R * w; bucket.g += G * w; bucket.b += B * w;
  }

  // A hue window spans three buckets, so a gradient on a bucket border still counts as one color.
  const windowAt = (center: number) => [center - 1, center, center + 1]
    .map((b) => buckets[(b + HUE_BUCKETS) % HUE_BUCKETS]);
  const weightOf = (center: number) => windowAt(center).reduce((sum, b) => sum + b.weight, 0);
  const peak = buckets.reduce((best, _, center) => (weightOf(center) > weightOf(best) ? center : best), 0);
  const total = weightOf(peak);
  if (total === 0) return null;

  const channel = (pick: (b: typeof buckets[number]) => number) => {
    const value = windowAt(peak).reduce((sum, b) => sum + pick(b), 0) / total;
    return Math.round(value).toString(16).padStart(2, "0");
  };
  return `#${channel((b) => b.r)}${channel((b) => b.g)}${channel((b) => b.b)}`;
}
