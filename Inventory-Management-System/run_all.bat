@echo off
title SMVITM Inventory Management System Launcher
echo =====================================================================
echo  AI-Powered Smart Inventory Management System - SMVITM Bantakal
echo  Department of Artificial Intelligence and Data Science
echo =====================================================================
echo.
echo [1/2] Launching FastAPI Backend on port 8000 (all interfaces 0.0.0.0)...
start "SMVITM Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Launching React Vite Frontend on port 5173...
start "SMVITM Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 0.0.0.0"

echo.
echo Waiting 4 seconds for servers to initialize...
timeout /t 4 /nobreak >nul

echo.
echo ---------------------------------------------------------------------
echo  Local Access:   http://localhost:5173
echo  Other Devices: Check your Wi-Fi IPv4 using 'ipconfig' (e.g. http://192.168.x.x:5173)
echo ---------------------------------------------------------------------
echo.
echo Opening browser...
start http://localhost:5173

echo.
echo IMPORTANT: Keep both terminal windows open while using the application!
echo If another device is connecting, ensure both devices are on the same Wi-Fi.
