import {afterEach, describe, expect, it, vi} from "vitest";
import {mountedHookHost} from "./helpers/mountedHookHost";
import {db} from "@/platform/product/store";
import {addShot} from "@/features/video/commands/shots";
import {createProject} from "@/features/projects/commands/projects";
import type {StoreTx} from "@/platform/storage/types";

const host = vi.hoisted(() => ({hooks: undefined as ReturnType<typeof mountedHookHost> | undefined, query: vi.fn()}));
vi.mock("react", async original => ({...await original<typeof import("react")>(), useState: (initial: unknown) => host.hooks!.useState(initial), useRef: (initial: unknown) => host.hooks!.useRef(initial), useEffect: (effect: () => unknown, dependencies?: readonly unknown[]) => host.hooks!.useEffect(effect, dependencies)}));
vi.mock("@/platform/product/queries", () => ({useProductQuery: host.query}));
import {useShotMedia} from "@/features/video/queries/useShotMedia";

afterEach(() => {host.hooks?.unmount();vi.unstubAllGlobals();});
describe("shot media query identity", () => {
    it("does not expose retained media from a previous result collection while the next shared query loads", async () => {
        host.hooks = mountedHookHost();host.query.mockReset();
        vi.stubGlobal("window", {addEventListener: vi.fn(), removeEventListener: vi.fn()});
        const project = await createProject("media loading fixture");
        const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
        const shot = await addShot(project.id, episode.id);
        const render = () => host.hooks!.render(() => useShotMedia([shot]));
        expect(render()).toBeUndefined();
        const previousQuery = host.query.mock.calls.at(-1)![0] as (tx: StoreTx) => Promise<unknown>;
        host.query.mockReturnValue(await db.transaction("r", ["media"], previousQuery));
        render();
        await vi.waitFor(() => expect(render()?.size).toBe(0));
        const record = {id: "new-result", projectId: project.id, mimeType: "image/png", filename: "frame.png", blob: new Blob(["image"])};
        await db.media.add(record);
        shot.firstFrame.result = {mediaId: record.id, kind: "image"};
        expect(render()).toBeUndefined();
        const currentQuery = host.query.mock.calls.at(-1)![0] as (tx: StoreTx) => Promise<unknown>;
        host.query.mockReturnValue(await db.transaction("r", ["media"], currentQuery));
        render();
        await vi.waitFor(() => expect(render()?.get(record.id)).toMatchObject({id: record.id}));
        expect(host.hooks.render(() => useShotMedia([]))).toBeUndefined();
    });
});
