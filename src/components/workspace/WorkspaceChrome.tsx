import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Bell, ChevronLeft, Download, Ellipsis, Images, Users } from "lucide-react";
import { db } from "@/db/database";
import { downloadBlob, exportProjectZip } from "@/lib/projectPackage";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "shots", label: "分镜制作", to: "/p/$projectId" as const },
  { id: "storyboard", label: "故事板", to: "/p/$projectId/storyboard" as const },
  { id: "plan", label: "拍摄计划", to: "/p/$projectId/plan" as const },
  { id: "report", label: "拍摄报告", to: "/p/$projectId/report" as const },
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
        <Button onClick={() => void navigate({ to: "/" })}>返回列表</Button>
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
              step.id === "shots"
                ? pathname === `/p/${projectId}` || pathname === `/p/${projectId}/`
                : pathname.startsWith(href);
            return (
              <Link
                key={step.id}
                to={step.to}
                params={{ projectId }}
                className={cn("hover:text-foreground", active && "text-foreground font-medium")}
              >
                {step.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/p/$projectId/assets" params={{ projectId }}>
              <Images />
              资产
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" disabled>
            <Bell />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled>
            <Ellipsis />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" disabled>
                  <Users />
                  协作
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>本地版本暂不支持协作</TooltipContent>
          </Tooltip>
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

export function PlaceholderPage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">{detail}</p>
    </div>
  );
}
