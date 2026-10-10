import {db} from "./database";
import {assertAudioClipDocument, changeAudioClipMembership} from "./audio";
import {assertAudioProject, assertOwnedAudioMedia, AUDIO_TRANSACTION_TABLES, ownedAudioRow, touchAudioProject, validateAudioMetadata} from "./audioShared";
import {AUDIO_ARRANGEMENT_LIMIT, AudioArrangementConflictError, type AudioArrangementOwner, type AudioArrangementProposal, type AudioArrangementReceipt, type AudioArrangementRequest, type AudioTakeChoice} from "@/domain/audioArrangement";
import {planAudioArrangement} from "@/lib/audio/arrangement";
import {createId, nowIso} from "@/lib/ids";
import {targetRevision} from "@/lib/productionRevision";

async function snapshot(projectId: string, chapterId: string) {
    await assertAudioProject(projectId, "audio");
    const chapter = await ownedAudioRow(db.audioChapters, projectId, chapterId);
    const [segments, takes, tracks, clips] = await Promise.all([
        db.audioSegments.where("chapterId").equals(chapterId).toArray(),
        db.audioTakes.where("projectId").equals(projectId).toArray(),
        db.audioTracks.where("chapterId").equals(chapterId).toArray(),
        db.audioClips.where("chapterId").equals(chapterId).toArray(),
    ]);
    const related = new Set([...takes.filter(take => segments.some(segment => segment.id === take.segmentId)).map(take => take.id), ...clips.map(clip => clip.takeId)]);
    const scopedTakes = takes.filter(take => related.has(take.id));
    const media = await db.media.bulkGet(scopedTakes.map(take => take.mediaId));
    const descriptors = media.map((row,index) => row ? {id: row.id, projectId: row.projectId, filename: row.filename, mimeType: row.mimeType, size: row.blob.size, type: row.blob.type} : {missing: scopedTakes[index].mediaId});
    const ordered = <T extends {id: string}>(rows: T[]) => rows.slice().sort((a,b) => a.id.localeCompare(b.id));
    const fingerprint = targetRevision({chapter, segments: ordered(segments), takes: ordered(scopedTakes), tracks: ordered(tracks), clips: ordered(clips), media: descriptors});
    return {chapter, segments, takes, tracks, clips, fingerprint};
}

function validateChoices(choices: AudioTakeChoice[]) {
    if (!choices.length || choices.length > AUDIO_ARRANGEMENT_LIMIT || new Set(choices.map(row => row.segmentId)).size !== choices.length) throw new Error("每次请选择 1–20 个不同段落");
}

/** Read-only preview, shared by Agent frozen approvals and the manual draft command. */
export async function previewAudioSelection(projectId: string, chapterId: string, choices: AudioTakeChoice[], owner: AudioArrangementOwner = {type: "manual"}, id = createId("aap")): Promise<AudioArrangementProposal> {
    return db.transaction("r", AUDIO_TRANSACTION_TABLES, async () => {
        validateChoices(choices);
        const state = await snapshot(projectId, chapterId);
        const selections = [];
        for (const choice of choices) {
            const segment = state.segments.find(row => row.id === choice.segmentId);
            const take = state.takes.find(row => row.id === choice.takeId);
            if (!segment || !take || segment.projectId !== projectId || take.projectId !== projectId || take.segmentId !== segment.id) throw new Error("声音版本不属于当前章节段落");
            if (segment.revision !== choice.segmentRevision || take.revision !== choice.takeRevision) throw new Error("段落或声音版本已更新，请重新预览");
            validateAudioMetadata(take);
            await assertOwnedAudioMedia(projectId, take.mediaId);
            selections.push({segment, take, textMismatch: take.textSnapshot !== undefined && take.textSnapshot !== segment.text});
        }
        const at = nowIso();
        return {id, projectId, chapterId, revision: 1, createdAt: at, updatedAt: at, kind: "selection", state: "prepared", owner, fingerprint: state.fingerprint, choices, selections, items: [], before: state.clips};
    });
}

export async function previewAudioArrangement(projectId: string, chapterId: string, request: AudioArrangementRequest, owner: AudioArrangementOwner = {type: "manual"}, id = createId("aap")): Promise<AudioArrangementProposal> {
    return db.transaction("r", AUDIO_TRANSACTION_TABLES, async () => {
        const state = await snapshot(projectId, chapterId);
        const at = nowIso();
        const items = planAudioArrangement({projectId, chapterId, proposalId: id, at, request, ...state});
        for (const item of items) {
            const take = state.takes.find(row => row.id === item.takeId)!;
            validateAudioMetadata(take);
            await assertOwnedAudioMedia(projectId, take.mediaId);
        }
        return {id, projectId, chapterId, revision: 1, createdAt: at, updatedAt: at, kind: "arrangement", state: "prepared", owner, fingerprint: state.fingerprint, choices: [], request, selections: [], items, before: state.clips};
    });
}

