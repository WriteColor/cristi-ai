'use strict';

module.exports = {
  appId: 'com.cristi.companion',
  productName: 'Cristi AI Companion',
  copyright: 'Copyright © 2026 Write_Color',
  directories: {
    output: 'release',
    buildResources: 'resources',
  },
  compression: 'maximum',
  asar: true,
  files: [
    'dist/**/*',
    'electron/**/*',
    'package.json',
    '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!**/node_modules/*.d.ts',
    '!**/node_modules/.bin',
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'resources/icons/icon.ico',
    requestedExecutionLevel: 'requireAdministrator',
    forceCodeSigning: false,
    artifactName: 'Cristi-AI-Companion-Setup-${version}.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Cristi AI Companion',
    installerIcon: 'resources/icons/icon.ico',
    uninstallerIcon: 'resources/icons/icon.ico',
    uninstallDisplayName: 'Cristi AI Companion',
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
    differentialPackage: true,
  },
};

