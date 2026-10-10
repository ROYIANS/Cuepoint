import {describe, it, expect} from "vitest";
import {db} from "@/db/database";
import {putMedia} from "@/db/media";
import {STUDIO_LIBRARY_ID} from "@/domain/types";
import {uploadMediaFile} from "@/lib/media";
import {createId} from "@/lib/ids";
import {mediaWorkspaceRef, workspaceId} from "@/lib/workspace";
import {enumerateWorkspaceBinaryFixture} from "./helpers/workspaceBinaryFixture";

describe("independent workspace review probes", () => {
    it("observes integrated import cost against the original direct Blob boundary", async () => {
        for (const mib of [32, 128]) {
            const file = new File([new Uint8Array(mib * 1024 * 1024)], "large.mp4", {type: "video/mp4"});
            for (const mode of ["original", "managed"] as const) {
                let previous = performance.now();
                let longestGapMs = 0;
                const timer = setInterval(() => {
                    const current = performance.now();
                    longestGapMs = Math.max(longestGapMs, current - previous);
                    previous = current;
                }, 1);
                await new Promise(resolve => setTimeout(resolve, 5));
                const before = process.memoryUsage();
                const started = performance.now();
                const id = mode === "managed" ? (await uploadMediaFile(STUDIO_LIBRARY_ID, file)).id : await putMedia({
                    id: createId("med"), projectId: STUDIO_LIBRARY_ID, filename: file.name, mimeType: file.type, blob: file,
                });
                const elapsedMs = performance.now() - started;
                await new Promise(resolve => setTimeout(resolve, 5));
                clearInterval(timer);
                const after = process.memoryUsage();
                console.log(JSON.stringify({mode, mib, elapsedMs, longestGapMs,
                    arrayBuffersBefore: before.arrayBuffers, arrayBuffersAfter: after.arrayBuffers,
                    rssBefore: before.rss, rssAfter: after.rss}));
                expect((await db.media.get(id))?.blob.size).toBe(file.size);
                await db.media.delete(id);
            }
        }
    }, 30000);

    it("observes case-insensitive location aliasing and omitted arrangement history references", async () => {
        const workspace = workspaceId("review");
        const first = mediaWorkspaceRef(workspace, "Project", "Media");
        const second = mediaWorkspaceRef(workspace, "project", "media");
        expect(first.relativePath).not.toBe(second.relativePath);
        expect(first.relativePath.toLowerCase()).toBe(second.relativePath.toLowerCase());
        await db.table<Record<string, unknown>, string>("audioArrangementProposals").add({id: "arrangement", projectId: "owner",
            choices: [{takeId: "missing-choice"}], selections: [{take: {id: "snapshot-take", projectId: "owner", mediaId: "missing-snapshot-media"}}],
            items: [{takeId: "missing-item", clip: {takeId: "missing-item-clip"}}], before: [{takeId: "missing-before"}],
            receipt: {selected: [{selectedTakeId: "missing-selected"}], added: [{takeId: "missing-added"}], before: [{takeId: "missing-receipt-before"}], after: [{takeId: "missing-after"}]}});
        const report = await enumerateWorkspaceBinaryFixture();
        expect(report.references.filter(row => row.table === "audioArrangementProposals")).toEqual([]);
        expect(report.issues).toEqual([]);
    });
});
