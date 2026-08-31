import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/mp4',
    '.mov': 'video/quicktime',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json'
  };
  return mimes[ext] || 'application/octet-stream';
}

function wpeMediaPlugin() {
  return {
    name: 'wpe-media-plugin',
    configureServer(server) {
      // 1. Wallpaper Engine Scanner Endpoint for Web/Browser & Electron
      server.middlewares.use('/__wpe_scan', async (req, res) => {
        const drives = ['C:', 'D:', 'E:', 'F:', 'G:'];
        const possibleRoots = [];
        for (const d of drives) {
          possibleRoots.push(
            path.join(d, 'Program Files (x86)', 'Steam', 'steamapps'),
            path.join(d, 'Program Files', 'Steam', 'steamapps'),
            path.join(d, 'SteamLibrary', 'steamapps'),
            path.join(d, 'Steam', 'steamapps')
          );
        }

        const results = [];
        const visited = new Set();

        for (const steamRoot of possibleRoots) {
          try {
            if (!fs.existsSync(steamRoot)) continue;

            // Workshop Wallpapers
            const workshopDir = path.join(steamRoot, 'workshop', 'content', '431960');
            if (fs.existsSync(workshopDir)) {
              const itemDirs = await fs.promises.readdir(workshopDir, { withFileTypes: true });
              for (const itemDir of itemDirs) {
                if (!itemDir.isDirectory()) continue;
                const fullPath = path.join(workshopDir, itemDir.name);
                if (visited.has(fullPath)) continue;
                visited.add(fullPath);

                const projectJson = path.join(fullPath, 'project.json');
                if (fs.existsSync(projectJson)) {
                  try {
                    const data = JSON.parse(await fs.promises.readFile(projectJson, 'utf8'));
                    let mainFile = data.file ? path.join(fullPath, data.file) : null;
                    let previewFile = data.preview ? path.join(fullPath, data.preview) : null;
                    let finalType = data.type ? data.type.toLowerCase() : 'video';

                    const files = await fs.promises.readdir(fullPath);
                    const videoMatch = files.find(f => /\.(mp4|webm|mkv|mov)$/i.test(f));
                    const htmlMatch = files.find(f => /\.(html|htm)$/i.test(f));
                    const imageMatch = files.find(f => /\.(gif|png|jpg|jpeg|webp)$/i.test(f));

                    if (videoMatch) {
                      mainFile = path.join(fullPath, videoMatch);
                      finalType = 'video';
                    } else if (htmlMatch) {
                      mainFile = path.join(fullPath, htmlMatch);
                      finalType = 'web';
                    } else if (!mainFile || mainFile.endsWith('.json') || mainFile.endsWith('.pkg')) {
                      if (previewFile && fs.existsSync(previewFile)) {
                        mainFile = previewFile;
                      } else if (imageMatch) {
                        mainFile = path.join(fullPath, imageMatch);
                      }
                      finalType = mainFile && /\.gif$/i.test(mainFile) ? 'animated' : 'image';
                    }

                    if (previewFile && !fs.existsSync(previewFile) && imageMatch) {
                      previewFile = path.join(fullPath, imageMatch);
                    }

                    results.push({
                      id: `wpe_${itemDir.name}`,
                      workshopId: itemDir.name,
                      name: data.title || `Wallpaper ${itemDir.name}`,
                      category: 'wallpaper_engine',
                      type: finalType,
                      mainPath: mainFile ? `/__wpe_media?path=${encodeURIComponent(mainFile)}` : null,
                      previewPath: previewFile ? `/__wpe_media?path=${encodeURIComponent(previewFile)}` : (mainFile ? `/__wpe_media?path=${encodeURIComponent(mainFile)}` : null),
                      rawPath: mainFile,
                      description: data.description || `Wallpaper Engine Workshop (#${itemDir.name})`
                    });
                  } catch (_) {}
                }
              }
            }
          } catch (_) {}
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(results));
      });

      // 2. High-Performance Media Streaming Endpoint (with HTTP 206 Range support)
      server.middlewares.use('/__wpe_media', (req, res) => {
        try {
          const urlObj = new URL(req.url, 'http://localhost');
          let filePath = urlObj.searchParams.get('path');
          if (!filePath) {
            res.statusCode = 400;
            return res.end('No path provided');
          }

          // Recursively unwrap any nested /__wpe_media?path= prefixes
          while (filePath.startsWith('/__wpe_media?path=')) {
            filePath = decodeURIComponent(filePath.replace('/__wpe_media?path=', ''));
          }

          filePath = filePath.replace(/^file:\/\/\//, '');
          filePath = path.normalize(filePath);

          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            return res.end(`Archivo no encontrado: ${filePath}`);
          }

          const stat = fs.statSync(filePath);
          const fileSize = stat.size;
          const range = req.headers.range;
          const contentType = getMimeType(filePath);

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=86400');

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = end - start + 1;
            const file = fs.createReadStream(filePath, { start, end });
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': contentType,
            });
            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': contentType,
            });
            fs.createReadStream(filePath).pipe(res);
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(e.message);
        }
      });
    }
  };
}

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
  plugins: [react(), wpeMediaPlugin(), terminalLoggerPlugin()],
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
  }
});
