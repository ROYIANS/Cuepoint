import {Link} from "@tanstack/react-router";
import {ArrowLeft, FileBox} from "lucide-react";
import {Button} from "@/components/ui/button";
import {PageContent, PageState} from "@/components/layout/PageLayout";
import {useNativeWorkspaceState} from "@/lib/nativeWorkspace";

export function NativeProjectWorkspacePage({projectId}: {projectId: string}) {
    const {state, availability, error, refresh} = useNativeWorkspaceState();
    const project = state?.projects.find(item => item.id === projectId);
    const assets = state?.assets.filter(item => item.projectId === projectId) ?? [];
    const availabilityById = new Map(availability.map(item => [item.assetId, item.status]));
    if (error) return <PageContent><PageState kind="error" title="原生工作区不可用" description={error} action={<Button variant="outline" onClick={() => void refresh()}>重试</Button>}/></PageContent>;
    if (!state) return <PageContent><PageState kind="loading" title="正在打开项目…"/></PageContent>;
    if (!project) return <PageContent><PageState kind="missing" title="找不到这个项目" action={<Button asChild><Link to="/projects">返回项目</Link></Button>}/></PageContent>;
    return <PageContent role="main"><div className="mb-6 flex items-center gap-3"><Button variant="ghost" size="icon-sm" asChild><Link to="/projects" aria-label="返回项目"><ArrowLeft/></Link></Button><div><h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1><p className="text-sm text-muted-foreground">原生 SQLite 工作区</p></div><Button className="ml-auto" variant="outline" asChild><Link to="/assets" search={{project: project.id}}>项目素材</Link></Button></div><section className="rounded-xl border bg-card p-5"><div className="mb-4 flex items-center gap-2"><FileBox className="size-5 text-muted-foreground" aria-hidden/><h2 className="font-medium">素材副本</h2><span className="text-sm text-muted-foreground">{assets.length}</span></div>{assets.length ? <ul className="divide-y">{assets.map(asset => { const status = availabilityById.get(asset.id) ?? "missing"; const label = status === "present" ? "已托管" : status === "missing" ? "素材已丢失" : "素材已损坏"; return <li key={asset.id} className="flex items-center justify-between gap-3 py-3"><span className="truncate">{asset.displayName}</span><span className={status === "present" ? "shrink-0 text-xs text-muted-foreground" : "shrink-0 text-xs text-destructive"}>{label} · {asset.byteLength.toLocaleString()} bytes</span></li>; })}</ul> : <p className="text-sm text-muted-foreground">还没有导入项目素材。</p>}</section></PageContent>;
}
