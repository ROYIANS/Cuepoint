import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel";
import { flushPendingDrafts } from "@/lib/debouncedDraft";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Download, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Still } from "@/components/studio/Still";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from "@/db/database";
import { patchProjectOutput } from "@/db/repo";
import {
  episodeLabel,
  normalizeProjectMode,
} from "@/domain/types";
import { IMAGE_ACCEPT, pickMediaFile, uploadMediaFile } from "@/lib/media";
import { downloadBlob, exportProjectZip } from "@/lib/projectPackage";
import { cn } from "@/lib/utils";

const SERIES_STEPS = [
  { id: "episodes", label: "集", to: "/p/$projectId" as const, exact: true },
  { id: "world", label: "世界", to: "/p/$projectId/world" as const, exact: false },
];

const EPISODE_STEPS = [
  { id: "story", label: "故事", to: "/p/$projectId/e/$episodeId" as const, exact: true },
  { id: "shots", label: "分镜", to: "/p/$projectId/e/$episodeId/shots" as const, exact: false },
  { id: "produce", label: "制作", to: "/p/$projectId/e/$episodeId/produce" as const, exact: false },
];

function episodeIdFromPath(pathname: string, projectId: string): string | undefined {
  const prefix = `/p/${projectId}/e/`;
  if (!pathname.startsWith(prefix)) return undefined;
  return pathname.slice(prefix.length).split("/")[0] || undefined;
}

