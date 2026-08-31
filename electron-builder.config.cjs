'use strict';

module.exports = {
  appId: 'com.cristi.desktop',
  productName: 'Cristi Desktop',
  copyright: 'Copyright © 2026 Cristi AI Team',
  directories: {
    output: 'release',
    buildResources: 'resources',
  },
  files: [
    'dist/**/*',
    'electron/**/*',
    'public/**/*',
    'resources/**/*',
    'package.json',
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'resources/icons/icon.ico',
    requestedExecutionLevel: 'asInvoker',
    artifactName: 'Cristi-Desktop-Setup-${version}.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Cristi Desktop',
    installerIcon: 'resources/icons/icon.ico',
    uninstallerIcon: 'resources/icons/icon.ico',
    uninstallDisplayName: 'Cristi Desktop',
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
  },
  publish: [
    {
      provider: 'generic',
      url: 'https://releases.cristi.ai/download',
    },
  ],
  extraResources: [
    {
      from: 'public/',
      to: 'public/',
      filter: ['**/*'],
    },
  ],
};

