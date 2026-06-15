import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HardDrive, Trash2, RefreshCw, Plus } from "lucide-react";
import { 
  useListVolumes, 
  useCreateVolume,
  useRemoveVolume,
  getListVolumesQueryKey
} from "@workspace/api-client-react";
import { formatRelative } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Volumes() {
  const { data: volumes, isLoading } = useListVolumes();
  const createVolume = useCreateVolume();
  const removeVolume = useRemoveVolume();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListVolumesQueryKey() });

  const handleCreate = () => {
    if (!newVolumeName.trim()) return;
    createVolume.mutate({ data: { name: newVolumeName.trim() } }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `数据卷 ${newVolumeName} 已创建` });
        setCreateOpen(false);
        setNewVolumeName("");
        refresh();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "创建失败", description: err.message || "未能创建数据卷" });
      }
    });
  };

  const handleDelete = (name: string) => {
    if (!confirm(`确定删除数据卷 ${name} 吗？`)) return;
    removeVolume.mutate({ name }, {
      onSuccess: () => {
        toast({ title: "删除成功", description: `数据卷 ${name} 已被删除` });
        refresh();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "删除失败", description: err.message || "未能删除数据卷" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">数据卷管理</h2>
          <p className="text-muted-foreground">管理 Docker 数据卷以实现持久化存储。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> 刷新
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white">
                <Plus className="w-4 h-4 mr-2" /> 创建数据卷
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-card-border text-card-foreground">
              <DialogHeader>
                <DialogTitle>创建新数据卷</DialogTitle>
                <DialogDescription>
                  指定新数据卷的名称。驱动默认为 local。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">卷名称</Label>
                  <Input 
                    id="name" 
                    placeholder="例如: my-app-data" 
                    value={newVolumeName}
                    onChange={e => setNewVolumeName(e.target.value)}
                    className="font-mono bg-background"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
                <Button onClick={handleCreate} disabled={createVolume.isPending || !newVolumeName.trim()} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                  确定创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>名称</TableHead>
                <TableHead>驱动</TableHead>
                <TableHead>挂载点</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : !volumes || volumes.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">没有找到数据卷</TableCell></TableRow>
              ) : (
                volumes.map(volume => (
                  <TableRow key={volume.name} className="border-border hover:bg-muted/50">
                    <TableCell className="font-mono text-sm font-medium text-cyan-400">
                      {volume.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {volume.driver}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[300px] truncate" title={volume.mountpoint}>
                      {volume.mountpoint}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {volume.createdAt ? formatRelative(volume.createdAt) : '未知'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="删除" onClick={() => handleDelete(volume.name)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