export function WorkspaceChrome({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const episodeId = episodeIdFromPath(pathname, projectId);
  const project = useLiveQuery(
    async () => (await db.projects.get(projectId)) ?? null,
    [projectId],
  );
  const currentEpisode = useLiveQuery(
    async () => {
      if (!episodeId) return undefined;
      const row = await db.episodes.get(episodeId);
      return row?.projectId === projectId ? row : null;
    },
    [episodeId, projectId],
  );
  const firstProjectEpisode = useLiveQuery(async () => {
    const rows = await db.episodes.where("projectId").equals(projectId).sortBy("order");
    return rows[0] ?? null;
  }, [projectId]);
  const [backingUp, setBackingUp] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [outputState, setOutputState] = useState({ dirty: false, saving: false });
  const [confirmSettingsClose, setConfirmSettingsClose] = useState(false);
  function changeSettingsOpen(open: boolean) {
    if (!open && outputState.saving) return;
    if (!open && outputState.dirty) { setConfirmSettingsClose(true); return; }
    setOutputState({ dirty: false, saving: false });
    setSettingsOpen(open);
  }

  if (
    project === undefined ||
    (episodeId && currentEpisode === undefined) ||
    (project && normalizeProjectMode(project.mode) === "film" && firstProjectEpisode === undefined)
  ) {
    return <div className="text-muted-foreground p-10 text-sm">加载项目…</div>;
  }

  if (project === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p>找不到这个项目</p>
        <Button onClick={() => void navigate({ to: "/projects" })}>返回工作室</Button>
      </div>
    );
  }

  const mode = normalizeProjectMode(project.mode);
  const projectHome = pathname === `/p/${projectId}` || pathname === `/p/${projectId}/`;

  if (episodeId && currentEpisode === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p>找不到这一集</p>
        <Button onClick={() => void navigate({ to: "/p/$projectId", params: { projectId } })}>
          返回项目
        </Button>
      </div>
    );
  }

  if (mode === "film" && firstProjectEpisode === null && !projectHome && pathname !== `/p/${projectId}/memory`) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p>这个单片项目缺少内部集</p>
        <Button onClick={() => void navigate({ to: "/p/$projectId", params: { projectId } })}>
          修复项目
        </Button>
      </div>
    );
  }

  const episode = currentEpisode || undefined;
  const filmEpisode = mode === "film" ? firstProjectEpisode || undefined : undefined;
  const title = mode === "film" ? project.name : episode ? episodeLabel(episode) : project.name;
  const backToStudio = mode === "film" || !episode;

  async function uploadCover() {
    try {
      const file = await pickMediaFile(IMAGE_ACCEPT);
      if (!file) return;
      const uploaded = await uploadMediaFile(projectId, file);
      await patchProjectOutput(projectId, { coverMediaId: uploaded.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传封面失败");
    }
  }

  async function clearCover() {
    try {
      await patchProjectOutput(projectId, { coverMediaId: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "清除封面失败");
    }
  }

  return (
    <div className="workspace-shell bg-background flex h-screen flex-col">
      <header className="workspace-header grid min-h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-4">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1">
          {backToStudio ? (
            <Button variant="ghost" size="icon-sm" asChild>
              <Link to="/projects" aria-label="返回工作室">
                <ChevronLeft />
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="icon-sm" asChild>
              <Link to="/p/$projectId" params={{ projectId }} aria-label="返回集列表">
                <ChevronLeft />
              </Link>
            </Button>
          )}
          <span className="truncate text-[15px] font-medium">{title}</span>
        </div>
        <nav className="text-muted-foreground col-span-2 row-start-2 flex items-center justify-center gap-6 text-[13px] sm:col-span-1 sm:col-start-2 sm:row-start-1">
          {filmEpisode ? (
            <>
              <Link
                to="/p/$projectId/e/$episodeId"
                params={{ projectId, episodeId: filmEpisode.id }}
                activeOptions={{ exact: true }}
                className={cn(
                  "hover:text-foreground",
                  (pathname === `/p/${projectId}/e/${filmEpisode.id}` ||
                    pathname === `/p/${projectId}/e/${filmEpisode.id}/`) &&
                    "text-foreground font-medium",
                )}
              >
                故事
              </Link>
              <Link
                to="/p/$projectId/world"
                params={{ projectId }}
                className={cn(
                  "hover:text-foreground",
                  (pathname.startsWith(`/p/${projectId}/world`) ||
                    pathname.startsWith(`/p/${projectId}/assets`)) &&
                    "text-foreground font-medium",
                )}
              >
                世界
              </Link>
              <Link
                to="/p/$projectId/e/$episodeId/shots"
                params={{ projectId, episodeId: filmEpisode.id }}
                search={{ shot: undefined }}
                className={cn(
                  "hover:text-foreground",
                  pathname.startsWith(`/p/${projectId}/e/${filmEpisode.id}/shots`) &&
                    "text-foreground font-medium",
                )}
              >
                分镜
              </Link>
              <Link
                to="/p/$projectId/e/$episodeId/produce"
                params={{ projectId, episodeId: filmEpisode.id }}
                className={cn(
                  "hover:text-foreground",
                  pathname.startsWith(`/p/${projectId}/e/${filmEpisode.id}/produce`) &&
                    "text-foreground font-medium",
                )}
              >
                制作
              </Link>
            </>
          ) : mode === "film" ? null : episode ? (
            <>
              {EPISODE_STEPS.map((step) => {
                const href = step.to
                  .replace("$projectId", projectId)
                  .replace("$episodeId", episode.id);
                const active = step.exact
                  ? pathname === href || pathname === `${href}/`
                  : pathname.startsWith(href);
                return (
                  <Link
                    key={step.id}
                    to={step.to}
                    params={{ projectId, episodeId: episode.id }}
                    search={step.id === "shots" ? { shot: undefined } : undefined}
                    activeOptions={{ exact: step.exact }}
                    className={cn("hover:text-foreground", active && "text-foreground font-medium")}
                  >
                    {step.label}
                  </Link>
                );
              })}
            </>
          ) : (
            <>
              {SERIES_STEPS.map((step) => {
                const href = step.to.replace("$projectId", projectId);
                const active = step.exact
                  ? pathname === href || pathname === `${href}/`
                  : pathname.startsWith(`/p/${projectId}/world`) ||
                    pathname.startsWith(`/p/${projectId}/assets`);
                return (
                  <Link
                    key={step.id}
                    to={step.to}
                    params={{ projectId }}
                    activeOptions={{ exact: step.exact }}
                    className={cn("hover:text-foreground", active && "text-foreground font-medium")}
                  >
                    {step.label}
                  </Link>
                );
              })}
            </>
          )}
          <Link to="/p/$projectId/memory" params={{ projectId }} className={cn("hover:text-foreground", pathname === `/p/${projectId}/memory` && "text-foreground font-medium")}>记忆</Link>
        </nav>
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:col-start-3">
          <Button variant="ghost" size="sm" onClick={() => changeSettingsOpen(true)} aria-label="项目设定">
            <Settings2 /><span className="hidden sm:inline">项目设定</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={backingUp}
            onClick={() => {
              setBackingUp(true);
              void flushPendingDrafts(projectId)
                .then(() => exportProjectZip(projectId))
                .then((blob) => {
                  downloadBlob(blob, `${project.name}.zip`);
                  toast.success("项目备份已下载");
                })
                .catch((error: unknown) => toast.error(
                  error instanceof Error ? `备份失败：${error.message}` : "备份失败，请重试",
                ))
                .finally(() => setBackingUp(false));
            }}
          >
            <Download />
            {backingUp ? "正在保存并备份…" : "备份项目"}
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>

      <Dialog open={settingsOpen} onOpenChange={changeSettingsOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>项目设定</DialogTitle>
          </DialogHeader>
          <ProjectSettingsPanel project={project} onOutputState={setOutputState} />
          <div>
            <p className="text-sm font-medium">项目封面</p>
            <div className="mt-2 flex items-start gap-4">
              <div className="aspect-[2/3] w-28 overflow-hidden rounded-xl bg-card ring-foreground/8 ring-1">
                <Still mediaId={project.coverMediaId} title={project.name} />
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => void uploadCover()}>
                  {project.coverMediaId ? "更换封面" : "上传封面"}
                </Button>
                {project.coverMediaId ? (
                  <Button variant="ghost" size="sm" onClick={() => void clearCover()}>
                    清除封面
                  </Button>
                ) : (
                  <p className="text-muted-foreground text-xs leading-5">
                    未设置时，项目库会用最早镜头的首帧作封面。
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={outputState.saving} onClick={() => changeSettingsOpen(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmSettingsClose} onOpenChange={setConfirmSettingsClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>输出配置尚未保存</AlertDialogTitle>
            <AlertDialogDescription>返回后可保存当前画幅和生成默认值；放弃只撤销本次输出配置修改，已自动保存的项目信息会保留。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOutputState({ dirty: false, saving: false }); setSettingsOpen(false); }}>放弃输出修改</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
