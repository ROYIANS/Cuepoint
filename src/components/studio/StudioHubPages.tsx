import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Box,
  Cable,
  FolderOpen,
  Info,
  MapPinned,
  MessageSquare,
  Palette,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

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

export function IpHomePage() {
  return (
    <HubPage title="我的 IP" description="让每一次创作，都延续你想表达的自己。">
      <section className="mt-10 border-y py-8 sm:py-10" aria-labelledby="ip-coming-soon">
        <span className="text-muted-foreground inline-flex rounded-full border px-2.5 py-1 text-xs">即将推出</span>
        <h2 id="ip-coming-soon" className="font-display mt-5 max-w-lg text-2xl leading-relaxed tracking-tight sm:text-3xl">
          一个创作身份，<br />多种表达方式。
        </h2>
        <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-7">
          围绕同一个 IP，创作视频、图片、文案、播客和音乐。这里将保存你的定位、表达偏好与参考作品，让每个项目拥有共同的创作背景。
        </p>
        <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-7">
          IP 档案与项目关联正在准备中。你现在可以继续聊天、制作视频；项目也可以独立存在，无需先建立 IP。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild><Link to="/agent"><MessageSquare aria-hidden />从一个想法开始</Link></Button>
          <Button asChild variant="outline"><Link to="/projects">查看项目<ArrowUpRight aria-hidden /></Link></Button>
        </div>
      </section>
      <div className="mt-8 grid gap-7 sm:grid-cols-3">
        {[
          { title: "IP 档案", text: "未来可整理定位、受众和表达偏好，逐步形成清晰的创作方向。" },
          { title: "创作项目", text: "未来可将不同类型的作品归入同一 IP；独立创作仍然自由。" },
          { title: "专属素材", text: "未来可集中整理人物、声音与视觉参考，供这个 IP 的作品复用。" },
        ].map((item) => (
          <section key={item.title}>
            <h3 className="text-sm font-medium">{item.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-6">{item.text}</p>
          </section>
        ))}
      </div>
    </HubPage>
  );
}

const ASSET_CATEGORIES = [
  { to: "/characters", title: "角色", description: "人物设定、外观与参考形象", icon: UserRound },
  { to: "/scenes", title: "场景", description: "常用空间、环境与氛围", icon: MapPinned },
  { to: "/props", title: "道具", description: "服装、物件与关键道具", icon: Box },
  { to: "/styles", title: "风格", description: "画风、光色与视觉参考", icon: Palette },
] as const;

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

export function AssetsHubPage() {
  return (
    <HubPage title="素材库" description="整理可以反复使用的创作素材，留给下一次灵感。">
      <section className="mt-9" aria-labelledby="creative-assets">
        <h2 id="creative-assets" className="text-muted-foreground mb-3 text-xs font-medium">创作资产</h2>
        <div className="divide-y border-y">
          {ASSET_CATEGORIES.map((item) => <DestinationRow key={item.to} {...item} />)}
        </div>
        <p className="text-muted-foreground mt-4 text-sm leading-6">现有角色、场景、道具和风格都在这里，原有素材与编辑方式保持可用。</p>
      </section>
      <section className="mt-9" aria-labelledby="future-media">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="future-media" className="text-sm font-medium">媒体与资料</h2>
          <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">即将推出</span>
        </div>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">图片、视频、音频与文档的统一管理，以及 IP 专属素材，将逐步加入。当前项目内的素材仍在各自工作区中使用。</p>
      </section>
    </HubPage>
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
