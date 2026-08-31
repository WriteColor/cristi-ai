const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_DIR = path.join(os.tmpdir(), 'cristi_wpe_hd_cache');
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (_) {}
}

function decompressLZ4Block(src, uncompressedSize) {
  const dst = Buffer.alloc(uncompressedSize);
  let srcPos = 0, dstPos = 0;
  while (srcPos < src.length && dstPos < uncompressedSize) {
    const token = src[srcPos++];
    let literalLen = token >> 4;
    if (literalLen === 15) {
      let b;
      do {
        b = src[srcPos++];
        literalLen += b;
      } while (b === 255);
    }
    src.copy(dst, dstPos, srcPos, srcPos + literalLen);
    srcPos += literalLen;
    dstPos += literalLen;
    if (dstPos >= uncompressedSize || srcPos >= src.length) break;
    const offset = src.readUInt16LE(srcPos);
    srcPos += 2;
    let matchLen = (token & 0x0F) + 4;
    if (matchLen === 19) {
      let b;
      do {
        b = src[srcPos++];
        matchLen += b;
      } while (b === 255);
    }
    for (let i = 0; i < matchLen; i++) {
      dst[dstPos] = dst[dstPos - offset];
      dstPos++;
    }
  }
  return dst;
}

function decodeDXT5(dxtData, width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  let srcPos = 0;
  const blocksW = Math.ceil(width / 4);
  const blocksH = Math.ceil(height / 4);

  for (let by = 0; by < blocksH; by++) {
    for (let bx = 0; bx < blocksW; bx++) {
      if (srcPos + 16 > dxtData.length) break;
      const a0 = dxtData[srcPos++];
      const a1 = dxtData[srcPos++];
      const aTable = [a0, a1];
      if (a0 > a1) {
        for (let i = 1; i <= 6; i++) aTable.push(Math.round(((7 - i) * a0 + i * a1) / 7));
      } else {
        for (let i = 1; i <= 4; i++) aTable.push(Math.round(((5 - i) * a0 + i * a1) / 5));
        aTable.push(0);
        aTable.push(255);
      }
      let aBits = 0n;
      for (let i = 0; i < 6; i++) {
        aBits |= BigInt(dxtData[srcPos++]) << BigInt(i * 8);
      }

      const c0 = dxtData.readUInt16LE(srcPos);
      srcPos += 2;
      const c1 = dxtData.readUInt16LE(srcPos);
      srcPos += 2;
      const r0 = ((c0 >> 11) & 0x1F) * 255 / 31;
      const g0 = ((c0 >> 5) & 0x3F) * 255 / 63;
      const b0 = (c0 & 0x1F) * 255 / 31;
      const r1 = ((c1 >> 11) & 0x1F) * 255 / 31;
      const g1 = ((c1 >> 5) & 0x3F) * 255 / 63;
      const b1 = (c1 & 0x1F) * 255 / 31;

      const cTable = [
        [r0, g0, b0],
        [r1, g1, b1],
        [(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3],
        [(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3]
      ];

      const cBits = dxtData.readUInt32LE(srcPos);
      srcPos += 4;

      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const pixelX = bx * 4 + px;
          const pixelY = by * 4 + py;
          if (pixelX < width && pixelY < height) {
            const shift = BigInt((py * 4 + px) * 3);
            const aIdx = Number((aBits >> shift) & 0x07n);
            const alpha = aTable[aIdx];

            const cShift = (py * 4 + px) * 2;
            const cIdx = (cBits >> cShift) & 0x03;
            const rgb = cTable[cIdx];

            const dstIdx = (pixelY * width + pixelX) * 4;
            rgba[dstIdx] = Math.round(rgb[0]);
            rgba[dstIdx + 1] = Math.round(rgb[1]);
            rgba[dstIdx + 2] = Math.round(rgb[2]);
            rgba[dstIdx + 3] = alpha;
          }
        }
      }
    }
  }
  return rgba;
}

