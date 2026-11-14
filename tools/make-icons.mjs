// Renders the toolbar icons (a white shield on a violet tile) with no dependencies.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc = (buf) => { let c = ~0; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

function inShield(x, y) { // unit coords 0..1
  const cx = 0.5, top = 0.2, bottom = 0.82, half = 0.27;
  if (y < top || y > bottom) return false;
  const t = (y - top) / (bottom - top);
  const w = t < 0.45 ? half : half * Math.cos(((t - 0.45) / 0.55) * Math.PI / 2);
  return Math.abs(x - cx) <= w;
}
function inSlash(x, y) { // diagonal bar cut through the shield ("leave me alone")
  return Math.abs((x - 0.5) - (y - 0.5)) < 0.045 && x > 0.28 && x < 0.72;
}
function inTile(x, y) {
  const r = 0.22, m = 0.02;
  const dx = Math.max(m + r - x, 0, x - (1 - m - r)), dy = Math.max(m + r - y, 0, y - (1 - m - r));
  return dx * dx + dy * dy <= r * r && x >= m && x <= 1 - m && y >= m && y <= 1 - m;
}

function render(size) {
  const S = 4, rows = [];
  for (let py = 0; py < size; py++) {
    const row = [0];
    for (let px = 0; px < size; px++) {
      let tile = 0, white = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const x = (px + (sx + 0.5) / S) / size, y = (py + (sy + 0.5) / S) / size;
        if (inTile(x, y)) { tile++; if (inShield(x, y) && !inSlash(x, y)) white++; }
      }
      const a = tile / (S * S), wf = tile ? white / tile : 0;
      const mix = (c) => Math.round(c * (1 - wf) + 255 * wf);
      row.push(mix(0x4b), mix(0x3f), mix(0xd6), Math.round(a * 255));
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

for (const s of [16, 32, 48, 128, 256, 512, 1024]) {
  writeFileSync(new URL(`../extension/icons/${s}.png`, import.meta.url), render(s));
}
console.log("icons written");
