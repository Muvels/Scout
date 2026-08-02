import { defineConfig } from 'tbf/config';

export default defineConfig({
  appId: 'framework.thebrowser.scout',
  productName: 'Scout',
  protocols: ['scout'],
  pages: { settings: 'pages/settings' },
  runtime: 'node',
  permissions: { fs: ['appData'], net: true, subprocess: false },
  shell: {
    security: { trustedTypes: true, connectSrc: ["'self'"] },
  },
  windows: { browser: 'shell/index.html' },
  extensions: {
    // uBlock Origin ships as Scout's content blocker; scout://settings owns
    // the on/off control, so it installs preapproved instead of prompting.
    bundled: [{ path: 'extensions/ublock', preapproved: true }],
  },
  icons: {
    mac: 'assets/icon.icns',
    win: 'assets/icon.png',
    linux: 'assets/icon.png',
  },
  build: {
    targets: {
      mac: ['dmg', 'zip'],
      win: ['nsis'],
      linux: ['appimage', 'deb'],
    },
    ffmpeg: 'proprietary',
  },
});
