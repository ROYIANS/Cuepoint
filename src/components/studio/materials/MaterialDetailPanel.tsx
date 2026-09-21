import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, ArrowUpRight, History, Trash2, Upload, X } from "lucide-react";
import { db } from "@/db/database";
import { releaseMaterialUse } from "@/db/repo";
import { addFileMaterialVersion, deleteMaterial, promoteMaterial, refreshSettingMaterial, setMaterialArchived, updateMaterialMetadata, updateMaterialUse, useMaterialInProject } from "@/db/materials";
import type { LibraryMaterial } from "@/domain/materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { MaterialPreview } from "./MaterialPreview";
import { KIND_LABELS, MaterialScopeSelect, MaterialSelect, parseScope, scopeValue, useMaterialDraftGuard } from "./MaterialControls";
import { MATERIAL_ACCEPT } from "./MaterialImportDialog";
import { LegacySettingLink } from "./LegacyMaterialSources";

export function MaterialDetailPanel({ id, onClose, onSelect }: { id: string; onClose: () => void; onSelect: (id: string) => void }) {
  const material = useLiveQuery(async () => await db.libraryMaterials.get(id) ?? null, [id]);
  return material ? <MaterialEditor key={id} material={material} onClose={onClose} onSelect={onSelect} /> : <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent className="material-detail"><SheetHeader><SheetTitle>素材详情</SheetTitle><SheetDescription>{material === null ? "素材不存在或已删除" : "正在读取素材…"}</SheetDescription></SheetHeader></SheetContent></Sheet>;
}

