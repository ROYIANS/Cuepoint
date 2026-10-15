import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import type {StoreTx} from "@/platform/storage/types";

const host = vi.hoisted(() => ({
    cells: [] as unknown[], cursor: 0, mounted: true, lateWrites: 0,
    result: {value: undefined, error: null} as {value: unknown; error: Error | null},
    query: undefined as ((tx: StoreTx) => unknown) | undefined,
    cleanups: [] as Array<() => void>, writePreference: vi.fn(),
}));
vi.mock("react", async original => ({...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = host.cursor++;
        if (!(index in host.cells)) host.cells[index] = typeof initial === "function" ? initial() : initial;
        return [host.cells[index], (next: unknown) => {
            if (!host.mounted) host.lateWrites++;
            host.cells[index] = typeof next === "function" ? next(host.cells[index]) : next;
        }];
    },
    useRef: (initial: unknown) => {
        const index = host.cursor++;
        if (!(index in host.cells)) host.cells[index] = {current: initial};
        return host.cells[index];
    },
    useEffect: (setup: () => void | (() => void)) => {
        const index = host.cursor++;
        if (!(index in host.cells)) {
            host.cells[index] = true;
            const cleanup = setup();
            if (cleanup) host.cleanups.push(cleanup);
        }
    },
}));
vi.mock("@/platform/product/queries", () => ({useProductQueryState: (query: (tx: StoreTx) => unknown) => {
    host.query = query;
    return host.result;
}}));
vi.mock("@/features/settings/ui/settingsStore", async original => ({
    ...await original<typeof import("@/features/settings/ui/settingsStore")>(), writeAutoCheckUpdates: host.writePreference,
}));

import {GeneralSection} from "@/features/settings/ui/sections/GeneralSection";
import {StorageSection} from "@/features/settings/ui/sections/StorageSection";
import {SettingsRow} from "@/features/settings/ui/SettingsCard";
import {Switch} from "@/ui/switch";
import {db} from "@/platform/product/store";
import {putDeviceSetting} from "@/features/settings/commands/deviceSettings";
import {createProject} from "@/features/projects/commands/projects";
import {addCharacter, addProp, addScene, addStyle} from "@/features/library/commands/assets";

// Keep production row controls/callbacks; only the query subscription and writer
// are substituted. Captured queries below execute real StoreTx snapshots.
type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children), ...nodes(node.props.control)];
}
function draw(run: () => unknown): Node[] {
    host.cursor = 0;
    return nodes(run());
}
function row(tree: Node[], title: string): Node {
    const result = tree.find(node => node.type === SettingsRow && node.props.title === title);
    expect(result).toBeDefined();
    return result!;
}
function control(tree: Node[]): Node {
    const result = tree.find(node => node.type === Switch);
    expect(result).toBeDefined();
    return result!;
}
function toggle(tree: Node[], checked: boolean) {
    (control(tree).props.onCheckedChange as (checked: boolean) => void)(checked);
}
function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => {resolve = yes; reject = no;});
    return {promise, resolve, reject};
}
const flush = async () => {for (let index = 0; index < 6; index++) await Promise.resolve();};

beforeEach(() => {
    host.cells = [];
    host.cursor = 0;
    host.mounted = true;
    host.lateWrites = 0;
    host.result = {value: undefined, error: null};
    host.query = undefined;
    host.cleanups = [];
    host.writePreference.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
    host.mounted = false;
    host.cleanups.splice(0).forEach(cleanup => cleanup());
});

