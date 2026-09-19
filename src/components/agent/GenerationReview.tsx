import { useId, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Input, Select } from "antd";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Image, LoaderCircle, RotateCcw, Video } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/db/database";
import { getGenerationPreferenceState, saveGenerationPreference } from "@/db/generationPreferences";
import type { AgentToolCall } from "@/domain/agent";
import { IMAGE_RATIOS, VIDEO_RATIOS } from "@/domain/output";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GENERATION_PROFILES, generationSubmitSchema, profileRequest, type GenerationSubmitArgs } from "@/lib/agent/generationProfiles";
import { reviewAndApproveGeneration } from "@/lib/agent/generationReview";
import { recommendGenerationSelection } from "@/lib/agent/generationSelection";
import { applyGenerationSelection } from "@/lib/agent/generationReviewDraft";
import type { RunAction } from "./AgentRunDetails";

const PROVIDER_LABELS = { apimart: "APIMart", aihubmix: "AIHubMix" };
function popupRoot() { return document.querySelector<HTMLElement>(".agent-chat-root") ?? document.body; }
function Choice({ label, value, options, onChange, disabled }: {
  label: string; value?: string; options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  return <div className="agent-generation-field"><label htmlFor={id}>{label}</label>
    <Select id={id} value={value} options={options} onChange={onChange} disabled={disabled} variant="borderless" getPopupContainer={(trigger: HTMLElement) => trigger.closest<HTMLElement>('[role=dialog]') ?? popupRoot()} popupMatchSelectWidth virtual={false} className="agent-generation-choice" />
  </div>;
}
const options = (values: readonly (string | number)[]) => values.map((value) => ({ value: String(value), label: String(value) }));

/** The model's proposal remains immutable; only confirmed overrides become executable. */
export function GenerationReview({ call, busy, onAction }: {
  call: AgentToolCall; busy: boolean; onAction: (runId: string, action: RunAction, callId?: string) => void;
}) {
  let raw: unknown;
  try { raw = JSON.parse(call.arguments); } catch { raw = undefined; }
  const parsed = generationSubmitSchema.safeParse(raw);
  if (!parsed.success || !call.preview?.revision) return <div><p role="alert">生成提案不完整，请取消后让助手重新准备。</p><Button variant="ghost" size="sm" disabled={busy} onClick={() => onAction(call.runId, "reject", call.id)}>取消本次生成</Button></div>;
  return <GenerationReviewForm key={call.id} call={call} initial={parsed.data} busy={busy} onAction={onAction} />;
}

function GenerationReviewForm({ call, initial, busy, onAction }: {
  call: AgentToolCall; initial: GenerationSubmitArgs; busy: boolean; onAction: (runId: string, action: RunAction, callId?: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const savingRef = useRef(false);
  const connectors = useLiveQuery(() => db.connectors.toArray(), []);
  const preferenceState = useLiveQuery(getGenerationPreferenceState, []);
  const project = useLiveQuery(async () => (await db.projects.get(initial.target.projectId)) ?? null, [initial.target.projectId]);
  const kind = initial.target.kind === "shot" && initial.target.slot === "clip" ? "video" : "image";
  const title = kind === "image" ? "图片" : "视频";
  const Icon = kind === "image" ? Image : Video;
  const selected = connectors?.find((item) => item.id === draft.connectorId);
  const provider = selected?.definitionId;
  const validProvider = provider === "apimart" || provider === "aihubmix" ? provider : undefined;
  const recommendation = connectors && preferenceState && project !== undefined ? recommendGenerationSelection({
    kind, connectors, projectDefaults: project?.generationDefaults, preferences: preferenceState.preferences, preferenceIssues: preferenceState.issues,
  }) : undefined;
  const hasDefault = Boolean(preferenceState?.preferences[kind] || preferenceState?.issues[kind]);
  let validation: string | undefined;
  try {
    if (!connectors) throw new Error("正在读取生成连接…");
    if (!selected?.apiKey.trim() || !validProvider) throw new Error("请选择已配置密钥的生成连接。");
    if (!draft.prompt.trim()) throw new Error("请填写画面描述。");
    profileRequest(generationSubmitSchema.parse(draft), validProvider);
  } catch (cause) { validation = cause instanceof Error && cause.name !== "ZodError" ? cause.message : "请检查画面描述与生成参数。"; }
  const disabled = busy || saving;
  async function confirm() {
    if (savingRef.current || busy || validation) return;
    savingRef.current = true; setSaving(true); setError(undefined);
    try {
      await reviewAndApproveGeneration(call.runId, call.id, draft, { arguments: call.arguments, revision: call.preview!.revision! });
      if (remember) {
        const parameters = { ...draft.parameters };
        delete parameters.mode;
        if (parameters.aspectRatio === "adaptive") delete parameters.aspectRatio;
        await saveGenerationPreference(kind, { connectorId: draft.connectorId, model: draft.model, parameters })
          .catch(() => toast.error("本次生成已确认，但默认配置保存失败，请稍后重试。"));
      }
      onAction(call.runId, "resume");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "确认失败，请重试。"); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return <div className="agent-generation-review" aria-label={`确认${title}生成`}>
    <div className="agent-generation-review-heading"><Icon size={18} aria-hidden /><strong>确认{title}生成</strong><span>AI 已准备</span></div>
    <p className="agent-generation-review-intro">可以直接确认，也可以调整下面的配置。</p>
    {call.preview?.target && /^\/(?!\/)/.test(call.preview.target.href) && <Link className="agent-generation-target" to={call.preview.target.href}>{call.preview.target.label}<ArrowUpRight size={13} aria-hidden /></Link>}
    {recommendation && ["project", "global"].includes(recommendation.source) && <div className="agent-generation-default">
      <span>{recommendation.status === "ready" ? `${recommendation.source === "project" ? "项目" : "我的"}默认 · ${recommendation.recommendation?.model}` : recommendation.issues.join("；")}</span>
      {recommendation.recommendation && <button type="button" disabled={disabled} onClick={() => {
        const selection = recommendation.recommendation!;
        const selectedProvider = connectors?.find((item) => item.id === selection.connectorId)?.definitionId;
        if (selectedProvider === "apimart" || selectedProvider === "aihubmix") {
          setDraft(applyGenerationSelection(draft, selection, selectedProvider)); setError(undefined); setNotice("已应用默认配置，生成方式沿用本次参考素材。");
        }
      }}>应用默认</button>}
    </div>}
    <GenerationConfigurationFields draft={draft} onChange={setDraft} disabled={disabled} />
    {notice && <p className="agent-generation-form-note" role="status">{notice}</p>}
    <div className="agent-generation-remember"><label><Checkbox checked={remember} disabled={disabled} onCheckedChange={(value) => setRemember(value === true)} />设为默认{title}生成配置</label>
      {hasDefault && <button type="button" className="agent-generation-reset" disabled={disabled} onClick={() => {
        if (savingRef.current) return;
        savingRef.current = true; setSaving(true);
        void saveGenerationPreference(kind, null).then(() => toast.success(`已清除默认${title}配置`)).catch(() => toast.error("清除默认配置失败，请重试。"))
          .finally(() => { savingRef.current = false; setSaving(false); });
      }}>清除已保存的默认</button>}
    </div>
    {remember && <p className="agent-generation-form-note">用于未设置项目默认值的后续生成，仅记住连接、模型和通用参数。</p>}
    {(error || validation) && <p role="alert" className="agent-generation-form-error">{error ?? validation}</p>}
    <div className="agent-generation-confirm-actions">
      <Button size="sm" disabled={disabled || Boolean(validation)} onClick={() => void confirm()}>{saving && <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" />}确认并生成{title}</Button>
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onAction(call.runId, "reject", call.id)}>取消本次生成</Button>
      <button type="button" className="agent-generation-reset" disabled={disabled} onClick={() => { setDraft(initial); setError(undefined); setNotice(undefined); }}><RotateCcw size={13} aria-hidden />恢复 AI 建议</button>
    </div>
    <p className="agent-generation-cost-note">确认后向所选供应商提交，可能产生费用。生成结果会先保存到本地。</p>
  </div>;
}

/** Shared configuration controls for single requests and durable batch drafts. */
export function GenerationConfigurationFields({draft,onChange,disabled}: {draft:GenerationSubmitArgs;onChange:(draft:GenerationSubmitArgs)=>void;disabled:boolean}) {
  const promptId=useId();
  const connectors=useLiveQuery(()=>db.connectors.toArray(),[]);
  const kind=draft.target.kind==='shot'&&draft.target.slot==='clip'?'video':'image';
  const selected=connectors?.find(item=>item.id===draft.connectorId);
  const provider=selected?.definitionId;
  const validProvider=provider==='apimart'||provider==='aihubmix'?provider:undefined;
  const choices=(connectors??[]).filter(item=>item.definitionId==='apimart'||item.definitionId==='aihubmix');
  const models=GENERATION_PROFILES.filter(profile=>profile.provider===provider&&profile.kind===kind);
  const p=draft.parameters;
  const frames=draft.inputs.some(input=>['first-frame','last-frame'].includes(input.role));
  const references=draft.inputs.length>0&&!frames;
  const referenceVideos=draft.inputs.filter(input=>input.role==='reference-video').length;
  const patch=(parameters:GenerationSubmitArgs['parameters'])=>onChange({...draft,parameters:{...draft.parameters,...parameters}});
  function changeConnection(connectorId:string) {
    const connection=choices.find(item=>item.id===connectorId);
    const supported=GENERATION_PROFILES.filter(profile=>profile.provider===connection?.definitionId&&profile.kind===kind);
    const model=supported.find(profile=>profile.model===draft.model)?.model??supported[0]?.model;
    if(model&&connection&&(connection.definitionId==='apimart'||connection.definitionId==='aihubmix'))onChange(applyGenerationSelection(draft,{connectorId,model,parameters:{}},connection.definitionId));
  }
  return <>
    <div className="agent-generation-fields">
      <Choice label="供应商连接" value={draft.connectorId} disabled={disabled} options={[
        ...choices.map((item) => ({ value: item.id, label: `${PROVIDER_LABELS[item.definitionId as keyof typeof PROVIDER_LABELS]}${item.label ? ` · ${item.label}` : ""}${!item.apiKey.trim() ? "（未配置密钥）" : ""}`, disabled: !item.apiKey.trim() })),
        ...(!selected ? [{ value: draft.connectorId, label: connectors ? "原连接已不可用" : "读取连接…", disabled: true }] : []),
      ]} onChange={changeConnection} />
      <Choice label="生成模型" value={draft.model} disabled={disabled || !models.length} options={models.map((model) => ({ value: model.model, label: model.model }))} onChange={(model) => {
        if (validProvider) onChange(applyGenerationSelection(draft, { connectorId: draft.connectorId, model, parameters: {} }, validProvider));
      }} />
    </div>
    <div className="agent-generation-field"><label htmlFor={promptId}>画面描述</label><Input.TextArea id={promptId} value={draft.prompt} onChange={(event) => { onChange({ ...draft, prompt: event.target.value }); }} disabled={disabled} autoSize={{ minRows: 3, maxRows: 9 }} maxLength={32000} variant="borderless" /></div>
    <div className="agent-generation-fields agent-generation-parameters">
      {kind === "image" ? <>
        <Choice label={provider === "aihubmix" ? "图片尺寸" : "图片比例"} value={p.size ?? "auto"} disabled={disabled} options={provider === "aihubmix" ? options(["auto", "1024x1024", "1536x1024", "1024x1536"]) : options(["auto", ...IMAGE_RATIOS])} onChange={(size) => patch({ size })} />
        {provider === "aihubmix" ? <Choice label="画质" value={p.quality ?? "default"} disabled={disabled} options={[{ value: "default", label: "模型默认" }, { value: "low", label: "低" }, { value: "medium", label: "中" }, { value: "high", label: "高" }]} onChange={(quality) => patch({ quality: quality === "default" ? undefined : quality as "low" | "medium" | "high" })} />
          : <Choice label="分辨率" value={p.resolution ?? "1k"} disabled={disabled} options={options(["1k", "2k", "4k"])} onChange={(resolution) => patch({ resolution })} />}
      </> : <>
        <Choice label="分辨率" value={p.resolution ?? (provider === "aihubmix" ? "720p" : "2K")} disabled={disabled} options={options(provider === "aihubmix" ? referenceVideos ? ["720p"] : ["720p", "1080p", "4K"] : ["768P", "2K"])} onChange={(resolution) => patch({ resolution, ...(provider === "aihubmix" && resolution !== "720p" ? { duration: 8 } : {}) })} />
        <Choice label="时长（秒）" value={String(p.duration ?? (provider === "aihubmix" ? 8 : 5))} disabled={disabled} options={options(provider === "aihubmix" ? (p.resolution && p.resolution !== "720p" || references) ? [8] : [4, 6, 8] : Array.from({ length: 12 }, (_, i) => i + 4))} onChange={(duration) => patch({ duration: Number(duration) })} />
        {!(frames && provider === "apimart") && <Choice label="视频比例" value={p.aspectRatio ?? (references && provider === "apimart" ? "adaptive" : "16:9")} disabled={disabled} options={options(provider === "aihubmix" ? ["16:9", "9:16"] : [...VIDEO_RATIOS, ...(references ? ["adaptive"] : [])])} onChange={(aspectRatio) => patch({ aspectRatio })} />}
      </>}
    </div>
    <p className="agent-generation-reference-note">{draft.inputs.length ? `已选 ${draft.inputs.length - referenceVideos} 张参考图片${referenceVideos ? `、${referenceVideos} 段视频` : ""}${frames ? " · 首尾帧模式" : ""}` : "根据文字描述生成"} · 目标和参考素材沿用本次提案</p>
  </>;
}
