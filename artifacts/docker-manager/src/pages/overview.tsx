import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, Activity, HardDrive, Cpu, Box, Play, Square, RefreshCw, Layers } from "lucide-react";
import { useGetDockerInfo, useGetOllamaStatus, useListContainers, useStartOllama, useStopOllama, useRestartOllama, getGetOllamaStatusQueryKey, useDeployOllama } from "@workspace/api-client-react";
import { formatBytes, formatRelative } from "@/lib/format";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Overview() {
  const { data: dockerInfo, isLoading: isDockerLoading } = useGetDockerInfo();
  const { data: ollamaStatus, isLoading: isOllamaLoading } = useGetOllamaStatus();
  const { data: containers, isLoading: isContainersLoading } = useListContainers({ all: true });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deployOllama = useDeployOllama();
  const startOllama = useStartOllama();
  const stopOllama = useStopOllama();
  const restartOllama = useRestartOllama();

  const handleOllamaAction = (action: 'deploy' | 'start' | 'stop' | 'restart') => {
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getGetOllamaStatusQueryKey() });
      toast({ title: "操作成功", description: "Ollama 状态已更新" });
    };

    if (action === 'deploy') deployOllama.mutate({ data: { port: 11434 } }, { onSuccess });
    else if (action === 'start') startOllama.mutate(undefined, { onSuccess });
    else if (action === 'stop') stopOllama.mutate(undefined, { onSuccess });
    else if (action === 'restart') restartOllama.mutate(undefined, { onSuccess });
  };

  const recentContainers = containers?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">系统概览</h2>
        <p className="text-muted-foreground">监控 Docker 引擎状态和资源使用情况。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-cyan-400">
              <Server className="w-5 h-5" />
              Docker 引擎状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDockerLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
              </div>
            ) : dockerInfo ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground">版本</span>
                  <p className="font-mono">{dockerInfo.serverVersion}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">操作系统</span>
                  <p className="font-mono">{dockerInfo.osType} ({dockerInfo.architecture})</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">容器总数</span>
                  <p className="font-mono text-xl">
                    <span className="text-green-400">{dockerInfo.containersRunning}</span> 
                    <span className="text-muted-foreground"> / {dockerInfo.containers}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">镜像总数</span>
                  <p className="font-mono text-xl">{dockerInfo.images}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Cpu className="w-4 h-4" /> 内存
                  </span>
                  <p className="font-mono">{formatBytes(dockerInfo.memTotal)}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-cyan-400">
              <Activity className="w-5 h-5" />
              Ollama 运行状态
            </CardTitle>
            {ollamaStatus?.running ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">运行中</Badge>
            ) : (
              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/50">已停止</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {isOllamaLoading ? (
              <div className="h-20 bg-muted rounded animate-pulse"></div>
            ) : ollamaStatus ? (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">API 状态</span>
                    <p className="font-mono">{ollamaStatus.apiReachable ? '可访问' : '不可达'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">容器名称</span>
                    <p className="font-mono">{ollamaStatus.containerName || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">端口</span>
                    <p className="font-mono">{ollamaStatus.port || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">运行时长</span>
                    <p className="font-mono">{ollamaStatus.uptime || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!ollamaStatus.containerId ? (
                    <Button onClick={() => handleOllamaAction('deploy')} disabled={deployOllama.isPending} variant="default" size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white">
                      <HardDrive className="w-4 h-4 mr-2" /> 一键部署
                    </Button>
                  ) : !ollamaStatus.running ? (
                    <Button onClick={() => handleOllamaAction('start')} disabled={startOllama.isPending} variant="outline" size="sm" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
                      <Play className="w-4 h-4 mr-2" /> 启动
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => handleOllamaAction('stop')} disabled={stopOllama.isPending} variant="outline" size="sm" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                        <Square className="w-4 h-4 mr-2" /> 停止
                      </Button>
                      <Button onClick={() => handleOllamaAction('restart')} disabled={restartOllama.isPending} variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                        <RefreshCw className="w-4 h-4 mr-2" /> 重启
                      </Button>
                    </>
                  )}
                  <Link href="/ollama">
                    <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-white">
                      进入管理
                    </Button>
                  </Link>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-card-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Box className="w-5 h-5 text-cyan-400" />
            最近容器
          </CardTitle>
          <Link href="/containers">
            <Button variant="link" className="text-cyan-400 hover:text-cyan-300 px-0">查看全部 &rarr;</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isContainersLoading ? (
             <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>)}
             </div>
          ) : recentContainers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">没有找到容器</div>
          ) : (
            <div className="space-y-4">
              {recentContainers.map(container => (
                <div key={container.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-2 h-2 rounded-full", container.state === 'running' ? 'bg-green-500' : 'bg-red-500')} />
                    <div>
                      <div className="font-mono font-medium text-sm text-white">{container.names[0]?.replace(/^\//, '')}</div>
                      <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px] md:max-w-md" title={container.image}>{container.image}</div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <Badge variant="outline" className="font-mono text-xs">{container.state}</Badge>
                    <span className="text-xs text-muted-foreground">{formatRelative(container.created)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
