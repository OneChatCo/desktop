@echo off
setlocal enabledelayedexpansion

echo Starting Windows build process...

REM Set environment variables
set ELECTRON_CACHE=C:\electron-cache
set CSC_IDENTITY_AUTO_DISCOVERY=false

REM Create cache directories
if not exist "C:\electron-cache" mkdir "C:\electron-cache"

REM Kill any running node processes
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul

REM Clean previous build
echo Cleaning previous build...
if exist dist rmdir /s /q dist 2>nul

REM Build TypeScript
echo Building TypeScript...
npx tsc -p tsconfig.json
if !errorlevel! neq 0 (
    echo TypeScript build failed
    exit /b 1
)

REM Copy assets
echo Copying assets...
npm run copy:assets
if !errorlevel! neq 0 (
    echo Asset copy failed
    exit /b 1
)

REM Build CSS
echo Building CSS...
npm run tailwind:build
if !errorlevel! neq 0 (
    echo CSS build failed
    exit /b 1
)

REM Build Electron app
echo Building Electron app...
npx electron-builder --win
if !errorlevel! neq 0 (
    echo Electron build failed
    exit /b 1
)

echo Build completed successfully!
