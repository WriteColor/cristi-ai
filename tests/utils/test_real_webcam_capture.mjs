import http from 'http';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function testWebcam() {
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
  console.log('Creando servidor local seguro para WebRTC...');

  const html = `<!DOCTYPE html>
  <html>
  <head><title>Camera Test</title></head>
  <body style="background:#000; color:#fff;">
    <h2>Test Camara</h2>
    <video id="vid" autoplay playsinline width="640" height="480" style="background:#222;"></video>
    <canvas id="can" width="640" height="480" style="display:none;"></canvas>
    <script>
      window.startCam = async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return { success: false, error: 'mediaDevices no disponible en este contexto' };
          }
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          const vid = document.getElementById('vid');
          vid.srcObject = stream;
          await vid.play();
          const track = stream.getVideoTracks()[0];
          return { success: true, label: track ? track.label : 'Cámara activa' };
        } catch (e) {
          return { success: false, error: e.name + ': ' + e.message };
        }
      };

      window.grabFrame = () => {
        const vid = document.getElementById('vid');
        const can = document.getElementById('can');
        const ctx = can.getContext('2d');
        ctx.drawImage(vid, 0, 0, 640, 480);
        return can.toDataURL('image/jpeg', 0.85).split(',')[1];
      };
    </script>
  </body>
  </html>`;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  await new Promise((r) => server.listen(9876, '127.0.0.1', r));
  console.log('Servidor en http://127.0.0.1:9876');

  const browser = await chromium.launch({
    executablePath: fs.existsSync(bravePath) ? bravePath : undefined,
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const context = await browser.newContext({
    permissions: ['camera']
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:9876');

  console.log('Iniciando captura física de cámara...');
  const initRes = await page.evaluate(() => window.startCam());
  console.log('Resultado inicio cámara:', initRes);

  if (initRes.success) {
    console.log(`Cámara física activada: "${initRes.label}". Esperando fotograma real (1.5s)...`);
    await new Promise((r) => setTimeout(r, 1500));
    const b64 = await page.evaluate(() => window.grabFrame());
    console.log('Bytes de imagen base64:', b64?.length);

    if (b64 && b64.length > 1000) {
      const outDir = path.resolve('tests/artifacts/live_verification');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.resolve(outDir, 'real_hardware_webcam.jpg');
      fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
      console.log('FOTOGRAMA FÍSICO REAL GUARDADO:', outPath);
    }
  }

  await browser.close();
  server.close();
}

testWebcam().catch((e) => console.error(e));
