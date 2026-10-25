# PowerShell Launcher for SMVITM Inventory Management System
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " AI-Powered Smart Inventory Management System - SMVITM Bantakal" -ForegroundColor Green
Write-Host " Department of Artificial Intelligence and Data Science" -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

Write-Host "[1/2] Launching FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Write-Host "[2/2] Launching React Vite Frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Opening web browser to http://localhost:5173..." -ForegroundColor Green
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host "System launched! Keep the server windows open while using the app." -ForegroundColor White
