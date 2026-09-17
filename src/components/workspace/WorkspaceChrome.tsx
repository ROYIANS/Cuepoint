import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Download, Ellipsis } from "lucide-react";
import { db } from "@/db/database";
import { downloadBlob, exportProjectZip } from "@/lib/projectPackage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "story", label: "故事", to: "/p/$projectId" as const },
  { id: "world", label: "世界", to: "/p/$projectId/world" as const },
  { id: "shots", label: "分镜", to: "/p/$projectId/shots" as const },
  { id: "produce", label: "制作", to: "/p/$projectId/produce" as const },
];

export function WorkspaceChrome({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);

  if (project === undefined) {
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

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-4">
        <div className="flex min-w-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/" aria-label="返回工作室">
              <ChevronLeft />
            </Link>
          </Button>
          <span className="truncate text-[15px] font-medium">{project.name}</span>
        </div>
        <nav className="text-muted-foreground flex items-center gap-6 text-[13px]">
          {STEPS.map((step) => {
            const href = step.to.replace("$projectId", projectId);
            const active =
              step.id === "story"
                ? pathname === `/p/${projectId}` || pathname === `/p/${projectId}/`
                : step.id === "world"
                  ? pathname.startsWith(`/p/${projectId}/world`) ||
                    pathname.startsWith(`/p/${projectId}/assets`)
                  : pathname.startsWith(href);
            return (
              <Link
                key={step.id}
                to={step.to}
                params={{ projectId }}
                activeOptions={{ exact: step.id === "story" }}
                className={cn("hover:text-foreground", active && "text-foreground font-medium")}
              >
                {step.label}
              </Link>
            );
          })}
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
