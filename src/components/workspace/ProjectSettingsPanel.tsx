import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { db } from "@/db/database";
import { patchProjectDetails } from "@/db/repo";
import { ASPECT_PRESET_IDS, type AspectPresetId, type Project } from "@/domain/types";
import {
  APIMART_IMAGE_MODELS, apimartImageSizes, defaultImageGeneration, defaultVideoGeneration,
  IMAGE_EXT_VERSIONS, IMAGE_QUALITIES, IMAGE_RESOLUTIONS, isApimartImage25, isApimartImageExt,
  isApimartImageModel, OUTPUT_PROFILE_VERSION, validateGenerationDefaults, VIDEO_RATIOS, VIDEO_RESOLUTIONS,
  type ApimartImageModel, type ProjectGenerationDefaults,
} from "@/domain/output";
import { AssetTextField } from "@/components/assets/AssetTextField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function SettingSelect({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: readonly (string | { value: string; label: string })[];
  onChange: (value: string) => void; disabled?: boolean;
}) {
  const choices = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  const known = choices.some((option) => option.value === value);
  return (
    <div className="grid min-w-0 gap-2">
      <span className="text-xs font-medium">{label}</span>
      <Select value={value || "__invalid"} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {!known && <SelectItem value={value || "__invalid"}>待调整：{value || "未填写"}</SelectItem>}
          {choices.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="min-w-0 space-y-4 border-t pt-5">
    <div><h3 className="text-sm font-semibold">{title}</h3><p className="text-muted-foreground mt-1 text-xs leading-5">{description}</p></div>
    {children}
  </section>;
}

export function ProjectSettingsPanel({ project, onOutputState }: { project: Project; onOutputState: (state: { dirty: boolean; saving: boolean }) => void }) {
  const styles = useLiveQuery(() => db.styles.where("projectId").equals(project.id).sortBy("name"), [project.id]);
  const [stylePending, setStylePending] = useState(false);
  async function setStyle(value: string) {
    setStylePending(true);
    try { await patchProjectDetails(project.id, { defaultStyleId: value === "none" ? undefined : value }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "风格保存失败"); }
    finally { setStylePending(false); }
  }
  return <div className="min-w-0 space-y-6">
    <div className="space-y-4">
      <AssetTextField key={`${project.id}:name`} draftKey={`${project.id}:name`} projectId={project.id}
        label="项目名称" value={project.name} persist={(name) => patchProjectDetails(project.id, { name })} />
      <AssetTextField key={`${project.id}:brief`} draftKey={`${project.id}:brief`} projectId={project.id}
        label="创作简述" value={project.brief ?? ""} multiline placeholder="想讲什么，为什么值得拍出来" persist={(brief) => patchProjectDetails(project.id, { brief })} />
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">补充创作信息 <span className="text-muted-foreground text-xs font-normal">· 可选</span></summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {([
            ["genre", "类型 / 题材", "如：悬疑、都市、成长"],
            ["audience", "目标观众", "希望谁看到这部作品"],
            ["tone", "叙事基调", "如：克制、温暖、荒诞"],
          ] as const).map(([field, label, placeholder]) => <AssetTextField key={`${project.id}:${field}`} draftKey={`${project.id}:${field}`}
            projectId={project.id} label={label} placeholder={placeholder} value={project[field] ?? ""}
            persist={(value) => patchProjectDetails(project.id, { [field]: value })} />)}
        </div>
      </details>
    </div>
    <Section title="默认视觉风格" description="镜头默认跟随这里的风格；镜头中单独选择的风格会保留。可先在世界 → 风格中建立本项目的风格。">
      <SettingSelect label="项目风格" value={project.defaultStyleId ?? "none"} disabled={styles === undefined || stylePending}
        options={[{ value: "none", label: "暂不设置" }, ...(styles ?? []).map((style) => ({ value: style.id, label: style.name || "未命名风格" }))]}
        onChange={(value) => void setStyle(value)} />
      {stylePending && <p role="status" className="text-muted-foreground text-xs">正在保存风格…</p>}
    </Section>
    <ProjectOutputSettings key={project.id} project={project} onOutputState={onOutputState} />
  </div>;
}

