import { Plus, Trash2, Type } from "lucide-react";
import { useState } from "react";
import { emptySlot, slotHasBody } from "@/domain/slot";
import type { GenerationSlot, Id } from "@/domain/types";
import {
  IMAGE_ACCEPT,
  MEDIA_ACCEPT,
  VIDEO_ACCEPT,
  pickMediaFile,
  uploadMediaFile,
} from "@/lib/media";
import { cn } from "@/lib/utils";
import { MediaPreview } from "@/components/media/MediaThumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TileVariant = "frame" | "reference" | "asset";

export function GenerationSlotTile({
  slot,
  variant,
  label,
  onOpen,
}: {
  slot: GenerationSlot;
  variant: TileVariant;
  label?: string;
  onOpen: () => void;
}) {
  const hasResult = Boolean(slot.result?.mediaId);
  const hasBody = slotHasBody(slot);
  const dashed = variant === "reference" && !hasResult;

  return (
    <div className={variant === "asset" ? "w-full" : "relative mx-auto h-[124px] w-[220px]"}>
      {label ? <div className="text-muted-foreground mb-1.5 text-xs">{label}</div> : null}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "relative flex flex-col overflow-hidden text-left",
          variant === "asset"
            ? "bg-muted h-36 w-full rounded-xl border"
              : dashed
              ? "h-full w-full rounded-md border border-dashed bg-[#fffdf7]"
              : "bg-background h-full w-full rounded-md border",
        )}
      >
        {hasResult ? (
          <MediaPreview mediaId={slot.result?.mediaId} className="h-full w-full" />
        ) : hasBody ? (
          <div className="flex h-full flex-col justify-between p-3">
            <Type className="text-muted-foreground size-4" />
            <p className="line-clamp-3 text-[12px] leading-5">
              {slot.prompt || "已填写参考，待生成"}
            </p>
          </div>
        ) : variant === "frame" ? (
          <span className="text-muted-foreground m-auto">
            <Plus className="size-5" />
          </span>
        ) : (
          <span className="text-muted-foreground m-auto px-4 text-center text-[11px] leading-5">
            填写提示词与参考
          </span>
        )}
        {hasResult ? (
          <span className="absolute top-1.5 right-1.5">
            <Badge variant="secondary">{slot.result?.kind === "video" ? "视频" : "图片"}</Badge>
          </span>
        ) : null}
      </button>
    </div>
  );
}

function RefStrip({
  ids,
  onRemove,
  onAdd,
  addLabel,
}: {
  ids: Id[];
  onRemove: (id: Id) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <div key={id} className="group relative h-20 w-28 overflow-hidden rounded-lg border">
          <MediaPreview mediaId={id} className="h-full w-full" />
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute top-1 right-1 hidden size-6 rounded-full group-hover:flex"
            onClick={() => onRemove(id)}
            aria-label="移除参考"
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="text-muted-foreground hover:text-foreground hover:border-brand flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs"
      >
        <Plus className="size-3.5" />
        {addLabel}
      </button>
    </div>
  );
}

export function GenerationSlotEditor({
  open,
  title,
  projectId,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  projectId: Id;
  value: GenerationSlot;
  onClose: () => void;
  onSave: (slot: GenerationSlot) => void;
}) {
  const [draft, setDraft] = useState(value);

  async function addRef(kind: "image" | "video") {
    const file = await pickMediaFile(kind === "video" ? VIDEO_ACCEPT : IMAGE_ACCEPT);
    if (!file) return;
    const uploaded = await uploadMediaFile(projectId, file);
    setDraft((current) =>
      kind === "video"
        ? { ...current, referenceVideoIds: [...current.referenceVideoIds, uploaded.id] }
        : { ...current, referenceImageIds: [...current.referenceImageIds, uploaded.id] },
    );
  }

  async function setResult() {
    const file = await pickMediaFile(MEDIA_ACCEPT);
    if (!file) return;
    const uploaded = await uploadMediaFile(projectId, file);
    setDraft((current) => ({
      ...current,
      result: { mediaId: uploaded.id, kind: uploaded.kind },
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>槽位主体是提示词和参考，外面的画面只是生成结果</DialogDescription>
        </DialogHeader>
        <div className="app-scroll space-y-5 overflow-auto pr-1">
          <div className="grid gap-2">
            <Label>提示词</Label>
            <Textarea
              autoFocus
              value={draft.prompt}
              onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
              placeholder="描述要生成的画面或镜头…"
              className="min-h-32"
            />
          </div>
          <div className="grid gap-2">
            <Label>参考图</Label>
            <RefStrip
              ids={draft.referenceImageIds}
              addLabel="添加图片"
              onAdd={() => void addRef("image")}
              onRemove={(id) =>
                setDraft({
                  ...draft,
                  referenceImageIds: draft.referenceImageIds.filter((item) => item !== id),
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>参考视频</Label>
            <RefStrip
              ids={draft.referenceVideoIds}
              addLabel="添加视频"
              onAdd={() => void addRef("video")}
              onRemove={(id) =>
                setDraft({
                  ...draft,
                  referenceVideoIds: draft.referenceVideoIds.filter((item) => item !== id),
                })
              }
            />
          </div>
          <div className="bg-muted space-y-3 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">最终生成素材</div>
                <div className="text-muted-foreground text-[11px]">
                  仅用于预览和导出，不是这个槽位的主体
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void setResult()}>
                  上传结果
                </Button>
                {draft.result ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraft({ ...draft, result: undefined })}
                  >
                    清除
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="bg-background h-36 overflow-hidden rounded-lg border">
              <MediaPreview
                mediaId={draft.result?.mediaId}
                className="h-full w-full"
                empty="还没有生成结果"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="brand"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditableGenerationSlot({
  projectId,
  slot,
  variant,
  label,
  title,
  onSave,
}: {
  projectId: Id;
  slot?: GenerationSlot;
  variant: TileVariant;
  label?: string;
  title: string;
  onSave: (slot: GenerationSlot) => void;
}) {
  const value = slot ?? emptySlot();
  const [open, setOpen] = useState(false);
  return (
    <>
      <GenerationSlotTile
        slot={value}
        variant={variant}
        label={label}
        onOpen={() => setOpen(true)}
      />
      {open ? (
        <GenerationSlotEditor
          open={open}
          title={title}
          projectId={projectId}
          value={value}
          onClose={() => setOpen(false)}
          onSave={onSave}
        />
      ) : null}
    </>
  );
}
