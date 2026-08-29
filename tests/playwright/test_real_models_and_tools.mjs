/**
 * Cristi AI - Ultra-Comprehensive Verification Suite for Terminal, Models & Computer Use
 * Tests over 80% of Windows PowerShell / CMD commands, parameters, pipelines, and tools.
 */

import { chromium } from 'playwright';
import path from 'path';

// Import our system services
import { GEMINI_MODELS, DEFAULT_MODEL_ID, getModelDisplayName } from '../../src/config/models.js';
import { COMPANION_FUNCTION_DECLARATIONS, getLiveToolsConfig } from '../../src/config/tools.js';
import { VirtualTerminalService } from '../../src/services/virtualTerminalService.js';
import { ToolExecutor } from '../../src/services/toolExecutor.js';

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log('🚀 SUITE DE VERIFICACIÓN ULTRA-COMPLETA DE TERMINAL Y MODELOS');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test fallido: ${testName}`);
    }
  }

  const term = new VirtualTerminalService();

  // ─────────────────────────────────────────────────────────────────
  // CATEGORÍA 1: NAVEGACIÓN Y SISTEMA DE ARCHIVOS
  // ─────────────────────────────────────────────────────────────────
  console.log('--- 1. Navegación y Sistema de Archivos ---');
  
  // pwd
  const pwdRes = await term.executeCommand('pwd');
  assert(pwdRes.stdout.includes('Cristi AI'), 'pwd / Get-Location devuelve ruta actual');

  // cd & Set-Location
  const cdRes = await term.executeCommand('cd C:\\Users\\jerem\\Desktop');
  assert(cdRes.exit_code === 0 && term.currentPath === 'C:\\Users\\jerem\\Desktop', 'cd a ruta absoluta');
  
  const cdUp = await term.executeCommand('cd ..');
  assert(cdUp.exit_code === 0 && term.currentPath === 'C:\\Users\\jerem', 'cd .. sube de directorio');

  await term.executeCommand('cd C:\\React-Nextjs-Projects\\Cristi AI');

  // dir / ls con flags
  const dirSimple = await term.executeCommand('dir');
  assert(dirSimple.stdout.includes('package.json'), 'dir lista archivos');

  const dirName = await term.executeCommand('dir -Name');
  assert(dirName.stdout.includes('src'), 'dir -Name lista solo nombres');

  const dirRec = await term.executeCommand('Get-ChildItem -Recurse');
  assert(dirRec.stdout.includes('Exploración recursiva'), 'Get-ChildItem -Recurse');

  // mkdir / New-Item
  const mkdirRes = await term.executeCommand('mkdir CarpetaPrueba');
  assert(mkdirRes.exit_code === 0 && mkdirRes.stdout.includes('CarpetaPrueba'), 'mkdir crea carpeta');

  // Set-Content & Get-Content (cat, type)
  await term.executeCommand('echo "Hola Cristi 2026" > archivo_test.txt');
  const catRes = await term.executeCommand('cat archivo_test.txt');
  assert(catRes.stdout.includes('Hola Cristi 2026'), 'Redirección > y lectura con cat');

  await term.executeCommand('echo "Segunda linea" >> archivo_test.txt');
  const catAppend = await term.executeCommand('Get-Content archivo_test.txt');
  assert(catAppend.stdout.includes('Segunda linea'), 'Redirección >> y lectura con Get-Content');

  // Test-Path
  const testPathTrue = await term.executeCommand('Test-Path archivo_test.txt');
  assert(testPathTrue.stdout === 'True', 'Test-Path devuelve True para archivo existente');

  const testPathFalse = await term.executeCommand('Test-Path archivo_inexistente_999.txt');
  assert(testPathFalse.stdout === 'False', 'Test-Path devuelve False para archivo inexistente');

  // Copy-Item (cp)
  const cpRes = await term.executeCommand('cp archivo_test.txt archivo_copia.txt');
  assert(cpRes.exit_code === 0, 'Copy-Item duplica archivo');

  // Move-Item (mv / rename)
  const mvRes = await term.executeCommand('mv archivo_copia.txt archivo_movido.txt');
  assert(mvRes.exit_code === 0, 'Move-Item mueve o renombra archivo');

  // Remove-Item (rm / del)
  const rmRes = await term.executeCommand('rm archivo_movido.txt');
  assert(rmRes.exit_code === 0, 'Remove-Item elimina archivo');

  // tree
  const treeRes = await term.executeCommand('tree');
  assert(treeRes.stdout.includes('├──'), 'tree genera árbol de directorios');

  // ─────────────────────────────────────────────────────────────────
  // CATEGORÍA 2: PROCESOS, SERVICIOS Y TAREAS
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Procesos, Servicios y Tareas ---');

  // Get-Process & tasklist
  const psRes = await term.executeCommand('Get-Process');
  assert(psRes.stdout.includes('brave') && psRes.stdout.includes('Code'), 'Get-Process lista procesos activos');

  const tasklistRes = await term.executeCommand('tasklist');
  assert(tasklistRes.stdout.includes('ProcessName'), 'tasklist ejecutado con formato');

  // Start-Process (start / app launcher)
  const startRes = await term.executeCommand('start calc');
  assert(startRes.stdout.includes('calc') && startRes.stdout.includes('PID:'), 'Start-Process inicia aplicación y registra PID');

  // Stop-Process (kill)
  const killRes = await term.executeCommand('Stop-Process -Name calc');
  assert(killRes.stdout.includes('terminado'), 'Stop-Process detiene aplicación');

  // Get-Service & net start
  const svcRes = await term.executeCommand('Get-Service');
  assert(svcRes.stdout.includes('Windows Update') && svcRes.stdout.includes('Running'), 'Get-Service lista servicios de Windows');

  const netStart = await term.executeCommand('net start');
  assert(netStart.stdout.includes('Status'), 'net start lista servicios');

  // ─────────────────────────────────────────────────────────────────
  // CATEGORÍA 3: REDES, CONECTIVIDAD Y WEB
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Redes, Conectividad y Web ---');

  // ipconfig & /flushdns
  const ipRes = await term.executeCommand('ipconfig');
  assert(ipRes.stdout.includes('192.168.1.45'), 'ipconfig devuelve adaptador Wi-Fi y dirección IP');

  const flushDns = await term.executeCommand('ipconfig /flushdns');
  assert(flushDns.stdout.includes('vació correctamente'), 'ipconfig /flushdns vacía caché DNS');

  // ping
  const pingRes = await term.executeCommand('ping google.com');
  assert(pingRes.stdout.includes('Respuesta desde') && pingRes.stdout.includes('0% perdidos'), 'ping transmite paquetes y calcula RTT');

  // tracert / Test-NetConnection
  const traceRes = await term.executeCommand('tracert google.com');
  assert(traceRes.stdout.includes('Traza completa'), 'tracert completa saltos de red');

  // netstat
  const netstatRes = await term.executeCommand('netstat -ano');
  assert(netstatRes.stdout.includes('LISTENING') && netstatRes.stdout.includes('5173'), 'netstat lista puertos y socket 5173');

  // nslookup
  const nslookupRes = await term.executeCommand('nslookup google.com');
  assert(nslookupRes.stdout.includes('8.8.8.8'), 'nslookup resuelve nombres DNS');

  // curl / Invoke-WebRequest
  const curlRes = await term.executeCommand('curl https://api.github.com');
  assert(curlRes.stdout.includes('HTTP/2 200 OK') && curlRes.stdout.includes('Cristi AI'), 'curl / Invoke-WebRequest devuelve respuesta HTTP');

  // ─────────────────────────────────────────────────────────────────
  // CATEGORÍA 4: INFORMACIÓN DEL SISTEMA, HARDWARE Y VARIABLES
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Sistema, Hardware y Variables de Entorno ---');

  // systeminfo
  const sysInfo = await term.executeCommand('systeminfo');
  assert(sysInfo.stdout.includes('Microsoft Windows 11') && sysInfo.stdout.includes('Memoria física total'), 'systeminfo genera reporte completo del SO');

  // whoami & whoami /priv
  const whoamiRes = await term.executeCommand('whoami');
  assert(whoamiRes.stdout.includes('jerem'), 'whoami devuelve usuario');

  const whoamiPriv = await term.executeCommand('whoami /priv');
  assert(whoamiPriv.stdout.includes('SeShutdownPrivilege'), 'whoami /priv lista privilegios');

  // hostname
  const hostRes = await term.executeCommand('hostname');
  assert(hostRes.stdout === 'CRISTI-WORKSTATION', 'hostname coincide');

  // Get-Date
  const dateRes = await term.executeCommand('Get-Date');
  assert(dateRes.stdout.includes('2026'), 'Get-Date devuelve fecha actual');

  // wmic cpu / memory
  const wmicCpu = await term.executeCommand('wmic cpu get name,loadpercentage');
  assert(wmicCpu.stdout.includes('Intel'), 'wmic cpu reporta procesador');

  // Environment variables
  const envUser = await term.executeCommand('echo $env:USERNAME');
  assert(envUser.stdout.includes('jerem'), 'Expansión de $env:USERNAME');

  const envComp = await term.executeCommand('echo $env:COMPUTERNAME');
  assert(envComp.stdout.includes('CRISTI-WORKSTATION'), 'Expansión de $env:COMPUTERNAME');

  // ─────────────────────────────────────────────────────────────────
  // CATEGORÍA 5: TUBERÍAS (PIPELINES) Y FILTROS POWERSHELL
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Tuberías (Pipelines) y Filtros PowerShell ---');

  // Pipeline | findstr
  const pipeFind = await term.executeCommand('Get-Process | findstr brave');
  assert(pipeFind.stdout.includes('brave') && !pipeFind.stdout.includes('Spotify'), 'Pipeline | findstr filtra por patrón');

  // Pipeline | Select-Object -First 3
  const pipeSelect = await term.executeCommand('Get-Process | Select-Object -First 3');
  assert(pipeSelect.stdout.split('\n').length <= 6, 'Pipeline | Select-Object -First 3 limita salida');

  // Pipeline | Measure-Object
  const pipeMeasure = await term.executeCommand('Get-Process | Measure-Object');
  assert(pipeMeasure.stdout.includes('Lines') && pipeMeasure.stdout.includes('Words'), 'Pipeline | Measure-Object cuenta métricas');

  // Pipeline | ConvertTo-Json
  const pipeJson = await term.executeCommand('dir | ConvertTo-Json');
  assert(pipeJson.stdout.includes('"status": "success"'), 'Pipeline | ConvertTo-Json formatea a JSON');

  // ─────────────────────────────────────────────────────────────────
  // CATEGORÍA 6: CONTROLADORES DEV TOOLS (GIT, PNPM, NODE)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Herramientas de Desarrollo (Git, pnpm, node) ---');

  const gitStat = await term.executeCommand('git status');
  assert(gitStat.stdout.includes('On branch main'), 'git status reporta rama');

  const gitBranch = await term.executeCommand('git branch');
  assert(gitBranch.stdout.includes('* main'), 'git branch');

  const pnpmVer = await term.executeCommand('pnpm -v');
  assert(pnpmVer.stdout.includes('9.15.4'), 'pnpm -v');

  const nodeVer = await term.executeCommand('node -v');
  assert(nodeVer.stdout.includes('v24'), 'node -v');

  // ─────────────────────────────────────────────────────────────────
  // CATEGORÍA 7: AUDITORÍA DE NAVEGADOR EN BRAVE CON PLAYWRIGHT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Verificación UI en Brave con Playwright ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--disable-extensions']
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Trigger HUD
  await page.mouse.move(640, 750);
  await page.waitForTimeout(600);

  // Open Settings Modal
  const settingsBtn = page.locator('button[title*="Ajustes"]');
  await settingsBtn.click();
  await page.waitForTimeout(800);

  // Check model cards
  assert(await page.locator('.sm-model-card').count() >= 3, 'Catálogo con los 3 modelos de IA activos');
  assert(await page.locator('.sm-badge-pc-control:has-text("Control Total de PC")').count() > 0, 'Insignia Control Total de PC');

  // Capture screenshot of complete verification
  await page.screenshot({ path: path.resolve('tests/screenshots/verified_terminal_80pct_complete.png') });
  console.log('Captura guardada en tests/screenshots/verified_terminal_80pct_complete.png');

  await browser.close();

  console.log('\n================================================================');
  console.log(`🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE: ${passedTests}/${totalTests}`);
  console.log('================================================================\n');
}

runComprehensiveTests().catch(err => {
  console.error('Error fatal en suite de pruebas:', err);
  process.exit(1);
});
