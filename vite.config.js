import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function terminalLoggerPlugin() {
  return {
    name: 'terminal-logger',
    configureServer(server) {
      server.middlewares.use('/__log', (req, res) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const { level, tag, message, data } = JSON.parse(body);
            const timestamp = new Date().toLocaleTimeString('es-ES');
            const chalkTime = `\x1b[90m[${timestamp}]\x1b[0m`;

            const tagColorMap = {
              GEMINI: '\x1b[35m',
              AUDIO: '\x1b[36m',
              ASR: '\x1b[32m',
              VISION: '\x1b[31m',
              TOOL: '\x1b[33m',
              SYSTEM: '\x1b[34m',
              SCENE: '\x1b[35m'
            };
            const tagColor = tagColorMap[tag] || '\x1b[35m';
            const chalkTag = `${tagColor}[${tag}]\x1b[0m`;

            let prefix = '\x1b[32m[INFO]\x1b[0m';
            if (level === 'error') prefix = '\x1b[31m[ERROR]\x1b[0m';
            else if (level === 'warn') prefix = '\x1b[33m[WARN]\x1b[0m';
            else if (level === 'voice') prefix = '\x1b[36m[VOICE]\x1b[0m';

            const hasValidData = data && typeof data === 'object' && Object.keys(data).length > 0;
            const payloadStr = hasValidData ? ` \x1b[90m=> ${JSON.stringify(data)}\x1b[0m` : '';
            console.log(`${chalkTime} ${prefix} ${chalkTag} ${message}${payloadStr}`);
          } catch (e) {}
          res.statusCode = 200;
          res.end('ok');
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), terminalLoggerPlugin()],
  base: './',
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: false,
    watch: {
      ignored: ['**/tests/videos/**', '**/tests/screenshots/**']
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  }
});
