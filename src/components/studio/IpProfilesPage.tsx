import {useMemo, useState} from "react";
import {Link, useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {
    Archive,
    ArrowLeft,
    ArrowUpRight,
    FolderOpen,
    Image,
    Layers3,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Shirt,
    Smile,
    Undo2
} from "lucide-react";
import {db} from "@/db/database";
import {setIpArchived} from "@/db/ipProfiles";
import type {IpProfile} from "@/domain/materials";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {PageContent, PageHeader, PageState, PageToolbar} from "@/components/layout/PageLayout";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {IP_TEXT_FIELDS, IpProfileEditor} from "./IpProfileEditor";
import {PROJECT_KINDS} from "./projectKinds";
import "./ipProfiles.css";

function errorMessage(cause: unknown) {
    return cause instanceof Error ? cause.message : "读取失败，请刷新后重试。";
}

function initials(name: string) {
    return Array.from(name.trim()).slice(0, 2).join("");
}

function dateLabel(value: string) {
    return new Date(value).toLocaleDateString("zh-CN", {month: "short", day: "numeric"});
}

export function IpProfilesPage() {
    const navigate = useNavigate();
    const [createOpen, setCreateOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [archived, setArchived] = useState(false);
    const view = useLiveQuery(async () => {
        try {
            const [profiles, links, materials, projects] = await Promise.all([db.ipProfiles.orderBy("updatedAt").reverse().toArray(), db.projectIpLinks.toArray(), db.libraryMaterials.toArray(), db.projects.toArray()]);
            return {profiles, links, materials, projects};
        } catch (cause) {
            return {error: errorMessage(cause)};
        }
    }, []);
    const profiles = view?.profiles ?? [];
    const filtered = profiles.filter(profile => profile.archived === archived && `${profile.name} ${profile.positioning} ${profile.topics}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const projectIds = useMemo(() => new Set(view?.projects?.map(project => project.id) ?? []), [view?.projects]);
    return <PageContent role="main" mode="collection" className="ip-page">
        <PageHeader title="IP" description="管理创作定位、表达偏好与关联项目。"
                    actions={<Button onClick={() => setCreateOpen(true)}><Plus aria-hidden/>新建 IP</Button>}/>
        <PageToolbar className="ip-library-toolbar">
            <div className="ip-filter-tabs" role="group" aria-label="IP 状态"><Button variant="ghost" type="button"
                                                                                      aria-pressed={!archived}
                                                                                      onClick={() => setArchived(false)}>使用中 <span>{profiles.filter(profile => !profile.archived).length}</span></Button><Button
                variant="ghost" type="button" aria-pressed={archived}
                onClick={() => setArchived(true)}>已归档 <span>{profiles.filter(profile => profile.archived).length}</span></Button>
            </div>
            <div className="ip-search"><Search size={15} aria-hidden/><Input aria-label="搜索 IP"
                                                                             placeholder="搜索名称、定位或主题"
                                                                             value={search}
                                                                             onChange={event => setSearch(event.target.value)}/>
            </div>
        </PageToolbar>
        {!view ? <PageState kind="loading" title="正在读取 IP 档案…"/> : view.error ?
            <PageState kind="error" title="暂时无法读取 IP" description={view.error}/> : !filtered.length ?
                <PageState title={search.trim() ? "没有匹配的 IP" : archived ? "暂无归档的 IP" : "暂无 IP"}
                           description={search.trim() ? "试试其他名称或主题词。" : archived ? "归档后的档案会保留原有关联，也可以随时恢复。" : "新建 IP，记录定位与创作偏好，再关联项目和素材。"}
                           action={!search.trim() && !archived ? <Button variant="outline" onClick={() => setCreateOpen(true)}><Plus aria-hidden/>新建 IP</Button> : undefined}/>
                : <div className="ip-profile-grid">{filtered.map(profile => {
                    const projectCount = view.links?.filter(link => link.ipId === profile.id && projectIds.has(link.projectId)).length ?? 0;
                    const materialCount = view.materials?.filter(material => material.scope.kind === "ip" && material.scope.id === profile.id && !material.archived).length ?? 0;
                    return <Link key={profile.id} to="/ips/$ipId" params={{ipId: profile.id}}
                                 className="ip-profile-card">
                        <div className="ip-profile-card-top"><span className="ip-monogram"
                                                                   aria-hidden>{initials(profile.name)}</span><ArrowUpRight
                            size={17} aria-hidden/></div>
                        <h2>{profile.name}</h2><p
                        className="ip-profile-positioning">{profile.positioning || "定位尚未填写，打开档案继续完善。"}</p>{profile.topics &&
                        <p className="ip-profile-topics">{profile.topics}</p>}
                        <footer><span><FolderOpen size={13} aria-hidden/>{projectCount} 个项目</span><span><Layers3
                            size={13} aria-hidden/>{materialCount} 份素材</span>
                            <time dateTime={profile.updatedAt}>{dateLabel(profile.updatedAt)}</time>
                        </footer>
                    </Link>;
                })}</div>}
        <p className="ip-page-footnote">项目也可以独立存在，随时在项目列表中选择或更改所属 IP。</p>
        {createOpen && <IpProfileEditor onClose={() => setCreateOpen(false)} onSaved={id => {
            setCreateOpen(false);
            void navigate({to: "/ips/$ipId", params: {ipId: id}});
        }}/>}
    </PageContent>;
}

export function IpProfilePage({ipId}: { ipId: string }) {
    const [editing, setEditing] = useState<IpProfile | null>(null);
    const [tab, setTab] = useState<"profile" | "projects" | "materials">("profile");
    const view = useLiveQuery(async () => {
        try {
            const profile = await db.ipProfiles.get(ipId) ?? null;
            const links = await db.projectIpLinks.where("ipId").equals(ipId).toArray();
            const projects = (await db.projects.bulkGet(links.map(link => link.projectId))).filter(project => project !== undefined);
            const materials = await db.libraryMaterials.filter(material => material.scope.kind === "ip" && material.scope.id === ipId && !material.archived).toArray();
            return {ipId, profile, projects, materials};
        } catch (cause) {
            return {ipId, error: errorMessage(cause)};
        }
    }, [ipId]);
    if (!view || view.ipId !== ipId) return <PageContent role="main" mode="detail" className="ip-page"><PageState kind="loading" title="正在读取 IP 档案…"/></PageContent>;
    if (view.error || !view.profile) return <PageContent role="main" mode="detail" className="ip-page">
        <PageHeader title="IP 档案" back={<Link to="/ips" className="ip-back"><ArrowLeft size={16} aria-hidden/>全部 IP</Link>}/>
        <PageState kind={view.error ? "error" : "missing"} title={view.error ? "暂时无法读取档案" : "找不到这个 IP"}
                   description={view.error ?? "这个档案可能已不可用，请返回列表查看。"}/>
    </PageContent>;
    const {profile, projects, materials} = view;
    return <PageContent role="main" mode="detail" className="ip-page ip-detail-page">
        <PageHeader title={profile.name} description={<span className="whitespace-pre-wrap">{profile.positioning || "还没有填写定位，可在档案中补充。"}</span>}
                    back={<Link to="/ips" className="ip-back"><ArrowLeft size={16} aria-hidden/>全部 IP</Link>}
                    actions={<div className="ip-detail-actions">{!profile.archived &&
                <Button variant="outline" onClick={() => setEditing(profile)}><Pencil
                    aria-hidden/>编辑档案</Button>}<IpArchiveAction profile={profile}/></div>}/>
        {profile.archived && <p className="ip-archive-note"><Archive size={15} aria-hidden/>档案已归档，原有项目和素材仍保留。恢复后可继续编辑和关联新项目。
        </p>}
        <PageToolbar className="ip-detail-tabs" role="group" aria-label="IP 内容">{([{id: "profile", label: "档案"}, {
            id: "projects",
            label: "关联项目",
            count: projects?.length ?? 0
        }, {id: "materials", label: "专属素材", count: materials?.length ?? 0}] as const).map(item => <Button
            variant="ghost" key={item.id} type="button" aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}>{item.label}{"count" in item && <span>{item.count}</span>}</Button>)}</PageToolbar>
        {tab === "profile" && <>
            <div className="ip-detail-fields">{IP_TEXT_FIELDS.map(field => <section key={field.key}>
                <h2>{field.label}</h2><p
                className={!profile[field.key] ? "is-empty" : undefined}>{profile[field.key] || "尚未填写"}</p>
            </section>)}</div>
            <p className="ip-page-footnote">关联项目的聊天会读取这份 IP
                档案的精简摘要，完整设定按需查阅。生成仍以你确认的提示词和参数为准。</p><DerivativeEntries/></>}
        {tab === "projects" && <section className="ip-related-section">
            <div className="ip-section-heading">
                <div><h2>关联项目</h2><p>项目保留各自的内容与素材，可以单独编辑。</p></div>
                <Button asChild variant="outline"><Link to="/projects">管理项目<ArrowUpRight
                    aria-hidden/></Link></Button></div>
            {projects?.length ?
                <div className="ip-project-list">{projects.map(project => <Link key={project.id} to="/p/$projectId"
                                                                                params={{projectId: project.id}}><FolderOpen
                    size={20} strokeWidth={1.5} aria-hidden/>
                    <div>
                        <strong>{project.name}</strong><span>{project.archivedAt ? "已归档 · " : ""}{PROJECT_KINDS.find(kind => kind.id === (project.kind ?? "video"))?.label ?? "未知类型"} · 更新于 {dateLabel(project.updatedAt)}</span>
                    </div>
                    <ArrowUpRight size={16} aria-hidden/></Link>)}</div> :
                <PageState compact title="还没有关联项目" description={`在项目列表中新建项目，或为已有项目选择“${profile.name}”。`}/>}
        </section>}
        {tab === "materials" && <section className="ip-related-section">
            <div className="ip-section-heading">
                <div><h2>专属素材</h2><p>集中整理属于这个 IP 的素材，使用时为项目创建独立副本。</p></div>
                <Button asChild variant="outline"><Link to="/assets" search={{ip: profile.id}}>打开素材库<ArrowUpRight
                    aria-hidden/></Link></Button></div>
            <div className="ip-material-entry-grid"><Link to="/assets" search={{ip: profile.id, view: "media"}}><Image
                size={23} strokeWidth={1.5} aria-hidden/><h3>媒体与资料</h3><p>图片、视频、音频和文档</p>
                <span>{materials?.filter(material => ["image", "video", "audio", "document"].includes(material.kind)).length ?? 0} 份素材<ArrowUpRight
                    size={14} aria-hidden/></span></Link><Link to="/assets" search={{ip: profile.id, view: "settings"}}><Layers3
                size={23} strokeWidth={1.5} aria-hidden/><h3>创作设定</h3><p>角色、场景、道具与风格</p>
                <span>{materials?.filter(material => ["character", "scene", "prop", "style"].includes(material.kind)).length ?? 0} 份设定<ArrowUpRight
                    size={14} aria-hidden/></span></Link></div>
        </section>}
        {editing && <IpProfileEditor key={editing.id} profile={editing} onClose={() => setEditing(null)}
                                     onSaved={() => setEditing(null)}/>}
    </PageContent>;
}

function DerivativeEntries() {
    return <section className="ip-derivatives">
        <div className="ip-section-heading">
            <div><h2>衍生创作</h2><p>衍生创作工作区正在准备中，当前可先整理参考与设定。</p></div>
        </div>
        <div>{[{icon: Image, title: "IP 形象", text: "形象图与视觉延展"}, {
            icon: Smile,
            title: "表情包",
            text: "情绪、动作与日常表达"
        }, {icon: Shirt, title: "周边设计", text: "把创作带入生活"}].map(item => <article key={item.title}>
            <item.icon size={20} strokeWidth={1.5} aria-hidden/>
            <h3>{item.title}</h3><p>{item.text}</p><span>即将推出</span></article>)}</div>
    </section>;
}

function IpArchiveAction({profile}: { profile: IpProfile }) {
    const [confirm, setConfirm] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string>();

    async function change() {
        if (pending) return;
        setPending(true);
        setError(undefined);
        try {
            await setIpArchived(profile.id, !profile.archived);
            setConfirm(false);
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setPending(false);
        }
    }

    return <><Button variant="ghost" onClick={() => {
        setError(undefined);
        setConfirm(true);
    }}>{profile.archived ? <Undo2 aria-hidden/> :
        <Archive aria-hidden/>}{profile.archived ? "恢复 IP" : "归档"}</Button><AlertDialog open={confirm}
                                                                                            onOpenChange={open => {
                                                                                                if (!pending) setConfirm(open);
                                                                                            }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{profile.archived ? "恢复这个 IP？" : "归档这个 IP？"}</AlertDialogTitle><AlertDialogDescription>{profile.archived ? "恢复后可以继续编辑档案，并关联新的创作项目。" : "归档后不再用于新的项目关联，已有项目、素材和档案内容全部保留。之后可以随时恢复。"}</AlertDialogDescription></AlertDialogHeader>{error &&
        <p role="alert" className="text-destructive text-sm">{error}</p>}<AlertDialogFooter><AlertDialogCancel asChild onClick={event => event.preventDefault()}><Button variant="outline"
                                                                                                    disabled={pending}
                                                                                                    onClick={() => setConfirm(false)}>取消</Button></AlertDialogCancel><Button
        disabled={pending} onClick={() => void change()}>{pending &&
        <LoaderCircle className="animate-spin motion-reduce:animate-none"
                      aria-hidden/>}{pending ? "正在保存…" : profile.archived ? "恢复 IP" : "确认归档"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
