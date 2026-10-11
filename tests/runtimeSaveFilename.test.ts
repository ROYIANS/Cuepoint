import {afterEach, describe, expect, it, vi} from "vitest";
import {downloadBlob, nativeSaveFilename} from "@/lib/runtimeSave";

const native = vi.hoisted(() => ({save: vi.fn()}));
vi.mock("@/lib/nativeSystemServices", () => ({saveNativeBlob: native.save}));

const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
function expectUsable(name: string) {
    expect(name).not.toBe("");
    expect([".", ".."]).not.toContain(name);
    expect(name).not.toMatch(/[\\/:*?"<>|\p{Cc}]/u);
    expect(name).not.toMatch(/[\uD800-\uDFFF]/u);
    expect(bytes(name)).toBeLessThanOrEqual(240);
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    native.save.mockReset();
});

describe("native export filename suggestions", () => {
    it.each(["我的项目-第一章.wav", "作品-分镜.csv", "素材库备份.zip", "封面 版本 2.PNG", "字幕.JSON"])("keeps a usable Chinese/format suggestion unchanged: %s", name => {
        expect(nativeSaveFilename(name)).toBe(name);
        expectUsable(nativeSaveFilename(name));
    });

    it("flattens path and filesystem punctuation without discarding the authored title", () => {
        const name = nativeSaveFilename('项目/第一章\\声音:样本*?"<>|.wav');
        expect(name).toBe("项目-第一章-声音-样本-.wav");
        expectUsable(name);
    });

    it("removes C0 and C1 Unicode controls before native metadata validation", () => {
        const name = nativeSaveFilename("录音\u0000\n\r\t\u007f\u0085\u009f样本.wav");
        expect(name).toBe("录音-样本.wav");
        expectUsable(name);
    });

    it("normalizes Unicode and repairs only malformed surrogate code units", () => {
        const name = nativeSaveFilename("Cafe\u0301-中文-\ud800-🎬-\udfff.wav");
        expect(name).toBe("Café-中文-�-🎬-�.wav");
        expectUsable(name);
    });

    it.each(["zip", "csv", "wav", "mp4", "docx", "tar.gz", "tar.bz2"])("keeps the usable .%s suffix when a multibyte title exceeds the byte limit", extension => {
        const original = `${"长标题🌹".repeat(90)}.${extension}`;
        const name = nativeSaveFilename(original);
        expect(name.endsWith(`.${extension}`)).toBe(true);
        expect(name.startsWith("长标题🌹")).toBe(true);
        expect(bytes(name)).toBeLessThanOrEqual(240);
        expect(bytes(name)).toBeGreaterThan(225);
        expectUsable(name);
        expect(nativeSaveFilename(name)).toBe(name);
    });

    it("counts UTF-8 bytes at the exact boundary and never splits an emoji or Chinese scalar", () => {
        const exact = `${"中".repeat(78)}aa.wav`;
        expect(bytes(exact)).toBe(240);
        expect(nativeSaveFilename(exact)).toBe(exact);
        const over = `${"中".repeat(78)}a🌹.wav`;
        expect(nativeSaveFilename(over)).toBe(`${"中".repeat(78)}a.wav`);
        expectUsable(nativeSaveFilename(over));
    });

    it("bounds a name with no usable suffix without treating a long dotted title as an extension", () => {
        const name = nativeSaveFilename(`中文项目.${"ending".repeat(100)}`);
        expect(name.startsWith("中文项目.")).toBe(true);
        expectUsable(name);
        expect(bytes(name)).toBe(240);
    });

    it.each(["", " ", ".", "..", "...", " . . ", "/../", ":::", "\u0000"])("uses a sensible name for an empty or unusable suggestion (%s)", name => {
        expect(nativeSaveFilename(name)).toBe("导出");
        expectUsable(nativeSaveFilename(name));
    });

    it("retains a usable suffix for an otherwise empty basename and removes path aliases", () => {
        expect(nativeSaveFilename(".zip")).toBe("导出.zip");
        const alias = nativeSaveFilename("../../作品\\声音.wav");
        expect(alias).toBe("-..-作品-声音.wav");
        expectUsable(alias);
        expect(nativeSaveFilename("  ..  ")).toBe("导出");
    });

    it("passes only a sanitized suggestion to native Save while preserving bytes, signal and cancellation", async () => {
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}});
        const create = vi.fn();
        vi.stubGlobal("document", {createElement: create});
        native.save.mockResolvedValue("canceled");
        const blob = new Blob([new Uint8Array([0, 255, 17])], {type: "audio/wav"});
        const controller = new AbortController();
        const filename = `${"桌面项目/音轨:".repeat(80)}.wav`;
        await expect(downloadBlob(blob, filename, controller.signal)).resolves.toBe("canceled");
        expect(native.save).toHaveBeenCalledExactlyOnceWith(blob, nativeSaveFilename(filename), controller.signal);
        expectUsable(native.save.mock.calls[0][1] as string);
        expect(await blob.arrayBuffer()).toEqual(new Uint8Array([0, 255, 17]).buffer);
        expect(create).not.toHaveBeenCalled();
    });

    it("leaves the browser anchor filename exact, including punctuation and length", async () => {
        vi.stubGlobal("window", {});
        const anchor = {href: "", download: "", click: vi.fn()};
        vi.stubGlobal("document", {createElement: vi.fn(() => anchor)});
        const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:filename-parity");
        const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        const blob = new Blob(["browser bytes"]), filename = `${"Web/原始标题:".repeat(80)}.zip`;
        await expect(downloadBlob(blob, filename)).resolves.toBe("saved");
        expect(anchor.download).toBe(filename);
        expect(anchor.click).toHaveBeenCalledOnce();
        expect(create).toHaveBeenCalledWith(blob);
        expect(revoke).toHaveBeenCalledWith("blob:filename-parity");
        expect(native.save).not.toHaveBeenCalled();
    });
});
