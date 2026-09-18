import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { MediaKind, MediaRecord } from "@/domain/types";
import { reusableMedia } from "@/lib/mediaPicker";
import { MediaPreview } from "./MediaThumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Inline in the slot dialog: selection reuses an ID and never owns/deletes its Blob. */
export function MediaPicker({ projectId, kinds, disabled, selectedIds, onSelect, onClose }: {
  projectId: string;
  kinds: readonly MediaKind[];
  disabled: boolean;
  selectedIds: readonly string[];
  onSelect: (record: MediaRecord) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const records = useLiveQuery(() => db.media.where("projectId").equals(projectId).toArray(), [projectId]);
  const items = reusableMedia(records ?? [], projectId, kinds, query);
  return (
    <section aria-label="选择已有素材" className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">选择已有素材</h3>
          <p className="text-muted-foreground mt-1 text-xs">仅显示当前{projectId === "studio" ? "工作室" : "项目"}的{ kinds.length === 1 ? (kinds[0] === "image" ? "图片" : "视频") : "图片与视频" }，无需再次上传。</p>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClose}>收起</Button>
      </div>
      <Input aria-label="搜索已有素材" placeholder="按文件名搜索…" value={query} disabled={disabled}
        onChange={(event) => setQuery(event.target.value)} />
      {records === undefined ? <p className="text-muted-foreground text-sm" role="status">加载中…</p> : items.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">{query.trim() ? "没有匹配的素材。" : "还没有可复用的素材，可以先上传文件。"}</p>
      ) : <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
        {items.map((record) => <button key={record.id} type="button" disabled={disabled || selectedIds.includes(record.id)}
          className="hover:border-brand focus-visible:ring-ring overflow-hidden rounded-lg border text-left focus-visible:ring-2 disabled:opacity-50"
          onClick={() => onSelect(record)} aria-label={`选择素材 ${record.filename}`}>
          <MediaPreview mediaId={record.id} className="h-24 w-full" />
          <span className="block truncate px-2 pt-2 text-xs" title={record.filename}>{record.filename}</span>
          <span className="text-muted-foreground block px-2 pb-2 text-[11px]">{selectedIds.includes(record.id) ? "已添加" : record.mimeType.startsWith("video/") ? "视频" : "图片"}</span>
        </button>)}
      </div>}
    </section>
  );
}
