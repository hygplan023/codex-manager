import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers, Trash2, RefreshCw } from "lucide-react";
import { 
  useListImages, 
  useDeleteImage,
  getListImagesQueryKey
} from "@workspace/api-client-react";
import { formatBytes, formatRelative } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Images() {
  const { data: images, isLoading } = useListImages();
  const deleteImage = useDeleteImage();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`确定强制删除镜像 ${name} 吗？`)) return;
    deleteImage.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "删除成功", description: `镜像 ${name} 已被删除` });
        refresh();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "删除失败", description: err.message || "未能删除镜像" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">镜像管理</h2>
          <p className="text-muted-foreground">查看并管理本地 Docker 镜像资源。</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-2" /> 刷新
        </Button>
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>名称 / 标签</TableHead>
                <TableHead>镜像 ID</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : !images || images.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">没有找到镜像</TableCell></TableRow>
              ) : (
                images.map(image => {
                  const id = image.id.replace('sha256:', '').substring(0, 12);
                  // Some images might not have repoTags if they are <none>:<none>
                  const tags = image.repoTags && image.repoTags.length > 0 ? image.repoTags : ['<none>:<none>'];
                  
                  return (
                    <TableRow key={image.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-white">
                        <div className="flex flex-col gap-1">
                          {tags.map((tag, i) => (
                            <span key={i} className="font-mono text-sm text-cyan-400">{tag}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {id}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatBytes(image.size)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(image.created)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="删除" onClick={() => handleDelete(image.id, tags[0])}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
