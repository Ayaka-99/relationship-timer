/**
 * Generates icons/icon-192.png and icons/icon-512.png
 * using only Node.js built-ins (no npm required).
 *
 * Icon design: purple gradient (#7C3AED → #A855F7) with a white heart.
 */

'use strict';
const fs   = require('fs');
const zlib = require('zlib');

// ── CRC-32 table ──────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk helper ──────────────────────────────
function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([len, typeBytes, data, crc]);
}

// ── Heart test ────────────────────────────────────
// Classic heart parametric equation in normalised coords
function isHeart(x, y, size) {
  const s  = size * 0.30;
  const nx = (x - size / 2) / s;
  const ny = -(y - size / 2) / s + 0.15;         // shift up slightly
  const v  = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * Math.pow(ny, 3);
  return v <= 0;
}

// ── Create PNG ────────────────────────────────────
function createPNG(size) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter_byte + R G B per pixel
  const raw = Buffer.alloc(size * (1 + size * 3));

  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    raw[row] = 0; // filter: None

    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 3;

      if (isHeart(x, y, size)) {
        // White heart with slight purple tint
        raw[px]     = 255;
        raw[px + 1] = 248;
        raw[px + 2] = 255;
      } else {
        // Diagonal gradient: #7C3AED → #A855F7
        const t     = (x + y) / (2 * (size - 1));
        raw[px]     = Math.round(124 + t * (168 - 124)); // R: 124 → 168
        raw[px + 1] = Math.round(58  + t * (85  - 58));  // G: 58  → 85
        raw[px + 2] = Math.round(237 + t * (247 - 237)); // B: 237 → 247
      }
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Write files ───────────────────────────────────
fs.mkdirSync('icons', { recursive: true });
fs.writeFileSync('icons/icon-192.png', createPNG(192));
fs.writeFileSync('icons/icon-512.png', createPNG(512));
console.log('✓ icons/icon-192.png');
console.log('✓ icons/icon-512.png');
