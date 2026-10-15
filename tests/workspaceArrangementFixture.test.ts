import {describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createAudioMusicProject} from "@/features/projects/commands/projects";
import {addAudioClip, addAudioSegment, addAudioTake} from "@/features/audio/commands/audio";
import {getAudioProjectSnapshot} from "@/features/audio/queries/snapshot";
import {applyAudioArrangementProposal, previewAudioArrangement, previewAudioSelection, saveAudioArrangementProposal} from "@/features/audio/commands/arrangement";
import type {AudioSegment, AudioTake} from "@/features/audio/models/audio";
import type {AudioArrangementProposal} from "@/features/audio/models/audioArrangement";
import {enumerateWorkspaceBinaryFixture} from "./helpers/workspaceBinaryFixture";

async function arrangeFixture() {
    const project = await createAudioMusicProject("history references", "audio");
    const snapshot = await getAudioProjectSnapshot(project.id);
    const chapter = snapshot.chapters[0], track = snapshot.tracks[0];
    const segments: AudioSegment[] = [], takes: AudioTake[] = [];
    for (let index = 0; index < 2; index++) {
        const segment = await addAudioSegment(project.id, {chapterId: chapter.id, text: `text ${index}`, notes: "", order: index});
        const mediaId = `audio-${index}`;
        const take = await addAudioTake(project.id, {segmentId: segment.id, mediaId, name: `take ${index}`, source: "recording", durationSec: 1, sampleRate: 48000, channels: 1},
            {id: mediaId, projectId: project.id, filename: "audio.wav", mimeType: "audio/wav", blob: new Blob([`audio ${index}`])});
        segments.push(segment); takes.push(take);
    }
    async function apply(proposal: AudioArrangementProposal) {
        await saveAudioArrangementProposal(proposal);
        await applyAudioArrangementProposal(project.id, proposal.id, proposal.revision, proposal.owner);
        return (await db.audioArrangementProposals.get(proposal.id))!;
    }
    await apply(await previewAudioSelection(project.id, chapter.id, segments.map((segment, index) => ({segmentId: segment.id, segmentRevision: segment.revision, takeId: takes[index].id, takeRevision: takes[index].revision}))));
    const current = (await db.audioSegments.get(segments[0].id))!;
    const alternate = await addAudioTake(project.id, {...takes[0], name: "alternate"});
    const selection = await apply(await previewAudioSelection(project.id, chapter.id, [{segmentId: current.id, segmentRevision: current.revision, takeId: alternate.id, takeRevision: alternate.revision}],
        {type: "agent", threadId: "SECRET_THREAD", runId: "SECRET_RUN", callId: "SECRET_CALL"}));
    await addAudioClip(project.id, {chapterId: chapter.id, trackId: track.id, takeId: takes[0].id, startSec: 0, trimStartSec: 0, trimEndSec: 1, gain: 1, fadeInSec: 0, fadeOutSec: 0});
    const arrangement = await apply(await previewAudioArrangement(project.id, chapter.id, {segmentIds: segments.map(row => row.id), trackId: track.id}));
    return {project, selection, arrangement, alternate, takes};
}