function decodeDXT1(dxtData, width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  let srcPos = 0;
  const blocksW = Math.ceil(width / 4);
  const blocksH = Math.ceil(height / 4);

  for (let by = 0; by < blocksH; by++) {
    for (let bx = 0; bx < blocksW; bx++) {
      if (srcPos + 8 > dxtData.length) break;
      const c0 = dxtData.readUInt16LE(srcPos);
      srcPos += 2;
      const c1 = dxtData.readUInt16LE(srcPos);
      srcPos += 2;
      const r0 = ((c0 >> 11) & 0x1F) * 255 / 31;
      const g0 = ((c0 >> 5) & 0x3F) * 255 / 63;
      const b0 = (c0 & 0x1F) * 255 / 31;
      const r1 = ((c1 >> 11) & 0x1F) * 255 / 31;
      const g1 = ((c1 >> 5) & 0x3F) * 255 / 63;
      const b1 = (c1 & 0x1F) * 255 / 31;

      let cTable;
      if (c0 > c1) {
        cTable = [
          [r0, g0, b0, 255],
          [r1, g1, b1, 255],
          [(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255],
          [(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255]
        ];
      } else {
        cTable = [
          [r0, g0, b0, 255],
          [r1, g1, b1, 255],
          [(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255],
          [0, 0, 0, 0]
        ];
      }

      const cBits = dxtData.readUInt32LE(srcPos);
      srcPos += 4;

      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const pixelX = bx * 4 + px;
          const pixelY = by * 4 + py;
          if (pixelX < width && pixelY < height) {
            const cShift = (py * 4 + px) * 2;
            const cIdx = (cBits >> cShift) & 0x03;
            const rgb = cTable[cIdx];

            const dstIdx = (pixelY * width + pixelX) * 4;
            rgba[dstIdx] = Math.round(rgb[0]);
            rgba[dstIdx + 1] = Math.round(rgb[1]);
            rgba[dstIdx + 2] = Math.round(rgb[2]);
            rgba[dstIdx + 3] = rgb[3];
          }
        }
      }
    }
  }
  return rgba;
}

function createBMP(rgba, width, height) {
  const rowSize = width * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeUInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // Top-down
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(32, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelArraySize, 34);

  let dstPos = 54;
  for (let i = 0; i < rgba.length; i += 4) {
    buf[dstPos++] = rgba[i + 2]; // B
    buf[dstPos++] = rgba[i + 1]; // G
    buf[dstPos++] = rgba[i];     // R
    buf[dstPos++] = rgba[i + 3]; // A
  }
  return buf;
}

/**
 * Extracts the highest-resolution full-size background texture/image from a Wallpaper Engine scene.pkg
 * Returns the cached file path on disk (BMP/JPEG/PNG) or null.
 */
function resolveHdMediaFromPkg(pkgPath) {
  try {
    const parentDir = path.dirname(pkgPath);
    const workshopId = path.basename(parentDir);
    const cacheFileBmp = path.join(CACHE_DIR, `wpe_${workshopId}_hd.bmp`);
    const cacheFileJpg = path.join(CACHE_DIR, `wpe_${workshopId}_hd.jpg`);
    const cacheFilePng = path.join(CACHE_DIR, `wpe_${workshopId}_hd.png`);

    if (fs.existsSync(cacheFileBmp)) return cacheFileBmp;
    if (fs.existsSync(cacheFileJpg)) return cacheFileJpg;
    if (fs.existsSync(cacheFilePng)) return cacheFilePng;

    if (!fs.existsSync(pkgPath)) return null;

    const buf = fs.readFileSync(pkgPath);
    const magicLen = buf.readUInt32LE(0);
    const fileCount = buf.readUInt32LE(4 + magicLen);
    let offset = 8 + magicLen;
    const entries = [];
    for (let i = 0; i < fileCount; i++) {
      const nameLen = buf.readUInt32LE(offset);
      offset += 4;
      const name = buf.slice(offset, offset + nameLen).toString('utf8');
      offset += nameLen;
      const fileOffset = buf.readUInt32LE(offset);
      offset += 4;
      const fileSize = buf.readUInt32LE(offset);
      offset += 4;
      entries.push({ name, fileOffset, fileSize });
    }
    const dataStart = offset;

    // Filter candidate textures
    const texEntries = entries
      .filter((e) => e.name.endsWith('.tex') || e.name.endsWith('.png') || e.name.endsWith('.jpg') || e.name.endsWith('.jpeg'))
      .sort((a, b) => b.fileSize - a.fileSize);

    for (const entry of texEntries) {
      const d = buf.slice(dataStart + entry.fileOffset, dataStart + entry.fileOffset + entry.fileSize);

      // 1. Direct Search for Embedded PNG in buffer
      const pngIdx = d.indexOf(Buffer.from([0x89, 0x50, 0x4E, 0x47]));
      if (pngIdx !== -1) {
        const pngBuf = d.slice(pngIdx);
        fs.writeFileSync(cacheFilePng, pngBuf);
        return cacheFilePng;
      }

      // 2. Direct Search for Embedded JPEG in buffer
      const jpgIdx = d.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]));
      if (jpgIdx !== -1) {
        const jpgBuf = d.slice(jpgIdx);
        fs.writeFileSync(cacheFileJpg, jpgBuf);
        return cacheFileJpg;
      }

      // 3. Texture Block (TEXB) DXT / RGBA Decoding
      const texbIdx = d.indexOf('TEXB');
      if (texbIdx === -1) continue;

      const format = d.readUInt32LE(texbIdx + 9 + 4);
      let width = 0;
      let height = 0;

      // Check TEXB format offsets
      if (d.slice(texbIdx, texbIdx + 8).toString('ascii') === 'TEXB0004') {
        width = d.readUInt32LE(texbIdx + 9 + 16);
        height = d.readUInt32LE(texbIdx + 9 + 20);
      } else {
        width = d.readUInt32LE(texbIdx + 9 + 12);
        height = d.readUInt32LE(texbIdx + 9 + 16);
      }

      if (width < 500 || height < 300) continue;

      const payload = d.slice(texbIdx + 9 + 28);

      let rgba;
      if (format === 13 || format === 5) {
        const rawDxt = decompressLZ4Block(payload, width * height);
        rgba = decodeDXT5(rawDxt, width, height);
      } else if (format === 11 || format === 1) {
        const rawDxt = decompressLZ4Block(payload, (width * height) / 2);
        rgba = decodeDXT1(rawDxt, width, height);
      } else if (format === 4) {
        rgba = decompressLZ4Block(payload, width * height * 4);
      }

      if (rgba) {
        const bmp = createBMP(rgba, width, height);
        fs.writeFileSync(cacheFileBmp, bmp);
        return cacheFileBmp;
      }
    }
  } catch (err) {
    console.error(`[wpePkgExtractor] Error extracting HD texture from ${pkgPath}:`, err.message);
  }
  return null;
}

module.exports = {
  resolveHdMediaFromPkg,
  CACHE_DIR
};
