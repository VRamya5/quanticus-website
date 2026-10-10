const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePNG(filePath) {
  const buf = fs.readFileSync(filePath);
  let pos = 8;
  let width, height, bitDepth, colorType;
  const idatChunks = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);

    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
      bitDepth = buf[pos + 16];
      colorType = buf[pos + 17];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  const compressedData = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressedData);

  const bytesPerPixel = colorType === 2 ? 3 : (colorType === 6 ? 4 : 1);
  const stride = 1 + width * bytesPerPixel;
  const rgba = Buffer.alloc(width * height * 4);

  // Unfilter scanlines
  const prevRow = Buffer.alloc(width * bytesPerPixel);
  const currRow = Buffer.alloc(width * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[y * stride];
    const rawScanline = decompressed.subarray(y * stride + 1, (y + 1) * stride);

    for (let x = 0; x < width * bytesPerPixel; x++) {
      const bpp = bytesPerPixel;
      const raw = rawScanline[x];
      const a = x >= bpp ? currRow[x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;

      let val = 0;
      if (filterType === 0) val = raw;
      else if (filterType === 1) val = (raw + a) & 0xff;
      else if (filterType === 2) val = (raw + b) & 0xff;
      else if (filterType === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        let pr = c;
        if (pa <= pb && pa <= pc) pr = a;
        else if (pb <= pc) pr = b;
        val = (raw + pr) & 0xff;
      }
      currRow[x] = val;
    }

    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;
      const inIdx = x * bytesPerPixel;
      if (colorType === 2) {
        rgba[outIdx] = currRow[inIdx];
        rgba[outIdx + 1] = currRow[inIdx + 1];
        rgba[outIdx + 2] = currRow[inIdx + 2];
        rgba[outIdx + 3] = 255;
      } else if (colorType === 6) {
        rgba[outIdx] = currRow[inIdx];
        rgba[outIdx + 1] = currRow[inIdx + 1];
        rgba[outIdx + 2] = currRow[inIdx + 2];
        rgba[outIdx + 3] = currRow[inIdx + 3];
      }
    }
    currRow.copy(prevRow);
  }

  return { width, height, rgba };
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crcBuf]);
}

function encodeRGBAtoPNG(rgba, width, height) {
  const stride = 1 + width * 4;
  const filtered = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    filtered[y * stride] = 0; // Filter 0
    rgba.copy(filtered, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatData = zlib.deflateSync(filtered, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // No interlace

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

console.log('Decoding original 9000x5625 image...');
const src = decodePNG(path.join(__dirname, '../Quanticus_Logo.pdf.png'));
console.log(`Original decoded: ${src.width}x${src.height}`);

// 1. Find bounding box of non-white pixels
let minX = src.width, maxX = 0, minY = src.height, maxY = 0;
for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const idx = (y * src.width + x) * 4;
    const r = src.rgba[idx];
    const g = src.rgba[idx + 1];
    const b = src.rgba[idx + 2];
    // Check if not pure white/light grey
    if (r < 240 || g < 240 || b < 240) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

// Add 3% margin to bounding box
const padX = Math.round((maxX - minX) * 0.04);
const padY = Math.round((maxY - minY) * 0.04);
minX = Math.max(0, minX - padX);
maxX = Math.min(src.width - 1, maxX + padX);
minY = Math.max(0, minY - padY);
maxY = Math.min(src.height - 1, maxY + padY);

const cropW = maxX - minX + 1;
const cropH = maxY - minY + 1;
console.log(`Cropped Bounding Box: [${minX}, ${minY}, ${cropW}, ${cropH}]`);

// 2. Downsample cropped region to a crisp target width (e.g. 1000px)
const TARGET_W = 1000;
const scale = TARGET_W / cropW;
const TARGET_H = Math.round(cropH * scale);
console.log(`Rescaling to ${TARGET_W}x${TARGET_H}`);

const targetRGBA = Buffer.alloc(TARGET_W * TARGET_H * 4);

for (let dy = 0; dy < TARGET_H; dy++) {
  for (let dx = 0; dx < TARGET_W; dx++) {
    const sx = Math.min(src.width - 1, Math.round(minX + dx / scale));
    const sy = Math.min(src.height - 1, Math.round(minY + dy / scale));
    const sIdx = (sy * src.width + sx) * 4;
    const dIdx = (dy * TARGET_W + dx) * 4;

    targetRGBA[dIdx] = src.rgba[sIdx];
    targetRGBA[dIdx + 1] = src.rgba[sIdx + 1];
    targetRGBA[dIdx + 2] = src.rgba[sIdx + 2];
    targetRGBA[dIdx + 3] = src.rgba[sIdx + 3];
  }
}

// 3. Flood-fill from borders to make outer white transparent, while keeping white letters inside the square solid white!
const isOuterTransparent = new Uint8Array(TARGET_W * TARGET_H);
const queue = [];

function isWhite(x, y) {
  const idx = (y * TARGET_W + x) * 4;
  const r = targetRGBA[idx];
  const g = targetRGBA[idx + 1];
  const b = targetRGBA[idx + 2];
  // Outer background is white (r,g,b > 240)
  return r > 240 && g > 240 && b > 240;
}

// Seed queue with border pixels
for (let x = 0; x < TARGET_W; x++) {
  if (isWhite(x, 0)) { isOuterTransparent[0 * TARGET_W + x] = 1; queue.push([x, 0]); }
  if (isWhite(x, TARGET_H - 1)) { isOuterTransparent[(TARGET_H - 1) * TARGET_W + x] = 1; queue.push([x, TARGET_H - 1]); }
}
for (let y = 0; y < TARGET_H; y++) {
  if (isWhite(0, y)) { isOuterTransparent[y * TARGET_W + 0] = 1; queue.push([0, y]); }
  if (isWhite(TARGET_W - 1, y)) { isOuterTransparent[y * TARGET_W + (TARGET_W - 1)] = 1; queue.push([TARGET_W - 1, y]); }
}

let head = 0;
while (head < queue.length) {
  const [cx, cy] = queue[head++];
  const neighbors = [
    [cx + 1, cy],
    [cx - 1, cy],
    [cx, cy + 1],
    [cx, cy - 1]
  ];

  for (const [nx, ny] of neighbors) {
    if (nx >= 0 && nx < TARGET_W && ny >= 0 && ny < TARGET_H) {
      const nIdx = ny * TARGET_W + nx;
      if (!isOuterTransparent[nIdx] && isWhite(nx, ny)) {
        isOuterTransparent[nIdx] = 1;
        queue.push([nx, ny]);
      }
    }
  }
}

// Apply transparency to outer pixels with anti-aliasing edge softening
for (let y = 0; y < TARGET_H; y++) {
  for (let x = 0; x < TARGET_W; x++) {
    const idx = (y * TARGET_W + x) * 4;
    const isOuter = isOuterTransparent[y * TARGET_W + x];
    if (isOuter) {
      targetRGBA[idx + 3] = 0; // Alpha 0
    }
  }
}

const transparentPNG = encodeRGBAtoPNG(targetRGBA, TARGET_W, TARGET_H);
const outDir = path.join(__dirname, '../assets');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'quanticus-logo.png'), transparentPNG);
fs.writeFileSync(path.join(outDir, 'quanticus-logo-transparent.png'), transparentPNG);

console.log('Successfully generated transparent cropped logo in assets/quanticus-logo.png !');
