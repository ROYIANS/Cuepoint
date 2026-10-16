import {describe, expect, it} from "vitest";
import {filterSettings, isSettingsSectionId, type SettingsSection} from "@/features/settings/ui/settingsModel";

const sections: SettingsSection[] = [
    {id: "general", title: "通用", rows: [
        {id: "automatic", title: "启动时自动检查更新", description: "每天最多检查一次", keywords: "GitHub release AUTO"},
        {id: "checked", title: "上次检查时间", description: "本机最近成功检查的时间"},
    ]},
    {id: "appearance", title: "外观", rows: [
        {id: "theme", title: "主题", description: "深色界面", keywords: "Dark Theme"},
        {id: "language", title: "语言", description: "简体中文"},
    ]},
    {id: "update", title: "关于与更新", rows: [
        {id: "version", title: "当前版本", description: "桌面应用版本", keywords: "release version"},
        {id: "check", title: "检查更新"},
    ]},
];

describe("settings search", () => {
    it.each(["", " ", " \t\n "])("keeps all sections and rows for blank query %j", query => {
        expect(filterSettings(sections, query)).toEqual(sections);
    });

    it("keeps an entire section when its title matches", () => {
        expect(filterSettings(sections, "  外观  ")).toEqual([sections[1]]);
    });

    it.each([
        ["启动时", "general", "automatic"],
        ["本机最近成功", "general", "checked"],
        ["  dArK tHeMe ", "appearance", "theme"],
        ["GITHUB", "general", "automatic"],
    ])("matches %j against row title, description or keywords", (query, sectionId, rowId) => {
        const result = filterSettings(sections, query);
        expect(result.map(section => section.id)).toEqual([sectionId]);
        expect(result[0].rows.map(row => row.id)).toEqual([rowId]);
    });

    it("retains only matching rows in every matching section, in authored order", () => {
        const result = filterSettings(sections, "release");
        expect(result.map(section => section.id)).toEqual(["general", "update"]);
        expect(result.map(section => section.rows.map(row => row.id))).toEqual([["automatic"], ["version"]]);
        expect(result.map(section => section.title)).toEqual(["通用", "关于与更新"]);
    });

    it("treats missing optional row text as empty and returns no unrelated results", () => {
        expect(filterSettings(sections, "不存在的设置")).toEqual([]);
        expect(filterSettings(sections, "undefined")).toEqual([]);
        expect(filterSettings(sections, "null")).toEqual([]);
    });

    it("leaves the input usable for a later query after narrowing rows", () => {
        const before = structuredClone(sections);
        filterSettings(sections, "Dark");
        expect(sections).toEqual(before);
        expect(filterSettings(sections, "外观")[0].rows.map(row => row.id)).toEqual(["theme", "language"]);
    });
});

describe("settings section identifiers", () => {
    it.each(["general", "appearance", "models", "mcp", "skills", "storage", "update"])("accepts %s", value => {
        expect(isSettingsSectionId(value)).toBe(true);
    });

    it.each([undefined, null, 1, {}, ["general"], "", "General", "updates", " general"])("rejects %j", value => {
        expect(isSettingsSectionId(value)).toBe(false);
    });
});
