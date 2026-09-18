import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Shot } from "@/domain/types";
import type { ShotMediaIndex } from "@/lib/shotMedia";

/** Subscribe only to result media used by this episode, not the whole library. */
export function useShotMedia(shots: Shot[] | undefined): ShotMediaIndex | undefined {
  const idsKey = JSON.stringify([...new Set((shots ?? []).flatMap((shot) =>
    [shot.firstFrame, shot.lastFrame, shot.clip]
      .flatMap((slot) => slot.result ? [slot.result.mediaId] : []),
  ))].sort());
  const result = useLiveQuery(async () => {
    const rows = await db.media.bulkGet(JSON.parse(idsKey) as string[]);
    return { idsKey, media: new Map(rows.flatMap((row) => row ? [[row.id, row] as const] : [])) };
  }, [idsKey]);
  // Live queries retain their previous value while dependencies change. Do not
  // let gap filters or reveal-shot navigation treat a stale collection as loaded.
  return result?.idsKey === idsKey ? result.media : undefined;
}
