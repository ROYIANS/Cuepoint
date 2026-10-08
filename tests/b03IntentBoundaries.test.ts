import {afterEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";

// Run the actual component functions and capture their event props with a small
// deterministic hook host. Storage is real Dexie over fake-indexeddb; this host
// does not claim DOM, Radix event delivery, effects, or live-query scheduling.
type Host = {cells: unknown[]; cursor: number; results: unknown[]; queryIndex: number};
const runtime = vi.hoisted(() => ({active: undefined as Host | undefined}));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    return {...react,
        useState: (initial: unknown) => {
            const host = runtime.active!; const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = typeof initial === "function" ? initial() : initial;
            return [host.cells[index], (next: unknown) => {
                host.cells[index] = typeof next === "function" ? next(host.cells[index]) : next;
            }];
        },
        useRef: (initial: unknown) => {
            const host = runtime.active!; const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = {current: initial};
            return host.cells[index];
        },
        useEffect: () => {}, useContext: () => false,
        useMemo: (compute: () => unknown) => compute(), useCallback: (callback: unknown) => callback,
    };
});
vi.mock("dexie-react-hooks", () => ({useLiveQuery: () => {
    const host = runtime.active!; return host.results[host.queryIndex++];
}}));
vi.mock("antd", () => ({Switch: () => null, InputNumber: () => null}));
vi.mock("@tanstack/react-router", () => ({Link: () => null, useBlocker: () => ({status: "idle"})}));
vi.mock("@dnd-kit/core", () => ({DndContext: () => null, PointerSensor: {}, KeyboardSensor: {}, closestCenter: {}, useSensor: vi.fn(), useSensors: () => []}));
vi.mock("@dnd-kit/sortable", () => ({SortableContext: () => null, sortableKeyboardCoordinates: {}, verticalListSortingStrategy: {}, useSortable: () => ({setNodeRef: vi.fn()})}));
vi.mock("@/lib/undo", () => ({useUndo: () => ({registerUndo: vi.fn()})}));
vi.mock("@/lib/useShotMedia", () => ({useShotMedia: () => new Map()}));
vi.mock("@/components/shots/ShotRowViewport", () => ({ShotScrollViewport: () => null, useShotRowViewport: () => ({rowRef: vi.fn(), nearViewport: true})}));
vi.mock("sonner", () => ({toast: {error: vi.fn(), success: vi.fn()}}));

import {toast} from "sonner";
import {db} from "@/db/database";
import * as repoProjects from "@/db/projects";
import * as repoShots from "@/db/shots";
import * as repoAssets from "@/db/assets";
import * as repoChat from "@/db/chat";
import * as contextSettings from "@/db/contextSettings";
import {GENERAL_AGENT_ID} from "@/domain/agent";
import {DEFAULT_CONTEXT_POLICY} from "@/lib/agent/contextPolicy";
import {emptySlot} from "@/domain/slot";
import {ContextParameters} from "@/components/agent/ContextParameters";
import {ShotEditorPage} from "@/components/shots/ShotEditorPage";
import {DropdownMenuCheckboxItem} from "@/components/ui/dropdown-menu";