describe("general settings read and save feedback", () => {
    const render = () => GeneralSection({});

    it("disables the default switch and shows loading until preferences have been read", () => {
        const tree = draw(render);
        expect(control(tree).props.checked).toBe(false);
        expect(control(tree).props.disabled).toBe(true);
        expect(row(tree, "上次检查时间").props.description).toBe("正在读取…");
        expect(tree.some(node => node.props.role === "status")).toBe(false);
    });

    it("shows disabled-by-default preference and clear feedback when the initial read fails", () => {
        host.result = {value: undefined, error: new Error("workspace read failed")};
        const tree = draw(render);
        expect(control(tree).props.checked).toBe(false);
        expect(control(tree).props.disabled).toBe(false);
        expect(row(tree, "上次检查时间").props.description).toBe("尚未检查");
        expect(tree.find(node => node.props.role === "status")?.props.children).toBe("暂时无法读取偏好，当前使用默认值。");
        expect(host.writePreference).not.toHaveBeenCalled();
    });

    it("executes the real general query against the provided transaction snapshot", async () => {
        const at = Date.UTC(2026, 9, 14, 8);
        await putDeviceSetting("settings.autoCheckUpdates", true);
        await putDeviceSetting("settings.lastUpdateCheckAt", at);
        draw(render);
        const value = await db.transaction("r", ["deviceSettings"], tx => host.query!(tx));
        expect(value).toEqual({autoCheck: true, lastCheck: at});
        host.result = {value, error: null};
        const tree = draw(render);
        expect(control(tree).props.checked).toBe(true);
        expect(control(tree).props.disabled).toBe(false);
        expect(row(tree, "上次检查时间").props.description).not.toBe("尚未检查");
    });

    it("keeps a previously read preference on refresh failure and labels it accurately", () => {
        host.result = {value: {autoCheck: true, lastCheck: undefined}, error: new Error("refresh failed")};
        const tree = draw(render);
        expect(control(tree).props.checked).toBe(true);
        expect(control(tree).props.disabled).toBe(false);
        expect(tree.find(node => node.props.role === "status")?.props.children).toBe("暂时无法读取偏好，正在显示上次读取的设置。");
    });

    it("serializes rapid toggles and restores persisted state with retry feedback after failure", async () => {
        host.result = {value: {autoCheck: false, lastCheck: undefined}, error: null};
        const pending = deferred();
        host.writePreference.mockReturnValueOnce(pending.promise);
        const initial = draw(render);
        toggle(initial, true);
        toggle(initial, false);
        expect(host.writePreference).toHaveBeenCalledExactlyOnceWith(true);
        const saving = draw(render);
        expect(control(saving).props.checked).toBe(true);
        expect(control(saving).props.disabled).toBe(true);
        pending.reject(new Error("save failed"));
        await flush();
        const failed = draw(render);
        expect(control(failed).props.checked).toBe(false);
        expect(control(failed).props.disabled).toBe(false);
        expect(failed.find(node => node.props.role === "alert")?.props.children).toBe("偏好未能保存，请重试。");
        toggle(failed, true);
        await flush();
        expect(host.writePreference).toHaveBeenCalledTimes(2);
        expect(draw(render).some(node => node.props.role === "alert")).toBe(false);
    });

    it("does not publish a late failed-save message after the section is unmounted", async () => {
        host.result = {value: {autoCheck: false, lastCheck: undefined}, error: null};
        const pending = deferred();
        host.writePreference.mockReturnValueOnce(pending.promise);
        toggle(draw(render), true);
        host.mounted = false;
        host.cleanups.splice(0).forEach(cleanup => cleanup());
        pending.reject(new Error("late failure"));
        await flush();
        expect(host.lateWrites).toBe(0);
    });
});

describe("storage scale presentation", () => {
    const render = () => StorageSection({});

    it("shows loading instead of a fabricated empty inventory", () => {
        const tree = draw(render);
        expect(row(tree, "数据规模").props.description).toBe("正在读取…");
        expect(row(tree, "数据规模").props.description).not.toContain("0 个项目");
    });

    it("shows an explicit read failure rather than zeros or a retained successful count", () => {
        host.result = {value: {projects: 2, assets: 5}, error: new Error("storage read failed")};
        const tree = draw(render);
        expect(row(tree, "数据规模").props.description).toBe("暂时无法读取数据规模，请稍后重试。");
        expect(row(tree, "数据规模").props.description).not.toContain("2 个项目");
        expect(row(tree, "数据规模").props.description).not.toContain("0 个项目");
    });

    it("counts actual projects and all four asset types through its own read transaction", async () => {
        const project = await createProject("settings inventory");
        await createProject("second project");
        await addCharacter(project.id);
        await addScene(project.id);
        await addScene(project.id);
        await addProp(project.id);
        await addStyle(project.id);
        draw(render);
        const rootReads = [db.projects, db.characters, db.scenes, db.props, db.styles].map(table =>
            vi.spyOn(table, "count").mockRejectedValue(new Error("escaped read snapshot")));
        try {
            const value = await db.transaction("r", ["projects", "characters", "scenes", "props", "styles"], tx => host.query!(tx));
            expect(value).toEqual({projects: 2, assets: 5});
            rootReads.forEach(read => expect(read).not.toHaveBeenCalled());
            host.result = {value, error: null};
            expect(row(draw(render), "数据规模").props.description).toBe("2 个项目 · 5 项素材设定");
        } finally {
            rootReads.forEach(read => read.mockRestore());
        }
    });

    it("shows zero only after the real empty-workspace query succeeds", async () => {
        draw(render);
        const value = await db.transaction("r", ["projects", "characters", "scenes", "props", "styles"], tx => host.query!(tx));
        expect(value).toEqual({projects: 0, assets: 0});
        host.result = {value, error: null};
        expect(row(draw(render), "数据规模").props.description).toBe("0 个项目 · 0 项素材设定");
    });
});