describe("audio arrangement historical binary references", () => {
    it("projects real prepared/applied selection and arrangement owners without execution state", async () => {
        const f = await arrangeFixture();
        const before = await db.audioArrangementProposals.toArray();
        const report = await enumerateWorkspaceBinaryFixture();
        const refs = report.references.filter(row => row.table === "audioArrangementProposals");
        expect(report.issues).toEqual([]);
        expect(refs.every(row => row.status === "resolved")).toBe(true);
        const fields = new Set(refs.map(row => row.field));
        for (const field of ["choices.0.takeId", "selections.0.take.id", "selections.0.take.mediaId", "selections.0.segment.selectedTakeId",
            "items.0.takeId", "items.1.clip.takeId", "before.0.takeId", "receipt.selected.0.selectedTakeId", "receipt.added.0.takeId", "receipt.before.0.takeId", "receipt.after.0.takeId"]) {
            expect(fields.has(field), field).toBe(true);
        }
        expect(refs).toContainEqual(expect.objectContaining({rowId: f.selection.id, targetId: f.alternate.id, target: "audioTakeSnapshot"}));
        expect(JSON.stringify(report)).not.toContain("SECRET_");
        expect(JSON.stringify(report)).not.toContain("fingerprint");
        expect(JSON.stringify(report)).not.toContain('"owner":{"type"');
        expect(await db.audioArrangementProposals.toArray()).toEqual(before);
    });

    it("retains embedded take identity after live deletion and reports missing historical references/media", async () => {
        const f = await arrangeFixture();
        await db.audioTakes.clear();
        await db.media.delete(f.alternate.mediaId);
        const before = await db.audioArrangementProposals.toArray();
        const report = await enumerateWorkspaceBinaryFixture();
        const refs = report.references.filter(row => row.table === "audioArrangementProposals");
        expect(refs.filter(row => row.target === "audioTakeSnapshot").every(row => row.status === "resolved")).toBe(true);
        expect(refs.filter(row => row.target === "audioTakes").every(row => row.status === "missing-reference")).toBe(true);
        expect(refs).toContainEqual(expect.objectContaining({rowId: f.selection.id, field: "selections.0.take.mediaId", targetId: f.alternate.mediaId, status: "missing-reference"}));
        expect(await db.audioArrangementProposals.toArray()).toEqual(before);
        expect(await db.audioTakes.count()).toBe(0);
    });

    it("reports foreign embedded owners, media and receipt owners rather than exporting raw snapshots", async () => {
        const f = await arrangeFixture();
        const foreign = await createAudioMusicProject("foreign", "audio");
        const selections = f.selection.selections.map(row => ({...row, take: {...row.take, projectId: foreign.id}, segment: {...row.segment, projectId: foreign.id}}));
        await db.audioArrangementProposals.update(f.selection.id, {selections, receipt: {...f.selection.receipt!, projectId: foreign.id}});
        await db.media.update(f.alternate.mediaId, {projectId: foreign.id});
        await db.audioTakes.update(f.alternate.id, {projectId: foreign.id});
        const before = await db.audioArrangementProposals.toArray();
        const report = await enumerateWorkspaceBinaryFixture();
        expect(report.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({table: "audioArrangementProposals", rowId: f.selection.id, field: "selections.0.take.projectId", kind: "foreign-owner"}),
            expect.objectContaining({table: "audioArrangementProposals", rowId: f.selection.id, field: "selections.0.segment.projectId", kind: "foreign-owner"}),
            expect.objectContaining({table: "audioArrangementProposals", rowId: f.selection.id, field: "selections.0.take.mediaId", kind: "foreign-owner"}),
            expect.objectContaining({table: "audioArrangementProposals", rowId: f.selection.id, field: "receipt.projectId", kind: "foreign-owner"}),
            expect.objectContaining({table: "audioArrangementProposals", rowId: f.selection.id, field: "choices.0.takeId", kind: "foreign-owner"}),
        ]));
        expect(await db.audioArrangementProposals.toArray()).toEqual(before);
    });

    it("reports unreadable fixture bytes without mutating production records", async () => {
        const f = await arrangeFixture();
        const before = {media: await db.media.toArray(), proposals: await db.audioArrangementProposals.toArray()};
        const fault = vi.spyOn(Blob.prototype, "arrayBuffer").mockRejectedValue(new Error("read failed"));
        try {
            const report = await enumerateWorkspaceBinaryFixture();
            expect(report.binaries.every(row => row.state === "read-failed" && row.contentHash === undefined)).toBe(true);
            expect(report.issues).toContainEqual(expect.objectContaining({table: "media", rowId: f.alternate.mediaId, kind: "read-failed"}));
        } finally {
            fault.mockRestore();
        }
        expect(await db.media.toArray()).toEqual(before.media);
        expect(await db.audioArrangementProposals.toArray()).toEqual(before.proposals);
        expect(await (await db.media.get(f.alternate.mediaId))!.blob.text()).toBe("audio 0");
    });
});
