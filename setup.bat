@echo off
setlocal enabledelayedexpansion
title Cristi AI Companion - Instalador y Configurador de Entorno

echo ================================================================
echo  🌸 CRISTI AI COMPANION - INSTALACION Y CONFIGURACION AUTOMATICA
echo  Autor: Write_Color
echo ================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado en este equipo.
    echo Por favor instala Node.js LTS (v18 a v24) desde: https://nodejs.org/
    echo Presiona cualquier tecla para salir...
    pause >nul
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [1/4] Node.js detectado: %NODE_VER%

:: 2. Check and Enable PNPM
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [2/4] pnpm no detectado. Activando pnpm automaticamente con corepack...
    call corepack enable
    call corepack prepare pnpm@latest --activate
    where pnpm >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo activar pnpm automaticamente.
        echo Ejecuta en PowerShell como Administrador: npm install -g pnpm
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%i in ('pnpm -v') do set PNPM_VER=%%i
echo [2/4] pnpm detectado: v%PNPM_VER%

:: 3. Install Dependencies
echo.
echo [3/4] Instalando paquetes y dependencias del proyecto con pnpm...
call pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] Ocurrio un error al instalar las dependencias con pnpm.
    pause
    exit /b %errorlevel%
)

:: 4. Run Automated Environment Bootstrapper
echo.
echo [4/4] Ejecutando validacion e inicializacion del entorno de Cristi AI Companion...
call pnpm run setup:env
if %errorlevel% neq 0 (
    echo [ERROR] La configuracion del entorno reporto un problema.
    pause
    exit /b %errorlevel%
)

echo.
echo ================================================================
echo  ✨ INSTALACION COMPLETADA CON EXITO - LISTO PARA EJECUTAR
echo ================================================================
echo   1. Iniciar en modo desarrollo (Desktop): pnpm run app:dev
echo   2. Ejecutar pruebas de diagnostico:      pnpm run test:diagnostics
echo   3. Compilar instalador ejecutable:       pnpm run app:build
echo ================================================================
echo.
pause
