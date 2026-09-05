import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== VERIFICANDO SPOTIFY Y SISTEMA REAL ===');

// Check standard Spotify paths
const candidates = [
  path.join(process.env.APPDATA || '', 'Spotify', 'Spotify.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Spotify', 'Spotify.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'Spotify.exe'),
  'C:\\Program Files\\Spotify\\Spotify.exe',
  'C:\\Program Files (x86)\\Spotify\\Spotify.exe'
];

for (const p of candidates) {
  console.log(`Path [${p}]: ${fs.existsSync(p) ? 'ENCONTRADO' : 'NO EXISTE'}`);
}

// Check AppX
try {
  const out = execSync(`powershell -NoProfile -Command "Get-AppxPackage *Spotify* | Select-Object -Property Name, PackageFamilyName, InstallLocation | ConvertTo-Json"`, { encoding: 'utf-8' });
  console.log('AppX Spotify:', out.trim() || 'No AppX found');
} catch (e) {
  console.log('Error buscando AppX:', e.message);
}

// Check Spotify Web API / Web player or protocol handler
try {
  const regOut = execSync(`powershell -NoProfile -Command "Get-ItemProperty 'HKCU:\\Software\\Classes\\spotify' -ErrorAction SilentlyContinue | ConvertTo-Json"`, { encoding: 'utf-8' });
  console.log('Registry spotify: URI protocol:', regOut.trim() || 'No protocol handler');
} catch (e) {
  console.log('Protocol check:', e.message);
}
