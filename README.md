# Docker 容器管理平台 — Ollama一键部署管理系统
## 开发工作室：南充远达文化广告策划工作室

### 项目简介
本平台基于Docker可视化管理Ollama本地大模型，支持容器启停、模型拉取、安全检测、Codex/ Claude Code本地直连调试，Windows/macOS一键部署，无需复杂命令行操作。

### 核心功能
1. Ollama容器可视化管控，自动检测11434端口运行状态
2. 本地模型拉取、查看、参数配置、性能测试
3. Codex CLI一键配置，自动生成跨平台启动脚本
4. 离线安装包一键解压启动，适配Windows批处理/macOS脚本
5. 完整API连通检测工具，快速排查本地模型连接问题

### 本地部署教程
1. 下载仓库内 `dist-package.zip` 离线安装包
2. Windows：双击 `start-windows.bat` 一键启动
3. MacOS/Linux：终端执行 `./start-mac.sh`
4. 访问本地地址 http://localhost:11434 进入管理面板

### 适配环境
- Windows 10/11、macOS 12+
- Docker Desktop 4.70及以上
- Node.js 20 LTS、pnpm包管理器

### 版权信息
©2026 南充远达文化广告策划工作室 版权所有
