# ================================================================
#  🌸 CRISTI AI COMPANION - SCRIPT DE INSTALACIÓN AUTOMÁTICA
#  Autor: Write_Color
# ================================================================

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " 🌸 CRISTI AI COMPANION - INSTALACIÓN Y CONFIGURACIÓN AUTOMÁTICA" -ForegroundColor Magenta
Write-Host " Autor: Write_Color" -ForegroundColor DarkGray
Write-Host "================================================================`n" -ForegroundColor Cyan

# 1. Check Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[ERROR] Node.js no está instalado o no se encuentra en el PATH." -ForegroundColor Red
    Write-Host "Descarga e instala Node.js LTS (v18 a v24) desde https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
$nodeVersion = node -v
Write-Host "[1/4] Node.js detectado: $nodeVersion" -ForegroundColor Green

# 2. Check and activate pnpm
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
    Write-Host "[2/4] pnpm no detectado. Activando con corepack..." -ForegroundColor Yellow
    corepack enable
    corepack prepare pnpm@latest --activate
    $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpmCmd) {
        Write-Host "[ERROR] No se pudo activar pnpm. Instálalo ejecutando: npm install -g pnpm" -ForegroundColor Red
        exit 1
    }
}
$pnpmVersion = pnpm -v
Write-Host "[2/4] pnpm detectado: v$pnpmVersion" -ForegroundColor Green

# 3. Install Dependencies
Write-Host "`n[3/4] Instalando dependencias del proyecto con pnpm..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Falló la instalación de dependencias." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 4. Run Bootstrapper
Write-Host "`n[4/4] Ejecutando validación integral del entorno..." -ForegroundColor Cyan
pnpm run setup:env
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Falló la validación del entorno." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host " ✨ ¡INSTALACIÓN COMPLETADA CON ÉXITO!" -ForegroundColor Green
Write-Host "    • Modo Desarrollo:       pnpm run app:dev" -ForegroundColor White
Write-Host "    • Pruebas Diagnósticas:  pnpm run test:diagnostics" -ForegroundColor White
Write-Host "    • Empaquetar Instalador: pnpm run app:build" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Green
