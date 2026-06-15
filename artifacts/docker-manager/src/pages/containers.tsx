import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Box, Play, Square, RefreshCw, Trash2, Terminal, Filter } from "lucide-react";
import { 
  useListContainers, 
  useStartContainer, 
  useStopContainer, 
  useRestartContainer, 
  useDeleteContainer,
  useFetchContainerLogs,
  getListContainersQueryKey
} from "@workspace/api-client-react";
import { formatRelative } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function LogsModal({ containerId, isOpen, onClose, containerName }: { containerId: string | null, isOpen: boolean, onClose: () => void, containerName: string }) {
  const { data: logsData, isLoading } = useFetchContainerLogs(containerId || "");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col bg-[#0d1117] border-gray-800 text-gray-300">
        <DialogHeader>
          <DialogTitle className="text-gray-100 font-mono flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            {containerName} 日志
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            显示最后 100 行日志输出。
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 relative rounded-md border border-gray-800 bg-black">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              加载中...
            </div>
          ) : (
            <ScrollArea className="h-[500px] w-full p-4 font-mono text-xs whitespace-pre">
              {logsData?.logs || '无日志输出'}
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Containers() {
  const [showAll, setShowAll] = useState(true);
  const [search, setSearch] = useState("");
  
  const { data: containers, isLoading } = useListContainers({ all: showAll });
  
  const startContainer = useStartContainer();
  const stopContainer = useStopContainer();
  const restartContainer = useRestartContainer();
  const deleteContainer = useDeleteContainer();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [logsContainerId, setLogsContainerId] = useState<string | null>(null);
  const [logsContainerName, setLogsContainerName] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListContainersQueryKey({ all: showAll }) });

  const handleAction = (action: 'start' | 'stop' | 'restart' | 'delete', id: string, name: string) => {
    const onSuccess = () => {
      toast({ title: "操作成功", description: `容器 ${name} 已执行操作` });
      refresh();
    };
    
    if (action === 'delete' && !confirm(`确定删除容器 ${name} 吗？将强制删除。`)) return;

    if (action === 'start') startContainer.mutate({ id }, { onSuccess });
    if (action === 'stop') stopContainer.mutate({ id }, { onSuccess });
    if (action === 'restart') restartContainer.mutate({ id }, { onSuccess });
    if (action === 'delete') deleteContainer.mutate({ id }, { onSuccess });
  };

  const filteredContainers = containers?.filter(c => {
    if (!search) return true;
    const term = search.toLowerCase();
    return c.names.some(n => n.toLowerCase().includes(term)) || c.image.toLowerCase().includes(term) || c.id.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">容器管理</h2>
        <p className="text-muted-foreground">查看并管理所有的 Docker 容器实例。</p>
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-background/50">
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索容器名称、镜像或 ID..."
                  className="pl-9 bg-card font-mono text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
                <Label htmlFor="show-all" className="text-sm cursor-pointer">显示停止的容器</Label>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-2" /> 刷新
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[150px]">名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>镜像</TableHead>
                <TableHead>端口映射</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : !filteredContainers || filteredContainers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">没有找到匹配的容器</TableCell></TableRow>
              ) : (
                filteredContainers.map(container => {
                  const name = container.names[0]?.replace(/^\//, '') || container.id.substring(0, 12);
                  const isRunning = container.state === 'running';
                  return (
                    <TableRow key={container.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-white">
                        <div className="font-mono text-sm">{name}</div>
                        <div className="font-mono text-xs text-muted-foreground mt-0.5">{container.id.substring(0, 12)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "font-mono text-xs capitalize",
                          isRunning ? "bg-green-500/10 text-green-400 border-green-500/50" : "bg-muted text-muted-foreground"
                        )}>
                          {container.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate" title={container.image}>
                        {container.image}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-cyan-400/80">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {container.ports.map((p, i) => (
                            <span key={i} className="bg-cyan-950/50 px-1 py-0.5 rounded">
                              {p.publicPort ? `${p.publicPort}->` : ''}{p.privatePort}/{p.type}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(container.created)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="查看日志" onClick={() => { setLogsContainerId(container.id); setLogsContainerName(name); }}>
                            <Terminal className="w-4 h-4 text-gray-400" />
                          </Button>
                          {isRunning ? (
                            <>
                              <Button variant="ghost" size="icon" title="停止" onClick={() => handleAction('stop', container.id, name)}>
                                <Square className="w-4 h-4 text-orange-400" />
                              </Button>
                              <Button variant="ghost" size="icon" title="重启" onClick={() => handleAction('restart', container.id, name)}>
                                <RefreshCw className="w-4 h-4 text-cyan-400" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="icon" title="启动" onClick={() => handleAction('start', container.id, name)}>
                              <Play className="w-4 h-4 text-green-400" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="删除" onClick={() => handleAction('delete', container.id, name)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LogsModal 
        containerId={logsContainerId} 
        containerName={logsContainerName}
        isOpen={!!logsContainerId} 
        onClose={() => setLogsContainerId(null)} 
      />
    </div>
  );
}
