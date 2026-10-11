import {useState} from "react";
import {useNavigate} from "@tanstack/react-router";
import {FolderOpen, Plus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {PageContent, PageHeader, PageState} from "@/components/layout/PageLayout";
import {nativeWorkspace, useNativeWorkspaceState} from "@/lib/nativeWorkspace";
import {toast} from "sonner";

export function NativeProjectGalleryPage() {
    const navigate = useNavigate();
    const {state, error, busy, refresh} = useNativeWorkspaceState();
    const [title, setTitle] = useState("未命名项目");
    const [creating, setCreating] = useState(false);
    async function create() {
        if (creating || !title.trim()) return;
        setCreating(true);
        try {
            const project = await nativeWorkspace.createProject(title);
            await refresh();
            await navigate({to: "/p/$projectId", params: {projectId: project.id}});
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "创建项目失败");
        } finally { setCreating(false); }
    }
    return <PageContent role="main">
        <PageHeader title="项目" description="管理桌面工作区中的项目。" actions={<div className="flex items-center gap-2"><Input aria-label="项目名称" value={title} onChange={event => setTitle(event.target.value)} className="w-44"/><Button disabled={busy || creating} onClick={() => void create()}><Plus aria-hidden/>新建项目</Button></div>}/>
        {error && <PageState kind="error" title="原生工作区不可用" description={error} action={<Button variant="outline" onClick={() => void refresh()}>重试</Button>}/>}
        {!error && !state && <PageState kind="loading" title="正在打开桌面工作区…"/>}
        {state && state.projects.length === 0 && <PageState title="还没有项目" description="创建第一个桌面项目，数据会保存到应用自己的工作区。"/>}
        {state && state.projects.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{state.projects.map(project => <button type="button" key={project.id} className="group rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/50" onClick={() => void navigate({to: "/p/$projectId", params: {projectId: project.id}})}><FolderOpen className="mb-8 size-5 text-muted-foreground" aria-hidden/><strong className="block truncate">{project.title}</strong><span className="text-xs text-muted-foreground">原生 SQLite 项目</span></button>)}</div>}
    </PageContent>;
}
