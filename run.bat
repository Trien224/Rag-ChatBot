@echo off
title RAG Document QA Assistant - Production Server
cd /d "%~dp0"

echo ======================================================================
echo          RAG DOCUMENT ASSISTANT (FASTAPI + REACT)
echo ======================================================================
echo.

REM 1. Open browser in background after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul 2>&1 & start http://127.0.0.1:8000"

echo [INFO] Starting FastAPI Backend and Web UI...
echo [LINK] Web Chat UI      : http://127.0.0.1:8000
echo [LINK] Swagger API Docs : http://127.0.0.1:8000/docs
echo.
echo Press [Ctrl + C] in this window to stop the server.
echo ======================================================================
echo.

REM 2. Run Uvicorn Server
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload

pause
