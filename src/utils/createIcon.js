'use strict';
const zlib = require('zlib');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

/**
 * Creates a 32x32 RGBA PNG buffer with a 3×3 dot grid icon.
 * @param {boolean} lightDots - true = white dots, false = dark dots
 */
function createLauncherIconPNG(lightDots = true) {
  const SIZE = 32;
  const pixels = new Uint8Array(SIZE * SIZE * 4); // RGBA, all transparent

  const [r, g, b] = lightDots ? [255, 255, 255] : [40, 40, 40];

  // 3x3 grid: each dot 7x7 px, starting at offset 4, spacing 10
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const ox = 4 + col * 10;
      const oy = 4 + row * 10;
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          // Skip extreme corners for rounded look
          if ((dx === 0 || dx === 6) && (dy === 0 || dy === 6)) continue;
          const i = ((oy + dy) * SIZE + (ox + dx)) * 4;
          pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 220;
        }
      }
    }
  }

  // Build raw scanlines with None filter byte
  const stride = SIZE * 4 + 1;
  const raw = Buffer.alloc(stride * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * stride] = 0; // filter = None
    for (let x = 0; x < SIZE; x++) {
      const src = (y * SIZE + x) * 4;
      const dst = y * stride + 1 + x * 4;
      raw[dst] = pixels[src]; raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2]; raw[dst + 3] = pixels[src + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { createLauncherIconPNG };
