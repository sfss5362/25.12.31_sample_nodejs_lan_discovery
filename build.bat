@echo off
echo Building LAN Discovery...
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not installed
    echo Install from: https://nodejs.org/
    pause
    exit /b 1
)

call npm install
call npm install --save-dev pkg
call npm run build

if exist dist\lan-discovery.exe (
    echo.
    echo SUCCESS! File: dist\lan-discovery.exe
) else (
    echo.
    echo FAILED! Check errors above.
)

pause
