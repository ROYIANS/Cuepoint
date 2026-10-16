import {describe, expect, it, vi} from "vitest";
import {createSkillDirectoryImportServices} from "@/platform/runtime/skillImport";
import type {NativeSession} from "@/platform/storage/protocol";

const session: NativeSession = {version: 1, session: "24d6f0af-8917-4b9e-8114-07b080a0cff6", workspaceId: "b923330b-f7aa-4477-8cff-b51954309668", generation: 1};
const operationId = "skillimport_1";
const captured = () => ({status: "captured", operationId, directoryName: "creative-flow",
    files: [{path: "SKILL.md", text: "\ufeff---\r\nname: creative-flow\r\ndescription: 描述\r\n---\r\n正文\r\n"}, {path: "references/guide.md", text: "参考\r\n"}],
    exclusions: {count: 1, paths: ["scripts"]}});

describe("one-shot native skill import transport", () => {
    it("uses the current fixed session and preserves captured bytes with no path request", async () => {
        const raw = captured();
        const call = vi.fn().mockResolvedValue(raw);
        const getSession = vi.fn().mockResolvedValue(session);
        const services = createSkillDirectoryImportServices(getSession, call);
        const result = await services.pickDirectory(operationId);
        expect(result).toEqual(raw);
        expect(call).toHaveBeenCalledExactlyOnceWith("skill_import_directory", {request: {...session, operationId}});
        expect(getSession).toHaveBeenCalledTimes(1);
        if (result.status !== "captured") throw new Error("expected captured result");
        expect(new TextEncoder().encode(result.files[0].text)).toEqual(new TextEncoder().encode(raw.files[0].text));
        raw.files[0].text = "changed after decoding";
        expect(result.files[0].text).not.toEqual(raw.files[0].text);
        expect(Object.isFrozen(result.files)).toBe(true);
        expect(Object.isFrozen(result.files[0])).toBe(true);
    });

    it("returns native chooser cancellation without installation or another call", async () => {
        const call = vi.fn().mockResolvedValue({status: "canceled", operationId});
        const result = await createSkillDirectoryImportServices(async () => session, call).pickDirectory(operationId);
        expect(result).toEqual({status: "canceled", operationId});
        expect(call).toHaveBeenCalledTimes(1);
    });

    it("blocks duplicate gestures synchronously and releases the slot after the real response", async () => {
        let complete!: (value: unknown) => void;
        const call = vi.fn().mockReturnValue(new Promise(resolve => {complete = resolve;}));
        const services = createSkillDirectoryImportServices(async () => session, call);
        const pending = services.pickDirectory(operationId);
        await expect(services.pickDirectory("second")).rejects.toThrow("仍在进行");
        await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(1));
        complete({status: "canceled", operationId});
        await pending;
        call.mockResolvedValueOnce({status: "canceled", operationId: "second"});
        await expect(services.pickDirectory("second")).resolves.toEqual({status: "canceled", operationId: "second"});
        expect(call).toHaveBeenCalledTimes(2);
    });

    it.each(["../path", "", "x".repeat(129), "file:target"])("rejects invalid operation identity before native invoke: %s", async invalid => {
        const call = vi.fn();
        await expect(createSkillDirectoryImportServices(async () => session, call).pickDirectory(invalid)).rejects.toThrow();
        expect(call).not.toHaveBeenCalled();
    });

    it.each([
        ["platform", "macOS 或 Windows"], ["nativeFilesystem", "本地固定 NTFS"], ["nativeIdentity", "安全读取"],
        ["busy", "仍在进行"], ["changed", "发生变化"], ["containment", "链接"], ["skillLimit", "超过"],
        ["skillText", "UTF-8"], ["skillPath", "文件名"], ["skillRoot", "SKILL.md"],
    ])("maps bounded native %s errors to useful fixed copy", async (code, expected) => {
        const call = vi.fn().mockRejectedValue({code, message: "/Users/private/path should not be displayed"});
        const services = createSkillDirectoryImportServices(async () => session, call);
        await expect(services.pickDirectory(operationId)).rejects.toThrow(expected);
        expect(call).toHaveBeenCalledTimes(1);
    });

    it("does not claim a lost reply canceled the native picker or installed content", async () => {
        const call = vi.fn().mockRejectedValue(new Error("transport lost"));
        const services = createSkillDirectoryImportServices(async () => session, call);
        await expect(services.pickDirectory(operationId)).rejects.toThrow("完成系统选择窗口");
        expect(call).toHaveBeenCalledTimes(1);
        call.mockResolvedValueOnce({status: "canceled", operationId});
        await expect(services.pickDirectory(operationId)).resolves.toEqual({status: "canceled", operationId});
    });

    const invalidReplies: Array<[string, () => unknown]> = [
        ["foreign operation", () => ({...captured(), operationId: "foreign"})],
        ["extra response field", () => ({...captured(), path: "/outside"})],
        ["extra file field", () => ({...captured(), files: [{path: "SKILL.md", text: "body", absolute: "/outside"}]})],
        ["missing root", () => ({...captured(), files: [{path: "references/a.txt", text: "body"}]})],
        ["script", () => ({...captured(), files: [...captured().files, {path: "scripts/a.txt", text: "body"}]})],
        ["binary extension", () => ({...captured(), files: [...captured().files, {path: "assets/a.png", text: "body"}]})],
        ["nested skill", () => ({...captured(), files: [...captured().files, {path: "references/other/SKILL.md", text: "body"}]})],
        ["hidden resource", () => ({...captured(), files: [...captured().files, {path: "assets/.hidden/a.md", text: "body"}]})],
        ["path escape", () => ({...captured(), files: [...captured().files, {path: "references/../a.md", text: "body"}]})],
        ["device name", () => ({...captured(), files: [...captured().files, {path: "references/CON.md", text: "body"}]})],
        ["case collision", () => ({...captured(), files: [...captured().files, {path: "references/GUIDE.md", text: "body"}]})],
        ["normalization collision", () => ({...captured(), files: [...captured().files, {path: "references/é.md", text: "one"}, {path: "references/e\u0301.md", text: "two"}]})],
        ["binary NUL", () => ({...captured(), files: [{path: "SKILL.md", text: "body\0"}]})],
        ["unpaired surrogate", () => ({...captured(), files: [{path: "SKILL.md", text: "body\ud800"}]})],
        ["resource byte excess", () => ({...captured(), files: [...captured().files, {path: "references/large.md", text: "界".repeat(43_691)}]})],
        ["document byte excess", () => ({...captured(), files: [{path: "SKILL.md", text: "a".repeat(40_977)}]})],
        ["file count excess", () => ({...captured(), files: [{path: "SKILL.md", text: "a"}, ...Array.from({length: 32}, (_, i) => ({path: `references/${i}.md`, text: "a"}))]})],
        ["raw package excess", () => ({...captured(), files: [{path: "SKILL.md", text: "body"}, ...Array.from({length: 4}, (_, i) => ({path: `references/${i}.md`, text: "a".repeat(131_072)}))]})],
        ["escaped response excess", () => ({...captured(), files: [{path: "SKILL.md", text: "body"}, ...Array.from({length: 4}, (_, i) => ({path: `references/${i}.md`, text: "\u0001".repeat(120_000)}))]})],
        ["bad exclusion count", () => ({...captured(), exclusions: {count: 0, paths: ["scripts"]}})],
        ["too many exclusion paths", () => ({...captured(), exclusions: {count: 21, paths: Array.from({length: 21}, (_, i) => `file${i}.bin`)}})],
        ["unbounded exclusion count", () => ({...captured(), exclusions: {count: 1_025, paths: []}})],
        ["invalid exclusion name", () => ({...captured(), exclusions: {count: 1, paths: ["scripts/"]}})],
    ];
    it.each(invalidReplies)("rejects %s snapshot without native replay", async (_label, makeReply) => {
        const call = vi.fn().mockResolvedValue(makeReply());
        await expect(createSkillDirectoryImportServices(async () => session, call).pickDirectory(operationId)).rejects.toThrow("未能取得技能文件夹内容");
        expect(call).toHaveBeenCalledTimes(1);
    });
});
