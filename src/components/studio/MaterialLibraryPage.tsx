import {useEffect, useState} from "react";
import {Link, useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {Archive, ArrowUpRight, Image, Layers, Search, Upload} from "lucide-react";
import {db} from "@/db/database";
import type {LibraryMaterial} from "@/domain/materials";
import {Button} from "@/components/ui/button";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Input} from "@/components/ui/input";
import {MaterialPreview} from "./materials/MaterialPreview";
import {MaterialDetailPanel} from "./materials/MaterialDetailPanel";
import {MaterialImportDialog} from "./materials/MaterialImportDialog";
import {LegacyMaterialSources} from "./materials/LegacyMaterialSources";
import {KIND_LABELS, MaterialScopeSelect, MaterialSelect, SETTINGS_KINDS} from "./materials/MaterialControls";
import {PageContent, PageHeader, PageState, PageToolbar} from "@/components/layout/PageLayout";
import "./materials/materialLibrary.css";

export type MaterialLibrarySearch = {
    ip?: string;
    project?: string;
    scope?: "shared" | "global" | "all";
    view?: "media" | "settings"
};

export function MaterialLibraryPage({search: routeSearch}: { search: MaterialLibrarySearch }) {
    const navigate = useNavigate();
    const [view, setView] = useState<"media" | "settings">(routeSearch.view ?? "media");
    const scope = routeSearch.project ? `project:${routeSearch.project}` : routeSearch.ip ? `ip:${routeSearch.ip}` : routeSearch.scope ?? "shared";
    const [kind, setKind] = useState("all");
    const [status, setStatus] = useState("active");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    useEffect(() => {
        setView(routeSearch.view ?? "media");
        setKind("all");
    }, [routeSearch.view]);
    const data = useLiveQuery(async () => ({
        materials: (await (scope === "all" ? db.libraryMaterials.toArray() : scope === "shared" ? db.libraryMaterials.where("scope.kind").anyOf("global", "ip").toArray() : scope === "global" ? db.libraryMaterials.where("scope.kind").equals("global").toArray() : db.libraryMaterials.where("scope.id").equals(scope.slice(scope.indexOf(":") + 1)).toArray())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        ips: await db.ipProfiles.toArray(),
        projects: await db.projects.toArray()
    }), [scope]);
    const matches = data?.materials.filter((material) => SETTINGS_KINDS.includes(material.kind) === (view === "settings") && (kind === "all" || material.kind === kind) && (status === "all" || material.archived === (status === "archived")) && (scope === "all" || scope === "shared" && material.scope.kind !== "project" || scope === "global" && material.scope.kind === "global" || material.scope.kind !== "global" && scope === `${material.scope.kind}:${material.scope.id}`) && `${material.name} ${material.notes} ${material.tags.join(" ")}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const initialScope = scope.startsWith("project:") || scope.startsWith("ip:") || scope === "global" ? scope : "global";

    function navigateScope(nextScope: string, nextView: "media" | "settings") {
        const owner: MaterialLibrarySearch = nextScope.startsWith("ip:") ? {ip: nextScope.slice(3)}
            : nextScope.startsWith("project:") ? {project: nextScope.slice(8)}
                : {scope: nextScope === "global" || nextScope === "all" ? nextScope : "shared"};
        void navigate({to: "/assets", search: {...owner, view: nextView}, replace: true});
    }

    function changeView(next: "media" | "settings") {
        setView(next);
        setKind("all");
        navigateScope(scope, next);
    }

    function scopeLabel(material: LibraryMaterial) {
        const owner = material.scope;
        return owner.kind === "global" ? "全局" : owner.kind === "ip" ? data?.ips.find((ip) => ip.id === owner.id)?.name ?? "IP" : data?.projects.find((project) => project.id === owner.id)?.name ?? "原项目";
    }

    return <PageContent role="main" className="material-library">
        <PageHeader title="素材库" description="管理媒体、资料和创作设定的版本。"
            actions={<Button onClick={() => setImporting(true)}><Upload size={16} aria-hidden/>导入素材</Button>}/>
        <Tabs className="gap-4" value={view} onValueChange={(next) => changeView(next as "media" | "settings")}><TabsList
            className="h-auto flex-wrap" aria-label="素材视图"><TabsTrigger value="media"><Image size={16}
                                                                                                   aria-hidden/>媒体与资料</TabsTrigger><TabsTrigger
            value="settings"><Layers size={16} aria-hidden/>创作设定</TabsTrigger></TabsList><TabsContent value={view}>
            {view === "settings" && <nav className="material-setting-links" aria-label="创建与编辑创作设定">{([{
                to: "/characters",
                label: "角色"
            }, {to: "/scenes", label: "场景"}, {to: "/props", label: "道具"}, {
                to: "/styles",
                label: "风格"
            }] as const).map((entry) => <Link key={entry.to} to={entry.to}>{entry.label}编辑库<ArrowUpRight size={12}
                                                                                                            aria-hidden/></Link>)}</nav>}
            <PageToolbar className="material-filters">
                <div className="material-search"><Search size={16} aria-hidden/><Input aria-label="搜索素材"
                                                                                       placeholder="搜索名称、标签或备注"
                                                                                       value={search}
                                                                                       onChange={(event) => setSearch(event.target.value)}/>
                </div>
                <MaterialScopeSelect value={scope} filter
                                     onChange={(next) => navigateScope(next, view)}/><MaterialSelect label="素材类型"
                                                                                                     value={kind}
                                                                                                     onChange={setKind}
                                                                                                     options={[{
                                                                                                         value: "all",
                                                                                                         label: "全部类型"
                                                                                                     }, ...Object.entries(KIND_LABELS).filter(([key]) => SETTINGS_KINDS.includes(key as keyof typeof KIND_LABELS) === (view === "settings")).map(([value, label]) => ({
                                                                                                         value,
                                                                                                         label
                                                                                                     }))]}/><MaterialSelect
                label="素材状态" value={status} onChange={setStatus}
                options={[{value: "active", label: "使用中"}, {value: "archived", label: "已归档"}, {
                    value: "all",
                    label: "全部状态"
                }]}/></PageToolbar>
            <div className="material-section-heading"><h2>版本素材 <span>{matches?.length ?? "…"}</span></h2>
                <p>{scope === "shared" ? "默认展示全局与 IP 专属素材" : "每个项目固定使用所采用的版本"}</p></div>
            {!matches ? <PageState kind="loading" title="正在读取素材库…"/> : matches.length ?
                <div className="material-grid">{matches.map((material) => <MaterialCard key={material.id}
                                                                                        material={material}
                                                                                        scopeLabel={scopeLabel(material)}
                                                                                        onOpen={() => setSelected(material.id)}/>)}</div> :
                <PageState title={search || kind !== "all" || status === "archived" ? "没有匹配的素材" : "还没有版本素材"}
                    description={view === "media" ? "导入文件，或从下方现有素材建立独立版本。" : "在编辑库整理设定，再从下方现有素材保存独立快照。"}
                    action={view === "media" ? <Button variant="outline" onClick={() => setImporting(true)}>导入素材</Button> : undefined}/>}
            {status !== "archived" &&
                <LegacyMaterialSources view={view} scope={scope} search={search} kind={kind} onCreated={setSelected}/>}
        </TabsContent></Tabs><p className="material-storage-note">素材库与 IP 档案保存在当前浏览器本地。项目 ZIP
        包含已加入项目的素材副本，不包含整个素材库或 IP 档案。</p>
        {selected && <MaterialDetailPanel id={selected} onClose={() => setSelected(null)} onSelect={setSelected}/>}
        {importing && <MaterialImportDialog initialScope={initialScope} onClose={() => setImporting(false)}
                                            onImported={setSelected}/>}
    </PageContent>;
}

function MaterialCard({material, scopeLabel, onOpen}: {
    material: LibraryMaterial;
    scopeLabel: string;
    onOpen: () => void
}) {
    const version = useLiveQuery(async () => db.materialVersions.where("[materialId+revision]").equals([material.id, material.revision]).first(), [material.id, material.revision]);
    return <Button variant="ghost" className="material-card" onClick={onOpen} aria-label={material.name}><MaterialPreview
        payload={version?.payload}/>
        <div className="material-card-caption">
            <div className="material-card-meta">
                <span>{KIND_LABELS[material.kind]} · {scopeLabel}</span><span>{material.archived ?
                <Archive size={12} aria-label="已归档"/> : `v${material.revision}`}</span></div>
            <strong title={material.name}>{material.name}</strong>{material.tags.length > 0 &&
            <span>{material.tags.slice(0, 3).join(" · ")}</span>}</div>
    </Button>;
}
