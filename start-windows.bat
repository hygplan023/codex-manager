@echo off
title Docker 管理中心 — 启动器
color 0B
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       Docker 管理中心  —  启动中...       ║
echo  ╚══════════════════════════════════════════╝
echo.

:: 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo  [错误] 未找到 Node.js，请先安装 Node.js 20+
  echo  下载地址: https://nodejs.org/
  pause
  exit /B 1
)

:: 检查 pnpm
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo  [信息] 未找到 pnpm，正在安装...
  call npm install -g pnpm
)

:: 安装依赖（首次或更新后）
echo  [1/3] 检查依赖...
call pnpm install --frozen-lockfile 2>nul || call pnpm install

:: 启动 API 服务器（后台）
echo  [2/3] 启动 API 服务器 (端口 8080)...
start "Docker管理中心-API" /MIN cmd /C "pnpm --filter @workspace/api-server run dev"

:: 等待 API 启动
timeout /T 5 /NOBREAK >nul

:: 启动前端
echo  [3/3] 启动前端界面 (端口 18765)...
start "Docker管理中心-UI" cmd /C "pnpm --filter @workspace/docker-manager run dev && pause"

:: 等待前端启动后打开浏览器
timeout /T 6 /NOBREAK >nul
echo.
echo  ✅ 启动完成！正在打开浏览器...
start http://localhost:18765

echo.
echo  前端: http://localhost:18765
echo  API:  http://localhost:8080/api/healthz
echo.
echo  关闭此窗口不会停止服务，请在任务管理器中结束 node.exe 进程来停止服务。
pause
