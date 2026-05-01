/**
 * Generates a minimal ICO file from the launcher SVG concept.
 * Produces sizes: 16, 32, 48, 256 — all white 3×3 dot grid on transparent bg.
 */
'use strict';
const fs = require('fs');
const path = require('path');
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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePng(size) {
  const px = new Uint8Array(size * size * 4); // RGBA transparent

  const dotCount = 3;
  const dotSize  = Math.max(2, Math.round(size * 0.18));
  const spacing  = Math.round(size * 0.28);
  const startX   = Math.round((size - (dotCount - 1) * spacing - dotSize) / 2);
  const startY   = startX;

  for (let row = 0; row < dotCount; row++) {
    for (let col = 0; col < dotCount; col++) {
      const ox = startX + col * spacing;
      const oy = startY + row * spacing;
      for (let dy = 0; dy < dotSize; dy++) {
        for (let dx = 0; dx < dotSize; dx++) {
          // Round corners by skipping extreme corners
          if (dotSize > 3 && (dx === 0 || dx === dotSize - 1) && (dy === 0 || dy === dotSize - 1)) continue;
          const i = ((oy + dy) * size + (ox + dx)) * 4;
          if (i + 3 >= px.length) continue;
          px[i] = 255; px[i+1] = 255; px[i+2] = 255; px[i+3] = 230;
        }
      }
    }
  }

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * stride + 1 + x * 4;
      raw.set(px.slice(src, src + 4), dst);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildIco(sizes) {
  const images = sizes.map(s => makePng(s));

  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: 1 = ICO
  header.writeUInt16LE(sizes.length, 4);

  const dirSize  = 16 * sizes.length;
  const dataOffset = 6 + dirSize;

  const dirs = [];
  let offset = dataOffset;
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const entry = Buffer.alloc(16);
    entry[0] = s >= 256 ? 0 : s; // 0 means 256
    entry[1] = s >= 256 ? 0 : s;
    entry[2] = 0;   // color count
    entry[3] = 0;   // reserved
    entry.writeUInt16LE(1, 4);   // color planes
    entry.writeUInt16LE(32, 6);  // bits per pixel
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    dirs.push(entry);
    offset += images[i].length;
  }

  return Buffer.concat([header, ...dirs, ...images]);
}

const outPath = path.join(__dirname, '../assets/icon/traylauncher.ico');
const ico = buildIco([16, 32, 48, 256]);
fs.writeFileSync(outPath, ico);
console.log(`ICO written: ${outPath} (${ico.length} bytes)`);
