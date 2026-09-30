import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {
    addCharacter, addProp, addScene, addShot, addStyle, copyStudioCharacter, copyStudioProp,
    copyStudioScene, copyStudioStyle, createProject, patchCharacter, patchProjectOutput,
    patchProp, patchScene, patchShot, patchStyle, putMedia, setCharacterSlot, setPropSlot,
    setSceneSlot, setShotSlot, setStyleSlot, PRODUCTION_TABLES,
} from "@/db/repo";
import {applyProductionProposal, createProductionProposal, undoProductionProposal} from "@/db/productionProposals";
import {emptySlot} from "@/domain/slot";
import {STUDIO_LIBRARY_ID} from "@/domain/types";
import type {GenerationSlot, MediaKind} from "@/domain/types";
import type {AgentGenerationJob} from "@/domain/agentGeneration";
import type {GenerationBatch} from "@/domain/agentGenerationBatch";
import {DraftConflictError} from "@/lib/draftConflict";

const assetApis = [
    {kind: "character", add: addCharacter, patch: patchCharacter, copy: copyStudioCharacter,
        set: (id: string, slot: GenerationSlot, baseline?: GenerationSlot) => setCharacterSlot(id, "front", slot, baseline)},
    {kind: "scene", add: addScene, patch: patchScene, copy: copyStudioScene,
        set: (id: string, slot: GenerationSlot, baseline?: GenerationSlot) => setSceneSlot(id, "wide", slot, baseline)},
    {kind: "prop", add: addProp, patch: patchProp, copy: copyStudioProp,
        set: (id: string, slot: GenerationSlot, baseline?: GenerationSlot) => setPropSlot(id, "hero", slot, baseline)},
    {kind: "style", add: addStyle, patch: patchStyle, copy: copyStudioStyle,
        set: (id: string, slot: GenerationSlot, baseline?: GenerationSlot) => setStyleSlot(id, "look", slot, baseline)},
] as const;
async function fixture() {
    const project = await createProject("media boundaries");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shot = await addShot(project.id, episode.id);
    return {project, episode, shot};
}
async function media(projectId: string, id: string, mimeType = "image/png", bytes = "pixels") {
    await putMedia({id, projectId, mimeType, filename: id, blob: new Blob([bytes], {type: mimeType})});
    return id;
}
function resultSlot(mediaId: string, kind: MediaKind = "image"): GenerationSlot {
    return {...emptySlot(), result: {mediaId, kind}};
}
async function snapshot() {
    return db.transaction("r", PRODUCTION_TABLES, async () => {
        const tables = await Promise.all(PRODUCTION_TABLES.map(async table => {
            const rows = await table.toArray();
            return {name: table.name, rows: await Promise.all(rows.map(async row => {
                if (!("blob" in row)) return row;
                return {...row, blob: {type: row.blob.type, bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer()))}};
            }))};
        }));
        return tables;
    });
}
afterEach(() => vi.restoreAllMocks());

