import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { FolderOpen, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/db/database";
import { createProject, deleteProject, renameProject } from "@/db/repo";
import { formatUpdatedAt } from "@/lib/format";
import {
  downloadBlob,
  exportProjectZip,
  importProjectZip,
  PackageError,
} from "@/lib/projectPackage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ProjectListPage() {
  const navigate = useNavigate();
  const projects =
    useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("未命名项目");
  const [renameId, setRenameId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string>();

  async function handleCreate() {
    const project = await createProject(name);
    setCreating(false);
    setName("未命名项目");
    await navigate({ to: "/p/$projectId", params: { projectId: project.id } });
  }

  async function handleImport(file: File) {
    try {
      const project = await importProjectZip(file);
      await navigate({ to: "/p/$projectId", params: { projectId: project.id } });
    } catch (err) {
      toast.error(err instanceof PackageError ? err.message : "导入失败");
    }
  }

  return (
    <div className="bg-muted/40 min-h-screen">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-5">
          <div>
            <p className="text-lg font-semibold tracking-tight">爱分镜</p>
            <p className="text-muted-foreground text-xs">本地项目管理 · 导入导出备份</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".zip,application/zip";
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (file) void handleImport(file);
                };
                input.click();
              }}
            >
              <Upload />
              导入项目
            </Button>
            <Button size="sm" variant="brand" onClick={() => setCreating(true)}>
              <Plus />
              新建项目
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-8 py-8">
        {projects.length === 0 ? (
          <div className="bg-background flex flex-col items-center justify-center rounded-2xl border border-dashed py-24 text-center">
            <FolderOpen className="text-muted-foreground size-9" />
            <p className="mt-4 text-base font-medium">还没有项目</p>
            <p className="text-muted-foreground mt-1 text-sm">新建一个，或导入以前导出的 zip</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {projects.map((project) => (
              <li
                key={project.id}
                className="bg-card flex items-center justify-between rounded-2xl border px-5 py-4"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() =>
                    void navigate({
                      to: "/p/$projectId",
                      params: { projectId: project.id },
                    })
                  }
                >
                  <p className="truncate text-[15px] font-medium">{project.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    更新于 {formatUpdatedAt(project.updatedAt)}
                  </p>
                </button>
                <div className="ml-4 flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRenameId(project.id);
                      setRenameValue(project.name);
                    }}
                  >
                    重命名
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void exportProjectZip(project.id).then((blob) =>
                        downloadBlob(blob, `${project.name}.zip`),
                      );
                    }}
                  >
                    导出
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(project.id)}>
                    删除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="项目名称"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              取消
            </Button>
            <Button variant="brand" onClick={() => void handleCreate()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameId)} onOpenChange={(open) => !open && setRenameId(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(undefined)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (renameId) void renameProject(renameId, renameValue);
                setRenameId(undefined);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复（除非你已经导出过 zip）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) void deleteProject(deleteId);
                setDeleteId(undefined);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
