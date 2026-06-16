@echo off
title Docker Manager - Stop
cd /d "%~dp0"
echo [INFO] Stopping container...
docker compose down
echo [OK] Stopped.
pause
