import { flushPendingDrafts } from "@/lib/debouncedDraft";
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
import {
  ASPECT_PRESET_IDS,
  ASPECT_PRESETS,
  resolutionForAspect,
  type AspectPresetId,
  type Id,
  type ProjectMode,
  type Shot,
} from "@/domain/types";
import { cn } from "@/lib/utils";

function coverOfProject(shots: Shot[], projectId: Id): Id | undefined {
  return shots
    .filter((shot) => shot.projectId === projectId)
    .sort((left, right) => left.order - right.order)
    .find((shot) => shot.firstFrame.result?.mediaId)?.firstFrame.result?.mediaId;
}

export function ProjectGalleryPage() {
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const shots = useLiveQuery(() => db.shots.toArray(), []) ?? [];
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("未命名项目");
  const [mode, setMode] = useState<ProjectMode>("film");
  const [aspectPreset, setAspectPreset] = useState<AspectPresetId>("16:9");
  const [renameId, setRenameId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string>();

  const visible = useMemo(
    () => filterAndSortLibrary(projects, query, sort),
    [projects, query, sort],
  );

  const aspectResolution = resolutionForAspect(aspectPreset);

  async function handleCreate() {
    try {
      const project = await createProject(name, mode, aspectPreset);
      setCreating(false);
      setName("未命名项目");
      setMode("film");
      setAspectPreset("16:9");
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
          <CreateTile
            frame="poster"
            label="创建新项目"
            hint="本地项目"
            onClick={() => setCreating(true)}
          />
          {visible.map((project) => (
            <CoverCard
              key={project.id}
              frame="poster"
              title={project.name}
              subtitle={`更新 ${formatUpdatedAt(project.updatedAt)}`}
              mediaId={project.coverMediaId ?? coverOfProject(shots, project.id)}
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
                  label: "备份项目（zip）",
                  onSelect: () => {
                    void flushPendingDrafts(project.id)
                      .then(() => exportProjectZip(project.id))
                      .then((blob) => downloadBlob(blob, `${project.name}.zip`))
                      .catch((error: unknown) => toast.error(
                        error instanceof Error ? `备份失败：${error.message}` : "备份失败，请重试",
                      ));
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
          <fieldset>
            <legend className="text-sm font-medium">项目类型</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(
                [
                  { value: "film", title: "单片", hint: "直接进入故事，适合短片和电影" },
                  { value: "series", title: "连载", hint: "按集管理故事、分镜和制作" },
                ] satisfies { value: ProjectMode; title: string; hint: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mode === option.value}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    mode === option.value
                      ? "border-brand bg-brand/5"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => setMode(option.value)}
                >
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="text-muted-foreground mt-1 block text-xs leading-5">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">画幅比例</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ASPECT_PRESET_IDS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={aspectPreset === preset}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors",
                    aspectPreset === preset
                      ? "border-brand bg-brand/5"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => setAspectPreset(preset)}
                >
                  {ASPECT_PRESETS[preset].label}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              默认分辨率 {aspectResolution.width}×{aspectResolution.height}
            </p>
          </fieldset>
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
              删除后无法恢复（除非你已经备份过项目）。
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
