@echo off
setlocal enabledelayedexpansion
title Cristi AI Companion - Instalador y Configurador de Entorno

echo ================================================================
echo  CRISTI AI COMPANION - INICIO RAPIDO Y CONFIGURACION DE ENTORNO
echo  Autor: Write_Color
echo ================================================================
echo.

:: 1. Check Node.js Version (>= 20)
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado en este equipo.
    echo Por favor instala Node.js LTS (v20 o superior) desde: https://nodejs.org/
    echo Presiona cualquier tecla para salir...
    pause >nul
    exit /b 1
)

for /f "tokens=*" %%i in ('node -e "const v = parseInt(process.version.slice(1)); if (v < 20) process.exit(1); console.log(process.version);"') do set NODE_VER=%%i
if %errorlevel% neq 0 (
    echo [ERROR] Se requiere Node.js v20 o superior.
    node -v
    echo Por favor actualiza Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)
echo [1/5] Node.js verificado: %NODE_VER% (cumple ^=^= 20)

:: 2. Check and Enable PNPM (>= 9)
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [2/5] pnpm no detectado. Activando pnpm automaticamente con corepack...
    call corepack enable
    call corepack prepare pnpm@latest --activate
    where pnpm >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo activar pnpm automaticamente.
        echo Ejecuta en PowerShell o Terminal: npm install -g pnpm
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%i in ('node -e "const { execSync } = require('child_process'); const pv = execSync('pnpm --version', {encoding:'utf8'}).trim(); const m = parseInt(pv.split('.')[0]); if (m < 9) process.exit(1); console.log('v' + pv);"') do set PNPM_VER=%%i
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] Se recomienda pnpm v9 o superior.
    pnpm --version
) else (
    echo [2/5] pnpm verificado: %PNPM_VER% (cumple ^=^= 9)
)

:: 3. Install Dependencies
echo.
echo [3/5] Instalando dependencias del proyecto con pnpm...
call pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] Ocurrio un error al instalar las dependencias con pnpm.
    pause
    exit /b %errorlevel%
)

:: 4. Build Electron and Frontend
echo.
echo [4/5] Compilando procesos de Electron y frontend con Vite...
call pnpm run build:electron
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion de Electron.
    pause
    exit /b %errorlevel%
)

call pnpm run build
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion del frontend con Vite.
    pause
    exit /b %errorlevel%
)

:: Run environment validation
call pnpm run setup:env --unattended
if %errorlevel% neq 0 (
    echo [ERROR] La validacion del entorno reporto un problema.
    pause
    exit /b %errorlevel%
)

echo.
echo ================================================================
echo  INSTALACION Y COMPILACION COMPLETADAS CON EXITO
echo ================================================================
echo.
echo [5/5] Iniciando Cristi AI Companion en modo desarrollo...
call pnpm run app:dev
