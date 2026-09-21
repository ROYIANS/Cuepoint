import { useBlocker } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { MaterialKind, MaterialScope } from "@/domain/materials";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

export const KIND_LABELS: Record<MaterialKind, string> = { image: "图片", video: "视频", audio: "音频", document: "文档", character: "角色", scene: "场景", prop: "道具", style: "风格" };
export const SETTINGS_KINDS: MaterialKind[] = ["character", "scene", "prop", "style"];
export function scopeValue(scope: MaterialScope) { return scope.kind === "global" ? "global" : `${scope.kind}:${scope.id}`; }
export function parseScope(value: string): MaterialScope { if (value.startsWith("ip:")) return { kind: "ip", id: value.slice(3) }; if (value.startsWith("project:")) return { kind: "project", id: value.slice(8) }; return { kind: "global" }; }
export function MaterialSelect({ value, onChange, label, options, disabled, placeholder }: { value: string; onChange: (value: string) => void; label: string; options: Array<{ value: string; label: string }>; disabled?: boolean; placeholder?: string }) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger className="material-select" aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent className="material-select-popup">{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}
export function MaterialScopeSelect({ value, onChange, filter = false, disabled = false }: { value: string; onChange: (value: string) => void; filter?: boolean; disabled?: boolean }) {
  const data = useLiveQuery(async () => ({ ips: await db.ipProfiles.toArray(), projects: await db.projects.toArray() }), []);
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger className="material-select" aria-label={filter ? "筛选素材归属" : "素材保存位置"}><SelectValue /></SelectTrigger><SelectContent className="material-select-popup">
    {filter && <SelectItem value="shared">共享素材（全局与 IP）</SelectItem>}
    <SelectItem value="global">全局素材</SelectItem>
    {filter && <SelectItem value="all">全部（含项目）</SelectItem>}
    <SelectGroup><SelectLabel>IP 专属</SelectLabel>{data?.ips.filter((ip) => filter || !ip.archived || value === `ip:${ip.id}`).map((ip) => <SelectItem key={ip.id} value={`ip:${ip.id}`}>{ip.name}{ip.archived ? "（已归档）" : ""}</SelectItem>)}</SelectGroup>
    <SelectGroup><SelectLabel>项目素材</SelectLabel>{data?.projects.filter((project) => filter || !project.archivedAt || value === `project:${project.id}`).map((project) => <SelectItem key={project.id} value={`project:${project.id}`}>{project.name}{project.archivedAt ? "（已归档）" : ""}</SelectItem>)}</SelectGroup>
  </SelectContent></Select>;
}

export function useMaterialDraftGuard(dirty: boolean, pending: boolean) {
  const [requested, setRequested] = useState<(() => void) | null>(null);
  const blocker = useBlocker({ shouldBlockFn: () => dirty || pending, withResolver: true, enableBeforeUnload: dirty || pending });
  const requestClose = (close: () => void) => { if (pending) return; if (dirty) setRequested(() => close); else close(); };
  const dialog: ReactNode = <AlertDialog open={Boolean(requested) || blocker.status === "blocked"} onOpenChange={(open) => { if (!open) { setRequested(null); if (blocker.status === "blocked") blocker.reset(); } }}>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending ? "正在保存素材" : "保留未保存的修改？"}</AlertDialogTitle><AlertDialogDescription>{pending ? "等待操作完成后再离开，避免丢失操作结果。" : "离开会放弃当前表单中尚未保存的内容。"}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter>
      <Button variant="outline" onClick={() => { setRequested(null); if (blocker.status === "blocked") blocker.reset(); }}>继续编辑</Button>
      {!pending && <Button variant="destructive" onClick={() => { requested?.(); setRequested(null); if (blocker.status === "blocked") blocker.proceed(); }}>放弃并离开</Button>}
    </AlertDialogFooter></AlertDialogContent>
  </AlertDialog>;
  return { requestClose, dialog };
}
