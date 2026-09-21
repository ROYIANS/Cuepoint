import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { flushPendingDrafts } from "@/lib/debouncedDraft";
import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CoverCard, LibraryGrid } from "@/components/studio/CoverCard";
import { LibraryHeader } from "@/components/studio/LibraryHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db } from "@/db/database";
import { createProject, deleteProject, renameProject, setProjectArchived } from "@/db/repo";
import { formatUpdatedAt } from "@/lib/format";
import { filterAndSortLibrary, type LibrarySort } from "@/lib/library";
import {
  downloadBlob,
  exportProjectZip,
  importProjectZip,
  PackageError,
} from "@/lib/projectPackage";
import {
  ASPECT_PRESET_IDS,
  ASPECT_PRESETS,
  type AspectPresetId,
  type Id,
  type ProjectMode,
  type Shot,
} from "@/domain/types";
import { bindProjectIp } from "@/db/ipProfiles";
import { ProjectIpPicker } from "./ProjectIpPicker";
import { Plus } from "lucide-react";
import { PROJECT_KINDS, ProjectKindPlaceholder, type ProjectKindId } from "./projectKinds";
import { cn } from "@/lib/utils";

function coverOfProject(shots: Shot[], projectId: Id): Id | undefined {
  return shots
    .filter((shot) => shot.projectId === projectId)
    .sort((left, right) => left.order - right.order)
    .find((shot) => shot.firstFrame.result?.mediaId)?.firstFrame.result?.mediaId;
}

