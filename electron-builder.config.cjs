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
    "native/**/*",
    "public/**/*",
    "package.json"
  ],
  win: {
    icon: "public/favicon.ico",
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
  asar: true,
  // PowerShell/C# source and the helper executable must remain filesystem
  // visible because WASAPI is launched as a child process outside asar.
  asarUnpack: ["native/**/*"]
};
