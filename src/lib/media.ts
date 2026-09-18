import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { putMedia } from "@/db/repo";
import { kindFromMime } from "@/domain/slot";
import type { Id, MediaKind, MediaRecord } from "@/domain/types";
import { createId } from "./ids";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

export interface MediaView {
  url: string;
  mimeType: string;
  kind: MediaKind;
}

export function useMedia(mediaId: Id | undefined): MediaView | undefined {
  const [view, setView] = useState<{ id: Id; record: MediaRecord; media: MediaView }>();
  const record = useLiveQuery(async () => mediaId ? (await db.media.get(mediaId)) ?? null : null, [mediaId]);

  useEffect(() => {
    if (!mediaId || !record || record.id !== mediaId) {
      setView(undefined);
      return;
    }
    const url = URL.createObjectURL(record.blob);
    setView({
      id: mediaId,
      record,
      media: {
        url,
        mimeType: record.mimeType,
        kind: kindFromMime(record.mimeType),
      },
    });
    return () => URL.revokeObjectURL(url);
  }, [mediaId, record]);

  return view && view.id === mediaId && view.record === record ? view.media : undefined;
}

export async function uploadMediaFile(projectId: Id, file: File): Promise<{
  id: Id;
  kind: MediaKind;
}> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("请选择图片或视频文件");
  }
  const id = createId("med");
  const kind = kindFromMime(file.type);
  await putMedia({
    id,
    projectId,
    mimeType: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
    filename: file.name,
    blob: file,
  });
  return { id, kind };
}

export function pickMediaFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
