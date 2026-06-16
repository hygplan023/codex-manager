@echo off
title Docker Manager
cd /d "%~dp0"

echo ============================================
echo   Docker Manager - One-click start (Docker)
echo ============================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker not found. Please install and start Docker Desktop.
  echo Download: https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker is not running. Please start Docker Desktop and retry.
  pause
  exit /b 1
)

echo [INFO] Building and starting container...
echo [INFO] First run downloads the base image and may take a few minutes.
echo.
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo [ERROR] Start failed. Please screenshot the logs above and send them.
  pause
  exit /b 1
)

echo.
echo [OK] Started successfully. Opening browser...
timeout /t 3 >nul
start "" http://localhost:18765
echo.
echo URL  : http://localhost:18765
echo Logs : docker compose logs -f
echo Stop : double-click stop-docker.bat  (or run: docker compose down)
echo.
pause