export function ProjectGalleryPage() {
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.projects.toArray(), []);
  const shots = useLiveQuery(() => db.shots.toArray(), []) ?? [];
  const profiles = useLiveQuery(() => db.ipProfiles.toArray(), []) ?? [];
  const ipLinks = useLiveQuery(() => db.projectIpLinks.toArray(), []) ?? [];
  const [ipFilter, setIpFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [createIpId, setCreateIpId] = useState<string | null>(null);
  const [binding, setBinding] = useState<{ projectId: string; name: string; ipId: string | null }>();
  const [bindingBusy, setBindingBusy] = useState(false);
  const [bindingError, setBindingError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [kindFilter, setKindFilter] = useState<ProjectKindId | "all">("all");
  const [createKind, setCreateKind] = useState<ProjectKindId>("video");
  const [submitting, setSubmitting] = useState(false);
  const creatingRef = useRef(false);
  const selectedKind = PROJECT_KINDS.find((kind) => kind.id === createKind)!;
  const filteredKind = PROJECT_KINDS.find((kind) => kind.id === kindFilter);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("未命名项目");
  const [mode, setMode] = useState<ProjectMode>("film");
  const [aspectPreset, setAspectPreset] = useState<AspectPresetId>("16:9");
  const [renameId, setRenameId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string>();

  const visible = useMemo(
    () => filterAndSortLibrary((projects ?? []).filter((project) => {
      const ipId = ipLinks.find((link) => link.projectId === project.id)?.ipId;
      return Boolean(project.archivedAt) === showArchived && (ipFilter === "all" || (ipFilter === "independent" ? !ipId : ipId === ipFilter));
    }), query, sort),
    [projects, query, sort, ipLinks, ipFilter, showArchived],
  );


  async function handleCreate() {
    if (!selectedKind.available || !name.trim() || creatingRef.current) return;
    creatingRef.current = true;
    setSubmitting(true);
    try {
      const project = await createProject(name.trim(), mode, aspectPreset, createIpId);
      setCreating(false);
      setName("未命名项目");
      setMode("film");
      setAspectPreset("16:9");
      await navigate({ to: "/p/$projectId", params: { projectId: project.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      creatingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-10 sm:py-8">
      <LibraryHeader title="项目" query={query} onQuery={setQuery} sort={sort} onSort={setSort}
        extra={<Button size="sm" onClick={() => { setCreateKind(kindFilter === "all" ? "video" : kindFilter); setCreating(true); }}><Plus aria-hidden />新建项目</Button>}
      />
      <p className="text-muted-foreground mt-3 text-sm leading-6">从一个想法出发，找到适合它的创作形式。</p>
      <div className="mt-6 flex flex-wrap gap-1 border-b pb-3" role="group" aria-label="按创作类型筛选">
        <button type="button" aria-pressed={kindFilter === "all"} onClick={() => setKindFilter("all")}
          className={cn("rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", kindFilter === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}>全部</button>
        {PROJECT_KINDS.map((kind) => {
          const Icon = kind.icon;
          return <button key={kind.id} type="button" aria-pressed={kindFilter === kind.id} onClick={() => setKindFilter(kind.id)}
            className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", kindFilter === kind.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}>
            <Icon className="size-4" aria-hidden />{kind.label}
            {!kind.available && <span className="text-muted-foreground text-[10px]">即将推出</span>}
          </button>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">所属 IP
          <Select value={ipFilter} onValueChange={setIpFilter}><SelectTrigger aria-label="筛选所属 IP" className="max-w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="independent">独立项目</SelectItem>{profiles.map((ip) => <SelectItem key={ip.id} value={ip.id}>{ip.name}{ip.archived ? "（已归档）" : ""}</SelectItem>)}</SelectContent></Select>
        </label>
        <label className="flex items-center gap-2"><Checkbox checked={showArchived} onCheckedChange={(checked) => setShowArchived(checked === true)} />查看已归档项目</label>
      </div>
      <div className="mt-6">
        {filteredKind && !filteredKind.available ? <ProjectKindPlaceholder kind={filteredKind} /> : <>
        {projects === undefined && <p className="text-muted-foreground py-12 text-center text-sm" role="status">加载项目中…</p>}
        {projects !== undefined && !visible.length && <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-base font-medium">{query.trim() || ipFilter !== "all" || showArchived ? "没有找到匹配的项目" : "从第一部作品开始"}</h2>
          <p className="text-muted-foreground mt-2 text-sm">{query.trim() ? "试试其他关键词，或清除搜索。" : "视频创作已开放，其他创作形式将陆续加入。"}</p>
          {query.trim() ? <Button className="mt-5" variant="outline" onClick={() => setQuery("")}>清除搜索</Button> : <Button className="mt-5" variant="outline" onClick={() => { setCreateKind("video"); setCreating(true); }}>新建视频项目</Button>}
        </div>}
        <LibraryGrid>
          {visible.map((project) => (
            <CoverCard
              key={project.id}
              frame="poster"
              title={project.name}
              subtitle={`视频 · ${profiles.find((ip) => ip.id === ipLinks.find((link) => link.projectId === project.id)?.ipId)?.name ?? "独立项目"} · ${project.archivedAt ? "已归档" : formatUpdatedAt(project.updatedAt)}`}
              mediaId={project.coverMediaId ?? coverOfProject(shots, project.id)}
              onOpen={() =>
                void navigate({ to: "/p/$projectId", params: { projectId: project.id } })
              }
              actions={[
                {
                  label: "项目素材",
                  onSelect: () => void navigate({ to: "/assets", search: { project: project.id } }),
                },
                {
                  label: "所属 IP",
                  onSelect: () => { setBindingError(""); setBinding({ projectId: project.id, name: project.name, ipId: ipLinks.find((link) => link.projectId === project.id)?.ipId ?? null }); },
                },
                {
                  label: project.archivedAt ? "恢复项目" : "归档项目",
                  onSelect: () => { void setProjectArchived(project.id, !project.archivedAt).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "操作失败")); },
                },
                {
                  label: "重命名",
                  onSelect: () => {
                    setRenameId(project.id);
                    setRenameValue(project.name);
                  },
                },
                {
                  label: "备份项目（zip）",
                  onSelect: () => {
                    void flushPendingDrafts(project.id)
                      .then(() => exportProjectZip(project.id))
                      .then((blob) => downloadBlob(blob, `${project.name}.zip`))
                      .catch((error: unknown) => toast.error(
                        error instanceof Error ? `备份失败：${error.message}` : "备份失败，请重试",
                      ));
                  },
                },
                {
                  label: "删除",
                  tone: "danger",
                  onSelect: () => setDeleteId(project.id),
                },
              ]}
            />
          ))}
        </LibraryGrid>
        </>}
      </div>

      <Dialog open={creating} onOpenChange={(open) => { if (!creatingRef.current) setCreating(open); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>选择创作类型。视频已开放，其他类型将陆续加入。</DialogDescription>
          </DialogHeader>
          <fieldset disabled={submitting}>
            <legend className="text-sm font-medium">创作类型</legend>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PROJECT_KINDS.map((kind) => {
                const Icon = kind.icon;
                return <button type="button" key={kind.id} aria-pressed={createKind === kind.id} onClick={() => setCreateKind(kind.id)}
                  className={cn("flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-sm focus-visible:outline-2 focus-visible:outline-ring", createKind === kind.id ? "border-brand bg-brand/5" : "text-muted-foreground hover:bg-muted/50")}>
                  <Icon className="size-5" aria-hidden /><span>{kind.label}</span>
                  <span className="text-[10px]">{kind.available ? "已开放" : "即将推出"}</span>
                </button>;
              })}
            </div>
          </fieldset>
          {!selectedKind.available ? <ProjectKindPlaceholder kind={selectedKind} /> : <>
          <label htmlFor="new-project-name" className="text-sm font-medium">项目名称</label>
          <Input
            id="new-project-name"
            disabled={submitting}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="项目名称"
          />
          <fieldset disabled={submitting}>
            <legend className="text-sm font-medium">视频形式</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(
                [
                  { value: "film", title: "单片", hint: "直接进入故事，适合短片和电影" },
                  { value: "series", title: "连载", hint: "按集管理故事、分镜和制作" },
                ] satisfies { value: ProjectMode; title: string; hint: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mode === option.value}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    mode === option.value
                      ? "border-brand bg-brand/5"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => setMode(option.value)}
                >
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="text-muted-foreground mt-1 block text-xs leading-5">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={submitting}>
            <legend className="text-sm font-medium">画幅比例</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ASPECT_PRESET_IDS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={aspectPreset === preset}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors",
                    aspectPreset === preset
                      ? "border-brand bg-brand/5"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => setAspectPreset(preset)}
                >
                  {ASPECT_PRESETS[preset].label}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              生成模型与分辨率可在创建后的项目设定中分别配置
            </p>
          </fieldset>
          <div className="space-y-2"><span className="text-sm font-medium">所属 IP</span><ProjectIpPicker value={createIpId} onChange={setCreateIpId} disabled={submitting} /></div>
          <p className="text-muted-foreground text-xs leading-5">项目类型固定为视频。可选择所属 IP，也可以独立创作。</p>
          </>}
          <DialogFooter>
            <Button disabled={submitting} variant="outline" onClick={() => setCreating(false)}>
              {selectedKind.available ? "取消" : "关闭"}
            </Button>
            <Button disabled={!selectedKind.available || !name.trim() || submitting} variant="brand" onClick={() => void handleCreate()}>
              {submitting ? "创建中…" : selectedKind.available ? "创建项目" : "即将推出"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(binding)} onOpenChange={(open) => { if (!open && !bindingBusy) setBinding(undefined); }}>
        <DialogContent><DialogHeader><DialogTitle>项目所属 IP</DialogTitle><DialogDescription>{binding?.name} · 关联仅整理项目归属，不会改写已有内容。</DialogDescription></DialogHeader>
          <ProjectIpPicker value={binding?.ipId ?? null} onChange={(ipId) => setBinding((value) => value ? { ...value, ipId } : value)} disabled={bindingBusy} />
          {bindingError && <p role="alert" className="text-destructive text-sm">{bindingError}</p>}
          <DialogFooter><Button variant="outline" disabled={bindingBusy} onClick={() => setBinding(undefined)}>取消</Button>
            <Button disabled={bindingBusy} onClick={async () => {
              if (!binding || bindingBusy) return;
              setBindingBusy(true); setBindingError("");
              try { await bindProjectIp(binding.projectId, binding.ipId); setBinding(undefined); }
              catch (error) { setBindingError(error instanceof Error ? error.message : "保存失败"); }
              finally { setBindingBusy(false); }
            }}>{bindingBusy ? "保存中…" : "保存"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameId)} onOpenChange={(open) => !open && setRenameId(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(undefined)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (renameId) void renameProject(renameId, renameValue);
                setRenameId(undefined);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复（除非你已经备份过项目）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) void deleteProject(deleteId);
                setDeleteId(undefined);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export async function importStudioProject(file: File) {
  try {
    return await importProjectZip(file);
  } catch (err) {
    toast.error(err instanceof PackageError ? err.message : "导入失败");
    return undefined;
  }
}
