import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import type {Episode, Project, Shot} from "@/domain/types";

const host = vi.hoisted(() => ({
    cells: [] as unknown[], cursor: 0, results: [] as unknown[], queryIndex: 0,
    queries: [] as Array<() => Promise<unknown>>, pathname: "", repository: undefined as unknown,
    navigate: vi.fn(), readError: undefined as string | undefined, retry: vi.fn(), registerUndo: vi.fn(),
}));
vi.mock("react", async original => {
    const actual = await original<typeof import("react")>();
    return {...actual,
        useState: (initial: unknown) => {const index = host.cursor++; if (!(index in host.cells)) host.cells[index] = typeof initial === "function" ? initial() : initial; return [host.cells[index], (next: unknown) => {host.cells[index] = typeof next === "function" ? next(host.cells[index]) : next;}];},
        useRef: (initial: unknown) => {const index = host.cursor++; if (!(index in host.cells)) host.cells[index] = {current: initial}; return host.cells[index];},
        useEffect: () => undefined,
        useMemo: (compute: () => unknown) => compute(), useCallback: (callback: unknown) => callback,
        useContext: () => false,
    };
});
vi.mock("@/lib/videoWorkspaceRepository", () => ({
    getVideoWorkspaceRepository: () => host.repository,
    useVideoWorkspaceRepository: () => host.repository,
    useVideoWorkspaceReadStatus: () => ({error: host.readError, retry: host.retry}),
    useVideoWorkspaceQuery: (query: () => Promise<unknown>) => {host.queries.push(query); return host.results[host.queryIndex++];},
}));
vi.mock("@tanstack/react-router", () => ({
    Link: () => null, Navigate: () => null, Outlet: () => null, useNavigate: () => host.navigate,
    createFileRoute: () => (options: unknown) => ({options}),
    useBlocker: () => ({status: "idle"}),
    useRouterState: ({select}: {select: (state: unknown) => unknown}) => select({location: {pathname: host.pathname}}),
}));
vi.mock("@dnd-kit/core", () => ({DndContext: () => null, PointerSensor: {}, KeyboardSensor: {}, closestCenter: {}, useSensor: vi.fn(), useSensors: () => []}));
vi.mock("@dnd-kit/sortable", () => ({SortableContext: () => null, sortableKeyboardCoordinates: {}, verticalListSortingStrategy: {}, useSortable: () => ({setNodeRef: vi.fn()})}));
vi.mock("@/lib/undo", () => ({useUndo: () => ({registerUndo: host.registerUndo})}));
vi.mock("@/lib/useShotMedia", () => ({useShotMedia: () => new Map()}));
vi.mock("@/components/shots/ShotRowViewport", () => ({ShotScrollViewport: () => null, useShotRowViewport: () => ({rowRef: vi.fn(), nearViewport: true})}));
vi.mock("sonner", () => ({toast: {error: vi.fn(), success: vi.fn()}}));

import {Outlet} from "@tanstack/react-router";
import {db} from "@/db/database";
import {emptyEpisode, emptyProject, emptyShot} from "@/db/productionRecords";
import {AppFrame} from "@/components/layout/AppFrame";
import {PageHeader, PageState} from "@/components/layout/PageLayout";
import {WorkspaceChrome} from "@/components/workspace/WorkspaceChrome";
import {ProjectHomePage} from "@/components/workspace/ProjectHomePage";
import {WorkspaceCapabilityState} from "@/components/workspace/WorkspaceCapabilityState";
import {StoryPage} from "@/components/story/StoryPage";
import {ShotEditorPage} from "@/components/shots/ShotEditorPage";
import {BeatTextField} from "@/components/story/BeatTextField";
import {ShotTextField} from "@/components/shots/ShotTextField";
import {TextDraftField} from "@/components/drafts/TextDraftField";
import {ShotRow} from "@/components/shots/ShotRow";
import {EditableGenerationSlot} from "@/components/slots/GenerationSlotCard";
import {VideoWorkspaceReadNotice} from "@/components/workspace/VideoWorkspaceReadNotice";
import {AudioWorkspacePage} from "@/components/audio/AudioWorkspacePage";
import {MusicWorkspacePage} from "@/components/music/MusicWorkspacePage";
import {Route as StudioRoute} from "@/routes/_studio";
import {StudioShell} from "@/components/studio/StudioShell";

