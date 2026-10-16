import {expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createProject} from "@/features/projects/commands/projects";
import {desktopMediaSelection, importDesktopMedia, ownsDesktopMediaImport, pickDesktopMediaDirectory, shutdownDesktopMediaImports} from "@/features/library/services/desktopMediaImport";
import {productEffectAdmission} from "@/platform/runtime/effectAdmission";
import {createSkillDirectoryImportServices, shutdownSkillDirectoryImports} from "@/platform/runtime/skillImport";
import {saveNativeBlob, shutdownNativeSaves} from "@/platform/runtime/nativeSystemServices";
import {sha256Bytes} from "@/platform/media/sha256";
import {interceptStoreTable} from "./helpers/storeFaults";
import {desktopMediaHost, deferred} from "./helpers/desktopMediaHost";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({invoke}));

it("quiesces actual desktop import before admission, original picker/save, and preserves original receipts until done", async () => {
    const project = await createProject("original shutdown"), host = desktopMediaHost(1), controller = new AbortController();
    const candidates = (await pickDesktopMediaDirectory(project.id, controller.signal, host.services))!;
    const id = crypto.randomUUID(), selection = desktopMediaSelection(candidates, host.entries.map(row => row.entryId), id);
    const admitted = deferred(), publish = deferred();
    const fault = interceptStoreTable(db, "desktopMediaImports", "add", async (tx, _args, next) => {
        admitted.resolve(); await tx.waitFor(publish.promise); return next();
    });
    const importing = importDesktopMedia({id, projectId: project.id, actor: {kind: "human"}, selection, signal: controller.signal}, {services: host.services});
    expect(ownsDesktopMediaImport(id, project.id)).toBe(true);
    await admitted.promise;
    const picked = deferred(), finishPick = deferred();
    const pickCall = vi.fn(async () => {picked.resolve(); await finishPick.promise; return {status: "canceled", operationId: "original-skill"};});
    const skills = createSkillDirectoryImportServices(async () => host.session, pickCall);
    const originalPick = skills.pickDirectory("original-skill"); await picked.promise;
    const finishing = deferred(), finishSave = deferred();
    const bytes = Uint8Array.of(7);
    invoke.mockImplementation(async (command: string) => {
        if (command === "product_save_begin") return {type: "ready", session: "12345678-1234-4234-8234-123456789012", chunkBytes: 262144};
        if (command === "product_save_chunk") return 1;
        if (command === "product_save_finish") {finishing.resolve(); await finishSave.promise; return {type: "saved", byteLength: 1, contentHash: sha256Bytes(bytes)};}
        if (command === "product_save_cancel") return true;
        throw new Error("unexpected request");
    });
    const originalSave = saveNativeBlob(new Blob([bytes]), "original.bin"); await finishing.promise;
    productEffectAdmission.close();
    const importsDone = shutdownDesktopMediaImports(), picksDone = shutdownSkillDirectoryImports(), savesDone = shutdownNativeSaves();
    expect(shutdownDesktopMediaImports()).toBe(importsDone); expect(shutdownSkillDirectoryImports()).toBe(picksDone); expect(shutdownNativeSaves()).toBe(savesDone);
    let complete = false; const all = Promise.all([importsDone, picksDone, savesDone]).then(() => {complete = true;});
    await Promise.resolve(); expect(complete).toBe(false); expect(ownsDesktopMediaImport(id, project.id)).toBe(true);
    await expect(skills.pickDirectory("late-pick")).rejects.toThrow("退出");
    await expect(saveNativeBlob(new Blob([bytes]), "late.bin")).rejects.toThrow("退出");
    await expect(pickDesktopMediaDirectory(project.id, controller.signal, host.services)).rejects.toThrow("退出");
    publish.resolve(); finishPick.resolve(); finishSave.resolve();
    expect((await importing).status).toBe("stopped"); await expect(originalPick).resolves.toMatchObject({status: "canceled"});
    await expect(originalSave).resolves.toBe("saved"); await all;
    expect(ownsDesktopMediaImport(id, project.id)).toBe(false);
    expect(host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(0);
    expect((await db.desktopMediaImports.get(id))?.status).toBe("stopped");
    expect(invoke.mock.calls.filter(([command]) => command === "product_save_finish")).toHaveLength(1);
    fault.mockRestore();
});
