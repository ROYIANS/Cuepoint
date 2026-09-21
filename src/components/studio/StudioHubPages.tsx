import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Cable,
  FolderOpen,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

function HubPage({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <header>
        <h1 className="font-display text-[28px] leading-tight tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">{description}</p>
      </header>
      {children}
    </div>
  );
}

function DestinationRow({ to, title, description, icon: Icon }: {
  to: "/characters" | "/scenes" | "/props" | "/styles" | "/connectors" | "/projects" | "/about";
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link to={to} className="group hover:bg-accent/50 focus-visible:ring-ring flex min-w-0 items-center gap-4 rounded-xl px-3 py-5 outline-none transition-colors focus-visible:ring-2 sm:px-4">
      <Icon className="text-muted-foreground size-5 shrink-0" strokeWidth={1.5} aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-6">{description}</p>
      </div>
      <ArrowUpRight className="text-muted-foreground/60 group-hover:text-foreground size-4 shrink-0" aria-hidden />
    </Link>
  );
}

export function SettingsHelpPage() {
  return (
    <HubPage title="设置与帮助" description="管理 AI 连接，找到项目备份与产品说明。">
      <div className="mt-9 divide-y border-y">
        <DestinationRow to="/connectors" title="连接与模型" description="配置 AI 服务连接，管理可用模型。" icon={Cable} />
        <DestinationRow to="/projects" title="项目与备份" description="进入项目列表，在项目菜单中导出备份；使用侧栏的导入入口恢复备份。" icon={FolderOpen} />
        <DestinationRow to="/about" title="关于小光点" description="了解产品、数据存储方式与开源项目。" icon={Info} />
      </div>
    </HubPage>
  );
}
