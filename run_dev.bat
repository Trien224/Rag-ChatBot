@echo off
title RAG Document Assistant - Development Mode
cd /d "%~dp0"

echo ======================================================================
echo          DEVELOPMENT MODE (BACKEND 8000 + FRONTEND 3000)
echo ======================================================================
echo.

REM 1. Start Backend in separate window
echo [1/2] Starting Backend FastAPI (Port 8000)...
start "RAG Backend API" cmd /k "title RAG Backend API & python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload"

REM 2. Start Frontend React Vite
echo [2/2] Starting React Vite Dev Server (Port 3000)...
cd frontend

REM Open browser after 3 seconds
start "" cmd /c "timeout /t 3 /nobreak >nul 2>&1 & start http://localhost:3000"

npm run dev
