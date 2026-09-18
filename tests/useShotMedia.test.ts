import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { addShot, createProject } from "@/db/repo";
import { useShotMedia } from "@/lib/useShotMedia";

const { liveQuery } = vi.hoisted(() => ({ liveQuery: vi.fn() }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: liveQuery }));

describe("shot media query identity", () => {
  it("does not expose retained media from a previous result collection while the next query loads", async () => {
    const project = await createProject("media loading fixture");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shot = await addShot(project.id, episode.id);
    liveQuery.mockReturnValue(undefined);
    expect(useShotMedia([shot])).toBeUndefined();
    const previousQuery = liveQuery.mock.calls.at(-1)![0] as () => Promise<unknown>;
    liveQuery.mockReturnValue(await previousQuery());
    expect(useShotMedia([shot])?.size).toBe(0);

    const record = { id: "new-result", projectId: project.id, mimeType: "image/png", filename: "frame.png", blob: new Blob(["image"]) };
    await db.media.add(record);
    shot.firstFrame.result = { mediaId: record.id, kind: "image" };
    // Dexie React retains the old value until its changed dependency query resolves.
    expect(useShotMedia([shot])).toBeUndefined();
    const currentQuery = liveQuery.mock.calls.at(-1)![0] as () => Promise<unknown>;
    liveQuery.mockReturnValue(await currentQuery());
    expect(useShotMedia([shot])?.get(record.id)).toMatchObject({ id: record.id });
    expect(useShotMedia([])).toBeUndefined();
  });
});
