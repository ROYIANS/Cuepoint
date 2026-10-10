import type {Table} from "dexie";
import {db} from "@/db/database";
import {emptyCharacter, emptyScene, emptyProp, emptyStyle, emptyProject, emptyShot} from "@/db/productionRecords";
import {emptySlot, SHOT_PICTURE_FIELDS} from "@/domain/slot";
import type {GenerationResult, GenerationSlot, MediaRecord} from "@/domain/types";
import type {AgentGenerationJob} from "@/domain/agentGeneration";
import type {GenerationBatch, GenerationBatchItem, GenerationSnapshot} from "@/domain/agentGenerationBatch";
import type {ProductionProposal} from "@/domain/production";
import type {GenerationSubmitArgs} from "@/lib/agent/generationProfiles";

export const at = "2026-10-09T00:00:00.000Z";
export function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const result = (mediaId: string): GenerationResult => ({kind: "image" as const, mediaId});
export const slot = (ids: string[]): GenerationSlot => ({...emptySlot(), referenceImageIds: ids, result: ids[0] ? result(ids[0]) : undefined});
export const media = (id: string, projectId: string, libraryRetained = false): MediaRecord => ({id, projectId, filename: `${id}.png`, mimeType: "image/png", blob: new Blob([`actual bytes ${id}`], {type: "image/png"}), libraryRetained});
export const target = (projectId: string) => ({kind: "character" as const, projectId, entityId: "deleted-target", slot: "front" as const});
export function job(id: string, projectId: string): AgentGenerationJob {
    return {version: 1, id, projectId, threadId: "deleted-thread", runId: "deleted-run", callId: `call-${id}`, connectorId: "local-fixture", provider: "apimart" as const, baseUrl: "https://fixture.invalid", model: "gpt-image-2", kind: "image" as const, target: target(projectId), baseRevision: "old", sourceRevisions: [], parameters: {}, inputs: [], fingerprint: id, status: "failed" as const, createdAt: at, updatedAt: at};
}
export function batch(id: string, projectId: string): GenerationBatch {
    return {version: 1, id, projectId, threadId: "deleted-thread", runId: "deleted-run", originCallId: "deleted-call", title: "cancelled", revision: 1, status: "cancelled", itemIds: [], confirmedItemIds: [], entityRevisions: {}, selections: {}, applications: [], createdAt: at, updatedAt: at};
}
export function proposal(id: string, projectId: string): ProductionProposal {
    return {id, projectId, target: target(projectId), change: {kind: "shot-text", patch: {}}, before: {}, baseRevision: "old", source: {kind: "manual" as const}, status: "undone", createdAt: at, updatedAt: at};
}
export function item(id: string, projectId: string): GenerationBatchItem {
    const draft: GenerationSubmitArgs = {connectorId: "fixture", model: "gpt-image-2", target: target(projectId), prompt: "local", parameters: {}, inputs: []};
    const baseline: GenerationSnapshot = job(id, projectId);
    return {id, projectId, batchId: "deleted-batch", threadId: "deleted-thread", order: 0, targetKey: "missing", label: "cancelled", proposal: draft, draft, included: false, state: "cancelled", baseline, createdAt: at, updatedAt: at};
}
export interface RetentionSource {
    name: string; table: string; retains: boolean; history: boolean;
    put(mediaId: string, projectId: string): Promise<() => Promise<void>>;
}
function source<T extends {id: string}>(name: string, table: Table<T, string>, build: (mediaId: string, projectId: string) => NoInfer<T>, retains = true, history = false): RetentionSource {
    return {name, table: table.name, retains, history, async put(mediaId, projectId) {
        const row = build(mediaId, projectId); await table.put(row);
        return async () => {await table.delete(row.id);};
    }};
}
const row = (id: string, projectId: string) => ({id: `source-${id}`, projectId, revision: 1, createdAt: at, updatedAt: at});
const sample = (referenceMediaId: string) => ({mode: "clone" as const, instruction: "unused sample", referenceMediaId});
export const historySources: RetentionSource[] = [
    source("proposal before", db.productionProposals, (id, owner) => ({...proposal(`p-${id}`, owner), before: {result: result(id)}}), true, true),
    source("proposal change", db.productionProposals, (id, owner) => ({...proposal(`p-${id}`, owner), change: {kind: "slot-result" as const, result: result(id)}}), true, true),
    source("job input", db.agentGenerationJobs, (id, owner) => ({...job(`j-${id}`, owner), inputs: [{mediaId: id, role: "reference-image" as const, revision: "old"}]}), true, true),
    source("job result", db.agentGenerationJobs, (id, owner) => ({...job(`j-${id}`, owner), result: result(id)}), true, true),
    ...["before", "result"].map(field => source(`batch ${field}`, db.agentGenerationBatches, (id, owner) => ({...batch(`b-${id}`, owner), applications: [{itemId: "deleted", jobId: "deleted", targetKey: "missing", baseline: "old", beforeRevision: "old", afterRevision: "old", at, result: result(field === "result" ? id : "missing-result"), ...(field === "before" ? {before: result(id)} : {})}]}), true, true)),
    source("item draft input", db.agentGenerationBatchItems, (id, owner) => ({...item(`i-${id}`, owner), draft: {...item(`i-${id}`, owner).draft, inputs: [{mediaId: id, role: "reference-image" as const}]}}), true, true),
];
export const currentSources: RetentionSource[] = [
    source("archived cover", db.projects, (id, owner) => ({...emptyProject("archived"), id: owner, archivedAt: at, coverMediaId: id})),
    ...["image reference", "video reference", "result"].flatMap(field => {
        const one = (id: string): GenerationSlot => ({...emptySlot(), ...(field === "result" ? {result: result(id)} : field === "image reference" ? {referenceImageIds: [id]} : {referenceVideoIds: [id]})});
        return [
            source(`character ${field}`, db.characters, (id, owner) => ({...emptyCharacter(owner), id: `source-${id}`, slots: {front: one(id)}})),
            source(`scene ${field}`, db.scenes, (id, owner) => ({...emptyScene(owner), id: `source-${id}`, slots: {wide: one(id)}})),
            source(`prop ${field}`, db.props, (id, owner) => ({...emptyProp(owner), id: `source-${id}`, slots: {hero: one(id)}})),
            source(`style ${field}`, db.styles, (id, owner) => ({...emptyStyle(owner), id: `source-${id}`, slots: {look: one(id)}})),
            ...SHOT_PICTURE_FIELDS.map(picture => source(`shot ${picture} ${field}`, db.shots, (id, owner) => ({...emptyShot(owner, "deleted-episode", 0, "1", 5), id: `source-${id}`, [picture]: one(id)}))),
        ];
    }),
    ...(["parsing", "ready", "partial", "failed", "unavailable"] as const).map(status => source(`reference ${status}`, db.projectReferences, (id, owner) => ({...row(id, owner), mediaId: id, digest: "fixture", kind: "image" as const, filename: "local.png", mimeType: "image/png", size: 1, status, operationId: "fixture", coverage: {totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: 0, truncated: false}, warnings: []}), status !== "unavailable")),
    source("superseded material use", db.materialUses, (id, owner) => ({...row(id, owner), materialId: "missing-material", targetKind: "media" as const, targetId: "irrelevant-target", mediaIds: [id], supersededBy: "later-use"})),
    {name: "library retained only", table: "media", retains: true, history: false, async put(id) {await db.media.update(id, {libraryRetained: true}); return async () => {await db.media.update(id, {libraryRetained: false});};}},
    source("unplaced audio take", db.audioTakes, (id, owner) => ({...row(id, owner), mediaId: id, name: "unplaced", source: "upload" as const, durationSec: 1, sampleRate: 24000, channels: 1})),
    source("unselected music work", db.musicWorks, (id, owner) => ({...row(id, owner), mediaId: id, title: "unselected", notes: "", lyrics: "", favorite: false, durationSec: 1, sampleRate: 24000, channels: 1})),
    source("old audio export", db.audioExports, (id, owner) => ({...row(id, owner), mediaId: id, fingerprint: "stale", format: "wav" as const, durationSec: 1})),
    source("dormant deleted audio result", db.audioGenerationJobs, (id, owner) => ({...row(id, owner), intentId: "old", connector: {id: "missing", provider: "apimart" as const, baseUrl: "https://fixture.invalid"}, input: {kind: "speech" as const, text: "", voice: "", speed: 1}, source: {kind: "manual" as const}, status: "failed" as const, taskIds: [], dormant: true, results: [{key: "deleted", title: "old", deleted: true, mediaId: id, provenance: {provider: "apimart" as const, model: "fixture"}}]})),
    source("speech job sample", db.audioGenerationJobs, (id, owner) => ({...row(id, owner), intentId: "old", connector: {id: "missing", provider: "mimo" as const, baseUrl: "https://fixture.invalid"}, input: {kind: "speech" as const, text: "", voice: "", speed: 1, mimo: sample(id)}, source: {kind: "manual" as const}, status: "failed" as const, taskIds: [], dormant: true, results: []})),
    source("unused speaker sample", db.audioSpeakers, (id, owner) => ({...row(id, owner), name: "unused", mimo: sample(id)})),
];
// Additive v24 reference owner. Keep the original current/history lists intact
// so historical scalar parity and their scan counts remain explicit controls.
const audioBatchSources: RetentionSource[] = [
    source("audio batch clone sample", db.audioGenerationBatchItems, (id, owner) => ({
        ...row(id, owner), batchId: "cancelled-audio-batch", chapterId: "deleted-chapter", segmentId: "deleted-segment",
        order: 0, included: false, state: "cancelled" as const, intentId: `batch-intent-${id}`,
        snapshot: {input: {kind: "speech" as const, text: "historical", voice: "mimo_default", speed: 1, mimo: sample(id)},
            connector: {id: "missing", provider: "mimo" as const, baseUrl: "https://fixture.invalid"}, fingerprint: "historical"}
    })),
];
export const retentionSources = [...currentSources, ...historySources, ...audioBatchSources];
