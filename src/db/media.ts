import {type GenerationSlot, type Id, type MediaRecord} from "@/domain/types";
import {db} from "./database";
import {collectSlotsMedia, SHOT_PICTURE_FIELDS, slotMediaIds} from "@/domain/slot";
import {assertProjectOwner, PRODUCTION_TABLES, touchProject} from "./productionShared";

export async function collectMediaIds(projectId?: Id): Promise<Set<Id>> {
    const [projects, characters, scenes, props, styles, shots, references, materialUses, retainedMedia] = await Promise.all([
        projectId === undefined ? db.projects.toArray() : db.projects.where("id").equals(projectId).toArray(),
        (projectId === undefined ? db.characters : db.characters.where("projectId").equals(projectId)).toArray(),
        (projectId === undefined ? db.scenes : db.scenes.where("projectId").equals(projectId)).toArray(),
        (projectId === undefined ? db.props : db.props.where("projectId").equals(projectId)).toArray(),
        (projectId === undefined ? db.styles : db.styles.where("projectId").equals(projectId)).toArray(),
        (projectId === undefined ? db.shots : db.shots.where("projectId").equals(projectId)).toArray(),
        (projectId === undefined ? db.projectReferences : db.projectReferences.where("projectId").equals(projectId)).toArray(),
        (projectId === undefined ? db.materialUses : db.materialUses.where("projectId").equals(projectId)).toArray(),
        (projectId === undefined ? db.media : db.media.where("projectId").equals(projectId)).filter((media) => media.libraryRetained === true).toArray(),
    ]);
    const ids = new Set<Id>();
    for (const table of [db.audioTakes, db.musicWorks, db.audioExports]) {
        const rows = await (projectId === undefined ? table : table.where("projectId").equals(projectId)).toArray();
        for (const row of rows) ids.add(row.mediaId);
    }
    const audioJobs = await (projectId === undefined ? db.audioGenerationJobs : db.audioGenerationJobs.where("projectId").equals(projectId)).toArray();
    for (const job of audioJobs) {
        if (job.input.kind === "speech" && job.input.mimo?.referenceMediaId) ids.add(job.input.mimo.referenceMediaId);
        for (const result of job.results) if (result.mediaId) ids.add(result.mediaId);
    }
    const speakers = await (projectId === undefined ? db.audioSpeakers : db.audioSpeakers.where("projectId").equals(projectId)).toArray();
    for (const speaker of speakers) if (speaker.mimo?.referenceMediaId) ids.add(speaker.mimo.referenceMediaId);
    const audioItems = await (projectId === undefined ? db.audioGenerationBatchItems : db.audioGenerationBatchItems.where("projectId").equals(projectId)).toArray();
    for (const item of audioItems) if (item.snapshot.input.mimo?.referenceMediaId) ids.add(item.snapshot.input.mimo.referenceMediaId);
    for (const use of materialUses) for (const mediaId of use.mediaIds) ids.add(mediaId);
    for (const media of retainedMedia) ids.add(media.id);
    for (const reference of references) if (reference.status !== "unavailable") ids.add(reference.mediaId);
    for (const project of projects) if (project.coverMediaId) ids.add(project.coverMediaId);
    for (const mediaId of collectSlotsMedia([
        ...characters.flatMap((character) => Object.values(character.slots ?? {})),
        ...scenes.flatMap((scene) => Object.values(scene.slots ?? {})),
        ...props.flatMap((prop) => Object.values(prop.slots ?? {})),
        ...styles.flatMap((style) => Object.values(style.slots ?? {})),
        ...shots.flatMap((shot) => SHOT_PICTURE_FIELDS.map((field) => shot[field])),
    ])) {
        ids.add(mediaId);
    }
    return ids;
}

export async function recycleSlotMedia(
    previous: GenerationSlot | undefined,
    next: GenerationSlot | undefined,
): Promise<void> {
    const kept = new Set(slotMediaIds(next));
    await deleteMediaIfOrphans(slotMediaIds(previous).filter((mediaId) => !kept.has(mediaId)));
}

export async function putMedia(record: MediaRecord): Promise<Id> {
    return db.transaction("rw", db.media, db.projects, async () => {
        await assertProjectOwner(record.projectId);
        // Physical replacement is a new record; immutable IDs keep pending previews valid.
        await db.media.add(record);
        await touchProject(record.projectId);
        return record.id;
    });
}

/** Fresh history snapshot for one candidate owner, including cancelled/undone outcomes. */
async function collectHistoryMediaIds(projectId: Id): Promise<Set<Id>> {
    const [proposals, jobs, batches, items] = await Promise.all([
        db.productionProposals.where("projectId").equals(projectId).toArray(),
        db.agentGenerationJobs.where("projectId").equals(projectId).toArray(),
        db.agentGenerationBatches.where("projectId").equals(projectId).toArray(),
        db.agentGenerationBatchItems.where("projectId").equals(projectId).toArray(),
    ]);
    const ids = new Set<Id>();
    for (const proposal of proposals) {
        if (proposal.before.result) ids.add(proposal.before.result.mediaId);
        if (proposal.change.kind === "slot-result") ids.add(proposal.change.result.mediaId);
    }
    for (const job of jobs) {
        if (job.result) ids.add(job.result.mediaId);
        for (const input of job.inputs) ids.add(input.mediaId);
    }
    for (const batch of batches) for (const application of batch.applications) {
        if (application.before) ids.add(application.before.mediaId);
        ids.add(application.result.mediaId);
    }
    for (const item of items) for (const input of item.draft.inputs) ids.add(input.mediaId);
    return ids;
}

/** Call after all owner/history/flag changes; never reuse this snapshot across operations. */
export async function deleteMediaIfOrphans(mediaIds: readonly (Id | undefined)[]): Promise<void> {
    const candidates = [...new Set(mediaIds.filter((id): id is Id => !!id))];
    if (!candidates.length) return;
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const records = (await db.media.bulkGet(candidates)).filter((record): record is MediaRecord => record !== undefined);
        if (!records.length) return;
        const used = await collectMediaIds();
        // History belongs to each candidate record's owner; current references remain global.
        const histories = new Map<Id, Set<Id>>();
        for (const projectId of new Set(records.map((record) => record.projectId))) {
            histories.set(projectId, await collectHistoryMediaIds(projectId));
        }
        for (const record of records) {
            if (!used.has(record.id) && !histories.get(record.projectId)?.has(record.id)) {
                await db.media.delete(record.id);
            }
        }
    });
}

export async function deleteMediaIfOrphan(mediaId: Id | undefined): Promise<void> {
    await deleteMediaIfOrphans([mediaId]);
}

export async function assertSlotMedia(projectId: Id, slot: GenerationSlot, allowVideoResult = false): Promise<void> {
    if (slot.result && slot.result.kind !== "image" && !(allowVideoResult && slot.result.kind === "video")) {
        throw new Error("素材结果类型不适用于当前槽位");
    }
    const expected = [
        ...slot.referenceImageIds.map((id) => ({id, kind: "image" as const})),
        ...slot.referenceVideoIds.map((id) => ({id, kind: "video" as const})),
        ...(slot.result ? [{id: slot.result.mediaId, kind: slot.result.kind}] : []),
    ];
    for (const {id, kind} of expected) {
        const media = await db.media.get(id);
        if (!media || media.projectId !== projectId || media.blob.size === 0 || !media.mimeType.startsWith(`${kind}/`)) {
            throw new Error("素材已失效、类型不符或不属于当前项目，请重新选择");
        }
    }
}