export async function saveAudioArrangementProposal(proposal: AudioArrangementProposal): Promise<AudioArrangementProposal> {
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
        if ((await snapshot(proposal.projectId, proposal.chapterId)).fingerprint !== proposal.fingerprint) throw new AudioArrangementConflictError("snapshot_changed", "预览内容已改变，请重新预览");
        if (proposal.state !== "prepared" || proposal.dormant || proposal.receipt) throw new Error("只能保存新的本地预览");
        await db.audioArrangementProposals.add(proposal);
        return proposal;
    });
}

export async function readAudioArrangementProposal(projectId: string, id: string) {
    return db.transaction("r", AUDIO_TRANSACTION_TABLES, async () => {
        await assertAudioProject(projectId,"audio");
        return ownedAudioRow(db.audioArrangementProposals, projectId, id);
    });
}

function assertOwner(proposal: AudioArrangementProposal, owner: AudioArrangementOwner) {
    if (proposal.dormant || targetRevision(proposal.owner) !== targetRevision(owner)) throw new Error("导入历史或其他执行的预览不能批准应用");
}

export async function applyAudioArrangementProposal(projectId: string, id: string, revision: number, owner: AudioArrangementOwner = {type: "manual"}, signal?: AbortSignal): Promise<AudioArrangementReceipt> {
    signal?.throwIfAborted();
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
        signal?.throwIfAborted();
        await assertAudioProject(projectId,"audio");
        const proposal = await ownedAudioRow(db.audioArrangementProposals, projectId, id);
        await ownedAudioRow(db.audioChapters, projectId, proposal.chapterId);
        assertOwner(proposal, owner);
        if (proposal.state === "applied" && proposal.receipt) {
            const current = await db.audioClips.bulkGet(proposal.receipt.added.map(row => row.id));
            return {...proposal.receipt, replayed: true, currentAddedIds: current.filter(row => row?.projectId === projectId && row.chapterId === proposal.chapterId).map(row => row!.id)};
        }
        if (proposal.revision !== revision || proposal.state !== "prepared") throw new AudioArrangementConflictError("proposal_changed", "预览已更新，请重新确认");
        const state = await snapshot(projectId, proposal.chapterId);
        if (state.fingerprint !== proposal.fingerprint) throw new AudioArrangementConflictError("snapshot_changed", "章节、声音或时间线已改变，请重新预览并确认");
        const selected = [];
        for (const item of proposal.selections) {
            const segment = state.segments.find(row => row.id === item.segment.id)!;
            if (segment.selectedTakeId !== item.take.id) {
                const next = {...segment, selectedTakeId: item.take.id, revision: segment.revision + 1, updatedAt: nowIso()};
                await db.audioSegments.put(next);
                selected.push(next);
            }
        }
        const added = proposal.items.flatMap(item => item.status === "add" && item.clip ? [item.clip] : []);
        const after = proposal.kind === "arrangement" ? await changeAudioClipMembership(projectId, proposal.chapterId, proposal.before, [...proposal.before, ...added]) : state.clips;
        const receipt: AudioArrangementReceipt = {proposalId: id, projectId, kind: proposal.kind, selected, added, preserved: proposal.items.filter(item => item.status !== "add").length, conflicts: proposal.items.filter(item => item.status === "manual_conflict").length, before: state.clips, after};
        signal?.throwIfAborted();
        await db.audioArrangementProposals.put({...proposal, state: "applied", receipt, revision: proposal.revision + 1, updatedAt: nowIso()});
        if (selected.length) await touchAudioProject(projectId);
        return receipt;
    });
}

/** Durable reviewed inverse for Agent and reload; never changes version selection. */
export async function revertAudioArrangementProposal(projectId: string, id: string, revision: number, signal?: AbortSignal): Promise<string[]> {
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
        signal?.throwIfAborted();
        await assertAudioProject(projectId,"audio");
        const proposal = await ownedAudioRow(db.audioArrangementProposals,projectId,id);
        if (proposal.dormant || proposal.kind !== "arrangement" || proposal.state !== "applied" || !proposal.receipt || proposal.revision !== revision || proposal.reverted) throw new Error("此排列不能撤销，请刷新后检查");
        await assertAudioClipDocument(projectId, proposal.chapterId, proposal.receipt.after);
        await changeAudioClipMembership(projectId, proposal.chapterId, proposal.receipt.after, proposal.receipt.before);
        await db.audioArrangementProposals.put({...proposal, reverted: true, revision: proposal.revision + 1, updatedAt: nowIso()});
        signal?.throwIfAborted();
        return proposal.receipt.added.map(row => row.id);
    });
}