// Wider variables model JavaScript/dynamic callers without hiding the narrowed API behind casts.
describe("generic patches explicitly reject media fields", () => {
    it.each(assetApis)("$kind rejects slots including own undefined without partial text writes", async api => {
        const {project} = await fixture();
        const asset = await api.add(project.id);
        const id = await media(project.id, "owned");
        const before = await snapshot();
        for (const slots of [{front: resultSlot(id)}, undefined]) {
            const patch = {notes: "must roll back", slots};
            await expect(api.patch(asset.id, patch)).rejects.toThrow("专用槽位");
            expect(await snapshot()).toEqual(before);
        }
        await api.patch(asset.id, {notes: "saved", extra: {nested: {kept: true}}}, {notes: asset.notes});
        await expect(api.patch(asset.id, {notes: "stale"}, {notes: asset.notes})).rejects.toBeInstanceOf(DraftConflictError);
    });
    it.each(["firstFrame", "lastFrame", "clip"])("shot rejects %s including own undefined", async field => {
        const {shot, project} = await fixture();
        const id = await media(project.id, "owned");
        const before = await snapshot();
        for (const value of [resultSlot(id), undefined]) {
            const patch = {notes: "must roll back", [field]: value};
            await expect(patchShot(shot.id, patch)).rejects.toThrow("专用槽位");
            expect(await snapshot()).toEqual(before);
        }
    });
    it("preserves text, relationships, extra and field baselines", async () => {
        const {project, episode, shot} = await fixture();
        const character = await addCharacter(project.id), scene = await addScene(project.id);
        const prop = await addProp(project.id), style = await addStyle(project.id);
        await patchShot(shot.id, {notes: "saved", durationSec: 6, characterIds: [character.id], sceneId: scene.id,
            propIds: [prop.id], styleId: style.id, beatId: undefined, extra: {nested: {kept: true}}}, shot);
        const stored = await db.shots.get(shot.id);
        expect(stored).toMatchObject({episodeId: episode.id, notes: "saved", durationSec: 6,
            characterIds: [character.id], sceneId: scene.id, propIds: [prop.id], styleId: style.id, extra: {nested: {kept: true}}});
        await expect(patchShot(shot.id, {notes: "stale"}, {notes: shot.notes})).rejects.toBeInstanceOf(DraftConflictError);
        expect(await db.shots.get(shot.id)).toEqual(stored);
        await patchShot(shot.id, {styleId: null, propIds: []});
        expect(await db.shots.get(shot.id)).toMatchObject({styleId: null, propIds: []});
    });
});

const invalidCases = ["foreign", "missing", "empty", "wrong MIME", "wrong declared kind", "bad image reference", "bad video reference"];
async function invalidSlot(owner: string, problem: string) {
    if (problem === "foreign") return resultSlot(await media((await createProject("other")).id, "invalid"));
    if (problem === "missing") return resultSlot("missing");
    if (problem === "empty") return resultSlot(await media(owner, "invalid", "image/png", ""));
    if (problem === "wrong MIME") return resultSlot(await media(owner, "invalid", "audio/wav"));
    if (problem === "wrong declared kind") return resultSlot(await media(owner, "invalid", "video/mp4"));
    if (problem === "bad image reference") return {...emptySlot(), referenceImageIds: [await media(owner, "invalid", "video/mp4")]};
    return {...emptySlot(), referenceVideoIds: [await media(owner, "invalid")]};
}
describe("dedicated slot media validation and target kinds", () => {
    for (const api of assetApis) {
        it.each(invalidCases)(`${api.kind} rejects %s atomically`, async problem => {
            const {project} = await fixture(), asset = await api.add(project.id);
            const slot = await invalidSlot(project.id, problem), before = await snapshot();
            await expect(api.set(asset.id, slot)).rejects.toThrow("素材");
            expect(await snapshot()).toEqual(before);
        });
        it(`${api.kind} rejects owned video result but accepts image plus video references`, async () => {
            const {project} = await fixture(), asset = await api.add(project.id);
            const video = await media(project.id, "video", "video/mp4"), image = await media(project.id, "image");
            const before = await snapshot();
            await expect(api.set(asset.id, resultSlot(video, "video"))).rejects.toThrow("类型");
            expect(await snapshot()).toEqual(before);
            await api.set(asset.id, {...resultSlot(image), referenceVideoIds: [video]});
            await api.set(asset.id, emptySlot());
            expect(await db.media.get(image)).toBeUndefined();
            expect(await db.media.get(video)).toBeUndefined();
        });
        it(`${api.kind} studio copies remain owned and reject wrong target kind`, async () => {
            const {project} = await fixture(), asset = await api.add(STUDIO_LIBRARY_ID);
            const image = await media(STUDIO_LIBRARY_ID, "studio-image");
            await api.set(asset.id, resultSlot(image));
            const copy = await api.copy(project.id, asset.id);
            const copied = Object.values(copy.slots).find(slot => slot?.result)?.result;
            expect(copied?.mediaId).not.toBe(image);
            expect((await db.media.get(copied!.mediaId))?.projectId).toBe(project.id);
            const video = await media(STUDIO_LIBRARY_ID, "studio-video", "video/mp4");
            // Imported/legacy corruption must be checked again at snapshot copy time.
            const table = {character: db.characters, scene: db.scenes, prop: db.props, style: db.styles}[api.kind];
            const key = {character: "front", scene: "wide", prop: "hero", style: "look"}[api.kind];
            await table.update(asset.id, {slots: {[key]: resultSlot(video, "video")}});
            const destination = await createProject("reject copy"), before = await snapshot();
            await expect(api.copy(destination.id, asset.id)).rejects.toThrow("类型");
            expect(await snapshot()).toEqual(before);
        });
    }
    for (const field of ["firstFrame", "lastFrame", "clip"] as const) {
        it.each(invalidCases)(`${field} rejects %s atomically`, async problem => {
            const {project, shot} = await fixture(), slot = await invalidSlot(project.id, problem);
            const before = await snapshot();
            await expect(setShotSlot(shot.id, field, slot)).rejects.toThrow("素材");
            expect(await snapshot()).toEqual(before);
        });
        it(`${field} enforces target kind and guarded replacement`, async () => {
            const {project, shot} = await fixture();
            const video = await media(project.id, "video", "video/mp4"), image = await media(project.id, "image");
            if (field === "clip") {
                await setShotSlot(shot.id, field, resultSlot(video, "video"));
            } else {
                const before = await snapshot();
                await expect(setShotSlot(shot.id, field, resultSlot(video, "video"))).rejects.toThrow("类型");
                expect(await snapshot()).toEqual(before);
            }
            await setShotSlot(shot.id, field, resultSlot(image));
            const before = await snapshot();
            await expect(setShotSlot(shot.id, field, {...emptySlot(), prompt: "stale"}, emptySlot())).rejects.toBeInstanceOf(DraftConflictError);
            expect(await snapshot()).toEqual(before);
            await setShotSlot(shot.id, field, emptySlot(), resultSlot(image));
            expect(await db.media.get(image)).toBeUndefined();
            if (field === "clip") expect(await db.media.get(video)).toBeUndefined();
        });
    }
});