type Node = ReactElement<Record<string, unknown>>;
function nodes(tree: unknown): Node[] {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Node; return [node, ...nodes(node.props.children)];
}
function host(results: unknown[] = []): Host {return {cells: [], cursor: 0, results, queryIndex: 0};}
function draw(target: Host, run: () => unknown) {
    runtime.active = target; target.cursor = 0; target.queryIndex = 0;
    return nodes(run());
}
function invoke(node: Node) {
    return (node.type as (props: Record<string, unknown>) => unknown)(node.props);
}
function change(tree: Node[], id: string, value: unknown) {
    (tree.find(node => node.props.id === id)!.props.onChange as (value: unknown) => void)(value);
}
async function settle() {for (let i = 0; i < 5; i++) await Promise.resolve();}
async function mutations(spy: {mock: {results: Array<{value: unknown}>}}) {
    await Promise.all(spy.mock.results.map(result => result.value)); await settle();
}
async function fixture() {
    const project = await repoProjects.createProject("B03");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shot = await repoShots.addShot(project.id, episode.id);
    const a = await repoAssets.addCharacter(project.id); const b = await repoAssets.addCharacter(project.id);
    return {project, episode, shot, a, b};
}
async function rowCallbacks(f: Awaited<ReturnType<typeof fixture>>) {
    const renderedShot = (await db.shots.get(f.shot.id))!;
    const results = [
        {projectId: f.project.id, project: f.project},
        {projectId: f.project.id, episodeId: f.episode.id, episode: f.episode},
        {projectId: f.project.id, episodeId: f.episode.id, shots: [renderedShot]},
        {projectId: f.project.id, characters: [f.a, f.b], scenes: []},
        {projectId: f.project.id, props: [], styles: []},
    ];
    const wrapper = ShotEditorPage({projectId: f.project.id, episodeId: f.episode.id}) as Node;
    let tree = draw(host(results), () => invoke(wrapper));
    // Traverse the production page -> beat -> row functions. No callback logic
    // is copied into this fixture and ShotRow needs no test-only export.
    const beat = tree.find(node => typeof node.type === "function" && node.type.name === "BeatBlock")!;
    tree = draw(host(), () => invoke(beat));
    const view = tree.find(node => typeof node.type === "function" && node.type.name === "BeatBlockView")!;
    tree = draw(host(), () => invoke(view));
    const row = tree.find(node => typeof node.type === "function" && node.type.name === "ShotRow")!;
    tree = draw(host(), () => invoke(row));
    return {
        select: (id: string, selected: boolean) => {
            const checkbox = tree.find(node => node.type === DropdownMenuCheckboxItem && node.key === id)!;
            (checkbox.props.onCheckedChange as (value: boolean) => void)(selected);
        },
        clear: () => {
            const clear = tree.find(node => node.props.children === "清除" && node.props.onSelect)!;
            (clear.props.onSelect as (event: unknown) => void)({preventDefault() {}});
        },
    };
}
afterEach(() => {vi.restoreAllMocks();});

