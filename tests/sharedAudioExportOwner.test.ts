import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {addAudioClip, addAudioTake, getAudioProjectSnapshot} from "@/db/audio";
import {exportAudioMix} from "@/lib/audio/exportMix";
import {encodePcm16Wav, MIX_SAMPLE_RATE} from "@/lib/audio/wav";
import {getAudioExportFreshness} from "@/lib/audio/fingerprint";
import {readBinaryBlob} from "@/lib/storage/binary";
import {interceptStoreTable} from "./helpers/storeFaults";

const samples = new Float32Array([0.25, -0.25, 0.5, -0.5]);
const frames = samples.length;
const source = () => encodePcm16Wav({length: frames, sampleRate: MIX_SAMPLE_RATE, numberOfChannels: 1, getChannelData: () => samples}).blob;
const hardware = {decoded: 0, rendered: 0, starts: [] as number[][]};

// Only the host audio decoder/render context is a fixture. Scheduling, PCM
// encoding, verified file reads, metadata transactions and output retention
// below all run through the current product code and selected real adapter.
class OfflineContextFixture {
    readonly currentTime = 0;
    readonly destination = {};
    constructor(readonly numberOfChannels: number, readonly length: number, readonly sampleRate: number) {}
    async decodeAudioData(bytes: ArrayBuffer) {
        expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
        hardware.decoded++;
        return {length: frames, duration: frames / MIX_SAMPLE_RATE, numberOfChannels: 1, sampleRate: MIX_SAMPLE_RATE, getChannelData: () => samples};
    }
    createBufferSource() {
        return {connect() {}, disconnect() {}, stop() {}, onended: null, start: (...times: number[]) => {hardware.starts.push(times);}};
    }
    createGain() {
        return {gain: {setValueAtTime() {}, linearRampToValueAtTime() {}}, connect() {}, disconnect() {}};
    }
    async startRendering() {
        hardware.rendered++;
        expect(this.length).toBe(frames);
        expect(this.sampleRate).toBe(MIX_SAMPLE_RATE);
        return {length: frames, sampleRate: MIX_SAMPLE_RATE, numberOfChannels: 2, getChannelData: () => samples};
    }
}

async function fixture() {
    hardware.decoded = 0; hardware.rendered = 0; hardware.starts = [];
    vi.stubGlobal("OfflineAudioContext", OfflineContextFixture);
    const project = await createAudioMusicProject("保留真实混音", "audio");
    const snapshot = await getAudioProjectSnapshot(project.id);
    const chapter = snapshot.chapters[0];
    const mediaId = `export-owner-source:${project.id}`;
    const take = await addAudioTake(project.id, {mediaId, name: "原始声音", source: "upload", durationSec: frames / MIX_SAMPLE_RATE, sampleRate: MIX_SAMPLE_RATE, channels: 1},
        {id: mediaId, projectId: project.id, filename: "source.wav", mimeType: "audio/wav", blob: source()});
    await addAudioClip(project.id, {chapterId: chapter.id, trackId: snapshot.tracks[0].id, takeId: take.id, startSec: 0, trimStartSec: 0, trimEndSec: take.durationSec, gain: 1, fadeInSec: 0, fadeOutSec: 0});
    return {project, chapter, take};
}

afterEach(() => vi.unstubAllGlobals());

describe("retained audio export through the shared product owner", () => {
    it.each(["chapter", "project"] as const)("retains the actual %s mix, its source fingerprint and exact WAV bytes", async scope => {
        const {project, chapter, take} = await fixture();
        const result = await exportAudioMix({projectId: project.id, projectName: project.name, chapterId: chapter.id, scope});
        expect(hardware.decoded).toBe(1); expect(hardware.rendered).toBe(1);
        expect(hardware.starts).toEqual([[0, 0, frames / MIX_SAMPLE_RATE]]);
        expect(result.attenuation).toBe(1);
        const snapshot = await getAudioProjectSnapshot(project.id);
        expect(snapshot.exports).toHaveLength(1);
        const exported = snapshot.exports[0];
        expect(exported).toMatchObject({projectId: project.id, scope, format: "wav", durationSec: frames / MIX_SAMPLE_RATE});
        expect(exported.chapterId).toBe(scope === "chapter" ? chapter.id : undefined);
        expect(getAudioExportFreshness(exported, snapshot)).toBe("current");
        expect(exported.fingerprint).toContain(take.id);
        const media = await db.media.get(exported.mediaId);
        expect(media).toMatchObject({projectId: project.id, mimeType: "audio/wav", filename: result.filename});
        const bytes = await (await readBinaryBlob(media!.blob)).arrayBuffer();
        expect(new Uint8Array(bytes)).toEqual(new Uint8Array(await result.blob.arrayBuffer()));
        const wav = new DataView(bytes);
        expect(wav.getUint32(24, true)).toBe(MIX_SAMPLE_RATE);
        expect(wav.getUint16(22, true)).toBe(2);
        expect(wav.getInt16(44, true)).toBe(8192);
        expect(await db.media.count()).toBe(2);
    });

    it("rolls back the staged output association on a late metadata write failure", async () => {
        const {project, chapter, take} = await fixture();
        let reached = 0;
        const fault = interceptStoreTable(db, "audioExports", "add", async (tx) => {
            reached++;
            expect(await tx.media.count()).toBe(2);
            throw new Error("late retained-output failure");
        });
        try {
            await expect(exportAudioMix({projectId: project.id, projectName: project.name, chapterId: chapter.id, scope: "chapter"})).rejects.toThrow("late retained-output failure");
        } finally {fault.mockRestore();}
        expect(reached).toBe(1); expect(hardware.rendered).toBe(1);
        expect(await db.audioExports.count()).toBe(0);
        expect(await db.media.count()).toBe(1);
        expect(new Uint8Array(await (await readBinaryBlob((await db.media.get(take.mediaId))!.blob)).arrayBuffer())).toEqual(new Uint8Array(await source().arrayBuffer()));
    });
});
