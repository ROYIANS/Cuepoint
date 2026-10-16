import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createProject} from "@/features/projects/commands/projects";
import {desktopMediaOperationId, desktopMediaSelection, importDesktopMedia, inspectDesktopMediaImport, pickDesktopMediaDirectory} from "@/features/library/services/desktopMediaImport";
import {UnknownCommitError} from "@/platform/storage/errors";
import {interceptStoreTable} from "./helpers/storeFaults";
import {desktopMediaHost, deferred} from "./helpers/desktopMediaHost";

async function fixture(count = 2) {
    const project = await createProject("Selected project"), host = desktopMediaHost(count), controller = new AbortController();
    const candidates = (await pickDesktopMediaDirectory(project.id, controller.signal, host.services))!;
    const id = crypto.randomUUID(), selection = desktopMediaSelection(candidates, host.entries.map(entry => entry.entryId), id);
    return {project, host, controller, candidates, input: {id, projectId: project.id, actor: {kind: "human"} as const, selection, signal: controller.signal}};
}
afterEach(() => vi.restoreAllMocks());
describe("actual shared directory import orchestration", () => {
    it("freezes scoped deterministic entries, publishes original/thumbnail/receipts and never dispatches a retained intent again", async () => {
        const f = await fixture(), progress: number[] = [];
        const result = await importDesktopMedia({...f.input, onProgress: value => progress.push(value.record.receipts.length)}, {services: f.host.services});
        expect(result).toMatchObject({status: "completed", actor: {kind: "human"}}); expect(result.receipts).toHaveLength(2);
        expect(progress).toEqual([0, 0, 0, 1, 1, 2]); expect(await db.media.count()).toBe(4);
        expect((await db.media.where("projectId").equals(f.project.id).toArray()).filter(media => media.thumbnailMediaId)).toHaveLength(2);
        const before = f.host.actions().filter(action => action.type === "prepareVideo").length;
        expect((await importDesktopMedia(f.input, {services: f.host.services})).status).toBe("completed");
        expect(f.host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(before);
        expect(f.host.actions().some(action => action.type === "discardPrepared")).toBe(false);
        const request = f.host.call.mock.calls[0][1].request;
        expect(request).toMatchObject({...f.host.session, projectId: f.project.id}); expect(JSON.stringify(request)).not.toContain("path");
    });
    it("orders Stop with current native drain and does not start the next selected item", async () => {
        const f = await fixture(3), entered = deferred(), release = deferred();
        f.host.setBeforePrepare(async index => {if (index === 1) {entered.resolve(); await release.promise;}});
        const running = importDesktopMedia(f.input, {services: f.host.services}); await entered.promise;
        f.controller.abort();
        await vi.waitFor(async () => expect((await db.desktopMediaImports.get(f.input.id))?.status).toBe("stopping"));
        expect(f.host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(2);
        let settled = false; void running.then(() => {settled = true;}); await Promise.resolve(); expect(settled).toBe(false);
        release.resolve(); const result = await running;
        expect(result.status).toBe("stopped"); expect(result.receipts).toHaveLength(1); expect(await db.media.count()).toBe(2);
        expect(f.host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(2);
        expect(f.host.actions().some(action => action.type === "cancelOperation")).toBe(true);
    });
    it("finds and cancels the original owner when Stop arrives before native reservation", async () => {
        const f = await fixture(2), entered = deferred(), reserve = deferred(), finish = deferred();
        f.host.setBeforeReserve(async () => {entered.resolve(); await reserve.promise;});
        f.host.setBeforePrepare(async () => finish.promise);
        const running = importDesktopMedia(f.input, {services: f.host.services}); await entered.promise;
        f.controller.abort();
        await vi.waitFor(() => expect(f.host.actions().some(action => action.type === "cancelOperation")).toBe(true));
        reserve.resolve();
        await vi.waitFor(() => expect(f.host.actions().filter(action => action.type === "cancelOperation").length).toBeGreaterThan(1));
        let settled = false; void running.then(() => {settled = true;}); await Promise.resolve(); expect(settled).toBe(false);
        finish.resolve(); const result = await running;
        expect(result.status).toBe("stopped"); expect(result.receipts).toHaveLength(0); expect(await db.media.count()).toBe(0);
        expect(f.host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(1);
    });
    it("reconciles an exact committed receipt after a lost publication ACK and releases its adopted operation", async () => {
        const f = await fixture(1), original = db.transaction.bind(db);
        const spy = vi.spyOn(db, "transaction").mockImplementation(async (mode, tables, callback) => {
            const value = await original(mode, tables, callback);
            if (typeof value === "object" && value !== null && "published" in value && value.published === true) throw new UnknownCommitError("lost-committed-publication", f.host.session.workspaceId);
            return value;
        });
        try {
            const result = await importDesktopMedia(f.input, {services: f.host.services});
            expect(result.status).toBe("completed"); expect(result.receipts).toHaveLength(1);
            expect(f.host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(1);
            expect(f.host.actions().some(action => action.type === "discardPrepared")).toBe(false);
            const owned = desktopMediaOperationId(f.input.id, f.input.selection.items[0].entryId);
            expect(f.host.actions().some(action => action.type === "releaseOperation" && action.operationId === owned)).toBe(true);
            expect(f.host.actions().some(action => action.type === "revokeDirectory")).toBe(true);
        } finally {spy.mockRestore();}
    });
    it("retains the committed result when Stop arrives inside final atomic publication", async () => {
        const f = await fixture(1), entered = deferred(), release = deferred();
        const fault = interceptStoreTable(db, "desktopMediaImports", "put", async (_tx, args, next) => {
            if ((args[0] as {status?: string}).status === "completed") {entered.resolve(); await release.promise;}
            return next();
        });
        try {
            const running = importDesktopMedia(f.input, {services: f.host.services}); await entered.promise; f.controller.abort(); release.resolve();
            const result = await running; expect(result.status).toBe("completed"); expect(result.receipts).toHaveLength(1); expect(await db.media.count()).toBe(2);
        } finally {fault.mockRestore();}
    });
    it("quarantines an unknown publication without discarding native claims or repeating work on readback", async () => {
        const f = await fixture(2);
        const fault = interceptStoreTable(db, "desktopMediaImports", "put", async (_tx, args, next) => {
            if ((args[0] as {receipts?: unknown[]}).receipts?.length) throw new UnknownCommitError("held-publication", f.host.session.workspaceId);
            return next();
        });
        let result;
        try {result = await importDesktopMedia(f.input, {services: f.host.services});} finally {fault.mockRestore();}
        expect(result.status).toBe("unknown"); expect(result.receipts).toHaveLength(0); expect(await db.media.count()).toBe(0);
        expect(f.host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(1);
        expect(f.host.actions().some(action => ["discardPrepared", "revokeDirectory"].includes(action.type))).toBe(false);
        expect((await inspectDesktopMediaImport(f.input.id, f.project.id, undefined, f.host.services)).status).toBe("unknown");
        await importDesktopMedia(f.input, {services: f.host.services});
        expect(f.host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(1);
    });
    it("reconciles provable stopped owners after reload while missing/foreign owners remain unknown", async () => {
        const f = await fixture();
        const {admitDesktopMediaImport} = await import("@/features/library/commands/desktopMediaImport");
        await admitDesktopMediaImport(f.input);
        const operationId = desktopMediaOperationId(f.input.id, f.input.selection.items[0].entryId);
        f.host.states.set(operationId, {status: "stopped", operationId, error: {code: "canceled", message: "已停止"}});
        expect((await inspectDesktopMediaImport(f.input.id, f.project.id, undefined, f.host.services)).status).toBe("stopped");
        const second = await fixture(); await admitDesktopMediaImport(second.input);
        expect((await inspectDesktopMediaImport(second.input.id, second.project.id, undefined, second.host.services)).status).toBe("unknown");
        expect(second.host.actions().some(action => action.type === "prepareVideo")).toBe(false);
    });
});