describe("B03 context policy intent", () => {
    it.each(["thread", "default"] as const)("preserves two stale-render callbacks on different %s fields", async owner => {
        const thread = await repoChat.createChatThread();
        const threadId = owner === "thread" ? thread.id : undefined;
        const source = owner === "thread" ? thread : (await db.agents.get(GENERAL_AGENT_ID))!;
        const ui = host([{scopeKey: threadId ?? GENERAL_AGENT_ID, source}]); const tree = draw(ui, () => ContextParameters({threadId, onBack: vi.fn()}));
        const update = vi.spyOn(contextSettings, "updateContextPolicy");
        change(tree, "context-auto", false); await mutations(update);
        // The same original render remains captured after storage commits.
        change(tree, "context-history", true); await mutations(update);
        expect(update.mock.calls.map(call => call[1])).toEqual([{autoCompress: false}, {limitHistory: true}]);
        const saved = threadId ? await db.chatThreads.get(threadId) : await db.agents.get(GENERAL_AGENT_ID);
        expect(saved?.contextPolicy).toEqual({...DEFAULT_CONTEXT_POLICY, autoCompress: false, limitHistory: true});
    });

    it.each(["thread", "default"] as const)("merges concurrent actual callbacks and commits same-field %s intent in order", async owner => {
        const thread = await repoChat.createChatThread();
        const threadId = owner === "thread" ? thread.id : undefined;
        const source = owner === "thread" ? thread : (await db.agents.get(GENERAL_AGENT_ID))!;
        const render = () => draw(host([{scopeKey: threadId ?? GENERAL_AGENT_ID, source}]), () => ContextParameters({threadId, onBack: vi.fn()}));
        const first = render(); const second = render();
        const update = vi.spyOn(contextSettings, "updateContextPolicy");
        change(first, "context-auto", false); change(second, "context-history", true); await mutations(update);
        const read = () => threadId ? db.chatThreads.get(threadId) : db.agents.get(GENERAL_AGENT_ID);
        expect((await read())?.contextPolicy).toMatchObject({autoCompress: false, limitHistory: true});
        // Both hosts still contain their initial query result. Explicit values,
        // rather than a revision or a toggle, decide the last committed field.
        change(first, "context-auto", false); change(second, "context-auto", true);
        const committed: boolean[] = [];
        await Promise.all(update.mock.results.slice(2).map((result, i) =>
            (result.value as Promise<void>).then(() => committed.push([false, true][i]))));
        expect((await read())?.contextPolicy?.autoCompress).toBe(committed.at(-1));
        expect((await read())?.contextPolicy?.limitHistory).toBe(true);
    });

    it("disables mismatched/pending/missing/error policy reads and rejects callbacks captured before a thread switch", async () => {
        const a = await repoChat.createChatThread(); const b = await repoChat.createChatThread();
        const ui = host([{scopeKey: a.id, source: a}]);
        const old = draw(ui, () => ContextParameters({threadId: a.id, onBack: vi.fn()}));
        const update = vi.spyOn(contextSettings, "updateContextPolicy");
        for (const result of [undefined, {scopeKey: a.id, source: a}, {scopeKey: b.id, source: null}, {scopeKey: b.id, source: null, error: "read failed"}]) {
            ui.results = [result];
            const pending = draw(ui, () => ContextParameters({threadId: b.id, onBack: vi.fn()}));
            expect(pending.find(node => node.props.id === "context-auto")?.props.disabled).toBe(true);
            change(pending, "context-auto", false);
        }
        change(old, "context-auto", false); await settle();
        expect(update).not.toHaveBeenCalled();
        ui.results = [{scopeKey: b.id, source: b}];
        const current = draw(ui, () => ContextParameters({threadId: b.id, onBack: vi.fn()}));
        change(current, "context-history", true); await mutations(update);
        expect(update).toHaveBeenCalledWith(b.id, {limitHistory: true});
        expect((await db.chatThreads.get(a.id))?.contextPolicy?.limitHistory).toBe(false);
    });

    it("clears optional local tokens through the actual input while preserving latest independent fields", async () => {
        const thread = await repoChat.createChatThread();
        await contextSettings.updateContextPolicy(thread.id, {customContextTokens: 8192});
        const source = (await db.chatThreads.get(thread.id))!;
        const tree = draw(host([{scopeKey: thread.id, source}]), () => ContextParameters({threadId: thread.id, onBack: vi.fn()}));
        await contextSettings.updateContextPolicy(thread.id, {historyMessageCount: 77});
        const update = vi.spyOn(contextSettings, "updateContextPolicy");
        change(tree, "context-local-budget", null); await mutations(update);
        expect(update).toHaveBeenCalledWith(thread.id, {customContextTokens: undefined});
        expect((await db.chatThreads.get(thread.id))?.contextPolicy).toEqual({...DEFAULT_CONTEXT_POLICY, historyMessageCount: 77});
    });

    it("reset and save-as-default replace the full latest policy including absent optional tokens", async () => {
        const thread = await repoChat.createChatThread();
        await contextSettings.updateContextPolicy(thread.id, {customContextTokens: 8192, limitHistory: true});
        const source = (await db.chatThreads.get(thread.id))!;
        const tree = draw(host([{scopeKey: thread.id, source}]), () => ContextParameters({threadId: thread.id, onBack: vi.fn()}));
        await contextSettings.updateContextPolicy(undefined, {historyMessageCount: 44});
        const reset = vi.spyOn(contextSettings, "resetThreadContextPolicy");
        (tree.find(node => node.props.onClick && Array.isArray(node.props.children) && node.props.children.includes("恢复默认"))!.props.onClick as () => void)();
        await mutations(reset);
        expect((await db.chatThreads.get(thread.id))?.contextPolicy).toEqual({...DEFAULT_CONTEXT_POLICY, historyMessageCount: 44});
        await contextSettings.updateContextPolicy(undefined, {customContextTokens: 16384, autoCompress: false});
        await contextSettings.updateContextPolicy(thread.id, {historyMessageCount: 55});
        const save = vi.spyOn(contextSettings, "saveContextPolicyAsDefault");
        (tree.find(node => node.props.children === "设为默认")!.props.onClick as () => void)(); await mutations(save);
        expect((await db.agents.get(GENERAL_AGENT_ID))?.contextPolicy).toEqual({...DEFAULT_CONTEXT_POLICY, historyMessageCount: 55});
        expect((await repoChat.createChatThread()).contextPolicy).toEqual({...DEFAULT_CONTEXT_POLICY, historyMessageCount: 55});
    });

    it("normalizes merged fields and rolls back missing-thread reset/default changes", async () => {
        const thread = await repoChat.createChatThread();
        await contextSettings.updateContextPolicy(thread.id, {limitHistory: true, historyMessageCount: 31, customContextTokens: 8192});
        await contextSettings.updateContextPolicy(thread.id, {historyMessageCount: -1, customContextTokens: 1});
        expect((await db.chatThreads.get(thread.id))?.contextPolicy).toEqual({...DEFAULT_CONTEXT_POLICY, limitHistory: true});
        const agent = await db.agents.get(GENERAL_AGENT_ID);
        await expect(contextSettings.updateContextPolicy("missing", {autoCompress: false})).rejects.toThrow("对话不存在");
        await expect(contextSettings.resetThreadContextPolicy("missing")).rejects.toThrow("对话不存在");
        await expect(contextSettings.saveContextPolicyAsDefault("missing")).rejects.toThrow("对话不存在");
        expect(await db.agents.get(GENERAL_AGENT_ID)).toEqual(agent);
        expect(await db.chatThreads.get("missing")).toBeUndefined();
    });
});

