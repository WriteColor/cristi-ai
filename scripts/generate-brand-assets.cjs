const fs = require('fs');
const path = require('path');
const { app, nativeImage } = require('electron');

const projectRoot = path.join(__dirname, '..');
const logoSourcePath = 'C:\\Users\\jerem\\Downloads\\ChatGPT Image 5 sept 2026, 19_55_57.png';
const bannerSourcePath = 'C:\\Users\\jerem\\Downloads\\ChatGPT Image 5 sept 2026, 20_42_20.png';

const publicDir = path.join(projectRoot, 'public');
const faviconPath = path.join(publicDir, 'favicon.ico');
const iconSizes = [16, 24, 32, 48, 64, 128, 256];

function createIco(images) {
  const directorySize = 6 + (images.length * 16);
  const output = Buffer.alloc(directorySize + images.reduce((total, image) => total + image.data.length, 0));
  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(images.length, 4);

  let dataOffset = directorySize;
  for (const [index, image] of images.entries()) {
    const entryOffset = 6 + (index * 16);
    output.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset);
    output.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1);
    output.writeUInt8(0, entryOffset + 2);
    output.writeUInt8(0, entryOffset + 3);
    output.writeUInt16LE(1, entryOffset + 4);
    output.writeUInt16LE(32, entryOffset + 6);
    output.writeUInt32LE(image.data.length, entryOffset + 8);
    output.writeUInt32LE(dataOffset, entryOffset + 12);
    image.data.copy(output, dataOffset);
    dataOffset += image.data.length;
  }

  return output;
}

app.whenReady().then(() => {
  // 1. Process Logo into Canonical public/ Directory (Zero Duplication)
  const logoSource = nativeImage.createFromPath(logoSourcePath);
  if (logoSource.isEmpty()) throw new Error(`No se pudo cargar el logo fuente: ${logoSourcePath}`);

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Canonical full-res copy to public/icon.png
  fs.copyFileSync(logoSourcePath, path.join(publicDir, 'icon.png'));

  // Tray icon (64x64 HiDPI)
  const trayPng = logoSource.resize({ width: 64, height: 64, quality: 'best' }).toPNG();
  fs.writeFileSync(path.join(publicDir, 'tray-icon.png'), trayPng);

  // Multi-resolution ICO (16, 24, 32, 48, 64, 128, 256) for Windows and Web
  const ico = createIco(iconSizes.map((size) => ({
    size,
    data: logoSource.resize({ width: size, height: size, quality: 'best' }).toPNG()
  })));
  fs.writeFileSync(faviconPath, ico);

  console.log('✅ Logo e iconos maestros (diseño rojo) generados exclusivamente en public/ (sin duplicación).');

  // 2. Process Banner into docs/assets/ (Single Source for Documentation & GitHub)
  const bannerSource = nativeImage.createFromPath(bannerSourcePath);
  if (bannerSource.isEmpty()) throw new Error(`No se pudo cargar el banner fuente: ${bannerSourcePath}`);

  const docsAssetsDir = path.join(projectRoot, 'docs', 'assets');
  if (!fs.existsSync(docsAssetsDir)) fs.mkdirSync(docsAssetsDir, { recursive: true });

  const bannerPngBuffer = fs.readFileSync(bannerSourcePath);
  fs.writeFileSync(path.join(docsAssetsDir, 'cristi-banner.png'), bannerPngBuffer);

  console.log('✅ Banner global actualizado en docs/assets/cristi-banner.png.');

  // 3. Sync to dist if dist exists
  const distDir = path.join(projectRoot, 'dist');
  if (fs.existsSync(distDir)) {
    try {
      fs.writeFileSync(path.join(distDir, 'favicon.ico'), ico);
      fs.writeFileSync(path.join(distDir, 'icon.png'), fs.readFileSync(logoSourcePath));
      fs.writeFileSync(path.join(distDir, 'tray-icon.png'), trayPng);
      console.log('✅ Sincronizados logos en dist/');
    } catch (e) {
      console.warn('Aviso sincronizando dist:', e.message);
    }
  }

  console.log('🎉 Identidad de marca unificada (sin archivos duplicados) procesada con éxito!');
  app.quit();
}).catch((error) => {
  console.error('Error generando brand assets:', error);
  app.exit(1);
});
