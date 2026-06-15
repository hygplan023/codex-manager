import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2, CheckCircle2, XCircle, HardDrive, Terminal, Copy } from "lucide-react";
import { 
  useGetOllamaStatus, 
  useListOllamaModels, 
  useDeleteOllamaModel, 
  useGetOllamaClientConfig, 
  useTestOllamaConnection,
  getGetOllamaStatusQueryKey,
  getListOllamaModelsQueryKey
} from "@workspace/api-client-react";
import { formatBytes, formatRelative } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function Ollama() {
  const { data: status } = useGetOllamaStatus();
  const { data: models, isLoading: isModelsLoading } = useListOllamaModels();
  const { data: config } = useGetOllamaClientConfig();
  const deleteModel = useDeleteOllamaModel();
  const testConnection = useTestOllamaConnection();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [pullModelName, setPullModelName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatusText, setPullStatusText] = useState("");

  const handlePullModel = async () => {
    if (!pullModelName.trim()) return;
    setPulling(true);
    setPullProgress(0);
    setPullStatusText("开始拉取...");

    try {
      const response = await fetch('/api/ollama/models/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: pullModelName.trim() })
      });

      if (!response.ok) throw new Error("请求失败");
      if (!response.body) throw new Error("无响应流");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setPullStatusText(data.status || "拉取中...");
              if (data.total && data.completed) {
                setPullProgress(Math.round((data.completed / data.total) * 100));
              }
              if (data.status === 'success') {
                toast({ title: "成功", description: `模型 ${pullModelName} 拉取成功` });
                queryClient.invalidateQueries({ queryKey: getListOllamaModelsQueryKey() });
                setPulling(false);
                setPullModelName("");
                return;
              }
              if (data.error) {
                toast({ variant: "destructive", title: "拉取失败", description: data.error });
                setPulling(false);
                return;
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "错误", description: "连接中断" });
    }
    setPulling(false);
  };

  const handleDeleteModel = (name: string) => {
    if (!confirm(`确定删除模型 ${name} 吗？`)) return;
    deleteModel.mutate({ name }, {
      onSuccess: () => {
        toast({ title: "已删除", description: `模型 ${name} 已被删除` });
        queryClient.invalidateQueries({ queryKey: getListOllamaModelsQueryKey() });
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "已复制到剪贴板" });
  };

  const handleTestConnection = (url: string) => {
    testConnection.mutate({ data: { url } }, {
      onSuccess: (res) => {
        if (res.success) {
          toast({ title: "连接成功", description: `延迟: ${res.latencyMs}ms, 模型数: ${res.models?.length || 0}` });
        } else {
          toast({ variant: "destructive", title: "连接失败", description: res.message });
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Ollama 管理</h2>
        <p className="text-muted-foreground">管理本地大语言模型及客户端连接配置。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-cyan-400">
              <Download className="w-5 h-5" />
              拉取模型
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="例如: llama3:8b, mistral" 
                value={pullModelName} 
                onChange={e => setPullModelName(e.target.value)}
                disabled={pulling}
                className="font-mono bg-background"
              />
              <Button onClick={handlePullModel} disabled={pulling || !pullModelName.trim()} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                <Download className="w-4 h-4 mr-2" />
                {pulling ? '拉取中' : '拉取'}
              </Button>
            </div>
            {pulling && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{pullStatusText}</span>
                  <span className="font-mono">{pullProgress}%</span>
                </div>
                <Progress value={pullProgress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-cyan-400">
              <Terminal className="w-5 h-5" />
              连接测试
            </CardTitle>
          </CardHeader>
          <CardContent>
            {config ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded bg-background/50 border border-border">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">本地连接 (localhost)</span>
                    <span className="font-mono text-sm">{config.localUrl}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleTestConnection(config.localUrl)}>测试</Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-background/50 border border-border">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">局域网连接 (LAN)</span>
                    <span className="font-mono text-sm">{config.lanUrl}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleTestConnection(config.lanUrl)}>测试</Button>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">正在加载配置...</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="text-lg">已安装模型</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
                ) : !models || models.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">没有安装任何模型</TableCell></TableRow>
                ) : (
                  models.map(model => (
                    <TableRow key={model.name} className="border-border hover:bg-muted/50">
                      <TableCell className="font-mono font-medium text-cyan-400">{model.name}</TableCell>
                      <TableCell className="font-mono text-xs">{formatBytes(model.size)}</TableCell>
                      <TableCell className="font-mono text-xs">{model.parameterSize || '-'}</TableCell>
                      <TableCell className="font-mono text-xs"><Badge variant="outline" className="bg-background">{model.quantizationLevel || '-'}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(model.modifiedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleDeleteModel(model.name)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {config?.configs && config.configs.length > 0 && (
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg">客户端配置指南</CardTitle>
            <CardDescription>各 AI 辅助编程工具的连接配置参考</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {config.configs.map(item => (
              <div key={item.client} className="space-y-2 border border-border p-4 rounded-lg bg-background/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-cyan-400 font-medium text-base">{item.client}</h3>
                  {item.configPath && <span className="text-xs text-muted-foreground font-mono">配置文件: {item.configPath}</span>}
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <div className="relative group">
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="secondary" className="h-7 bg-muted/80 backdrop-blur" onClick={() => copyToClipboard(item.localConfig)}>
                      <Copy className="w-3 h-3 mr-1" /> 复制
                    </Button>
                  </div>
                  <pre className="p-4 rounded-md bg-[#0d1117] overflow-x-auto text-xs font-mono text-gray-300 border border-[#30363d]">
                    {item.localConfig}
                  </pre>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