describe("B03 shot character selection intent", () => {
    it("keeps rapid add/add from the actual same-render row callbacks and unrelated edits", async () => {
        const f = await fixture(); const ui = await rowCallbacks(f);
        const select = vi.spyOn(repoShots, "setShotCharacterSelected");
        const oldTime = "2000-01-01T00:00:00.000Z";
        await db.projects.update(f.project.id, {updatedAt: oldTime});
        const mediaSlot = {...emptySlot(), prompt: "preserved media draft"};
        ui.select(f.a.id, true); ui.select(f.b.id, true);
        await Promise.all([mutations(select), repoShots.patchShot(f.shot.id, {notes: "latest notes"}), repoShots.setShotSlot(f.shot.id, "firstFrame", mediaSlot)]);
        expect(select.mock.calls).toEqual([[f.shot.id, f.a.id, true], [f.shot.id, f.b.id, true]]);
        expect(await db.shots.get(f.shot.id)).toEqual({...f.shot, characterIds: [f.a.id, f.b.id], notes: "latest notes", firstFrame: mediaSlot});
        expect((await db.projects.get(f.project.id))?.updatedAt).not.toBe(oldTime);
    });

    it("keeps rapid add/remove and duplicate selected values idempotent on the actual old render", async () => {
        const f = await fixture(); await repoShots.patchShot(f.shot.id, {characterIds: [f.a.id]});
        const ui = await rowCallbacks(f); const select = vi.spyOn(repoShots, "setShotCharacterSelected");
        ui.select(f.b.id, true); ui.select(f.a.id, false); await mutations(select);
        expect((await db.shots.get(f.shot.id))?.characterIds).toEqual([f.b.id]);
        ui.select(f.b.id, true); ui.select(f.b.id, true); ui.select(f.a.id, false); ui.select(f.a.id, false);
        await mutations(select);
        expect((await db.shots.get(f.shot.id))?.characterIds).toEqual([f.b.id]);
        ui.select(f.b.id, true); ui.select(f.b.id, false); await mutations(select);
        expect((await db.shots.get(f.shot.id))?.characterIds).toEqual([]);
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("retains whole-array patch and the actual clear command as exact replacements", async () => {
        const f = await fixture(); const ui = await rowCallbacks(f);
        await repoShots.setShotCharacterSelected(f.shot.id, f.a.id, true);
        await repoShots.setShotCharacterSelected(f.shot.id, f.b.id, true);
        await repoShots.patchShot(f.shot.id, {characterIds: [f.b.id]});
        expect((await db.shots.get(f.shot.id))?.characterIds).toEqual([f.b.id]);
        const patch = vi.spyOn(repoShots, "patchShot"); ui.clear(); await mutations(patch);
        expect(patch).toHaveBeenCalledWith(f.shot.id, {characterIds: []});
        expect((await db.shots.get(f.shot.id))?.characterIds).toEqual([]);
    });

    it.each([true, false])("rejects a foreign target for selected=%s without touching row/project", async selected => {
        const f = await fixture(); const foreign = await repoAssets.addCharacter((await repoProjects.createProject("foreign")).id);
        const original = await db.shots.get(f.shot.id); const project = await db.projects.get(f.project.id);
        await expect(repoShots.setShotCharacterSelected(f.shot.id, foreign.id, selected)).rejects.toThrow("角色不属于当前项目");
        expect(await db.shots.get(f.shot.id)).toEqual(original); expect(await db.projects.get(f.project.id)).toEqual(project);
    });

    it.each(["shot", "project", "episode", "foreign episode", "character", "surviving character", "scene", "prop", "style"])("validates latest missing/foreign %s atomically", async broken => {
        const f = await fixture();
        if (broken === "shot") await db.shots.delete(f.shot.id);
        if (broken === "project") await db.projects.delete(f.project.id);
        if (broken === "episode") await db.episodes.delete(f.episode.id);
        if (broken === "foreign episode") {
            const other = await repoProjects.createProject("foreign"); await db.episodes.update(f.episode.id, {projectId: other.id});
        }
        if (broken === "character") await db.characters.delete(f.a.id);
        if (broken === "surviving character") await db.shots.update(f.shot.id, {characterIds: ["deleted"]});
        if (broken === "scene") await db.shots.update(f.shot.id, {sceneId: "deleted"});
        if (broken === "prop") await db.shots.update(f.shot.id, {propIds: ["deleted"]});
        if (broken === "style") await db.shots.update(f.shot.id, {styleId: "deleted"});
        const original = await db.shots.get(f.shot.id); const project = await db.projects.get(f.project.id);
        await expect(repoShots.setShotCharacterSelected(f.shot.id, f.a.id, true)).rejects.toThrow();
        expect(await db.shots.get(f.shot.id)).toEqual(original); expect(await db.projects.get(f.project.id)).toEqual(project);
        expect(await db.characters.get("deleted")).toBeUndefined();
    });

    it("allows removal to repair one deleted reference, never reselects it, and rejects other invalid survivors", async () => {
        const f = await fixture(); await repoShots.patchShot(f.shot.id, {characterIds: [f.a.id, f.b.id]});
        const ui = await rowCallbacks(f); const select = vi.spyOn(repoShots, "setShotCharacterSelected");
        await db.characters.delete(f.a.id);
        ui.select(f.a.id, false); await mutations(select);
        expect((await db.shots.get(f.shot.id))?.characterIds).toEqual([f.b.id]);
        ui.select(f.a.id, true);
        await Promise.allSettled(select.mock.results.map(result => result.value)); await settle();
        expect(toast.error).toHaveBeenCalledWith("保存角色失败，请重试");
        expect((await db.shots.get(f.shot.id))?.characterIds).toEqual([f.b.id]);
        expect(await db.characters.get(f.a.id)).toBeUndefined();
        await db.shots.update(f.shot.id, {characterIds: [f.a.id, "another-deleted"]});
        const original = await db.shots.get(f.shot.id); const project = await db.projects.get(f.project.id);
        await expect(repoShots.setShotCharacterSelected(f.shot.id, f.a.id, false)).rejects.toThrow();
        expect(await db.shots.get(f.shot.id)).toEqual(original); expect(await db.projects.get(f.project.id)).toEqual(project);
    });
});
