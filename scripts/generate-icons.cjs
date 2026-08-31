/**
 * Cristi Desktop - Automated Multi-Format Visual Identity & Icon Generator
 * Generates Windows .ico (multi-resolution 16-256px), System Tray PNGs,
 * application icons, and web favicons.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT_DIR = path.join(__dirname, '..');
const ICONS_DIR = path.join(ROOT_DIR, 'resources', 'icons');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. Master SVG (Cyberpunk Cristi AI Prism)
const MASTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b0764" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#05010d" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="coreGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background rounded tech hexagon -->
  <rect width="512" height="512" rx="100" fill="url(#bgGlow)" />
  <rect x="12" y="12" width="488" height="488" rx="88" fill="none" stroke="#a855f7" stroke-width="4" stroke-opacity="0.3" stroke-dasharray="12 8" />

  <!-- Outer Cyber Diamond Ring -->
  <g filter="url(#glow)">
    <polygon points="256,64 432,240 256,416 80,240" fill="none" stroke="url(#neonGrad)" stroke-width="16" stroke-linejoin="round" />
  </g>

  <!-- Inner Dynamic Soundwave / Neural Iris Prism -->
  <polygon points="256,120 376,240 256,360 136,240" fill="url(#coreGrad)" fill-opacity="0.25" stroke="#38bdf8" stroke-width="6" />

  <!-- Central Audio Waveform Bars (S2S Voice Presence) -->
  <g fill="url(#neonGrad)">
    <rect x="192" y="210" width="12" height="60" rx="6" />
    <rect x="218" y="180" width="12" height="120" rx="6" />
    <rect x="250" y="150" width="12" height="180" rx="6" />
    <rect x="282" y="180" width="12" height="120" rx="6" />
    <rect x="308" y="210" width="12" height="60" rx="6" />
  </g>

  <!-- High-Tech Corner Crosshairs -->
  <path d="M 40 100 L 40 40 L 100 40" fill="none" stroke="#c084fc" stroke-width="6" />
  <path d="M 472 100 L 472 40 L 412 40" fill="none" stroke="#c084fc" stroke-width="6" />
  <path d="M 40 412 L 40 472 L 100 472" fill="none" stroke="#c084fc" stroke-width="6" />
  <path d="M 472 412 L 472 472 L 412 472" fill="none" stroke="#c084fc" stroke-width="6" />

  <!-- Core AI Sparkle -->
  <circle cx="256" cy="240" r="14" fill="#ffffff" filter="url(#glow)" />
</svg>`;

// CRC32 table calculator
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ (-1)) >>> 0;
}

function makePngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Pure JS Ultra-High-Fidelity Cyberpunk PNG Generator
function createCyberpunkPng(width, height) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = width / 2 - 1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        const norm = dist / r;
        // Cyberpunk Obsidian, Neon Violet (#a855f7) & Electric Cyan (#06b6d4)
        const red = Math.min(255, Math.floor(168 * (1 - norm * 0.6) + 30 * norm));
        const green = Math.min(255, Math.floor(85 * (1 - norm * 0.5) + 180 * (1 - norm) * 0.4));
        const blue = Math.min(255, Math.floor(247 * (1 - norm * 0.2) + 212 * (1 - norm) * 0.5));
        const alpha = Math.floor(Math.min(255, (1 - Math.max(0, (dist - (r - 1.2)) / 1.2)) * 255));

        rawData[pxOffset] = red;
        rawData[pxOffset + 1] = green;
        rawData[pxOffset + 2] = blue;
        rawData[pxOffset + 3] = alpha;
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = makePngChunk('IHDR', ihdrData);
  const idat = makePngChunk('IDAT', compressed);
  const iend = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Build Windows .ICO with multi-layer PNGs
function buildIcoFile(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let currentOffset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4);

  const directoryEntries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(item.width === 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height === 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // Palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Planes
    entry.writeUInt16LE(32, 6); // 32-bit
    entry.writeUInt32LE(item.buffer.length, 8);
    entry.writeUInt32LE(currentOffset, 12);
    directoryEntries.push(entry);
    currentOffset += item.buffer.length;
  }

  return Buffer.concat([header, ...directoryEntries, ...pngBuffers.map(p => p.buffer)]);
}

console.log('======================================================');
console.log('🎨 CRISTI DESKTOP - GENERADOR AUTOMATIZADO DE ICONOS');
console.log('======================================================');

// 1. Generate SVGs
fs.writeFileSync(path.join(ICONS_DIR, 'icon-source.svg'), MASTER_SVG, 'utf8');
fs.writeFileSync(path.join(ICONS_DIR, 'tray-icon.svg'), MASTER_SVG, 'utf8');
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), MASTER_SVG, 'utf8');

// 2. Generate PNGs at required resolutions
const png256 = createCyberpunkPng(256, 256);
const png128 = createCyberpunkPng(128, 128);
const png64 = createCyberpunkPng(64, 64);
const png32 = createCyberpunkPng(32, 32);
const png16 = createCyberpunkPng(16, 16);

// Save PNGs for Electron & System Tray
fs.writeFileSync(path.join(ICONS_DIR, 'icon.png'), png256);
fs.writeFileSync(path.join(ICONS_DIR, 'tray-icon.png'), png32);
fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.png'), png256);
fs.writeFileSync(path.join(PUBLIC_DIR, 'tray-icon.png'), png32);

// 3. Build Windows .ico files
const icoBuffer = buildIcoFile([
  { width: 256, height: 256, buffer: png256 },
  { width: 128, height: 128, buffer: png128 },
  { width: 64, height: 64, buffer: png64 },
  { width: 32, height: 32, buffer: png32 },
  { width: 16, height: 16, buffer: png16 }
]);

fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), icoBuffer);
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);

console.log(`[IconGen] ✅ Master SVGs & Multi-layer Windows .ico creados.`);
console.log(`[IconGen] ✅ PNGs 256px, 128px, 64px, 32px, 16px generados en /resources/icons y /public`);
console.log('======================================================\n');
