// PWA 用のアイコンを画像ファイルなしで生成する。パネル4枚（赤・緑・水色・黄）を 2×2 に並べた図柄。
// 実行: node tools/make-icons.mjs  → public/icons/ に PNG を書き出す
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [0x14, 0x14, 0x1c];
const COLORS = [
  [0xe0, 0x40, 0x5a],
  [0x7a, 0xd3, 0x3a],
  [0x4c, 0xc3, 0xe8],
  [0xf2, 0xd1, 0x3b],
];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 角丸の正方形の内側か。(cx, cy) 中心、半辺 h、角の半径 r。 */
function inRoundedSquare(x, y, cx, cy, h, r) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx > h || dy > h) return false;
  if (dx <= h - r || dy <= h - r) return true;
  const ex = dx - (h - r);
  const ey = dy - (h - r);
  return ex * ex + ey * ey <= r * r;
}

function shade(c, f) {
  return c.map((v) => Math.min(255, Math.round(v * f)));
}

/**
 * maskable 用は安全域（中央 80%）に図柄を収める。通常用は少し大きめに描く。
 */
function draw(size, maskable) {
  const scale = maskable ? 0.62 : 0.8;
  const tile = (size * scale) / 2; // 1枚のパネルの一辺
  const gap = tile * 0.12;
  const half = (tile - gap) / 2;
  const radius = half * 0.28;
  const left = size / 2 - tile;
  const centers = [
    [left + tile / 2, left + tile / 2],
    [left + tile * 1.5, left + tile / 2],
    [left + tile / 2, left + tile * 1.5],
    [left + tile * 1.5, left + tile * 1.5],
  ];
  return png(size, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = centers[i];
      if (!inRoundedSquare(px, py, cx, cy, half, radius)) continue;
      const c = COLORS[i];
      // 上端のハイライトと外周の影で、ゲーム内のパネルと同じ立体感にする
      if (inRoundedSquare(px, py, cx, cy - half * 0.62, half * 0.78, radius * 0.6) && py < cy - half * 0.35) return shade(c, 1.25);
      if (!inRoundedSquare(px, py, cx, cy - half * 0.04, half * 0.94, radius * 0.9)) return shade(c, 0.7);
      return c;
    }
    return BG;
  });
}

mkdirSync("public/icons", { recursive: true });
for (const [name, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
]) {
  writeFileSync(`public/icons/${name}`, draw(size, maskable));
  console.log(`public/icons/${name}`);
}
