# ================================================================
#  CRISTI AI COMPANION - SCRIPT DE INICIALIZACION Y CONFIGURACION
#  Autor: Write_Color
# ================================================================

[CmdletBinding()]
param(
    [switch]$NoLaunch,
    [switch]$CI
)

$ErrorActionPreference = 'Stop'

function Write-Banner {
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  CRISTI AI COMPANION - INICIALIZACION Y CONFIGURACION ESTRICTA " -ForegroundColor Magenta
    Write-Host "  Desktop AI Mate / Live2D / Gemini Live API / Multi-Window     " -ForegroundColor DarkCyan
    Write-Host "================================================================`n" -ForegroundColor Cyan
}

Write-Banner

# 1. Check Node.js Version (>= 20)
Write-Host "[1/5] Verificando entorno Node.js..." -ForegroundColor Cyan
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "  [ERROR] Node.js no esta instalado o no se encuentra en el PATH." -ForegroundColor Red
    Write-Host "  Por favor descarga e instala Node.js LTS (>= v20) desde: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

$nodeVersionRaw = (node -v).Trim()
$nodeMajor = [int]($nodeVersionRaw -replace '^v', '').Split('.')[0]
if ($nodeMajor -lt 20) {
    Write-Host "  [ERROR] Se requiere Node.js v20 o superior. Version detectada: $nodeVersionRaw" -ForegroundColor Red
    Write-Host "  Por favor actualiza Node.js desde: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] Node.js compatible: $nodeVersionRaw (>= v20)" -ForegroundColor Green

# 2. Check and Activate pnpm (>= 9)
Write-Host "`n[2/5] Verificando gestor de paquetes pnpm..." -ForegroundColor Cyan
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
    Write-Host "  pnpm no detectado en PATH. Activando mediante corepack..." -ForegroundColor Yellow
    try {
        corepack enable
        corepack prepare pnpm@latest --activate
        $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
    } catch {
        Write-Host "  [ERROR] No se pudo activar pnpm con corepack." -ForegroundColor Red
        Write-Host "  Ejecuta: npm install -g pnpm" -ForegroundColor Yellow
        exit 1
    }
}

if (-not $pnpmCmd) {
    Write-Host "  [ERROR] pnpm sigue sin estar disponible en PATH." -ForegroundColor Red
    exit 1
}

$pnpmVersionRaw = (pnpm -v).Trim()
$pnpmMajor = [int]$pnpmVersionRaw.Split('.')[0]
if ($pnpmMajor -lt 9) {
    Write-Host "  [ADVERTENCIA] Se recomienda pnpm v9 o superior. Version actual: v$pnpmVersionRaw" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] pnpm compatible: v$pnpmVersionRaw (>= v9)" -ForegroundColor Green
}

# 3. Install Dependencies
Write-Host "`n[3/5] Instalando dependencias del proyecto con pnpm..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Fallo la instalacion de dependencias." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "  [OK] Dependencias verificadas en node_modules." -ForegroundColor Green

# 4. Build Processes (Electron + Vite Frontend + Native WASAPI)
Write-Host "`n[4/5] Compilando procesos de Electron, Frontend y Helpers Nativos..." -ForegroundColor Cyan

# A. Electron Main & Preload
Write-Host "  -> Compilando Electron main y preload..." -ForegroundColor DarkCyan
pnpm run build:electron
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Fallo la compilacion de Electron." -ForegroundColor Red
    exit $LASTEXITCODE
}

# B. Vite Frontend
Write-Host "  -> Compilando frontend Vite..." -ForegroundColor DarkCyan
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Fallo la compilacion de Vite." -ForegroundColor Red
    exit $LASTEXITCODE
}

# C. Native WASAPI Helper
if ($IsWindows -or $env:OS -eq 'Windows_NT') {
    $wasapiHelperScript = Join-Path $PSScriptRoot 'native\build-wasapi-helper.ps1'
    if (Test-Path -LiteralPath $wasapiHelperScript) {
        Write-Host "  -> Compilando helper nativo WASAPI loopback..." -ForegroundColor DarkCyan
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $wasapiHelperScript
    }
}

# D. Environment Validation
Write-Host "`n[5/5] Ejecutando verificacion exhaustiva de entorno..." -ForegroundColor Cyan
pnpm run setup:env --unattended
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Fallo la validacion del entorno." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "  INSTALACION Y CONFIGURACION COMPLETADAS CON EXITO!" -ForegroundColor Green
Write-Host "   - Modo Desarrollo Desktop:  pnpm run app:dev" -ForegroundColor White
Write-Host "   - Empaquetar Instalador:    pnpm run app:build" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Green

if (-not $NoLaunch -and -not $CI) {
    $shouldLaunch = Read-Host "Deseas iniciar Cristi AI Companion ahora? (S/n)"
    if ($shouldLaunch -eq '' -or $shouldLaunch -match '^(s|y|si|yes)$') {
        Write-Host "`nIniciando Cristi AI Companion..." -ForegroundColor Magenta
        pnpm run app:dev
    }
}
