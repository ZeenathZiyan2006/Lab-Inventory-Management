@echo off
title SMVITM Inventory Management System - Initial Setup
echo =====================================================================
echo  SMVITM Inventory System - One-Time Dependency Installer
echo =====================================================================
echo.

:: Check Python version
python -c "import sys; exit(0 if sys.version_info >= (3, 10) else 1)" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo =====================================================================
    echo [ERROR] INCOMPATIBLE PYTHON VERSION DETECTED!
    echo.
    echo Your laptop currently has an outdated Python version (Python 3.6 / older).
    echo This modern AI project requires Python 3.10, 3.11, or 3.12.
    echo.
    echo PLEASE DO THIS:
    echo 1. Download and install Python 3.12: https://www.python.org/downloads/
    echo 2. IMPORTANT: Check the box "Add python.exe to PATH" during installation!
    echo 3. Restart your laptop or VS Code and run this script again.
    echo =====================================================================
    pause
    exit /b 1
)

echo [1/2] Installing Python backend dependencies...
cd /d "%~dp0backend"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python dependencies failed to install.
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
