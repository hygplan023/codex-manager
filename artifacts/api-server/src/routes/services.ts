import { Router } from "express";

const router = Router();

interface AiService {
  type: string;
  name: string;
  port: number;
  baseUrl: string;
  openaiBaseUrl: string;
  models: string[];
  status: string;
}

// Scan localhost for running AI services (Ollama, LM Studio, Jan, etc.)
router.get("/detect-ai-services", async (req, res) => {
  const services: AiService[] = [];

  // Ollama ports
  for (const port of [11434, 11435]) {
    try {
      const resp = await fetch(`http://localhost:${port}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { models?: Array<{ name: string }> };
        services.push({
          type: "ollama",
          name: `Ollama`,
          port,
          baseUrl: `http://localhost:${port}`,
          openaiBaseUrl: `http://localhost:${port}/v1`,
          models: (data.models || []).map((m) => m.name),
          status: "running",
        });
      }
    } catch {}
  }

  // LM Studio (port 1234 default)
  for (const port of [1234, 1235]) {
    try {
      const resp = await fetch(`http://localhost:${port}/v1/models`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { data?: Array<{ id: string }> };
        services.push({
          type: "lmstudio",
          name: `LM Studio`,
          port,
          baseUrl: `http://localhost:${port}`,
          openaiBaseUrl: `http://localhost:${port}/v1`,
          models: (data.data || []).map((m) => m.id),
          status: "running",
        });
      }
    } catch {}
  }

  // Jan App (port 1337)
  for (const port of [1337]) {
    try {
      const resp = await fetch(`http://localhost:${port}/v1/models`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { data?: Array<{ id: string }> };
        services.push({
          type: "jan",
          name: `Jan`,
          port,
          baseUrl: `http://localhost:${port}`,
          openaiBaseUrl: `http://localhost:${port}/v1`,
          models: (data.data || []).map((m) => m.id),
          status: "running",
        });
      }
    } catch {}
  }

  // Generic OpenAI-compat on other ports
  for (const port of [5000, 8000, 8081, 3000]) {
    try {
      const resp = await fetch(`http://localhost:${port}/v1/models`, {
        signal: AbortSignal.timeout(1000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { data?: Array<{ id: string }> };
        services.push({
          type: "openai-compat",
          name: `OpenAI 兼容服务`,
          port,
          baseUrl: `http://localhost:${port}`,
          openaiBaseUrl: `http://localhost:${port}/v1`,
          models: (data.data || []).map((m) => m.id),
          status: "running",
        });
      }
    } catch {}
  }

  return res.json(services);
});

// Generate Codex CLI config.yaml
router.post("/codex/generate-config", async (req, res) => {
  try {
    const {
      baseUrl = "http://localhost:11434/v1",
      model = "llama3",
      apiKey = "ollama",
      mcpServers = [],
      approvalMode = "suggest",
    } = req.body as {
      baseUrl?: string;
      model?: string;
      apiKey?: string;
      mcpServers?: Array<{ name: string; command: string }>;
      approvalMode?: string;
    };

    const toolsSection = mcpServers.length > 0
      ? "\ntools:\n" + mcpServers.map((s) =>
          `  - type: mcp_server\n    name: ${s.name}\n    command: ${s.command}`
        ).join("\n")
      : "";

    const config = `# Codex CLI 配置文件
# 路径: ~/.codex/config.yaml
# 使用 Ollama 本地模型运行 Codex

model: "${model}"
provider: ollama
baseURL: "${baseUrl}"
apiKey: "${apiKey}"
approvalMode: ${approvalMode}
${toolsSection}`;

    const winConfig = `# Windows PowerShell 环境变量方式
$env:OPENAI_API_KEY = "${apiKey}"
$env:OPENAI_BASE_URL = "${baseUrl}"
# 运行 Codex
npx @openai/codex`;

    const macConfig = `# macOS/Linux 环境变量方式
export OPENAI_API_KEY="${apiKey}"
export OPENAI_BASE_URL="${baseUrl}"
# 运行 Codex
npx @openai/codex`;

    return res.json({ config, winConfig, macConfig });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, message: msg });
  }
});

export default router;
