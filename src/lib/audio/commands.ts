import type {AudioClip, AudioPatch} from "@/domain/audio";
import {changeAudioClipMembership, getAudioProjectSnapshot, replaceAudioClips} from "@/db/audio";
import type {AudioArrangementReceipt} from "@/domain/audioArrangement";
import {createId} from "@/lib/ids";

type ClipHistoryEntry = { before: AudioClip[]; after: AudioClip[]; membershipOnly?: boolean };

function sameRevision(left: AudioClip[], right: AudioClip[]) {
    const revisions = new Map(left.map((clip) => [clip.id, clip.revision]));
    return left.length === right.length && right.every((clip) => revisions.get(clip.id) === clip.revision);
}

/** No source bytes are copied or cut. The source offset remains absolute. */
export function splitAudioClip(clip: AudioClip, absoluteTime: number, rightId = createId("acl")): [AudioClip, AudioClip] {
    const position = absoluteTime - clip.startSec;
    const duration = clip.trimEndSec - clip.trimStartSec;
    if (!Number.isFinite(position) || position <= 0 || position >= duration) throw new Error("分割点必须位于片段内部");
    // This domain has edge fades, not arbitrary automation. Avoid changing audible
    // output by silently restarting a partly completed fade on the right half.
    if (position < clip.fadeInSec || position > duration - clip.fadeOutSec) throw new Error("请将分割点移出淡入淡出区间，或先调整淡入淡出");
    return [
        {...clip, trimEndSec: clip.trimStartSec + position, fadeOutSec: 0},
        {...clip, id: rightId, startSec: absoluteTime, trimStartSec: clip.trimStartSec + position, fadeInSec: 0},
    ];
}

/** Ephemeral chapter history; every apply/undo/redo verifies the persisted revision. */
export class AudioClipHistory {
    private undoStack: ClipHistoryEntry[] = [];
    private redoStack: ClipHistoryEntry[] = [];
    private expected: AudioClip[] | undefined;
    private busy = false;

    constructor(private readonly projectId: string, private readonly chapterId: string, private readonly onChange?: () => void) {
    }

    get canUndo() {
        return !this.busy && this.undoStack.length > 0;
    }

    get canRedo() {
        return !this.busy && this.redoStack.length > 0;
    }

    executePatch(clip: AudioClip, patch: AudioPatch<AudioClip>) {
        return this.execute(clip, (rows) => rows.map((row) => row.id === clip.id ? {...row, ...patch} : row));
    }

    split(clip: AudioClip, absoluteTime: number) {
        return this.execute(clip, (rows) => rows.flatMap((row) => row.id === clip.id ? splitAudioClip(row, absoluteTime) : [row]));
    }

    duplicate(clip: AudioClip): Promise<AudioClip[]> {
        return this.execute(clip, (rows) => {
            const source = rows.find((row) => row.id === clip.id)!;
            return [...rows, {
                ...source,
                id: createId("acl"),
                startSec: source.startSec + source.trimEndSec - source.trimStartSec
            }];
        });
    }

    remove(clip: AudioClip) {
        return this.execute(clip, (rows) => rows.filter((row) => row.id !== clip.id));
    }

    /** Apply and record one reviewed insertion group using its actual repository receipt. */
    async applyArrangement(operation: () => Promise<AudioArrangementReceipt>) {
        return this.exclusive(async () => {
            const receipt = await operation();
            if (receipt.projectId !== this.projectId || receipt.kind !== "arrangement" || receipt.after.some(row => row.chapterId !== this.chapterId)) throw new Error("排列不属于当前章节");
            if (receipt.replayed || !receipt.added.length) return receipt;
            if (this.expected && !sameRevision(this.expected, receipt.before)) this.undoStack = [];
            this.undoStack.push({before: receipt.before, after: receipt.after, membershipOnly: true});
            if (this.undoStack.length > 50) this.undoStack.shift();
            this.redoStack = [];
            this.expected = receipt.after;
            return receipt;
        });
    }

    async undo() {
        return this.exclusive(async () => {
            const entry = this.undoStack.at(-1);
            if (!entry || !this.expected) return false;
            const restored = await this.restore(entry, entry.before);
            this.undoStack.pop();
            this.redoStack.push(entry);
            this.expected = restored;
            return true;
        });
    }

    async redo() {
        return this.exclusive(async () => {
            const entry = this.redoStack.at(-1);
            if (!entry || !this.expected) return false;
            const restored = await this.restore(entry, entry.after);
            this.redoStack.pop();
            this.undoStack.push(entry);
            this.expected = restored;
            return true;
        });
    }

    private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
        if (this.busy) throw new Error("请等待当前编辑保存完成");
        this.busy = true;
        this.onChange?.();
        try {
            return await operation();
        } finally {
            this.busy = false;
            this.onChange?.();
        }
    }

    private restore(entry: ClipHistoryEntry, desired: AudioClip[]) {
        const expected = this.expected!;
        if (!entry.membershipOnly) return replaceAudioClips(this.projectId, this.chapterId, expected, desired);
        // Prior manual-command undo may advance revisions; retained rows stay exactly current.
        const next = desired.map(row => expected.find(current => current.id === row.id) ?? row);
        return changeAudioClipMembership(this.projectId, this.chapterId, expected, next);
    }

    private async execute(clip: AudioClip, transform: (current: AudioClip[]) => AudioClip[]) {
        return this.exclusive(async () => {
            if (clip.projectId !== this.projectId || clip.chapterId !== this.chapterId) throw new Error("片段不属于当前章节");
            const snapshot = await getAudioProjectSnapshot(this.projectId);
            const before = snapshot.clips.filter((row) => row.chapterId === this.chapterId);
            if (before.find((row) => row.id === clip.id)?.revision !== clip.revision) throw new Error("片段已更新，请刷新后重试");
            if (this.expected && !sameRevision(this.expected, before)) {
                // A new edit can begin after an external change, but old history cannot
                // absorb that change and subsequently overwrite it.
                this.undoStack = [];
                this.redoStack = [];
            }
            const after = await replaceAudioClips(this.projectId, this.chapterId, before, transform(before));
            this.undoStack.push({before, after});
            if (this.undoStack.length > 50) this.undoStack.shift();
            this.redoStack = [];
            this.expected = after;
            return after;
        });
    }
}
