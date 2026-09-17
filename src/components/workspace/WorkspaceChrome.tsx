import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Download, Ellipsis } from "lucide-react";
import { db } from "@/db/database";
import { episodeLabel, normalizeProjectMode } from "@/domain/types";
import { downloadBlob, exportProjectZip } from "@/lib/projectPackage";
import { Button } from "@/components/ui/button";
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
        <Button onClick={() => void navigate({ to: "/" })}>返回工作室</Button>
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

  if (mode === "film" && firstProjectEpisode === null && !projectHome) {
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

  return (
    <div className="workspace-shell bg-background flex h-screen flex-col">
      <header className="workspace-header grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-4">
        <div className="flex min-w-0 items-center gap-1">
          {backToStudio ? (
            <Button variant="ghost" size="icon-sm" asChild>
              <Link to="/" aria-label="返回工作室">
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
        <nav className="text-muted-foreground flex items-center gap-6 text-[13px]">
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
        </nav>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" disabled>
            <Ellipsis />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void exportProjectZip(projectId).then((blob) =>
                downloadBlob(blob, `${project.name}.zip`),
              );
            }}
          >
            <Download />
            备份项目
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
