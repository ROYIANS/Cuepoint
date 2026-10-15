import {useEffect, useRef, useState} from "react";
import {useProductQuery} from "./storage/hooks";
import {binaryAvailability, binaryCacheIdentity} from "./storage/binary";
import type {Shot} from "../domain/types";
import {type ShotBinaryState, type ShotMediaIndex, verifiedShotMediaIndex} from "./shotMedia";

/** Only referenced result metadata is subscribed; file bytes remain native. */
export function useShotMedia(shots: Shot[] | undefined): ShotMediaIndex | undefined {
    const idsKey = JSON.stringify([...new Set((shots ?? []).flatMap(shot =>
        [shot.firstFrame, shot.lastFrame, shot.clip].flatMap(slot => slot.result ? [slot.result.mediaId] : []),
    ))].sort());
    const result = useProductQuery(async db => {
        const rows = await db.media.bulkGet(JSON.parse(idsKey) as string[]);
        return {idsKey, media: new Map(rows.flatMap(row => row ? [[row.id, row] as const] : []))};
    }, [idsKey]);
    const [revision, setRevision] = useState(0);
    const [checked, setChecked] = useState<{ source: typeof result; media: ShotMediaIndex }>();
    const cache = useRef(new Map<string, { state: ShotBinaryState; expires: number }>());
    useEffect(() => {
        if (!result || result.idsKey !== idsKey) return;
        setChecked(undefined);
        const controller = new AbortController();
        void (async () => {
            const states = new Map<string, ShotBinaryState>();
            for (const row of result.media.values()) {
                controller.signal.throwIfAborted();
                if (row.blob instanceof Blob) {
                    states.set(row.id, "ready");
                    continue;
                }
                let state: ShotBinaryState;
                try {
                    const key = await binaryCacheIdentity(row.blob);
                    const previous = cache.current.get(key);
                    if (previous && previous.expires > Date.now()) state = previous.state;
                    else {
                        state = await binaryAvailability(row.blob, controller.signal);
                        cache.current.set(key, {state, expires: Date.now() + 10_000});
                    }
                } catch {
                    controller.signal.throwIfAborted();
                    state = "error";
                }
                states.set(row.id, state);
            }
            if (!controller.signal.aborted) setChecked({
                source: result,
                media: verifiedShotMediaIndex(result.media, states)
            });
        })().catch(() => { /* Cleanup cancels an obsolete availability snapshot. */
        });
        return () => controller.abort();
    }, [result, idsKey, revision]);
    useEffect(() => {
        const refresh = () => {
            cache.current.clear();
            setRevision(value => value + 1);
        };
        window.addEventListener("focus", refresh);
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", refresh);
        return () => {
            window.removeEventListener("focus", refresh);
            if (typeof document !== "undefined") document.removeEventListener("visibilitychange", refresh);
        };
    }, []);
    return result?.idsKey === idsKey && checked?.source === result ? checked.media : undefined;
}
