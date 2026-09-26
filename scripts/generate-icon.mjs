// Gera build/icon.png (512×512) no estilo da marca do app (.brand-mark): quadrado
// arredondado na cor de destaque com um "F" escuro. Sem dependências: desenha com
// supersampling (anti-aliasing) e codifica o PNG com zlib.
// Uso: node scripts/generate-icon.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZE = 512;
const SS = 4; // amostras por eixo (anti-aliasing)
const ACCENT = [0x76, 0xf5, 0xd3];
const INK = [0x07, 0x10, 0x14];

const r = 0.22; // raio do canto (fração do lado)
const inRoundedSquare = (x, y) => {
  const m = 0.04; // margem transparente
  const lo = m, hi = 1 - m, rr = r * (hi - lo);
  const cx = Math.min(Math.max(x, lo + rr), hi - rr);
  const cy = Math.min(Math.max(y, lo + rr), hi - rr);
  return x >= lo && x <= hi && y >= lo && y <= hi && (x - cx) ** 2 + (y - cy) ** 2 <= rr ** 2;
};
// "F": haste vertical + barra superior + barra do meio (coordenadas 0..1).
const F_RECTS = [
  [0.33, 0.24, 0.45, 0.76],
  [0.33, 0.24, 0.70, 0.36],
  [0.33, 0.46, 0.63, 0.57],
];
const inF = (x, y) => F_RECTS.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0; // filtro "None"
  for (let px = 0; px < SIZE; px++) {
    let cover = 0, ink = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = (px + (sx + 0.5) / SS) / SIZE;
        const y = (py + (sy + 0.5) / SS) / SIZE;
        if (inRoundedSquare(x, y)) {
          cover++;
          if (inF(x, y)) ink++;
        }
      }
    }
    const n = SS * SS;
    const t = cover ? ink / cover : 0;
    const o = py * (SIZE * 4 + 1) + 1 + px * 4;
    for (let c = 0; c < 3; c++) raw[o + c] = Math.round(ACCENT[c] * (1 - t) + INK[c] * t);
    raw[o + 3] = Math.round((cover / n) * 255);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bits por canal
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync('build', { recursive: true });
writeFileSync('build/icon.png', png);
console.log(`build/icon.png ${SIZE}x${SIZE} (${png.length} bytes)`);
