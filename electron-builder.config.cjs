/**
 * Cristi AI Companion — Electron Builder Packaging Configuration
 * Modern Windows NSIS x64 packaging specification.
 *
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.writecolor.cristiaicompanion',
  productName: 'Cristi AI Companion',
  directories: {
    output: 'release',
    buildResources: 'public'
  },
  files: [
    'dist/**/*',
    'electron/dist/**/*',
    'electron/main.cjs',
    'electron/preload.cjs',
    'native/**/*',
    'public/icon.png',
    'public/tray-icon.png',
    'public/favicon.ico',
    'public/live2dcubismcore.min.js',
    'public/models/**/*',
    'public/audio/**/*',
    'package.json'
  ],
  extraResources: [
    {
      from: 'native',
      to: 'native',
      filter: ['**/*']
    },
    {
      from: 'public/tray-icon.png',
      to: 'tray-icon.png'
    },
    {
      from: 'public/icon.png',
      to: 'icon.png'
    },
    {
      from: 'public/favicon.ico',
      to: 'favicon.ico'
    }
  ],
  win: {
    icon: 'public/icon.png',
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    artifactName: 'Cristi-AI-Companion-Setup-${version}.${ext}',
    requestedExecutionLevel: 'asInvoker'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Cristi AI Companion'
  },
  asar: true,
  // Native WASAPI loopback helper and scripts must be unpacked outside ASAR
  // so Windows CreateProcess / powershell can invoke the executable directly.
  asarUnpack: [
    'native/**/*',
    'native/CristiWasapiLoopback.exe'
  ]
};
