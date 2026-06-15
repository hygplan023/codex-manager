import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Download, Trash2, CheckCircle2, XCircle, Terminal, Copy, RefreshCw, Square,
  Activity, Zap, Loader2, StopCircle, ScrollText, Wifi, WifiOff, Plug2,
  MonitorCheck, Search, Cpu, Bot,
} from "lucide-react";
import {
  useGetOllamaStatus, useListOllamaModels, useDeleteOllamaModel,
  useGetOllamaClientConfig, useTestOllamaConnection,
  useRestartOllama, useStopOllama, useGetOllamaLogs,
  getGetOllamaStatusQueryKey, getListOllamaModelsQueryKey,
} from "@workspace/api-client-react";
import { formatBytes, formatRelative } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---- Custom Tabs (no Radix UI — avoids React hook crash) ----
function TabBar({ tabs, active, onChange }: { tabs: string[]; active: number; onChange: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1 p-1 bg-background border border-border rounded-lg">
      {tabs.map((t, i) => (
        <button key={t} onClick={() => onChange(i)}
          className={cn("px-3 py-1.5 text-xs rounded-md transition-colors font-medium",
            i === active ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-muted-foreground hover:text-white hover:bg-muted/40")}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ---- Types ----
interface TestResult { loading: boolean; success?: boolean; message?: string; latencyMs?: number | null; models?: string[]; }
interface AiService { type: string; name: string; port: number; baseUrl: string; openaiBaseUrl: string; models: string[]; status: string; }

// ---- Config generators ----
function genCodexConfig(baseUrl: string, model: string) {
  return JSON.stringify({ baseURL: `${baseUrl}/v1`, apiKey: "ollama", model }, null, 2);
}
function genCodexYaml(baseUrl: string, model: string) {
  return `# ~/.codex/config.yaml\nmodel: "${model}"\nprovider: ollama\nbaseURL: "${baseUrl}/v1"\napiKey: "ollama"\napprovalMode: suggest`;
}
function genClaudeCodeMac(baseUrl: string) {
  return `export ANTHROPIC_BASE_URL="${baseUrl}/v1"\nexport ANTHROPIC_API_KEY="ollama"\nexport CLAUDE_CODE_MAX_TOKENS=4096`;
}
function genClaudeCodeWin(baseUrl: string) {
  return `$env:ANTHROPIC_BASE_URL="${baseUrl}/v1"\n$env:ANTHROPIC_API_KEY="ollama"\n$env:CLAUDE_CODE_MAX_TOKENS="4096"`;
}
function genContinueConfig(baseUrl: string, model: string) {
  return JSON.stringify({ models: [{ title: `Ollama — ${model}`, provider: "ollama", model, apiBase: baseUrl }] }, null, 2);
}

// ---- ConnectBlock ----
function ConnectBlock({ label, text, copyKey, copiedKey, onCopy, onTest, testResult, disabled }: {
  label: string; text: string; copyKey: string; copiedKey: string | null;
  onCopy: (text: string, key: string) => void; onTest: () => void;
  testResult?: TestResult; disabled?: boolean;
}) {
  return (
    <div className={cn("border rounded-lg p-4 space-y-2", disabled ? "border-border/40 opacity-60 bg-background/10" : "border-border bg-background/30")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={disabled} onClick={() => onCopy(text, copyKey)}>
            {copiedKey === copyKey ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-400" />已复制</> : <><Copy className="w-3.5 h-3.5 mr-1" />复制配置</>}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={disabled || testResult?.loading} onClick={onTest}>
            {testResult?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><MonitorCheck className="w-3.5 h-3.5 mr-1" />测试连接</>}
          </Button>
        </div>
      </div>
      {testResult && !testResult.loading && (
        <div className={cn("text-xs flex items-center gap-2 rounded px-3 py-1.5 border",
          testResult.success ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
          {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          <span>{testResult.message}</span>
          {testResult.success && testResult.models && testResult.models.length > 0 && (
            <span className="ml-auto text-green-300">{testResult.models.slice(0, 2).join(", ")}{testResult.models.length > 2 ? "..." : ""}</span>
          )}
        </div>
      )}
      <pre className="p-3 rounded-md bg-[#0d1117] overflow-x-auto text-xs font-mono text-gray-300 border border-[#30363d] leading-relaxed">{text}</pre>
    </div>
  );
}

// ---- Service type badge ----
function ServiceBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ollama: { label: "Ollama", cls: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
    lmstudio: { label: "LM Studio", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
    jan: { label: "Jan", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    "openai-compat": { label: "OpenAI 兼容", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  };
  const s = map[type] || { label: type, cls: "bg-muted text-muted-foreground" };
  return <Badge className={cn("text-xs border", s.cls)}>{s.label}</Badge>;
}

const QUICK_MODELS = ["codestral:latest", "deepseek-coder:6.7b", "qwen2.5-coder:7b", "llama3:8b", "mistral:latest"];
const CLIENT_TABS = ["Codex Desktop", "Codex CLI", "Claude Code", "Continue.dev", "Open WebUI"];
const CLAUDE_TABS = ["macOS / Linux", "Windows PS"];

export default function Ollama() {
  const { data: status, refetch: refetchStatus } = useGetOllamaStatus({ refetchInterval: 8000 });
  const { data: models, isLoading: isModelsLoading, refetch: refetchModels } = useListOllamaModels({
    refetchInterval: status?.apiReachable ? 15000 : false,
  });
  const { data: config } = useGetOllamaClientConfig();
  const deleteModel = useDeleteOllamaModel();
  const testConnection = useTestOllamaConnection();
  const restartOllama = useRestartOllama();
  const stopOllama = useStopOllama();
  const { data: logsData, refetch: refetchLogs } = useGetOllamaLogs();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Pull state
  const [pullModelName, setPullModelName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatusText, setPullStatusText] = useState("");
  const [pullDone, setPullDone] = useState(false);
  const [pullError, setPullError] = useState(false);

  // UI state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Tab state (custom — no Radix)
  const [clientTab, setClientTab] = useState(0);
  const [claudeTab, setClaudeTab] = useState(0);

  // Model selector for configs
  const [selectedModel, setSelectedModel] = useState("");

  // Local AI service detection
  const [detectedServices, setDetectedServices] = useState<AiService[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectedOnce, setDetectedOnce] = useState(false);

  const logsScrollRef = useRef<HTMLPreElement>(null);

  // Auto-select first installed model
  useEffect(() => {
    if (models && models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].name);
    }
  }, [models]);

  useEffect(() => { if (logsOpen) refetchLogs(); }, [logsOpen]);
  useEffect(() => {
    if (logsScrollRef.current) logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
  }, [logsData]);

  const detectLocalServices = useCallback(async () => {
    setDetecting(true);
    try {
      const resp = await fetch("/api/detect-ai-services");
      const services = (await resp.json()) as AiService[];
      setDetectedServices(services);
      setDetectedOnce(true);
      if (services.length > 0) {
        toast({ title: `✅ 检测到 ${services.length} 个本地 AI 服务` });
      } else {
        toast({ title: "未检测到本地 AI 服务", description: "确保 Ollama / LM Studio 已启动" });
      }
    } catch {
      toast({ variant: "destructive", title: "检测失败" });
    } finally {
      setDetecting(false);
    }
  }, [toast]);

  const handlePullModel = async (modelName?: string) => {
    const name = (modelName || pullModelName).trim();
    if (!name) return;
    if (modelName) setPullModelName(modelName);
    setPulling(true); setPullProgress(0); setPullStatusText("正在连接 Ollama...");
    setPullDone(false); setPullError(false);

    try {
      const response = await fetch("/api/ollama/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: name }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "请求失败" })) as { error?: string };
        throw new Error(err.error || "请求失败");
      }
      if (!response.body) throw new Error("无响应流");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n").filter(Boolean)) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as { status?: string; total?: number; completed?: number; error?: string };
              if (data.error) { setPullStatusText(`错误: ${data.error}`); setPullError(true); setPulling(false); return; }
              setPullStatusText(data.status || "拉取中...");
              if (data.total && data.completed) setPullProgress(Math.round((data.completed / data.total) * 100));
              if (data.status === "success") {
                setPullProgress(100); setPullStatusText("拉取成功！"); setPullDone(true);
                toast({ title: "✅ 拉取成功", description: `模型 ${name} 已下载完成` });
                queryClient.invalidateQueries({ queryKey: getListOllamaModelsQueryKey() });
                setPulling(false); setPullModelName(""); return;
              }
              if (data.status === "已停止拉取") { setPullStatusText("已手动停止"); setPulling(false); return; }
            } catch {}
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "连接中断";
      setPullStatusText(msg); setPullError(true);
    }
    setPulling(false);
  };

  const handleStopPull = async () => {
    await fetch("/api/ollama/models/stop-pull", { method: "POST" });
    setPulling(false); setPullStatusText("已手动停止拉取");
  };

  const confirmDeleteModel = () => {
    if (!deleteTarget) return;
    const name = deleteTarget;
    setDeleteTarget(null);
    deleteModel.mutate({ name }, {
      onSuccess: () => { toast({ title: "已删除" }); queryClient.invalidateQueries({ queryKey: getListOllamaModelsQueryKey() }); },
      onError: (err) => toast({ variant: "destructive", title: "删除失败", description: String(err) }),
    });
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000);
      toast({ title: "✅ 已复制到剪贴板" });
    } catch { toast({ variant: "destructive", title: "复制失败" }); }
  };

  const handleTestConnection = (url: string, key: string) => {
    setTestResults((p) => ({ ...p, [key]: { loading: true } }));
    testConnection.mutate({ data: { url } }, {
      onSuccess: (res) => setTestResults((p) => ({ ...p, [key]: { loading: false, success: res.success, message: res.message, latencyMs: res.latencyMs, models: res.models } })),
      onError: (err) => setTestResults((p) => ({ ...p, [key]: { loading: false, success: false, message: String(err) } })),
    });
  };

  const handleRestart = () => restartOllama.mutate(undefined, {
    onSuccess: () => { toast({ title: "已重启" }); queryClient.invalidateQueries({ queryKey: getGetOllamaStatusQueryKey() }); },
  });
  const handleStop = () => stopOllama.mutate(undefined, {
    onSuccess: () => { toast({ title: "已停止" }); queryClient.invalidateQueries({ queryKey: getGetOllamaStatusQueryKey() }); },
  });

  const isRunning = status?.running && status?.apiReachable;
  const localUrl = config?.localUrl || "http://localhost:11434";
  const lanUrl = config?.lanUrl || "";
  const activeModel = selectedModel || models?.[0]?.name || "llama3";

  // All installed models + models from detected services
  const allDetectedModels = [
    ...(models || []).map((m) => ({ name: m.name, source: "Ollama (容器)" })),
    ...detectedServices.flatMap((s) => s.models.map((m) => ({ name: m, source: s.name }))),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Ollama 管理</h2>
        <p className="text-muted-foreground">管理本地大语言模型及客户端连接配置。</p>
      </div>

      {/* Status Bar */}
      <Card className="bg-card border-card-border">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className={cn("w-3 h-3 rounded-full flex-shrink-0",
                isRunning ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
                  : status?.running ? "bg-yellow-400" : "bg-red-500")} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">
                    {isRunning ? "Ollama 运行中" : status?.running ? "Ollama 启动中..." : "Ollama 已停止"}
                  </span>
                  {isRunning ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-xs">API 可达</Badge>
                  ) : status?.running ? (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-xs">等待就绪</Badge>
                  ) : (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-xs">离线</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5 flex gap-4">
                  {status?.port && <span>端口: <span className="font-mono">{status.port}</span></span>}
                  {status?.uptime && <span>运行: {status.uptime}</span>}
                  {isRunning && <span>模型: {models?.length ?? 0} 个</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleRestart} disabled={restartOllama.isPending || !status?.containerId} className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> 重启服务
              </Button>
              <Button variant="outline" size="sm" onClick={handleStop} disabled={stopOllama.isPending || !status?.running} className="border-red-500/40 text-red-400 hover:bg-red-500/10">
                <Square className="w-3.5 h-3.5 mr-1.5" /> 停止容器
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLogsOpen(true)} className="border-border text-muted-foreground hover:text-white">
                <ScrollText className="w-3.5 h-3.5 mr-1.5" /> 查看日志
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { refetchStatus(); refetchModels(); }} className="text-muted-foreground hover:text-white">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Local AI Service Detection */}
      <Card className="bg-card border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-cyan-400">
              <Search className="w-4 h-4" /> 本地 AI 服务检测
            </CardTitle>
            <Button variant="outline" size="sm" onClick={detectLocalServices} disabled={detecting}
              className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10">
              {detecting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />检测中...</> : <><Search className="w-3.5 h-3.5 mr-1.5" />检测本地服务</>}
            </Button>
          </div>
          <CardDescription className="text-xs">自动检测本机运行的 Ollama、LM Studio、Jan 等 AI 服务及已加载的模型</CardDescription>
        </CardHeader>
        <CardContent>
          {!detectedOnce ? (
            <div className="text-center py-4 text-muted-foreground text-sm flex flex-col items-center gap-2">
              <Cpu className="w-8 h-8 text-muted-foreground/40" />
              <span>点击「检测本地服务」扫描 Ollama (11434)、LM Studio (1234)、Jan (1337) 等常用端口</span>
            </div>
          ) : detectedServices.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              未检测到本地运行的 AI 服务。请确保 Ollama 或 LM Studio 已启动并开放 API。
            </div>
          ) : (
            <div className="space-y-3">
              {detectedServices.map((svc) => (
                <div key={`${svc.type}-${svc.port}`} className="border border-border rounded-lg p-4 bg-background/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <span className="font-medium text-white text-sm">{svc.name}</span>
                      <ServiceBadge type={svc.type} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">:{svc.port}</span>
                      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">运行中</Badge>
                    </div>
                  </div>
                  {svc.models.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">已加载模型 ({svc.models.length})：</span>
                      <div className="flex flex-wrap gap-1.5">
                        {svc.models.map((m) => (
                          <button key={m} onClick={() => { setPullModelName(m); }}
                            className="text-xs font-mono px-2.5 py-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors">
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">无已加载模型</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-border text-muted-foreground"
                      onClick={() => handleTestConnection(svc.baseUrl, `svc-${svc.port}`)}>
                      {testResults[`svc-${svc.port}`]?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Wifi className="w-3.5 h-3.5 mr-1" />测试连接</>}
                    </Button>
                    {testResults[`svc-${svc.port}`] && !testResults[`svc-${svc.port}`]?.loading && (
                      <span className={cn("text-xs flex items-center gap-1",
                        testResults[`svc-${svc.port}`]?.success ? "text-green-400" : "text-red-400")}>
                        {testResults[`svc-${svc.port}`]?.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {testResults[`svc-${svc.port}`]?.message}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pull Model */}
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-cyan-400">
              <Download className="w-5 h-5" /> 拉取模型
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isRunning && (
              <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2">
                <Activity className="w-4 h-4 flex-shrink-0" /> Ollama 未运行，请先部署或启动 Ollama
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-2">快速选择常用模型：</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_MODELS.map((m) => (
                  <button key={m} onClick={() => setPullModelName(m)} disabled={pulling}
                    className={cn("text-xs font-mono px-2.5 py-1 rounded border transition-colors",
                      pullModelName === m ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300"
                        : "bg-background border-border text-muted-foreground hover:border-cyan-500/40 hover:text-cyan-400")}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="例如: llama3:8b, mistral:latest" value={pullModelName}
                onChange={(e) => setPullModelName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !pulling) handlePullModel(); }}
                disabled={pulling} className="font-mono bg-background" />
              {pulling ? (
                <Button onClick={handleStopPull} variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 flex-shrink-0">
                  <StopCircle className="w-4 h-4 mr-1.5" /> 停止
                </Button>
              ) : (
                <Button onClick={() => handlePullModel()} disabled={!pullModelName.trim() || !isRunning}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white flex-shrink-0">
                  <Download className="w-4 h-4 mr-1.5" /> 拉取
                </Button>
              )}
            </div>
            {(pulling || pullDone || pullError) && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className={cn("truncate max-w-[75%]",
                    pullError ? "text-red-400" : pullDone ? "text-green-400" : "text-muted-foreground")}>
                    {pullError ? <XCircle className="w-3.5 h-3.5 inline mr-1" /> : pullDone ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> : null}
                    {pullStatusText}
                  </span>
                  <span className="font-mono text-muted-foreground">{pullProgress}%</span>
                </div>
                <Progress value={pullProgress} className={cn("h-2",
                  pullError ? "[&>div]:bg-red-500" : pullDone ? "[&>div]:bg-green-500" : "")} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Test */}
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-cyan-400">
              <Terminal className="w-5 h-5" /> 连接测试
            </CardTitle>
          </CardHeader>
          <CardContent>
            {config ? (
              <div className="space-y-3">
                {[
                  { label: "本地连接 (localhost)", url: config.localUrl, key: "local" },
                  { label: "局域网连接 (LAN)", url: config.lanUrl, key: "lan" },
                ].map(({ label, url, key }) => {
                  const result = testResults[key];
                  return (
                    <div key={key} className="p-3 rounded bg-background/50 border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-muted-foreground block">{label}</span>
                          <span className="font-mono text-sm">{url}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleTestConnection(url, key)} disabled={result?.loading} className="flex-shrink-0">
                          {result?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Wifi className="w-3.5 h-3.5 mr-1" />测试</>}
                        </Button>
                      </div>
                      {result && !result.loading && (
                        <div className={cn("text-xs flex items-center gap-1.5 rounded px-2 py-1.5",
                          result.success ? "bg-green-500/10 border border-green-500/20 text-green-400"
                            : "bg-red-500/10 border border-red-500/20 text-red-400")}>
                          {result.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                          <span>{result.message}</span>
                          {result.success && result.models && result.models.length > 0 && (
                            <span className="text-green-300 ml-auto">{result.models.length} 个模型</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <div className="text-muted-foreground text-sm">正在加载配置...</div>}
          </CardContent>
        </Card>
      </div>

      {/* Installed Models */}
      <Card className="bg-card border-card-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" /> 已安装模型
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetchModels()} className="text-muted-foreground hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {!isRunning ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Ollama 未运行，无法获取模型列表</div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>名称</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>参数量</TableHead>
                    <TableHead>量化级别</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isModelsLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />加载中...
                    </TableCell></TableRow>
                  ) : !models || models.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      没有安装任何模型，请在上方拉取模型
                    </TableCell></TableRow>
                  ) : (
                    models.map((model) => (
                      <TableRow key={model.name} className="border-border hover:bg-muted/50">
                        <TableCell className="font-mono font-medium text-cyan-400">
                          {model.name}
                          <Badge className="ml-2 bg-green-500/15 text-green-400 border-green-500/30 text-xs">已就绪</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{formatBytes(model.size)}</TableCell>
                        <TableCell className="font-mono text-xs">{model.parameterSize || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <Badge variant="outline" className="bg-background">{model.quantizationLevel || "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatRelative(model.modifiedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => setDeleteTarget(model.name)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Connect */}
      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plug2 className="w-5 h-5 text-cyan-400" /> 一键接入 AI 编程工具
          </CardTitle>
          <CardDescription>选择已安装的模型，生成对应工具的连接配置，一键复制即可使用。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isRunning && (
            <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2">
              <Activity className="w-4 h-4 flex-shrink-0" /> Ollama 未运行。请先部署并拉取模型后再配置客户端。
            </div>
          )}

          {/* Model selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">使用模型：</Label>
            {allDetectedModels.length > 0 ? (
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="bg-background font-mono text-sm h-9 w-72">
                  <SelectValue placeholder="选择模型..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1117] border-[#30363d]">
                  {allDetectedModels.map((m) => (
                    <SelectItem key={`${m.name}-${m.source}`} value={m.name} className="font-mono text-sm">
                      {m.name} <span className="text-muted-foreground ml-1 text-xs">({m.source})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <Input value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
                  placeholder="手动输入模型名 (如 llama3:8b)"
                  className="font-mono text-sm h-9 w-64 bg-background" />
                <span className="text-xs text-muted-foreground">（先拉取模型或检测本地服务）</span>
              </div>
            )}
          </div>

          {/* Client tabs */}
          <TabBar tabs={CLIENT_TABS} active={clientTab} onChange={setClientTab} />

          {/* Codex Desktop */}
          {clientTab === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                在 Codex Desktop 设置中选择 <span className="text-cyan-300 font-mono">Custom / Ollama</span> 并填入以下配置：
              </p>
              <ConnectBlock label="本地配置 (localhost)" text={genCodexConfig(localUrl, activeModel)}
                copyKey="codex-local" copiedKey={copiedKey} onCopy={copyToClipboard}
                onTest={() => handleTestConnection(localUrl, "codex-test")} testResult={testResults["codex-test"]} disabled={!isRunning} />
              {lanUrl && <ConnectBlock label="局域网配置 (LAN，用于其他设备)" text={genCodexConfig(lanUrl, activeModel)}
                copyKey="codex-lan" copiedKey={copiedKey} onCopy={copyToClipboard}
                onTest={() => handleTestConnection(lanUrl, "codex-lan-test")} testResult={testResults["codex-lan-test"]} disabled={!isRunning} />}
            </div>
          )}

          {/* Codex CLI */}
          {clientTab === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                OpenAI Codex CLI 终端工具，使用本地模型完全离线运行：
              </p>
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded p-3 text-xs text-cyan-300 space-y-1">
                <p className="font-medium">安装 Codex CLI（需要 Node.js）：</p>
                <code className="block font-mono">npm install -g @openai/codex</code>
              </div>
              <ConnectBlock label="~/.codex/config.yaml（本地服务）" text={genCodexYaml(localUrl, activeModel)}
                copyKey="codex-cli-yaml" copiedKey={copiedKey} onCopy={copyToClipboard}
                onTest={() => handleTestConnection(localUrl, "codex-cli-test")} testResult={testResults["codex-cli-test"]} disabled={!isRunning} />
              <div className="text-xs text-muted-foreground bg-background/40 border border-border/50 rounded p-3">
                <p className="text-white/70 font-medium mb-1">等效命令行方式：</p>
                <code className="text-cyan-300 block">OPENAI_BASE_URL={localUrl}/v1 OPENAI_API_KEY=ollama codex "你的问题"</code>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded p-3 text-xs text-amber-300 space-y-1">
                <p className="font-medium">💡 Codex CLI 插件（MCP 工具）</p>
                <p>在 config.yaml 中添加 tools 段落可解锁文件系统、Git、搜索等扩展能力。</p>
                <p>详细步骤请查看左侧「安装指南」→「Codex CLI 配置」。</p>
              </div>
            </div>
          )}

          {/* Claude Code */}
          {clientTab === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                设置环境变量后，Claude Code 会将 API 请求发送到本地 Ollama。
              </p>
              <TabBar tabs={CLAUDE_TABS} active={claudeTab} onChange={setClaudeTab} />
              {claudeTab === 0 && (
                <ConnectBlock label="macOS / Linux — 本地" text={genClaudeCodeMac(localUrl)}
                  copyKey="claude-mac" copiedKey={copiedKey} onCopy={copyToClipboard}
                  onTest={() => handleTestConnection(localUrl, "claude-test")} testResult={testResults["claude-test"]} disabled={!isRunning} />
              )}
              {claudeTab === 1 && (
                <ConnectBlock label="Windows PowerShell — 本地" text={genClaudeCodeWin(localUrl)}
                  copyKey="claude-win" copiedKey={copiedKey} onCopy={copyToClipboard}
                  onTest={() => handleTestConnection(localUrl, "claude-test")} testResult={testResults["claude-test"]} disabled={!isRunning} />
              )}
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded p-3 text-xs text-cyan-300 space-y-1">
                <p>确保已拉取模型（如 <span className="font-mono">{activeModel}</span>），然后正常启动 <span className="font-mono">claude</span> 即可。</p>
              </div>
            </div>
          )}

          {/* Continue.dev */}
          {clientTab === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                将以下内容合并到 <span className="font-mono text-cyan-300">~/.continue/config.json</span> 的 models 数组中：
              </p>
              <ConnectBlock label="Continue.dev 配置" text={genContinueConfig(localUrl, activeModel)}
                copyKey="continue-local" copiedKey={copiedKey} onCopy={copyToClipboard}
                onTest={() => handleTestConnection(localUrl, "continue-test")} testResult={testResults["continue-test"]} disabled={!isRunning} />
            </div>
          )}

          {/* Open WebUI */}
          {clientTab === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">设置以下环境变量连接到本地 Ollama：</p>
              <ConnectBlock label="Open WebUI 本地配置" text={`OLLAMA_BASE_URL=${localUrl}`}
                copyKey="webui-local" copiedKey={copiedKey} onCopy={copyToClipboard}
                onTest={() => handleTestConnection(localUrl, "webui-test")} testResult={testResults["webui-test"]} disabled={!isRunning} />
              <div className="text-xs text-muted-foreground bg-background/40 border border-border/50 rounded p-3">
                <p className="text-white/70 font-medium mb-1">一键启动 Open WebUI（Docker）：</p>
                <code className="text-cyan-300 break-all block leading-relaxed">
                  {`docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -e OLLAMA_BASE_URL=http://host.docker.internal:11434 --name open-webui --restart unless-stopped ghcr.io/open-webui/open-webui:main`}
                </code>
                <Button size="sm" variant="ghost" className="mt-2 h-6 text-xs text-muted-foreground px-2"
                  onClick={() => copyToClipboard(`docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -e OLLAMA_BASE_URL=http://host.docker.internal:11434 --name open-webui --restart unless-stopped ghcr.io/open-webui/open-webui:main`, "webui-docker")}>
                  {copiedKey === "webui-docker" ? <><CheckCircle2 className="w-3 h-3 mr-1 text-green-400" />已复制</> : <><Copy className="w-3 h-3 mr-1" />复制命令</>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="bg-[#0d1117] border border-[#30363d] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" /> 确认删除模型
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1">
              即将删除模型 <span className="font-mono text-red-400">{deleteTarget}</span>。
              此操作不可撤销，但可重新拉取下载。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="border-border" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button className="bg-red-600 hover:bg-red-500 text-white" onClick={confirmDeleteModel}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="bg-[#0d1117] border border-[#30363d] max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <ScrollText className="w-5 h-5" /> Ollama 容器日志
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <pre ref={logsScrollRef} className="text-xs font-mono text-gray-300 leading-relaxed bg-background/50 border border-border rounded p-4 h-[50vh] overflow-y-auto whitespace-pre-wrap">
              {logsData?.logs || "暂无日志"}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => refetchLogs()} className="border-border">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> 刷新
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLogsOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
