import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Download, Trash2, CheckCircle2, XCircle, Terminal, Copy, RefreshCw, Square,
  Activity, Zap, Loader2, StopCircle, ScrollText, Wifi, WifiOff
} from "lucide-react";
import {
  useGetOllamaStatus,
  useListOllamaModels,
  useDeleteOllamaModel,
  useGetOllamaClientConfig,
  useTestOllamaConnection,
  useRestartOllama,
  useStopOllama,
  useGetOllamaLogs,
  getGetOllamaStatusQueryKey,
  getListOllamaModelsQueryKey,
} from "@workspace/api-client-react";
import { formatBytes, formatRelative } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const QUICK_MODELS = ["codestral:latest", "deepseek-coder:6.7b", "qwen2.5-coder:7b"];

interface TestResult {
  loading: boolean;
  success?: boolean;
  message?: string;
  latencyMs?: number | null;
  models?: string[];
}

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

  const [pullModelName, setPullModelName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatusText, setPullStatusText] = useState("");
  const [pullDone, setPullDone] = useState(false);
  const [pullError, setPullError] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const logsScrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logsOpen) {
      refetchLogs();
    }
  }, [logsOpen]);

  useEffect(() => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [logsData]);

  const handlePullModel = async () => {
    const name = pullModelName.trim();
    if (!name) return;
    setPulling(true);
    setPullProgress(0);
    setPullStatusText("正在连接 Ollama...");
    setPullDone(false);
    setPullError(false);

    try {
      const response = await fetch("/api/ollama/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: name }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(err.error || "请求失败");
      }
      if (!response.body) throw new Error("无响应流");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as {
                status?: string;
                total?: number;
                completed?: number;
                error?: string;
              };

              if (data.error) {
                setPullStatusText(`错误: ${data.error}`);
                setPullError(true);
                toast({ variant: "destructive", title: "拉取失败", description: data.error });
                setPulling(false);
                return;
              }

              setPullStatusText(data.status || "拉取中...");

              if (data.total && data.completed) {
                setPullProgress(Math.round((data.completed / data.total) * 100));
              }

              if (data.status === "success") {
                setPullProgress(100);
                setPullStatusText("拉取成功！");
                setPullDone(true);
                toast({ title: "✅ 拉取成功", description: `模型 ${name} 已下载完成` });
                queryClient.invalidateQueries({ queryKey: getListOllamaModelsQueryKey() });
                setPulling(false);
                setPullModelName("");
                return;
              }

              if (data.status === "已停止拉取") {
                setPullStatusText("已手动停止");
                setPulling(false);
                return;
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "连接中断";
      setPullStatusText(msg);
      setPullError(true);
      toast({ variant: "destructive", title: "拉取失败", description: msg });
    }
    setPulling(false);
  };

  const handleStopPull = async () => {
    await fetch("/api/ollama/models/stop-pull", { method: "POST" });
    setPulling(false);
    setPullStatusText("已手动停止拉取");
  };

  const confirmDeleteModel = () => {
    if (!deleteTarget) return;
    const name = deleteTarget;
    setDeleteTarget(null);
    deleteModel.mutate({ name }, {
      onSuccess: () => {
        toast({ title: "已删除", description: `模型 ${name} 已删除` });
        queryClient.invalidateQueries({ queryKey: getListOllamaModelsQueryKey() });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "删除失败", description: String(err) });
      },
    });
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      toast({ title: "✅ 已复制到剪贴板" });
    } catch {
      toast({ variant: "destructive", title: "复制失败", description: "请手动选中复制" });
    }
  };

  const handleTestConnection = async (url: string, key: string) => {
    setTestResults((prev) => ({ ...prev, [key]: { loading: true } }));
    testConnection.mutate(
      { data: { url } },
      {
        onSuccess: (res) => {
          setTestResults((prev) => ({
            ...prev,
            [key]: {
              loading: false,
              success: res.success,
              message: res.message,
              latencyMs: res.latencyMs,
              models: res.models,
            },
          }));
        },
        onError: (err) => {
          setTestResults((prev) => ({
            ...prev,
            [key]: { loading: false, success: false, message: String(err) },
          }));
        },
      }
    );
  };

  const handleRestart = () => {
    restartOllama.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "已重启", description: "Ollama 容器已重启" });
        queryClient.invalidateQueries({ queryKey: getGetOllamaStatusQueryKey() });
      },
    });
  };

  const handleStop = () => {
    stopOllama.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "已停止", description: "Ollama 容器已停止" });
        queryClient.invalidateQueries({ queryKey: getGetOllamaStatusQueryKey() });
      },
    });
  };

  const isRunning = status?.running && status?.apiReachable;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Ollama 管理</h2>
        <p className="text-muted-foreground">管理本地大语言模型及客户端连接配置。</p>
      </div>

      {/* Status Card */}
      <Card className="bg-card border-card-border">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className={cn(
                "w-3 h-3 rounded-full flex-shrink-0",
                isRunning ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : status?.running ? "bg-yellow-400" : "bg-red-500"
              )} />
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
                disabled={restartOllama.isPending || !status?.containerId}
                className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                重启服务
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                disabled={stopOllama.isPending || !status?.running}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                <Square className="w-3.5 h-3.5 mr-1.5" />
                停止容器
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setLogsOpen(true); }}
                className="border-border text-muted-foreground hover:text-white"
              >
                <ScrollText className="w-3.5 h-3.5 mr-1.5" />
                查看日志
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { refetchStatus(); refetchModels(); }}
                className="text-muted-foreground hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pull Model Card */}
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-cyan-400">
              <Download className="w-5 h-5" />
              拉取模型
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isRunning && (
              <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2">
                <Activity className="w-4 h-4 flex-shrink-0" />
                Ollama 未运行，请先从概览页部署或启动 Ollama
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {QUICK_MODELS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPullModelName(m)}
                  disabled={pulling}
                  className={cn(
                    "text-xs font-mono px-2.5 py-1 rounded border transition-colors",
                    pullModelName === m
                      ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300"
                      : "bg-background border-border text-muted-foreground hover:border-cyan-500/40 hover:text-cyan-400"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="例如: llama3:8b, mistral:latest"
                value={pullModelName}
                onChange={(e) => setPullModelName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !pulling) handlePullModel(); }}
                disabled={pulling}
                className="font-mono bg-background"
              />
              {pulling ? (
                <Button
                  onClick={handleStopPull}
                  variant="outline"
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 flex-shrink-0"
                >
                  <StopCircle className="w-4 h-4 mr-1.5" /> 停止
                </Button>
              ) : (
                <Button
                  onClick={handlePullModel}
                  disabled={!pullModelName.trim() || !isRunning}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white flex-shrink-0"
                >
                  <Download className="w-4 h-4 mr-1.5" /> 拉取
                </Button>
              )}
            </div>

            {(pulling || pullDone || pullError) && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className={cn(
                    "text-muted-foreground truncate max-w-[75%]",
                    pullError ? "text-red-400" : pullDone ? "text-green-400" : ""
                  )}>
                    {pullError ? <XCircle className="w-3.5 h-3.5 inline mr-1" /> : pullDone ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> : null}
                    {pullStatusText}
                  </span>
                  <span className="font-mono text-muted-foreground">{pullProgress}%</span>
                </div>
                <Progress
                  value={pullProgress}
                  className={cn("h-2", pullError ? "[&>div]:bg-red-500" : pullDone ? "[&>div]:bg-green-500" : "")}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Test Card */}
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-cyan-400">
              <Terminal className="w-5 h-5" />
              连接测试
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(url, key)}
                          disabled={result?.loading}
                          className="flex-shrink-0"
                        >
                          {result?.loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Wifi className="w-3.5 h-3.5 mr-1" />
                          )}
                          {result?.loading ? "测试中" : "测试"}
                        </Button>
                      </div>
                      {result && !result.loading && (
                        <div className={cn(
                          "text-xs flex items-center gap-1.5 rounded px-2 py-1.5",
                          result.success
                            ? "bg-green-500/10 border border-green-500/20 text-green-400"
                            : "bg-red-500/10 border border-red-500/20 text-red-400"
                        )}>
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
            ) : (
              <div className="text-muted-foreground text-sm">正在加载配置...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Installed Models */}
      <Card className="bg-card border-card-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            已安装模型
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchModels()}
            className="text-muted-foreground hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {!isRunning && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Ollama 未运行，无法获取模型列表
            </div>
          )}
          {isRunning && (
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
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin inline mr-2" />加载中...
                      </TableCell>
                    </TableRow>
                  ) : !models || models.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        没有安装任何模型，请在上方拉取模型
                      </TableCell>
                    </TableRow>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            onClick={() => setDeleteTarget(model.name)}
                          >
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

      {/* Client Config */}
      {config?.configs && config.configs.length > 0 && (
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg">客户端配置指南</CardTitle>
            <CardDescription>各 AI 辅助编程工具的连接配置参考</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isRunning && (
              <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2">
                <Activity className="w-4 h-4 flex-shrink-0" />
                Ollama 未运行，配置可参考但连接测试将失败。请先部署 Ollama 容器。
              </div>
            )}

            {config.configs.map((item) => {
              const configKey = `config-${item.client}`;
              const testResult = testResults[configKey];
              return (
                <div
                  key={item.client}
                  className={cn(
                    "space-y-3 border rounded-lg p-4",
                    !isRunning ? "border-border/40 bg-background/20 opacity-75" : "border-border bg-background/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-cyan-400 font-medium text-base">{item.client}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                      {item.configPath && (
                        <span className="text-xs text-muted-foreground font-mono mt-1 block">
                          配置文件: {item.configPath}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-border"
                        onClick={() => copyToClipboard(item.localConfig, configKey)}
                      >
                        {copiedKey === configKey ? (
                          <><CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-400" /> 已复制</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5 mr-1" /> 复制配置</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-border"
                        disabled={testResult?.loading || !isRunning}
                        onClick={() => handleTestConnection(config.localUrl, configKey)}
                      >
                        {testResult?.loading ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5 mr-1" />
                        )}
                        测试连接
                      </Button>
                    </div>
                  </div>

                  {testResult && !testResult.loading && (
                    <div className={cn(
                      "text-xs flex items-center gap-2 rounded px-3 py-2 border",
                      testResult.success
                        ? "bg-green-500/10 border-green-500/20 text-green-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                    )}>
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{testResult.message}</span>
                      {testResult.success && testResult.models && testResult.models.length > 0 && (
                        <span className="ml-auto text-green-300">
                          已加载 {testResult.models.length} 个模型: {testResult.models.slice(0, 3).join(", ")}
                          {testResult.models.length > 3 ? "..." : ""}
                        </span>
                      )}
                    </div>
                  )}

                  <pre className="p-4 rounded-md bg-[#0d1117] overflow-x-auto text-xs font-mono text-gray-300 border border-[#30363d] leading-relaxed">
                    {item.localConfig}
                  </pre>

                  {item.lanConfig !== item.localConfig && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-white select-none">
                        ▸ 局域网配置（用于其他设备连接）
                      </summary>
                      <pre className="mt-2 p-4 rounded-md bg-[#0d1117] overflow-x-auto text-xs font-mono text-gray-300 border border-[#30363d] leading-relaxed">
                        {item.lanConfig}
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 text-xs text-muted-foreground"
                        onClick={() => copyToClipboard(item.lanConfig, `${configKey}-lan`)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {copiedKey === `${configKey}-lan` ? "已复制" : "复制局域网配置"}
                      </Button>
                    </details>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-[#0d1117] border border-[#30363d] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              确认删除模型
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1">
              即将删除模型 <span className="font-mono text-red-400">{deleteTarget}</span>。
              此操作不可撤销，但模型可以重新拉取下载。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="border-border bg-background hover:bg-muted"
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={confirmDeleteModel}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="bg-[#0d1117] border border-[#30363d] max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              Ollama 容器日志
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <pre
              ref={logsScrollRef}
              className="text-xs font-mono text-gray-300 leading-relaxed bg-background/50 border border-border rounded p-4 h-[50vh] overflow-y-auto whitespace-pre-wrap"
            >
              {logsData?.logs || "暂无日志"}
            </pre>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchLogs()}
              className="border-border"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> 刷新
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLogsOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
