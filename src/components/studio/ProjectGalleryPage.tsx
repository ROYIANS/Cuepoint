import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CoverCard, CreateTile, LibraryGrid } from "@/components/studio/CoverCard";
import { LibraryHeader } from "@/components/studio/LibraryHeader";
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
import { db } from "@/db/database";
import { createProject, deleteProject, renameProject } from "@/db/repo";
import { formatUpdatedAt } from "@/lib/format";
import { filterAndSortLibrary, type LibrarySort } from "@/lib/library";
import {
  downloadBlob,
  exportProjectZip,
  importProjectZip,
  PackageError,
} from "@/lib/projectPackage";
import type { Id, Shot } from "@/domain/types";

function coverOfProject(shots: Shot[], projectId: Id): Id | undefined {
  return shots
    .filter((shot) => shot.projectId === projectId)
    .sort((left, right) => left.order - right.order)
    .find((shot) => shot.frame.result?.mediaId)?.frame.result?.mediaId;
}

export function ProjectGalleryPage() {
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const shots = useLiveQuery(() => db.shots.toArray(), []) ?? [];
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("未命名项目");
  const [renameId, setRenameId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string>();

  const visible = useMemo(
    () => filterAndSortLibrary(projects, query, sort),
    [projects, query, sort],
  );

  async function handleCreate() {
    try {
      const project = await createProject(name);
      setCreating(false);
      setName("未命名项目");
      await navigate({ to: "/p/$projectId", params: { projectId: project.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    }
  }

  return (
    <div className="px-10 py-8">
      <LibraryHeader title="我的项目" query={query} onQuery={setQuery} sort={sort} onSort={setSort} />
      <div className="mt-8">
        <LibraryGrid>
          <CreateTile label="创建新项目" hint="本地项目" onClick={() => setCreating(true)} />
          {visible.map((project) => (
            <CoverCard
              key={project.id}
              title={project.name}
              subtitle={`更新 ${formatUpdatedAt(project.updatedAt)}`}
              mediaId={coverOfProject(shots, project.id)}
              onOpen={() =>
                void navigate({ to: "/p/$projectId", params: { projectId: project.id } })
              }
              actions={[
                {
                  label: "重命名",
                  onSelect: () => {
                    setRenameId(project.id);
                    setRenameValue(project.name);
                  },
                },
                {
                  label: "导出 zip",
                  onSelect: () => {
                    void exportProjectZip(project.id).then((blob) =>
                      downloadBlob(blob, `${project.name}.zip`),
                    );
                  },
                },
                {
                  label: "删除",
                  tone: "danger",
                  onSelect: () => setDeleteId(project.id),
                },
              ]}
            />
          ))}
        </LibraryGrid>
      </div>

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

export async function importStudioProject(file: File) {
  try {
    return await importProjectZip(file);
  } catch (err) {
    toast.error(err instanceof PackageError ? err.message : "导入失败");
    return undefined;
  }
}
