import {useMemo, useState} from "react";
import {Image, Search, Upload} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {PageContent, PageHeader, PageState} from "@/components/layout/PageLayout";
import {nativeWorkspace, useNativeWorkspaceState} from "@/lib/nativeWorkspace";
import type {MaterialLibrarySearch} from "./MaterialLibraryPage";
import {toast} from "sonner";

export function NativeAssetLibraryPage({search}: {search: MaterialLibrarySearch}) {
    const {state, availability, error, busy, refresh} = useNativeWorkspaceState();
    const [query, setQuery] = useState("");
    const [importing, setImporting] = useState(false);
    const projectId = search.project ?? "studio";
    const availabilityById = useMemo(() => new Map(availability.map(item => [item.assetId, item.status])), [availability]);
    const assets = useMemo(() => (state?.assets ?? []).filter(asset => asset.projectId === projectId && `${asset.displayName} ${asset.mimeType}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query, projectId, state]);
    async function importAsset() {
        if (importing) return;
        setImporting(true);
        try {
            const asset = await nativeWorkspace.importAsset(projectId, "桌面素材", "application/octet-stream");
            if (asset) { await refresh(); toast.success("素材已复制到应用工作区"); }
        } catch (cause) { toast.error(cause instanceof Error ? cause.message : "导入素材失败"); }
        finally { setImporting(false); }
    }
    return <PageContent role="main">
        <PageHeader title="素材库" description="管理应用工作区中的素材与文件副本。" actions={<Button disabled={busy || importing} onClick={() => void importAsset()}><Upload size={16} aria-hidden/>导入素材</Button>}/>
        <div className="flex items-center gap-2 border-b pb-4"><Image size={16} aria-hidden/><span className="text-sm font-medium">媒体与资料</span><div className="ml-auto flex w-full max-w-sm items-center gap-2"><Search size={16} aria-hidden/><Input aria-label="搜索素材" placeholder="搜索名称或格式" value={query} onChange={event => setQuery(event.target.value)}/></div></div>
        {error && <PageState kind="error" title="原生工作区不可用" description={error} action={<Button variant="outline" onClick={() => void refresh()}>重试</Button>}/>}
        {!error && !state && <PageState kind="loading" title="正在读取素材库…"/>}
        {state && !assets.length && <PageState title={query ? "没有匹配的素材" : "还没有素材"} description="导入文件后，完整副本会保存在应用工作区。" action={<Button variant="outline" onClick={() => void importAsset()}>导入素材</Button>}/>}
        {state && assets.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assets.map(asset => {
            const status = availabilityById.get(asset.id) ?? "missing";
            const label = status === "present" ? "已托管" : status === "missing" ? "素材已丢失" : "素材已损坏";
            return <article key={asset.id} className="rounded-xl border bg-card p-4"><div className="mb-5 flex items-start justify-between gap-3"><Image className="size-5 text-muted-foreground" aria-hidden/><span className={status === "present" ? "rounded-full bg-muted px-2 py-0.5 text-xs" : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"}>{label}</span></div><strong className="block truncate" title={asset.displayName}>{asset.displayName}</strong><p className="mt-1 text-xs text-muted-foreground">{asset.mimeType} · {asset.byteLength.toLocaleString()} bytes</p><p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">{asset.contentHash}</p></article>;
        })}</div>}
    </PageContent>;
}
