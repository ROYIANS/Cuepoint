import {describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {createAudioMusicProject, createProject} from "@/db/projects";
import {addCharacter} from "@/db/assets";
import {addAudioExport, addAudioTake, getAudioProjectSnapshot} from "@/db/audio";
import {addMusicWork} from "@/db/music";
import {addFileMaterialVersion, createFileMaterial, promoteLegacyMaterial} from "@/db/materials";
import {emptySlot} from "@/domain/slot";
import {STUDIO_LIBRARY_ID} from "@/domain/types";
import {enumerateWorkspaceBinaryFixture} from "./helpers/workspaceBinaryFixture";

const file = (bytes: string, name = "same.png", type = "image/png") => new File([bytes], name, {type});
const media = (id: string, projectId: string, bytes: string, mimeType = "image/png") => ({id, projectId, filename: "same.png", mimeType, blob: file(bytes, "same.png", mimeType)});

describe("disposable workspace binary-owner inventory", () => {
    it("enumerates live and nested historical bytes separately without remapping identities", async () => {
        const project = await createProject("visual");
        await db.media.bulkAdd([media("live", project.id, "live"), media("retained", project.id, "retained")]);
        const material = await createFileMaterial(file("first"), {kind: "global"});
        await addFileMaterialVersion(material.id, file("second"), 1);
        const character = await addCharacter(STUDIO_LIBRARY_ID);
        await db.media.add(media("face", STUDIO_LIBRARY_ID, "original face"));
        await db.characters.update(character.id, {slots: {front: {...emptySlot(), result: {mediaId: "face", kind: "image"}}}});
        const setting = await promoteLegacyMaterial("character", character.id, {kind: "global"});
        // The promoted snapshot owns independent bytes, even after its source is gone.
        await db.characters.delete(character.id);
        await db.media.delete("face");
        const versions = await db.materialVersions.toArray();
        const before = {media: await db.media.toArray(), versions};
        const report = await enumerateWorkspaceBinaryFixture();
        expect(report.binaries).toHaveLength(5);
        expect(report.binaries.filter(row => row.owner.table === "media").map(row => row.mediaId).sort()).toEqual(["live", "retained"]);
        expect(report.binaries.filter(row => row.owner.materialId === material.id).map(row => row.owner.revision).sort()).toEqual([1, 2]);
        expect(report.binaries.find(row => row.owner.materialId === setting.id)).toMatchObject({mediaId: "face", byteLength: 13, state: "ready"});
        expect(report.binaries.every(row => row.contentHash?.length === 64)).toBe(true);
        expect(new Set(report.binaries.map(row => row.key)).size).toBe(5);
        expect(new Set(report.binaries.filter(row => row.owner.materialId === material.id).map(row => row.contentHash)).size).toBe(2);
        expect(report.issues).toEqual([]);
        expect(report.references).toContainEqual(expect.objectContaining({table: "materialVersions", target: "materialSnapshot", targetId: "face", status: "resolved"}));
        expect(await db.media.toArray()).toEqual(before.media);
        expect(await db.materialVersions.toArray()).toEqual(before.versions);
        const serialized = JSON.stringify(report);
        expect(report.binaries.every(row => !Object.hasOwn(row, "blob"))).toBe(true);
        expect(serialized).not.toContain('"blob":');
        expect(serialized).not.toContain("original face");
    });

    it("includes microphone recordings, audio exports and music output references", async () => {
        const audio = await createAudioMusicProject("audio", "audio");
        const music = await createAudioMusicProject("music", "music");
        const chapter = (await getAudioProjectSnapshot(audio.id)).chapters[0];
        const recorded = await addAudioTake(audio.id, {name: "recorded", source: "recording", mediaId: "recorded", durationSec: 3, sampleRate: 48000, channels: 1}, media("recorded", audio.id, "recording", "audio/webm;codecs=opus"));
        const exported = await addAudioExport(audio.id, {chapterId: chapter.id, mediaId: "render", format: "wav", fingerprint: "timeline-v1", durationSec: 3}, media("render", audio.id, "render", "audio/wav"));
        const work = await addMusicWork(music.id, {title: "music", notes: "", favorite: false, lyrics: "", mediaId: "music", durationSec: 3, sampleRate: 48000, channels: 1}, media("music", music.id, "music", "audio/wav"));
        const report = await enumerateWorkspaceBinaryFixture();
        expect(report.issues).toEqual([]);
        expect(report.binaries).toHaveLength(3);
        expect(report.references).toEqual(expect.arrayContaining([
            expect.objectContaining({table: "audioTakes", rowId: recorded.id, targetId: "recorded", role: "recording", status: "resolved"}),
            expect.objectContaining({table: "audioExports", rowId: exported.id, targetId: "render", role: "output", status: "resolved"}),
            expect.objectContaining({table: "musicWorks", rowId: work.id, targetId: "music", role: "output", status: "resolved"}),
        ]));
    });

    it("reports missing/foreign ownership, unavailable references and empty copies without changing records", async () => {
        const project = await createProject("owner");
        const foreign = await createProject("foreign");
        await db.media.bulkAdd([media("foreign", foreign.id, "bytes"), media("empty", project.id, ""), media("orphan", "deleted-project", "orphan")]);
        const character = await addCharacter(project.id);
        await db.characters.update(character.id, {slots: {front: {...emptySlot(), referenceImageIds: ["missing", "foreign", "empty"]}}});
        const material = await createFileMaterial(file("version"), {kind: "global"});
        await db.libraryMaterials.delete(material.id);
        const before = await db.characters.get(character.id);
        const report = await enumerateWorkspaceBinaryFixture();
        expect(report.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({kind: "missing-owner", table: "media", rowId: "orphan", targetId: "deleted-project"}),
            expect.objectContaining({kind: "missing-owner", table: "materialVersions", targetId: material.id}),
            expect.objectContaining({kind: "missing-reference", table: "characters", targetId: "missing"}),
            expect.objectContaining({kind: "foreign-owner", table: "characters", targetId: "foreign"}),
            expect.objectContaining({kind: "empty-binary", table: "media", rowId: "empty"}),
        ]));
        expect(report.binaries.find(row => row.mediaId === "empty")).toMatchObject({state: "empty", byteLength: 0});
        expect(await db.characters.get(character.id)).toEqual(before);
        expect(await db.media.count()).toBe(3);
    });

    it("does not resolve a missing nested snapshot against a coincidentally matching live media row", async () => {
        const source = await addCharacter(STUDIO_LIBRARY_ID);
        await db.media.add(media("snapshot", STUDIO_LIBRARY_ID, "source"));
        await db.characters.update(source.id, {slots: {front: {...emptySlot(), result: {mediaId: "snapshot", kind: "image"}}}});
        const material = await promoteLegacyMaterial("character", source.id, {kind: "global"});
        const version = (await db.materialVersions.where("materialId").equals(material.id).first())!;
        if (version.payload.type !== "setting") throw new Error("Expected setting fixture");
        await db.materialVersions.update(version.id, {payload: {...version.payload, media: []}});
        const report = await enumerateWorkspaceBinaryFixture();
        expect(report.issues).toContainEqual(expect.objectContaining({kind: "missing-reference", table: "materialVersions", rowId: version.id, targetId: "snapshot"}));
        expect(await db.media.get("snapshot")).toBeDefined();
    });

    it("covers retained generation/reference owners and excludes secrets and execution state", async () => {
        const project = await createProject("closure");
        await db.media.add(media("available", project.id, "bytes"));
        const p = project.id;
        // Deliberately incomplete disposable rows expose the exact reference
        // projections. They are never used as production mutation fixtures.
        const raw = (name: string) => db.table<Record<string, unknown>, string>(name);
        await raw("projects").update(p, {coverMediaId: "missing-cover"});
        for (const table of ["characters", "scenes", "props", "styles"]) await raw(table).add({id: table, projectId: p, slots: {front: {...emptySlot(), result: {mediaId: "missing-slot", kind: "image"}}}});
        await raw("shots").add({id: "shot", projectId: p, firstFrame: {...emptySlot(), result: {mediaId: "missing-frame", kind: "image"}}, lastFrame: emptySlot(), clip: {...emptySlot(), result: {mediaId: "missing-clip", kind: "video"}}});
        await raw("projectReferences").add({id: "reference", projectId: p, mediaId: "missing-reference", status: "unavailable"});
        await raw("materialUses").add({id: "use", projectId: p, materialId: "material", revision: 1, mediaIds: ["missing-adoption"]});
        await raw("audioTakes").add({id: "take", projectId: p, mediaId: "available", source: "recording"});
        await raw("audioExports").add({id: "export", projectId: p, mediaId: "missing-export"});
        await raw("musicWorks").add({id: "work", projectId: p, mediaId: "missing-work"});
        await raw("audioSpeakers").add({id: "speaker", projectId: p, mimo: {referenceMediaId: "missing-voice"}});
        await raw("audioClips").add({id: "clip", projectId: p, takeId: "missing-take"});
        await raw("audioSegments").add({id: "segment", projectId: p, selectedTakeId: "missing-take"});
        await raw("audioGenerationJobs").add({id: "audio-job", projectId: p, input: {kind: "speech", mimo: {referenceMediaId: "missing-job-input"}}, results: [{key: "result", mediaId: "available", takeId: "take", workId: "missing-work-row"}], claim: {owner: "SECRET_RUNTIME_CLAIM"}, connector: {apiKey: "SECRET_API_KEY"}});
        await raw("audioGenerationBatchItems").add({id: "audio-item", projectId: p, snapshot: {input: {mimo: {referenceMediaId: "missing-audio-batch"}}, connector: {apiKey: "SECRET_BATCH_KEY"}}});
        await raw("productionProposals").add({id: "proposal", projectId: p, before: {result: {mediaId: "missing-before"}}, change: {kind: "slot-result", result: {mediaId: "missing-after"}}, source: {apiKey: "SECRET_PROPOSAL"}});
        await raw("agentGenerationJobs").add({id: "image-job", projectId: p, inputs: [{mediaId: "missing-image-input"}], result: {mediaId: "missing-image-output"}, parameters: {secret: "SECRET_PARAMETERS"}});
        await raw("agentGenerationBatches").add({id: "image-batch", projectId: p, applications: [{before: {mediaId: "missing-batch-before"}, result: {mediaId: "missing-batch-after"}}], confirmedAt: "SECRET_APPROVAL"});
        await raw("agentGenerationBatchItems").add({id: "image-item", projectId: p, draft: {inputs: [{mediaId: "missing-image-batch"}]}});
        await raw("connectors").add({id: "connector", definitionId: "fixture", apiKey: "SECRET_CONNECTOR"});
        const beforeCounts = await Promise.all(db.tables.map(table => table.count()));
        const report = await enumerateWorkspaceBinaryFixture();
        const expectedTables = ["projects", "characters", "scenes", "props", "styles", "shots", "projectReferences", "materialUses", "audioTakes", "audioExports", "musicWorks", "audioSpeakers", "audioClips", "audioSegments", "audioGenerationJobs", "audioGenerationBatchItems", "productionProposals", "agentGenerationJobs", "agentGenerationBatches", "agentGenerationBatchItems"];
        expect([...new Set(report.references.map(row => row.table))].sort()).toEqual(expectedTables.sort());
        expect(report.references.filter(row => row.status === "resolved")).toHaveLength(3);
        expect(report.issues.filter(row => row.kind === "missing-reference")).toHaveLength(report.references.length - 3);
        expect(report.references.find(row => row.table === "projectReferences")).toMatchObject({status: "missing-reference"});
        expect(JSON.stringify(report)).not.toContain("SECRET_");
        expect(JSON.stringify(report)).not.toContain("claim");
        expect(JSON.stringify(report)).not.toContain("apiKey");
        expect(await Promise.all(db.tables.map(table => table.count()))).toEqual(beforeCounts);
    });
});