const IMAGE_MODEL_LABELS: Record<ApimartImageModel, string> = {
  "gpt-image-2": "APIMart · GPT Image 2（标准通道）",
  "gpt-image-2.5-flare": "APIMart · GPT Image 2.5 Flare",
  "gpt-image-2.5-sunburst": "APIMart · GPT Image 2.5 Sunburst",
  "gpt-image-2.5-ext": "APIMart · GPT Image 2.5 Ext",
};

function ProjectOutputSettings({ project, onOutputState }: { project: Project; onOutputState: (state: { dirty: boolean; saving: boolean }) => void }) {
  const [ratio, setRatio] = useState<AspectPresetId>(project.aspectPreset);
  const [draft, setDraft] = useState<ProjectGenerationDefaults>(project.generationDefaults ?? {});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const errors = validateGenerationDefaults(draft);
  const dirty = ratio !== project.aspectPreset || JSON.stringify(draft) !== JSON.stringify(project.generationDefaults ?? {});
  useEffect(() => { onOutputState({ dirty, saving }); }, [dirty, saving, onOutputState]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!dirty && !saving) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, saving]);
  const image = draft.image;
  const video = draft.video;
  const imageKnown = Boolean(image && image.provider === "apimart" && isApimartImageModel(image.model) && image.profileVersion === OUTPUT_PROFILE_VERSION);
  const videoKnown = video?.provider === "apimart" && video.model === "MiniMax-H3" && video.profileVersion === OUTPUT_PROFILE_VERSION;
  const imageModel = imageKnown ? image!.model : undefined;
  const updateImage = (patch: Partial<NonNullable<ProjectGenerationDefaults["image"]>>) => {
    if (image) setDraft({ ...draft, image: { ...image, ...patch } });
  };
  const updateVideo = (patch: Partial<NonNullable<ProjectGenerationDefaults["video"]>>) => {
    if (video) setDraft({ ...draft, video: { ...video, ...patch } });
  };
  async function save() {
    if (errors.length || saving) return;
    setSaving(true); setSaveError(undefined);
    try {
      await patchProjectDetails(project.id, { aspectPreset: ratio, generationDefaults: draft });
      toast.success("输出配置已保存");
    } catch (error) { setSaveError(error instanceof Error ? error.message : "输出配置保存失败，请重试"); }
    finally { setSaving(false); }
  }
  return <Section title="画幅与生成默认值" description="画幅表达作品的目标。图片和视频可分别选择模型参数，也可以保持手动制作；保存配置不会发起生成。">
    <fieldset disabled={saving} className="min-w-0 space-y-5">
      <SettingSelect label="项目目标画幅" value={ratio} options={ASPECT_PRESET_IDS} onChange={(value) => setRatio(value as AspectPresetId)} />
      <div className="rounded-xl border p-4 space-y-4">
        <h4 className="text-sm font-medium">图片默认值</h4>
        <SettingSelect label="图片模型" value={!image ? "manual" : imageKnown ? image.model : "unsupported"}
          options={[{ value: "manual", label: "不设置生成默认值" }, ...APIMART_IMAGE_MODELS.map((model) => ({ value: model, label: IMAGE_MODEL_LABELS[model] })), ...(!imageKnown && image ? [{ value: "unsupported", label: `待确认：${image.model} / ${image.profileVersion}` }] : [])]}
          onChange={(value) => value !== "unsupported" && setDraft({ ...draft, image: value === "manual" ? undefined : defaultImageGeneration(ratio, value as ApimartImageModel) })} />
        {image && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingSelect label="图片比例" value={image.size} options={[...apimartImageSizes(image.model), { value: "auto", label: "自动（默认 1:1）" }]} onChange={(size) => updateImage({ size })} />
            <SettingSelect label="图片清晰度" value={image.resolution} options={IMAGE_RESOLUTIONS} onChange={(resolution) => updateImage({ resolution })} />
            {imageModel && isApimartImage25(imageModel) && <SettingSelect label="画质" value={image.quality ?? "auto"} options={[...IMAGE_QUALITIES]} onChange={(quality) => updateImage({ quality })} />}
            {imageModel && isApimartImageExt(imageModel) && <SettingSelect label="版本" value={image.version ?? "flare"} options={[...IMAGE_EXT_VERSIONS]} onChange={(version) => updateImage({ version })} />}
          </div>
          <p className="text-muted-foreground text-xs leading-5">清晰度是模型的输出档位，实际像素随比例而变化。一次生成 1 张图片。{imageModel && isApimartImage25(imageModel) ? " auto 会按最高档预扣，完成后再按实际用量结算。" : ""}</p>
        </>}
      </div>
      <div className="rounded-xl border p-4 space-y-4">
        <h4 className="text-sm font-medium">视频默认值</h4>
        <SettingSelect label="视频模型" value={!video ? "manual" : videoKnown ? "MiniMax-H3" : "unsupported"}
          options={[{ value: "manual", label: "不设置生成默认值" }, { value: "MiniMax-H3", label: "APIMart · MiniMax H3" }, ...(!videoKnown && video ? [{ value: "unsupported", label: `待确认：${video.model} / ${video.profileVersion}` }] : [])]}
          onChange={(value) => value !== "unsupported" && setDraft({ ...draft, video: value === "manual" ? undefined : defaultVideoGeneration(ratio) })} />
        {video && <>
          <SettingSelect label="视频生成方式" value={video.mode} options={[{ value: "text", label: "文字生视频" }, { value: "frames", label: "首帧 / 尾帧生视频" }, { value: "reference", label: "参考素材生视频" }]} onChange={(mode) => updateVideo({ mode })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingSelect label="视频比例" value={video.aspectRatio} options={video.mode === "frames" ? [{ value: "adaptive", label: "跟随输入图片" }] : video.mode === "reference" ? [...VIDEO_RATIOS, { value: "adaptive", label: "跟随参考素材" }] : VIDEO_RATIOS} onChange={(aspectRatio) => updateVideo({ aspectRatio })} />
            <SettingSelect label="视频分辨率" value={video.resolution} options={VIDEO_RESOLUTIONS} onChange={(resolution) => updateVideo({ resolution })} />
            <label className="grid gap-2 text-xs font-medium">默认生成时长（秒）
              <Input type="number" min={4} max={15} step={1} value={Number.isFinite(video.duration) ? video.duration : ""} onChange={(event) => updateVideo({ duration: event.target.value === "" ? 0 : Number(event.target.value) })} />
            </label>
          </div>
          <p className="text-muted-foreground text-xs leading-5">支持 4–15 秒整数。已有镜头的分镜时长保持原值。{video.mode === "frames" ? "首尾帧决定视频比例，项目画幅不会覆盖输入图片。" : "生成时仍需检查素材尺寸和角色，避免首尾帧与参考素材混用。"}</p>
        </>}
      </div>
    </fieldset>
    {errors.length > 0 && <ul role="alert" className="text-destructive list-inside list-disc text-xs leading-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    {saveError && <p role="alert" className="text-destructive text-xs">{saveError}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-muted-foreground text-xs">{saving ? "正在保存…" : dirty ? "输出配置尚未保存" : "输出配置已保存"}</p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={() => { setDraft(project.generationDefaults ?? {}); setRatio(project.aspectPreset); setSaveError(undefined); }}>撤销修改</Button>
        <Button size="sm" disabled={!dirty || saving || errors.length > 0} onClick={() => void save()}>保存输出配置</Button>
      </div>
    </div>
  </Section>;
}