// Execute the real page/row components with a deterministic hook host. Only the
// storage boundary is substituted; native assertions execute captured queriers.
type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    const children = node.type === PageHeader || node.type === PageState
        ? (node.type as (props: Record<string, unknown>) => unknown)(node.props) : node.props.children;
    return [node, ...nodes(children)];
}
function render(run: () => unknown, results: unknown[] = []) {host.cursor = 0; host.queryIndex = 0; host.queries = []; host.results = results; return nodes(run());}
function scoped(node: unknown) {const element = node as Node; return (element.type as (props: unknown) => unknown)(element.props);}
function fixture(runtime: "browser" | "native") {
    const project = emptyProject("同一套产品", "series"); const episode = emptyEpisode(project.id, 0, "第一集");
    episode.story.script = "正文";
    episode.story.beats = [{id: "beat", title: "开场", content: "正文", characterIds: [], timeOfDay: "日"}];
    const shot = emptyShot(project.id, episode.id, 0, "1", 3, "beat");
    const capabilities = ["world", "generation", "relations", "mediaSlots", "sync"].map(id => ({id, status: runtime === "native" ? "unavailable" : "available", reason: "此能力尚未接入"}));
    const repository = {
        runtime, capabilities: () => capabilities, capability: (id: string) => capabilities.find(item => item.id === id),
        project: vi.fn(async () => project), episode: vi.fn(async () => episode), episodes: vi.fn(async () => [episode]), shots: vi.fn(async () => [shot]),
        characters: vi.fn(async () => []), scenes: vi.fn(async () => []), props: vi.fn(async () => []), styles: vi.fn(async () => []),
        patchShot: vi.fn(async () => undefined), patchStoryBeat: vi.fn(async () => undefined),
    };
    host.repository = repository; return {project, episode, shot, repository};
}
function shellResults(project: Project, episode: Episode) {return [{projectId: project.id, project}, {projectId: project.id, episodeId: episode.id, episode}, {projectId: project.id, episode}];}
function shotResults(project: Project, episode: Episode, shot: Shot) {return [{projectId: project.id, project}, {projectId: project.id, episodeId: episode.id, episode}, {projectId: project.id, episodeId: episode.id, shots: [shot]}, {projectId: project.id, characters: [], scenes: []}, {projectId: project.id, props: [], styles: []}];}
beforeEach(() => {host.cells = []; host.readError = undefined; host.registerUndo.mockClear(); vi.stubGlobal("window", {addEventListener: vi.fn(), removeEventListener: vi.fn()});});

