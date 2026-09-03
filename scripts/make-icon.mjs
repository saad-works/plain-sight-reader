/**
 * Generates icon.png (128x128, referenced by package.json) and icon.svg
 * (editable source) from one shared shape list. Zero dependencies.
 *
 *   node scripts/make-icon.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 128;

const C = {
  bg: '#1A1B26',
  border: '#414868',
  card: '#24283B',
  blue: '#7AA2F7',
  green: '#9ECE6A',
  orange: '#E0AF68',
  purple: '#BB9AF7',
  fg: '#A9B1D6',
  mark: '#F7768E',
};

// Draw order matters (painter's algorithm).
const shapes = [
  { type: 'rect', x: 0, y: 0, w: 128, h: 128, r: 0, fill: C.bg },
  { type: 'rect', x: 20, y: 14, w: 88, h: 100, r: 14, fill: C.border },
  { type: 'rect', x: 22, y: 16, w: 84, h: 96, r: 12, fill: C.card },
  // "syntax tokens" — the book's text disguised as code
  { type: 'rect', x: 34, y: 30, w: 54, h: 8, r: 4, fill: C.blue },
  { type: 'rect', x: 42, y: 44, w: 40, h: 8, r: 4, fill: C.green },
  { type: 'rect', x: 42, y: 58, w: 30, h: 8, r: 4, fill: C.orange },
  { type: 'rect', x: 34, y: 72, w: 48, h: 8, r: 4, fill: C.purple },
  { type: 'rect', x: 42, y: 86, w: 26, h: 8, r: 4, fill: C.fg },
  { type: 'rect', x: 34, y: 100, w: 38, h: 8, r: 4, fill: C.blue },
  // bookmark ribbon
  { type: 'rect', x: 84, y: 8, w: 12, h: 26, r: 0, fill: C.mark },
  { type: 'tri', pts: [[84, 34], [96, 34], [90, 26]], fill: C.bg },
];

// ---- rasteriser ------------------------------------------------------------

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function insideRoundRect(px, py, s) {
  const { x, y, w, h, r } = s;
  if (px < x || py < y || px >= x + w || py >= y + h) return false;
  if (!r) return true;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideTri(px, py, s) {
  const [a, b, c] = s.pts;
  const sign = (p1, p2, p3) =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = sign([px, py], a, b);
  const d2 = sign([px, py], b, c);
  const d3 = sign([px, py], c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

const px = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let rgb = null;
    // 2x2 supersample for cheap anti-aliasing
    let rs = 0, gs = 0, bs = 0, hits = 0;
    for (const oy of [0.25, 0.75]) {
      for (const ox of [0.25, 0.75]) {
        let sample = null;
        for (const s of shapes) {
          const hit =
            s.type === 'tri'
              ? insideTri(x + ox, y + oy, s)
              : insideRoundRect(x + ox, y + oy, s);
          if (hit) sample = s.fill;
        }
        if (sample) {
          const [r, g, b] = hexToRgb(sample);
          rs += r; gs += g; bs += b; hits += 1;
        }
      }
    }
    rgb = hits ? [Math.round(rs / hits), Math.round(gs / hits), Math.round(bs / hits)] : hexToRgb(C.bg);
    const i = (y * SIZE + x) * 4;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = 255;
  }
}

// ---- PNG container -------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(join(ROOT, 'icon.png'), png);

// ---- SVG source -------------------------------------------------------

const svgShapes = shapes
  .map((s) =>
    s.type === 'tri'
      ? `  <polygon points="${s.pts.map((p) => p.join(',')).join(' ')}" fill="${s.fill}"/>`
      : `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${s.fill}"/>`
  )
  .join('\n');
writeFileSync(
  join(ROOT, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">\n${svgShapes}\n</svg>\n`
);

console.log('wrote icon.png and icon.svg');
