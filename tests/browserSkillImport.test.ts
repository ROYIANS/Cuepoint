import {describe, expect, it, vi} from "vitest";
import {prepareBrowserSkillImport} from "@/features/agent/skills/runtime/browserImport";

const text = "\uFEFF---\r\nname: portable\r\ndescription: Local workflow\r\n---\r\nUse selected tools.\r\n";
function file(path: string, content: string, size?: number) {
    const bytes = new TextEncoder().encode(content);
    const value = new File([bytes], path.split("/").at(-1)!);
    const read = vi.fn(async () => bytes.buffer);
    Object.defineProperty(value, "webkitRelativePath", {value: path});
    Object.defineProperty(value, "arrayBuffer", {value: read});
    if (size !== undefined) Object.defineProperty(value, "size", {value: size});
    return {value, read};
}

describe("browser skill directory capture", () => {
    it("preserves exact selected text and excludes scripts, binary, hidden and nested packages before reading", async () => {
        const root = file("portable/SKILL.md", text), reference = file("portable/references/guide.md", "Read me");
        const excluded = [file("portable/scripts/run.js", "throw 1"), file("portable/assets/image.png", "binary"),
            file("portable/references/.private.md", "hidden"), file("portable/references/nested/SKILL.md", "nested"),
            file("portable/references/nested/guide.md", "nested guide")];
        const candidate = await prepareBrowserSkillImport([root.value, reference.value, ...excluded.map(entry => entry.value)]);
        expect(candidate.document.text).toBe(text);
        expect(candidate.resources.map(entry => entry.path)).toEqual(["references/guide.md"]);
        expect(candidate.exclusions.count).toBe(5);
        expect(root.read).toHaveBeenCalledOnce(); expect(reference.read).toHaveBeenCalledOnce();
        for (const entry of excluded) expect(entry.read).not.toHaveBeenCalled();
    });
    it.each(["other/references/a.md", "portable/references/../a.md", "portable/references/AUX.txt", "portable/references/a:stream.txt", "portable/references/a\\b.md"])("rejects invalid root/path before any file reads: %s", async path => {
        const root = file("portable/SKILL.md", text), invalid = file(path, "x");
        await expect(prepareBrowserSkillImport([root.value, invalid.value])).rejects.toThrow();
        expect(root.read).not.toHaveBeenCalled(); expect(invalid.read).not.toHaveBeenCalled();
    });
    it("rejects case-fold collisions, count and byte limits before reading", async () => {
        const root = file("portable/SKILL.md", text), a = file("portable/references/a.md", "a"), b = file("portable/references/A.md", "b");
        await expect(prepareBrowserSkillImport([root.value, a.value, b.value])).rejects.toThrow("重名");
        const huge = file("portable/references/large.md", "x", 131_073);
        await expect(prepareBrowserSkillImport([root.value, huge.value])).rejects.toThrow("过大");
        await expect(prepareBrowserSkillImport({length: 1_025})).rejects.toThrow("条目");
        expect(root.read).not.toHaveBeenCalled(); expect(huge.read).not.toHaveBeenCalled();
    });
    it.each([
        ["portable/References/a.md"],
        ["portable/references/Folder/a.md", "portable/references/folder/b.md"],
        ["portable/references/café/a.md", "portable/references/cafe\u0301/b.md"],
        ["portable/references/leaf.md", "portable/references/leaf.md/nested.md"],
    ])("rejects resource component identity conflicts before reading %j", async (...paths) => {
        const root = file("portable/SKILL.md", text), resources = paths.map(path => file(path, "x"));
        await expect(prepareBrowserSkillImport([root.value, ...resources.map(entry => entry.value)])).rejects.toThrow();
        expect(root.read).not.toHaveBeenCalled();
        for (const resource of resources) expect(resource.read).not.toHaveBeenCalled();
    });
    it.each(["Portable", "portable--skill", "-portable", "a".repeat(65)])("rejects invalid root identity before reading %s", async name => {
        const root = file(`${name}/SKILL.md`, text);
        await expect(prepareBrowserSkillImport([root.value])).rejects.toThrow("文件夹名称");
        expect(root.read).not.toHaveBeenCalled();
    });
    it("rejects invalid UTF-8 through the common parser and changed declared sizes", async () => {
        const root = file("portable/SKILL.md", text), changed = file("portable/references/a.md", "content", 3);
        await expect(prepareBrowserSkillImport([root.value, changed.value])).rejects.toThrow("已变化");
        const bad = file("portable/SKILL.md", text);
        bad.read.mockResolvedValue(new Uint8Array([0xff]).buffer);
        Object.defineProperty(bad.value, "size", {value: 1});
        await expect(prepareBrowserSkillImport([bad.value])).rejects.toThrow();
    });
});