describe("shared video product page consumers", () => {
    it.each([
        {runtime: "native", pathname: "/assets", available: true},
        {runtime: "native", pathname: "/characters", available: false},
        {runtime: "browser", pathname: "/assets", available: true},
    ])("$runtime Studio route $pathname preserves its actual data owner boundary", ({runtime, pathname, available}) => {
        host.pathname = pathname;
        vi.stubGlobal("window", {
            addEventListener: vi.fn(), removeEventListener: vi.fn(),
            ...(runtime === "native" ? {__TAURI_INTERNALS__: {invoke: vi.fn()}} : {}),
        });
        const tree = render(() => (StudioRoute.options.component as () => unknown)());
        expect(tree.some(node => node.type === StudioShell)).toBe(true);
        expect(tree.some(node => node.type === Outlet)).toBe(available);
        expect(tree.some(node => node.type === WorkspaceCapabilityState)).toBe(!available);
        expect(tree.find(node => node.type === StudioShell)?.props.onImport === undefined).toBe(runtime === "native");
    });
    it.each(["browser", "native"] as const)("%s uses the same AppFrame, workspace header and nested Outlet", runtime => {
        const {project, episode} = fixture(runtime); host.pathname = `/p/${project.id}/e/${episode.id}/shots`;
        const tree = render(() => WorkspaceChrome({projectId: project.id}), shellResults(project, episode));
        expect(tree.some(node => node.type === AppFrame)).toBe(true);
        expect(tree.some(node => node.type === "header" && String(node.props.className).includes("workspace-header"))).toBe(true);
        expect(tree.some(node => node.type === Outlet)).toBe(true);
        expect(tree.some(node => node.type === WorkspaceCapabilityState)).toBe(false);
    });
    it("native unsupported routes keep the shared shell and do not mount their data owners", () => {
        const {project, episode} = fixture("native"); host.pathname = `/p/${project.id}/world`;
        const tree = render(() => WorkspaceChrome({projectId: project.id}), [{projectId: project.id, project}, {projectId: project.id, episodeId: undefined, episode: null}, {projectId: project.id, episode}]);
        expect(tree.some(node => node.type === AppFrame)).toBe(true);
        expect(tree.some(node => node.type === WorkspaceCapabilityState)).toBe(true);
        expect(tree.some(node => node.type === Outlet)).toBe(false);
    });
    it.each(["audio", "music"] as const)("native %s metadata cannot mount the browser-only workspace", kind => {
        const {project} = fixture("native");
        project.kind = kind;
        const tree = render(() => ProjectHomePage({projectId: project.id}), [{projectId: project.id, project}, {projectId: project.id, episode: null}]);
        expect(tree.some(node => node.type === WorkspaceCapabilityState)).toBe(true);
        expect(tree.some(node => node.type === AudioWorkspacePage || node.type === MusicWorkspacePage)).toBe(false);
    });
    it("native story and shot workbench query only the selected repository", async () => {
        const {project, episode, shot, repository} = fixture("native");
        const projectRead = vi.spyOn(db.projects, "get"); const episodeRead = vi.spyOn(db.episodes, "get"); const shotsRead = vi.spyOn(db.shots, "where");
        const story = render(() => scoped(StoryPage({projectId: project.id, episodeId: episode.id})), [project, episode, [], []]);
        expect(story.some(node => typeof node.type === "function" && node.type.name === "StoryEditor")).toBe(true);
        await Promise.all(host.queries.map(query => query()));
        host.cells = [];
        const shots = render(() => scoped(ShotEditorPage({projectId: project.id, episodeId: episode.id})), shotResults(project, episode, shot));
        expect(shots.some(node => node.type === "h1" && node.props.children === "分镜")).toBe(true);
        await Promise.all(host.queries.map(query => query()));
        expect(repository.project).toHaveBeenCalledWith(project.id);
        expect(repository.episode).toHaveBeenCalledWith(episode.id);
        expect(repository.shots).toHaveBeenCalledWith(episode.id);
        expect(projectRead).not.toHaveBeenCalled(); expect(episodeRead).not.toHaveBeenCalled(); expect(shotsRead).not.toHaveBeenCalled();
    });
    it("native text field saves retain the original scalar baselines", async () => {
        const {project, episode, shot, repository} = fixture("native");
        const beatField = BeatTextField({projectId: project.id, episodeId: episode.id, beat: episode.story.beats[0], field: "title"}) as ReactElement<Parameters<typeof TextDraftField>[0]>;
        const shotField = ShotTextField({shot, field: "content"}) as ReactElement<Parameters<typeof TextDraftField>[0]>;
        await beatField.props.persist("修改后", "开场"); await shotField.props.persist("新镜头", "旧镜头");
        expect(repository.patchStoryBeat).toHaveBeenCalledWith(episode.id, "beat", {title: "修改后"}, {title: "开场"});
        expect(repository.patchShot).toHaveBeenCalledWith(shot.id, {content: "新镜头"}, {content: "旧镜头"});
    });
    it("native media columns keep the shared row while generation data owners stay unmounted", () => {
        const {project, episode, shot} = fixture("native");
        const tree = render(() => ShotRow({shot, projectId: project.id, episodeId: episode.id, striped: false, initiallyVisible: true, selecting: false, selected: false, onSelectedChange: vi.fn(), onActivate: vi.fn(), workspaceView: "media", visibleDefs: [], characters: [], scenes: [], canMoveUp: false, canMoveDown: false, onMove: vi.fn(), onDuplicate: vi.fn(), onEditRelations: vi.fn(), onSlotOpenChange: vi.fn(), unavailable: false}));
        expect(tree.some(node => node.props["data-shot-mounted"] === "true")).toBe(true);
        expect(tree.filter(node => typeof node.type === "function" && node.type.name === "MediaSlotCapability")).toHaveLength(3);
        expect(tree.some(node => node.type === EditableGenerationSlot)).toBe(false);
        expect(tree.some(node => node.type === ShotTextField && node.props.field === "content")).toBe(true);
    });
    it("initial native read failure exposes recovery and later errors retain the shared workbench", () => {
        const {project, episode, shot} = fixture("native"); host.readError = "SQLite 工作区不可用";
        const failed = render(() => scoped(ShotEditorPage({projectId: project.id, episodeId: episode.id})));
        expect(failed.find(node => node.type === PageState)?.props.kind).toBe("error");
        host.cells = [];
        const retained = render(() => scoped(ShotEditorPage({projectId: project.id, episodeId: episode.id})), shotResults(project, episode, shot));
        expect(retained.some(node => node.type === VideoWorkspaceReadNotice && node.props.error === host.readError)).toBe(true);
        expect(retained.some(node => node.type === "h1" && node.props.children === "分镜")).toBe(true);
    });
    it("native scene-copy undo uses the committed inverse and does not delete from a page snapshot", async () => {
        const {project, episode, shot, repository} = fixture("native");
        const restore = vi.fn(async () => undefined);
        const deletes = {deleteShots: vi.fn(), deleteStoryBeat: vi.fn()};
        Object.assign(repository, deletes, {duplicateBeat: vi.fn(async () => ({beat: {...episode.story.beats[0], id: "copy"}, shots: [{...shot, id: "copy-shot"}], undo: {restore}}))});
        const story = render(() => scoped(StoryPage({projectId: project.id, episodeId: episode.id})), [project, episode, [], []]);
        const editor = story.find(node => typeof node.type === "function" && node.type.name === "StoryEditor");
        host.cells = [];
        const controls = render(() => scoped(editor));
        const copy = controls.find(node => node.props["aria-label"] === "复制场次及其镜头");
        (copy?.props.onClick as () => void)();
        await vi.waitFor(() => expect(host.registerUndo).toHaveBeenCalledOnce());
        await host.registerUndo.mock.calls[0][0].restore();
        expect(restore).toHaveBeenCalledOnce();
        expect(deletes.deleteShots).not.toHaveBeenCalled();
        expect(deletes.deleteStoryBeat).not.toHaveBeenCalled();
    });
    it("native shot-copy undo uses the committed inverse", async () => {
        const {project, episode, shot, repository} = fixture("native");
        const restore = vi.fn(async () => undefined);
        const deleteShots = vi.fn();
        Object.assign(repository, {deleteShots, duplicateShot: vi.fn(async () => ({...shot, id: "copy-shot", undo: {restore}}))});
        const tree = render(() => scoped(ShotEditorPage({projectId: project.id, episodeId: episode.id})), shotResults(project, episode, shot));
        const group = tree.find(node => typeof node.props.onDuplicateShot === "function");
        (group?.props.onDuplicateShot as (id: string) => void)(shot.id);
        await vi.waitFor(() => expect(host.registerUndo).toHaveBeenCalledOnce());
        await host.registerUndo.mock.calls[0][0].restore();
        expect(restore).toHaveBeenCalledOnce();
        expect(deleteShots).not.toHaveBeenCalled();
    });
});
