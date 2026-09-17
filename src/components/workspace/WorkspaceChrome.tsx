import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Download, Ellipsis } from "lucide-react";
import { db } from "@/db/database";
import { episodeLabel } from "@/domain/types";
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
  const episode = useLiveQuery(
    async () => {
      if (!episodeId) return undefined;
      const row = await db.episodes.get(episodeId);
      return row?.projectId === projectId ? row : null;
    },
    [episodeId, projectId],
  );

  if (project === undefined || (episodeId && episode === undefined)) {
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

  if (episodeId && episode === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p>找不到这一集</p>
        <Button onClick={() => void navigate({ to: "/p/$projectId", params: { projectId } })}>
          返回集列表
        </Button>
      </div>
    );
  }

  const title = episode ? episodeLabel(episode) : project.name;
  const backToStudio = !episode;

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-4">
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
          {episode ? (
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
            导出
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
