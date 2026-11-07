// Génère des icônes PNG simples (fond bleu + vague). Usage : node scripts/make-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const ch = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]); const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(b)); return Buffer.concat([l, b, c]); };
function png(n, path) {
  const raw = Buffer.alloc(n * (n * 3 + 1));
  for (let y = 0; y < n; y++) {
    const o = y * (n * 3 + 1); raw[o] = 0;
    const wave = Math.abs(y - Math.floor(n * 0.62)) < n * 0.05;
    for (let x = 0; x < n; x++) raw.set(wave ? [255, 255, 255] : [0x0b, 0x6e, 0x99], o + 1 + x * 3);
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(n, 0); ih.writeUInt32BE(n, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]));
}
for (const [n, p] of [[180, 'icon-180.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) png(n, new URL('../public/' + p, import.meta.url));
