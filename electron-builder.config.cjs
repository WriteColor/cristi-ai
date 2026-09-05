/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: "com.writecolor.cristiaicompanion",
  productName: "Cristi AI Companion",
  directories: {
    output: "release"
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "assets/icons/**/*",
    "package.json"
  ],
  win: {
    icon: "assets/icons/icon.ico",
    target: [
      {
        target: "nsis",
        arch: [
          "x64"
        ]
      }
    ],
    artifactName: "Cristi-AI-Companion-Setup-${version}.${ext}"
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false
  },
  asar: true
};
