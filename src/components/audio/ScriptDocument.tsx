import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Play, Plus, Trash2, Volume2 } from "lucide-react";
import { db } from "@/db/database";
import { addAudioSegment, addAudioSpeaker, deleteAudioSegment, patchAudioSegment, patchAudioSpeaker } from "@/db/audio";
import { appendAudioScript, editAudioScriptLines } from "@/lib/audio/scriptImport";
import type { AudioChapter, AudioProjectSnapshot, AudioSegment } from "@/domain/audio";
import { SPEECH_VOICES } from "@/lib/ai/apimartAudio";
import { DraftConflictError } from "@/lib/draftConflict";
import { flushPendingDrafts, useDebouncedDraft } from "@/lib/debouncedDraft";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DraftStatus } from "@/components/ui/draft-status";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, SavedText } from "@/components/audioMusic/shared";
import { useMedia } from "@/lib/media";
import { SourcePlayer, WorkspaceSelect, SelectOption } from "@/components/audioMusic/controls";
import type { AudioAction } from "./AudioInspector";

export function ScriptDocument({ chapter, snapshot, selectedId, busy, action, onSelect, onInspect }: {
  chapter: AudioChapter; snapshot: AudioProjectSnapshot; selectedId: string; busy: boolean; action: AudioAction;
  onSelect: (segment: AudioSegment) => void; onInspect: (segment: AudioSegment) => void;
}) {
  const segments = snapshot.segments.filter((row) => row.chapterId === chapter.id);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [focusRequest, setFocusRequest] = useState<{ id: string; atEnd?: boolean }>();
  useEffect(() => {
    if (!focusRequest) return;
    const row = segments.find((item) => item.id === focusRequest.id);
    const input = document.getElementById(`script-input-${focusRequest.id}`) as HTMLTextAreaElement | null;
    if (!row || !input) return;
    input.focus(); const caret = focusRequest.atEnd ? input.value.length : 0; input.setSelectionRange(caret, caret); onSelect(row); setFocusRequest(undefined);
  }, [focusRequest, segments, onSelect]);
  async function add(text = "") {
    const segment = await addAudioSegment(chapter.projectId, { chapterId: chapter.id, order: Math.max(0, ...segments.map((row) => row.order)) + 1, text, notes: "" });
    onSelect(segment); setFocusRequest({ id: segment.id });
  }
  return <div className="as-document">
    {!segments.length ? <div className="as-blank-document"><p>从你的第一段台词开始</p><span>写下脚本，或者导入、录制已有声音。制作方式由你决定。</span><div><Button disabled={busy} onClick={() => void action(() => add())}><Plus />写下第一段</Button><Button variant="ghost" onClick={() => setPasting(true)}>粘贴完整稿件</Button></div></div> : <div className="as-paragraphs">{segments.map((segment, index) => <ScriptParagraph key={segment.id} segment={segment} index={index} siblings={segments} snapshot={snapshot} selected={selectedId === segment.id} busy={busy} action={action} onSelect={() => onSelect(segment)} onInspect={() => onInspect(segment)} onFocusNew={(id, atEnd) => setFocusRequest({ id, atEnd })} />)}</div>}
    {segments.length > 0 && <footer className="as-document-footer"><Button size="sm" variant="ghost" disabled={busy} onClick={() => void action(() => add())}><Plus />添加一行</Button><Button size="sm" variant="ghost" onClick={() => setPasting(true)}>粘贴稿件</Button><span>文字编辑自动保存</span></footer>}
    <Dialog open={pasting} onOpenChange={setPasting}><DialogContent><DialogHeader><DialogTitle>粘贴稿件</DialogTitle><DialogDescription>每个非空回车行作为一个编辑单位，追加到当前章节。已有内容会保留。</DialogDescription></DialogHeader><Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={12} aria-label="完整稿件" placeholder="第一段台词…&#10;&#10;下一段台词…" /><Button disabled={busy || !pasted.trim()} onClick={() => void action(async () => { const added = await appendAudioScript(chapter.projectId, chapter.id, pasted); const last = added.at(-1); setPasted(""); setPasting(false); if (last) onSelect(last); })}>添加 {pasted.split(/\r?\n/).filter((part) => part.trim()).length} 行</Button></DialogContent></Dialog>
  </div>;
}
function ScriptParagraph({ segment, index, siblings, snapshot, selected, busy, action, onSelect, onInspect, onFocusNew }: {
  segment: AudioSegment; index: number; siblings: AudioSegment[]; snapshot: AudioProjectSnapshot; selected: boolean; busy: boolean;
  action: AudioAction; onSelect: () => void; onInspect: () => void; onFocusNew: (id: string, atEnd?: boolean) => void;
}) {
  const [roleOpen, setRoleOpen] = useState(false);
  const [audition, setAudition] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const speaker = snapshot.speakers.find((row) => row.id === segment.speakerId);
  const takes = snapshot.takes.filter((row) => row.segmentId === segment.id);
  const adopted = takes.find((take) => take.id === segment.selectedTakeId);
  const auditionTake = adopted ?? takes.at(-1);
  const preview = useMedia(audition && selected ? auditionTake?.mediaId : undefined);
  const { draft, setDraft, status, error, retry, useLatest } = useDebouncedDraft({ scope: segment.projectId, draftKey: `${segment.id}:text`, initialValue: segment.text, persist: async (text, baseline) => { const current = await db.audioSegments.get(segment.id); if (!current || current.text !== baseline) throw new DraftConflictError(); await patchAudioSegment(segment.projectId, current.id, current.revision, { text }); } });
  useEffect(() => {
    const input = textarea.current; if (!input) return;
    const measure = () => { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; };
    measure(); let width = input.getBoundingClientRect().width;
    const observer = new ResizeObserver((entries) => { const nextWidth = entries[0]?.contentRect.width; if (nextWidth === undefined || Math.abs(nextWidth - width) < 0.5) return; width = nextWidth; measure(); });
    observer.observe(input); return () => observer.disconnect();
  }, [draft]);
  async function splitLine(start: number, end: number) {
    await flushPendingDrafts(segment.projectId);
    const rows = await editAudioScriptLines({ projectId: segment.projectId, segmentId: segment.id, baseline: draft, start, end });
    if (rows[1]) onFocusNew(rows[1].id);
  }
  return <article id={`script-${segment.id}`} className="as-paragraph" data-selected={selected} onFocus={onSelect}>
    <div className="as-paragraph-gutter"><Popover open={roleOpen} onOpenChange={setRoleOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="as-role-button" aria-label={`段落 ${index + 1} 选择说话人和音色`}><span className="as-voice-avatar">{speaker?.name.slice(0, 1) ?? <MoreHorizontal size={14} />}</span></Button></PopoverTrigger><PopoverContent align="start" className="as-role-popover"><h3>这段由谁来讲述</h3><div className="as-role-options"><Button variant={!speaker ? "secondary" : "ghost"} className="justify-start" disabled={busy} onClick={() => void action(async () => { await patchAudioSegment(segment.projectId, segment.id, segment.revision, { speakerId: undefined }); setRoleOpen(false); })}>未指定角色</Button>{snapshot.speakers.map((row) => <Button key={row.id} variant={row.id === speaker?.id ? "secondary" : "ghost"} className="justify-start" disabled={busy} onClick={() => void action(async () => { await patchAudioSegment(segment.projectId, segment.id, segment.revision, { speakerId: row.id }); setRoleOpen(false); })}>{row.name}<span className="text-muted-foreground ml-auto text-xs">{row.voice ?? "alloy"}</span></Button>)}</div><Button size="sm" variant="ghost" disabled={busy} onClick={() => void action(async () => { const row = await addAudioSpeaker(segment.projectId, { name: `说话人 ${snapshot.speakers.length + 1}`, voice: "alloy", speed: 1 }); const current = await db.audioSegments.get(segment.id); if (current) await patchAudioSegment(segment.projectId, segment.id, current.revision, { speakerId: row.id }); })}><Plus />添加说话人</Button>{speaker && <div className="as-speaker-settings"><Field label="角色名称"><SavedText key={`${speaker.id}:name`} projectId={speaker.projectId} rowId={speaker.id} field="name" label="角色名称" value={speaker.name} save={async (name, baseline) => { const current = await db.audioSpeakers.get(speaker.id); if (!current || current.name !== baseline) throw new DraftConflictError(); await patchAudioSpeaker(speaker.projectId, current.id, current.revision, { name }); }} /></Field><Field label="默认音色"><WorkspaceSelect value={speaker.voice ?? "alloy"} onValueChange={(voice) => void action(() => patchAudioSpeaker(speaker.projectId, speaker.id, speaker.revision, { voice }))}>{SPEECH_VOICES.map((voice) => <SelectOption key={voice} value={voice}>{voice}</SelectOption>)}</WorkspaceSelect></Field></div>}<div className="as-line-menu-actions"><Button size="sm" variant="ghost" onClick={() => { setRoleOpen(false); onInspect(); }}><Volume2 size={13} />声音与生成</Button>{auditionTake && <Button size="sm" variant="ghost" onClick={() => { setAudition(!audition); setRoleOpen(false); }}><Play size={13} />试听</Button>}<Button size="sm" variant="ghost" disabled={busy || index === 0} onClick={() => void action(() => patchAudioSegment(segment.projectId, segment.id, segment.revision, { order: index > 1 ? (siblings[index - 2].order + siblings[index - 1].order) / 2 : siblings[0].order / 2 }))}><ArrowUp />上移</Button><Button size="sm" variant="ghost" disabled={busy || index === siblings.length - 1} onClick={() => void action(() => patchAudioSegment(segment.projectId, segment.id, segment.revision, { order: index + 2 < siblings.length ? (siblings[index + 1].order + siblings[index + 2].order) / 2 : siblings[index + 1].order + 1 }))}><ArrowDown />下移</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void action(async () => { await flushPendingDrafts(segment.projectId); const current = await db.audioSegments.get(segment.id); if (current) await deleteAudioSegment(segment.projectId, segment.id, current.revision); })}><Trash2 />删除此行</Button></div></PopoverContent></Popover></div>
    <div className="as-paragraph-main"><Textarea id={`script-input-${segment.id}`} ref={textarea} className="as-script-input" aria-label={`第 ${index + 1} 行正文`} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
      if (event.key === "Backspace" && !draft && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0 && index > 0 && !event.nativeEvent.isComposing) {
        event.preventDefault(); const previous = siblings[index - 1];
        void action(async () => { await flushPendingDrafts(segment.projectId); const current = await db.audioSegments.get(segment.id); if (!current || current.text) throw new DraftConflictError(); await deleteAudioSegment(segment.projectId, current.id, current.revision); onFocusNew(previous.id, true); }); return;
      }
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); const start = event.currentTarget.selectionStart; const end = event.currentTarget.selectionEnd; void action(() => splitLine(start, end)); } }} onPaste={(event) => {
      const pasted = event.clipboardData.getData("text/plain");
      if (!/[\r\n]/.test(pasted)) return;
      event.preventDefault(); const start = event.currentTarget.selectionStart; const end = event.currentTarget.selectionEnd;
      void action(async () => { await flushPendingDrafts(segment.projectId); const rows = await editAudioScriptLines({ projectId: segment.projectId, segmentId: segment.id, baseline: draft, start, end, pasted }); if (rows.length > 1) onFocusNew(rows.at(-1)!.id); });
    }} placeholder="写下正文…" rows={1} />{status === "error" && <DraftStatus status={status} error={error} onRetry={() => void retry()} onUseLatest={useLatest} />}{preview && <div className="as-inline-audition"><SourcePlayer src={preview.url} title={`第 ${index + 1} 行`} autoplay /></div>}</div>
  </article>;
}
