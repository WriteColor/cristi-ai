import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}', 'electron/**/*.{js,cjs}', 'scripts/**/*.{js,cjs,mjs}', '*.config.{js,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        window: 'readonly',
        Response: 'readonly',
        BroadcastChannel: 'readonly',
        ClipboardItem: 'readonly',
        HTMLImageElement: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        Audio: 'readonly',
        ResizeObserver: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        AudioWorkletNode: 'readonly',
        ImageData: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        Image: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        WebSocket: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        Buffer: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-constant-condition': 'off',
      'no-useless-assignment': 'off'
    }
  }
];
