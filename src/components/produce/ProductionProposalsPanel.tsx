import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Plus, Undo2 } from "lucide-react";
import { db } from "@/db/database";
import { applyProductionProposal, cancelProductionProposal, createProductionProposal, undoProductionProposal } from "@/db/productionProposals";
import type { ProductionProposal } from "@/domain/production";
import type { GenerationResult, Shot, ShotPictureField } from "@/domain/types";
import { targetRevision } from "@/lib/productionRevision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MediaPicker } from "@/components/media/MediaPicker";
import { MediaPreview } from "@/components/media/MediaThumb";

const STATUS = {pending:"待确认",applied:"已应用",cancelled:"已取消",undone:"已撤销"};
const SLOT_LABELS = {firstFrame:"首帧",lastFrame:"尾帧",clip:"成片"};
const FIELD_LABELS = {content:"内容",notes:"备注",durationSec:"时长（秒）"};

export function ProductionProposalsPanel({projectId,episodeId,shots}: {projectId:string;episodeId:string;shots:Shot[]}) {
  const proposals = useLiveQuery(async () => ({projectId,episodeId,rows:(await db.productionProposals.where("episodeId").equals(episodeId).toArray())
    .filter((row) => row.projectId === projectId).sort((a,b) => b.createdAt.localeCompare(a.createdAt))}), [projectId,episodeId]);
  const [editing, setEditing] = useState<Shot>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<{id:string;message:string}>();
  async function act(proposal: ProductionProposal, action: "apply" | "cancel" | "undo") {
    setBusy(proposal.id); setError(undefined);
    try {
      const operation = action === "apply" ? applyProductionProposal : action === "undo" ? undoProductionProposal : cancelProductionProposal;
      await operation(proposal.id,projectId);
      toast.success(action === "apply" ? "提案已应用" : action === "undo" ? "已恢复提案前的内容" : "提案已取消");
    } catch (err) { setError({id:proposal.id,message:err instanceof Error ? err.message : "操作失败，请重试"}); }
    finally { setBusy(undefined); }
  }
  const rows = proposals?.projectId === projectId && proposals.episodeId === episodeId ? proposals.rows : undefined;
  return <section className="mt-8 rounded-2xl border" aria-label="变更提案">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
      <div><h2 className="text-sm font-semibold">变更提案</h2>
        <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-5">先预览镜头文字或素材变更，再决定是否应用。已应用的提案可以撤销；后续手动修改会受到保护。</p></div>
      <Button variant="outline" size="sm" disabled={shots.length === 0 || !!busy} onClick={() => setEditing(shots[0])}><Plus />新建提案</Button>
    </div>
    {rows === undefined ? <p className="text-muted-foreground p-5 text-sm" role="status">加载提案…</p> : rows.length === 0 ?
      <p className="text-muted-foreground p-5 text-sm">暂无提案。你可以先手动准备变更，确认后写入镜头。</p> :
      <ul className="divide-y">{rows.map((proposal) => {
        const shot = shots.find((item) => item.id === proposal.target.entityId);
        const change = proposal.change;
        return <li key={proposal.id} className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">镜头 {shot?.shotNumber || "已删除"} · {change.kind === "shot-text" ? "文字调整" : proposal.target.kind === "shot" && proposal.target.slot ? SLOT_LABELS[proposal.target.slot] : "素材调整"}</p>
            <span className="text-muted-foreground text-xs">{proposal.source.kind === "manual" ? "手动提案" : `${proposal.source.provider} · ${proposal.source.model}`} · {STATUS[proposal.status]}</span>
          </div>
          {change.kind === "shot-text" ? <div className="space-y-3">{(["content","notes","durationSec"] as const).filter((key) => Object.hasOwn(change.patch,key)).map((key) =>
            <div key={key}><p className="text-muted-foreground mb-1 text-xs">{FIELD_LABELS[key]}</p><div className="grid gap-2 sm:grid-cols-2">
              <TextValue label="变更前" value={proposal.before[key]} /><TextValue label="提案内容" value={change.patch[key]} />
            </div></div>)}</div> : <div className="grid gap-3 sm:grid-cols-2">
              <ResultPreview label="变更前" result={proposal.before.result} /><ResultPreview label="提案素材" result={change.result} />
            </div>}
          {error?.id === proposal.id ? <p role="alert" className="text-destructive text-sm">{error.message}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {proposal.status === "pending" ? <><Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void act(proposal,"cancel")}>取消提案</Button>
              <Button size="sm" disabled={!!busy || !shot} onClick={() => void act(proposal,"apply")}>{busy === proposal.id ? "处理中…" : "确认应用"}</Button></> : null}
            {proposal.status === "applied" ? <Button size="sm" variant="outline" disabled={!!busy || !shot} onClick={() => void act(proposal,"undo")}><Undo2 />{busy === proposal.id ? "处理中…" : "撤销应用"}</Button> : null}
          </div>
        </li>;
      })}</ul>}
    {editing ? <ProposalEditor key={editing.id} initialShot={editing} shots={shots} onClose={() => setEditing(undefined)} onSelect={setEditing} /> : null}
  </section>;
}