function MaterialEditor({ material, onClose, onSelect }: { material: LibraryMaterial; onClose: () => void; onSelect: (id: string) => void }) {
  const [draft, setDraft] = useState<{ revision: number; name: string; notes: string; tags: string } | null>(null);
  const [pending, setPending] = useState(false); const pendingRef = useRef(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [projectId, setProjectId] = useState(material.scope.kind === "project" ? material.scope.id : "");
  const [targetScope, setTargetScope] = useState("global"); const [promoting, setPromoting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const guard = useMaterialDraftGuard(Boolean(draft), pending);
  const data = useLiveQuery(async () => ({
    versions: (await db.materialVersions.where("materialId").equals(material.id).toArray()).sort((a, b) => b.revision - a.revision),
    uses: await db.materialUses.where("materialId").equals(material.id).toArray(),
    events: (await db.materialEvents.where("materialId").equals(material.id).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    projects: await db.projects.toArray(), ips: await db.ipProfiles.toArray(), links: await db.projectIpLinks.toArray(),
    derived: (await db.libraryMaterials.toArray()).filter((item) => item.source?.materialId === material.id),
  }), [material.id]);
  const version = data?.versions.find((item) => item.revision === (selectedRevision ?? material.revision));
  const values = draft ?? { revision: material.revision, name: material.name, notes: material.notes, tags: material.tags.join("，") };
  const materialScope = material.scope;
  const targetProjects = data?.projects.filter((project) => !project.archivedAt && (materialScope.kind === "global" || materialScope.kind === "project" && materialScope.id === project.id || materialScope.kind === "ip" && data.links.some((link) => link.projectId === project.id && link.ipId === materialScope.id)));
  function edit(patch: Partial<typeof values>) { setDraft({ ...values, ...patch }); setError(""); }
  async function action(work: () => Promise<unknown>, message: string) {
    if (pendingRef.current) return;
    pendingRef.current = true; setPending(true); setError(""); setNotice("");
    try { await work(); setNotice(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败，请重试"); }
    finally { pendingRef.current = false; setPending(false); }
  }
  const operationsDisabled = pending || Boolean(draft);
  const scopeLabel = materialScope.kind === "global" ? "全局素材" : materialScope.kind === "ip" ? `IP · ${data?.ips.find((ip) => ip.id === materialScope.id)?.name ?? "已不可用"}` : `项目 · ${data?.projects.find((project) => project.id === materialScope.id)?.name ?? "已删除"}`;
  const hasReferences = Boolean(data?.uses.length || data?.derived.length);
  return <><Sheet open onOpenChange={(open) => { if (!open) guard.requestClose(onClose); }}><SheetContent className="material-detail" showCloseButton={false}>
    <SheetHeader className="material-detail-heading"><div><p className="material-eyebrow">{KIND_LABELS[material.kind]} · {scopeLabel}</p><SheetTitle>{material.name}</SheetTitle><SheetDescription>版本 {material.revision}{material.archived ? " · 已归档" : " · 可复用"}</SheetDescription></div><Button size="icon" variant="ghost" aria-label="关闭素材详情" disabled={pending} onClick={() => guard.requestClose(onClose)}><X /></Button></SheetHeader>
    <div className="material-detail-body">
      <MaterialPreview payload={version?.payload} inspect />
      {data && data.versions.length > 1 && <label className="material-field">查看历史版本<MaterialSelect label="查看历史版本" value={String(selectedRevision ?? material.revision)} onChange={(value) => setSelectedRevision(Number(value))} options={data.versions.map((item) => ({ value: String(item.revision), label: `版本 ${item.revision} · ${new Date(item.createdAt).toLocaleDateString("zh-CN")}` }))} /></label>}
      {selectedRevision !== null && selectedRevision !== material.revision && <p className="material-muted">当前预览历史版本；“用于项目”始终采用最新版本 {material.revision}。</p>}
      <section className="material-detail-section"><h3>素材信息</h3>
        <label className="material-field">名称<Input value={values.name} disabled={pending || material.archived} onChange={(event) => edit({ name: event.target.value })} /></label>
        <label className="material-field">备注<Textarea value={values.notes} disabled={pending || material.archived} rows={3} onChange={(event) => edit({ notes: event.target.value })} placeholder="用途、注意事项或创作背景" /></label>
        <label className="material-field">标签<Input value={values.tags} disabled={pending || material.archived} onChange={(event) => edit({ tags: event.target.value })} placeholder="用逗号分隔" /></label>
        {draft && <div className="material-inline-actions"><Button disabled={pending || !values.name.trim()} onClick={() => void action(async () => { await updateMaterialMetadata(material.id, { name: values.name, notes: values.notes, tags: values.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }, values.revision); setDraft(null); }, "素材信息已保存，生成新的版本。")}>保存修改</Button><Button variant="ghost" disabled={pending} onClick={() => setDraft(null)}>撤销修改</Button></div>}
      </section>
      <section className="material-detail-section"><h3>来源与版本</h3><p className="material-muted">{material.source ? `来自${material.source.materialId ? "另一份素材" : material.source.projectId === "studio" ? "工作室原件" : "项目原件"}，此处保存独立快照。` : "直接导入，原文件保存在素材版本中。"}</p>
        {version?.payload.type === "setting" && material.source?.entityId && material.source.projectId && <LegacySettingLink row={{ id: material.source.entityId, ownerId: material.source.projectId, kind: version.payload.kind }} />}
        {version?.payload.type === "setting" && <p className="material-muted">在原设定编辑页修改，返回后保存新快照；已有项目仍固定使用原版本。</p>}
        <div className="material-inline-actions"><Button variant="outline" disabled={operationsDisabled || material.archived} onClick={() => { if (version?.payload.type === "setting") void action(() => refreshSettingMaterial(material.id, material.revision), "已从原设定保存新版本。"); else fileInput.current?.click(); }}><Upload size={14} />{version?.payload.type === "setting" ? "从原设定保存新版本" : "上传新版本"}</Button><Button variant="outline" disabled={operationsDisabled || material.archived} onClick={() => setPromoting(!promoting)}>复制到其他位置</Button></div>
        <input ref={fileInput} hidden type="file" accept={MATERIAL_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void action(() => addFileMaterialVersion(material.id, file, material.revision), "新版本已保存，项目内容没有自动改变。"); }} />
        {promoting && <div className="material-action-block"><MaterialScopeSelect value={targetScope} onChange={setTargetScope} disabled={operationsDisabled} /><Button disabled={operationsDisabled || scopeValue(material.scope) === targetScope} onClick={() => void action(async () => { const copy = await promoteMaterial(material.id, parseScope(targetScope)); setPromoting(false); onSelect(copy.id); }, "独立副本已保存。")}>保存独立副本</Button></div>}
      </section>
      <section className="material-detail-section"><h3>用于项目</h3><p className="material-muted">创建项目专属副本并固定版本，后续更新需手动确认。媒体会进入项目素材，不会自动替换镜头。</p><div className="material-action-block"><MaterialSelect label="使用素材的目标项目" placeholder="选择项目" value={projectId} disabled={operationsDisabled || material.archived} onChange={setProjectId} options={(targetProjects ?? []).map((project) => ({ value: project.id, label: project.name }))} /><Button disabled={operationsDisabled || material.archived || !targetProjects?.some((project) => project.id === projectId)} onClick={() => void action(() => useMaterialInProject(material.id, projectId), "已加入项目，版本固定。")}>用于项目</Button></div>
        {data?.uses.length === 0 && <p className="material-muted">尚未用于项目。</p>}
        <ul className="material-use-list">{data?.uses.map((use) => <li key={use.id}><div><Link to="/p/$projectId" params={{ projectId: use.projectId }}>{data.projects.find((project) => project.id === use.projectId)?.name ?? "项目已删除"}<ArrowUpRight size={12} /></Link><span>版本 {use.revision}{use.supersededBy ? " · 历史引用" : " · 当前采用"}</span>{use.targetKind !== "media" && <LegacySettingLink row={{ kind: use.targetKind, id: use.targetId, ownerId: use.projectId }} />}</div><div className="material-inline-actions">{!use.supersededBy && use.revision < material.revision && <Button variant="outline" size="sm" disabled={operationsDisabled || material.archived} onClick={() => void action(() => updateMaterialUse(use.id), "新版项目副本已加入，已有编辑内容和素材引用没有替换。")}>加入新版副本 v{material.revision}</Button>}<Button variant="ghost" size="sm" disabled={operationsDisabled} onClick={() => { setError(""); setReleasing(use.id); }}>{use.targetKind === "media" ? "移除未使用副本" : "解除引用"}</Button></div></li>)}</ul>
      </section>
      <section className="material-detail-section"><h3><History size={14} aria-hidden />操作记录</h3><ul className="material-event-list">{data?.events.slice(0, 30).map((event) => <li key={event.id}><span>{({ create: "导入素材", promote: "建立独立快照", version: "保存新版本", archive: "归档素材", restore: "恢复素材", use: "加入项目", "update-use": "加入新版项目副本", release: "移除未使用副本" } as Record<string, string>)[event.action] ?? "素材变更"}{event.detail ? ` · ${event.detail}` : ""}</span><time>{new Date(event.createdAt).toLocaleString("zh-CN")}</time></li>)}</ul></section>
      {error && <p role="alert" className="material-error">{error}</p>}{notice && <p role="status" className="material-notice">{notice}</p>}{pending && <p role="status">正在保存…</p>}
      <div className="material-inline-actions material-danger-zone"><Button variant="outline" disabled={operationsDisabled} onClick={() => void action(() => setMaterialArchived(material.id, !material.archived), material.archived ? "已恢复素材。" : "已归档，已有项目引用继续保留。") }><Archive size={14} />{material.archived ? "恢复素材" : "归档"}</Button><Button variant="ghost" disabled={operationsDisabled || !data || hasReferences || !material.archived} onClick={() => setDeleting(true)}><Trash2 size={14} />永久删除</Button></div>
      {!material.archived && !hasReferences && <p className="material-muted">需要永久删除时，请先归档素材。</p>}
      {hasReferences && <p className="material-muted">当前有 {data?.uses.length} 条项目引用、{data?.derived.length} 份衍生素材，不能永久删除；可归档。</p>}
    </div>
  </SheetContent></Sheet>{guard.dialog}<AlertDialog open={deleting} onOpenChange={(open) => { if (!pending) setDeleting(open); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>永久删除“{material.name}”？</AlertDialogTitle><AlertDialogDescription>删除所有版本和文件，操作不可撤销。保存前会再次检查引用。</AlertDialogDescription></AlertDialogHeader>{error && <p role="alert" className="material-error">{error}</p>}<AlertDialogFooter><Button variant="outline" disabled={pending} onClick={() => setDeleting(false)}>取消</Button><Button variant="destructive" disabled={pending} onClick={() => void action(async () => { await deleteMaterial(material.id); setDeleting(false); onClose(); }, "")}>永久删除</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  <AlertDialog open={Boolean(releasing)} onOpenChange={(open) => { if (!pending && !open) setReleasing(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>移除这条项目引用？</AlertDialogTitle><AlertDialogDescription>删除该项目未被镜头、封面或任务历史使用的文件及使用记录，保留素材库原件。创作设定请先在项目编辑页删除，再解除引用。</AlertDialogDescription></AlertDialogHeader>{error && <p role="alert" className="material-error">{error}</p>}<AlertDialogFooter><Button variant="outline" disabled={pending} onClick={() => setReleasing(null)}>取消</Button><Button variant="destructive" disabled={pending || !releasing} onClick={() => void action(async () => { await releaseMaterialUse(releasing!); setReleasing(null); }, "项目引用已移除，素材库版本继续保留。")}>确认移除</Button></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
