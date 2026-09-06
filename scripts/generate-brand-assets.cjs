const fs = require('fs');
const path = require('path');
const { app, nativeImage } = require('electron');

const projectRoot = path.join(__dirname, '..');
const logoSourcePath = 'C:\\Users\\jerem\\Downloads\\ChatGPT Image 5 sept 2026, 19_55_57.png';
const bannerSourcePath = 'C:\\Users\\jerem\\Downloads\\ChatGPT Image 5 sept 2026, 20_42_20.png';

const iconsDir = path.join(projectRoot, 'assets', 'icons');
const faviconPath = path.join(projectRoot, 'public', 'favicon.ico');
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
  // 1. Process New Red Logo
  const logoSource = nativeImage.createFromPath(logoSourcePath);
  if (logoSource.isEmpty()) throw new Error(`No se pudo cargar el logo fuente: ${logoSourcePath}`);

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // High quality copy to assets/icons/icon.png
  fs.copyFileSync(logoSourcePath, path.join(iconsDir, 'icon.png'));
  
  // Tray icons (64x64)
  const trayPng = logoSource.resize({ width: 64, height: 64, quality: 'best' }).toPNG();
  fs.writeFileSync(path.join(iconsDir, 'tray-icon.png'), trayPng);
  fs.writeFileSync(path.join(projectRoot, 'public', 'tray-icon.png'), trayPng);

  // App icon for web / public (512x512)
  const appIconPng = logoSource.resize({ width: 512, height: 512, quality: 'best' }).toPNG();
  fs.writeFileSync(path.join(projectRoot, 'public', 'icon.png'), appIconPng);

  // Favicon PNG (32x32)
  const favicon32 = logoSource.resize({ width: 32, height: 32, quality: 'best' }).toPNG();
  fs.writeFileSync(path.join(projectRoot, 'public', 'favicon.png'), favicon32);

  // Multi-resolution ICO (16, 24, 32, 48, 64, 128, 256)
  const ico = createIco(iconSizes.map((size) => ({
    size,
    data: logoSource.resize({ width: size, height: size, quality: 'best' }).toPNG()
  })));
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
  fs.writeFileSync(faviconPath, ico);

  console.log('✅ Logo e iconos maestros (diseño rojo) generados con éxito.');

  // 2. Process New Global Banner
  const bannerSource = nativeImage.createFromPath(bannerSourcePath);
  if (bannerSource.isEmpty()) throw new Error(`No se pudo cargar el banner fuente: ${bannerSourcePath}`);

  const docsAssetsDir = path.join(projectRoot, 'docs', 'assets');
  const publicAssetsDir = path.join(projectRoot, 'public', 'assets');
  if (!fs.existsSync(docsAssetsDir)) fs.mkdirSync(docsAssetsDir, { recursive: true });
  if (!fs.existsSync(publicAssetsDir)) fs.mkdirSync(publicAssetsDir, { recursive: true });

  const bannerPngBuffer = fs.readFileSync(bannerSourcePath);
  const bannerJpgBuffer = bannerSource.toJPEG(95);

  // Write PNG & JPG versions to docs/assets and public/assets
  fs.writeFileSync(path.join(docsAssetsDir, 'cristi-banner.png'), bannerPngBuffer);
  fs.writeFileSync(path.join(docsAssetsDir, 'cristi-banner.jpg'), bannerJpgBuffer);

  fs.writeFileSync(path.join(publicAssetsDir, 'cristi-banner.png'), bannerPngBuffer);
  fs.writeFileSync(path.join(publicAssetsDir, 'cristi-banner.jpg'), bannerJpgBuffer);

  console.log('✅ Banner global actualizado en docs/assets y public/assets (.png y .jpg).');

  // 3. Sync to dist if dist exists
  const distDir = path.join(projectRoot, 'dist');
  if (fs.existsSync(distDir)) {
    try {
      fs.writeFileSync(path.join(distDir, 'favicon.ico'), ico);
      fs.writeFileSync(path.join(distDir, 'favicon.png'), favicon32);
      fs.writeFileSync(path.join(distDir, 'icon.png'), appIconPng);
      fs.writeFileSync(path.join(distDir, 'tray-icon.png'), trayPng);

      const distAssetsDir = path.join(distDir, 'assets');
      if (!fs.existsSync(distAssetsDir)) fs.mkdirSync(distAssetsDir, { recursive: true });
      fs.writeFileSync(path.join(distAssetsDir, 'cristi-banner.png'), bannerPngBuffer);
      fs.writeFileSync(path.join(distAssetsDir, 'cristi-banner.jpg'), bannerJpgBuffer);
      console.log('✅ Sincronizados logos y banner en dist/');
    } catch (e) {
      console.warn('Aviso sincronizando dist:', e.message);
    }
  }

  console.log('🎉 Identidad de marca (Logo rojo + Banner global) procesada con éxito!');
  app.quit();
}).catch((error) => {
  console.error('Error generando brand assets:', error);
  app.exit(1);
});