describe("project cover validation and recycling", () => {
    it.each(["foreign", "missing", "empty", "wrong MIME", "wrong declared kind"])("rejects %s before changing aspect or cover", async problem => {
        const {project} = await fixture(), slot = await invalidSlot(project.id, problem);
        const before = await snapshot();
        await expect(patchProjectOutput(project.id, {aspectPreset: "9:16", coverMediaId: slot.result!.mediaId})).rejects.toThrow("素材");
        expect(await snapshot()).toEqual(before);
    });
    it("rejects an empty identifier and recycles true orphans on replace and clear", async () => {
        const {project} = await fixture(), first = await media(project.id, "first"), second = await media(project.id, "second");
        const before = await snapshot();
        await expect(patchProjectOutput(project.id, {coverMediaId: ""})).rejects.toThrow("素材");
        expect(await snapshot()).toEqual(before);
        await patchProjectOutput(project.id, {coverMediaId: first});
        await patchProjectOutput(project.id, {aspectPreset: "9:16", coverMediaId: first});
        expect(await db.media.get(first)).toBeDefined();
        await patchProjectOutput(project.id, {coverMediaId: second});
        expect(await db.media.get(first)).toBeUndefined();
        await patchProjectOutput(project.id, {coverMediaId: null});
        expect((await db.projects.get(project.id))?.coverMediaId).toBeUndefined();
        expect(await db.media.get(second)).toBeUndefined();
    });
    it("keeps shared media until the last committed owner releases it", async () => {
        const {project, shot} = await fixture(), image = await media(project.id, "shared");
        await setShotSlot(shot.id, "firstFrame", resultSlot(image));
        await patchProjectOutput(project.id, {coverMediaId: image});
        await patchProjectOutput(project.id, {coverMediaId: null});
        expect(await db.media.get(image)).toBeDefined();
        await setShotSlot(shot.id, "firstFrame", emptySlot());
        expect(await db.media.get(image)).toBeUndefined();
    });
    it("keeps proposal history for guarded undo when cover and slots release both results", async () => {
        const {project, episode, shot} = await fixture(), first = await media(project.id, "before"), second = await media(project.id, "after");
        await setShotSlot(shot.id, "firstFrame", resultSlot(first));
        const proposal = await createProductionProposal({target: {kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "firstFrame"},
            source: {kind: "manual"}, change: {kind: "slot-result", result: {mediaId: second, kind: "image"}}});
        await applyProductionProposal(proposal.id, project.id);
        await patchProjectOutput(project.id, {coverMediaId: first});
        await patchProjectOutput(project.id, {coverMediaId: second});
        await patchProjectOutput(project.id, {coverMediaId: null});
        await undoProductionProposal(proposal.id, project.id);
        await setShotSlot(shot.id, "firstFrame", emptySlot());
        expect(await db.media.get(first)).toBeDefined();
        expect(await db.media.get(second)).toBeDefined();
    });
    it.each(["job input", "job result", "batch before", "batch result"])("keeps %s history when clearing the cover", async history => {
        const {project, episode, shot} = await fixture(), image = await media(project.id, "history");
        const result = {mediaId: image, kind: "image" as const};
        const target = {kind: "shot" as const, projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "firstFrame" as const};
        if (history.startsWith("job")) {
            const job: AgentGenerationJob = {version: 1, id: "job", callId: "call", runId: "run", threadId: "thread", projectId: project.id,
                connectorId: "connector", provider: "apimart", baseUrl: "https://provider.test", model: "gpt-image-2", kind: "image", target,
                baseRevision: "baseline", sourceRevisions: [], parameters: {}, fingerprint: "history", status: "downloaded",
                inputs: history === "job input" ? [{mediaId: image, role: "reference-image", revision: "original"}] : [],
                result: history === "job result" ? result : undefined, createdAt: "before", updatedAt: "before"};
            await db.agentGenerationJobs.add(job);
        } else {
            const batch: GenerationBatch = {version: 1, id: "batch", projectId: project.id, threadId: "thread", runId: "run", originCallId: "call",
                title: "history", revision: 1, status: "settled", itemIds: [], confirmedItemIds: [], entityRevisions: {}, selections: {},
                applications: [{itemId: "item", jobId: "job", targetKey: "shot:firstFrame", baseline: "baseline", beforeRevision: "before", afterRevision: "after",
                    before: history === "batch before" ? result : undefined,
                    result: history === "batch result" ? result : {mediaId: "other", kind: "image"}, at: "before"}], createdAt: "before", updatedAt: "before"};
            await db.agentGenerationBatches.add(batch);
        }
        await patchProjectOutput(project.id, {coverMediaId: image});
        await patchProjectOutput(project.id, {coverMediaId: null});
        expect(await db.media.get(image)).toBeDefined();
    });
    it("rolls back cover and recycled media when cleanup fails", async () => {
        const {project} = await fixture(), first = await media(project.id, "first"), second = await media(project.id, "second");
        await patchProjectOutput(project.id, {coverMediaId: first});
        const before = await snapshot();
        const originalDelete = db.media.delete.bind(db.media);
        vi.spyOn(db.media, "delete").mockImplementationOnce(async id => {
            await originalDelete(id);
            throw new Error("cleanup failure");
        });
        await expect(patchProjectOutput(project.id, {aspectPreset: "9:16", coverMediaId: second})).rejects.toThrow("cleanup failure");
        expect(await snapshot()).toEqual(before);
    });
    it("rolls back a slot write when the project touch fails", async () => {
        const {project, shot} = await fixture(), image = await media(project.id, "image");
        const before = await snapshot();
        vi.spyOn(db.projects, "update").mockRejectedValueOnce(new Error("touch failure"));
        await expect(setShotSlot(shot.id, "firstFrame", resultSlot(image))).rejects.toThrow("touch failure");
        expect(await snapshot()).toEqual(before);
    });
});
