@echo off
title SMVITM Inventory Management System - Initial Setup
echo =====================================================================
echo  SMVITM Inventory System - One-Time Dependency Installer
echo =====================================================================
echo.
echo [1/2] Installing Python backend dependencies...
cd /d "%~dp0backend"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python dependencies failed to install. Please ensure Python 3.10+ is installed and added to PATH.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Installing Node.js frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed. Please ensure Node.js is installed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =====================================================================
echo  Setup Completed Successfully!
echo  You can now double-click 'run_all.bat' to launch the entire system.
echo =====================================================================
pause