function TextValue({label,value}: {label:string;value:string|number|undefined}) {
  return <div className="bg-muted/30 min-w-0 rounded-lg border p-3"><p className="text-muted-foreground mb-1 text-[11px]">{label}</p><p className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">{value === "" || value === undefined ? "（空）" : value}</p></div>;
}
function ResultPreview({label,result}: {label:string;result?:GenerationResult}) {
  return <div className="min-w-0 rounded-lg border p-3"><p className="text-muted-foreground mb-2 text-xs">{label}</p>{result ? <MediaPreview mediaId={result.mediaId} className="h-32 w-full" /> : <p className="text-muted-foreground py-8 text-center text-xs">尚无素材</p>}</div>;
}
function ProposalEditor({initialShot,shots,onClose,onSelect}: {initialShot:Shot;shots:Shot[];onClose:()=>void;onSelect:(shot:Shot)=>void}) {
  const [content,setContent] = useState(initialShot.content);
  const [notes,setNotes] = useState(initialShot.notes);
  const [duration,setDuration] = useState(String(initialShot.durationSec));
  const [mode,setMode] = useState<"text"|ShotPictureField>("text");
  const [result,setResult] = useState<GenerationResult>();
  const [picker,setPicker] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [discardAction, setDiscardAction] = useState<(() => void)>();
  const dirty = content !== initialShot.content || notes !== initialShot.notes || duration !== String(initialShot.durationSec) || result !== undefined;
  function leave(action: () => void) {
    if (busy) return;
    if (dirty) setDiscardAction(() => action); else action();
  }
  function changeMode(next: typeof mode) {
    leave(() => {
      setMode(next);
      setContent(initialShot.content);
      setNotes(initialShot.notes);
      setDuration(String(initialShot.durationSec));
      setResult(undefined);
      setPicker(true);
      setError("");
    });
  }
  async function save() {
    setBusy(true);setError("");
    try {
      const patch: {content?:string;notes?:string;durationSec?:number} = {};
      if (content !== initialShot.content) patch.content = content;
      if (notes !== initialShot.notes) patch.notes = notes;
      if (duration !== String(initialShot.durationSec)) {
        if (!duration.trim()) throw new Error("请填写时长，未确定可填 0");
        patch.durationSec = Number(duration);
      }
      if (mode !== "text" && !result) throw new Error("请先选择素材");
      await createProductionProposal({target:{kind:"shot",projectId:initialShot.projectId,episodeId:initialShot.episodeId,entityId:initialShot.id,...(mode === "text" ? {} : {slot:mode})},
        change:mode === "text" ? {kind:"shot-text",patch} : {kind:"slot-result",result:result!},source:{kind:"manual"},expectedRevision:targetRevision(initialShot)});
      toast.success("提案已保存，请预览后确认应用");onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败，请重试"); }
    finally {setBusy(false);}
  }
  const selectClass = "bg-background h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return <><Dialog open onOpenChange={(open) => {if (!open) leave(onClose);}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
    <DialogHeader><DialogTitle>准备镜头变更</DialogTitle><DialogDescription>保存后会展示变更前后对比，确认应用时才会修改镜头。</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-xs">目标镜头<select className={selectClass} value={initialShot.id} disabled={busy} onChange={(event) => {const shot = shots.find((item) => item.id === event.target.value);if (shot) leave(() => onSelect(shot));}}>{shots.map((shot) => <option key={shot.id} value={shot.id}>镜头 {shot.shotNumber || shot.order+1}</option>)}</select></label>
      <label className="space-y-1.5 text-xs">变更类型<select className={selectClass} value={mode} disabled={busy} onChange={(event) => changeMode(event.target.value as typeof mode)}><option value="text">镜头文字</option>{Object.entries(SLOT_LABELS).map(([key,label]) => <option key={key} value={key}>{label}素材</option>)}</select></label>
    </div>
    {mode === "text" ? <div className="space-y-4">
      <label className="block space-y-1.5 text-xs">内容<Textarea value={content} disabled={busy} onChange={(event) => setContent(event.target.value)} className="min-h-28" /></label>
      <label className="block space-y-1.5 text-xs">备注<Textarea value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} /></label>
      <label className="block space-y-1.5 text-xs">时长（秒）<Input type="number" min={0} step="any" value={duration} disabled={busy} onChange={(event) => setDuration(event.target.value)} /></label>
    </div> : <div className="space-y-3">{result ? <ResultPreview label="已选素材" result={result} /> : null}
      {picker ? <MediaPicker projectId={initialShot.projectId} kinds={mode === "clip" ? ["image","video"] : ["image"]} disabled={busy} selectedIds={result ? [result.mediaId] : []} onClose={() => setPicker(false)} onSelect={(record) => {setResult({mediaId:record.id,kind:record.mimeType.startsWith("video/") ? "video" : "image"});setPicker(false);}} /> : <Button variant="outline" disabled={busy} onClick={() => setPicker(true)}>选择已有素材</Button>}
      {mode === "clip" ? <p className="text-muted-foreground text-xs">图片可作为成片占位，完整交付仍需要视频。</p> : null}</div>}
    {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
    <DialogFooter><Button variant="ghost" disabled={busy} onClick={() => leave(onClose)}>返回</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "保存中…" : "保存并预览提案"}</Button></DialogFooter>
  </DialogContent></Dialog>
    <AlertDialog open={!!discardAction} onOpenChange={(open) => { if (!open) setDiscardAction(undefined); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>放弃未保存的提案？</AlertDialogTitle>
        <AlertDialogDescription>这份提案尚未保存，离开后需要重新填写。镜头原有内容不会改变。</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>继续编辑</AlertDialogCancel><AlertDialogAction onClick={() => { const action = discardAction; setDiscardAction(undefined); action?.(); }}>放弃并继续</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
